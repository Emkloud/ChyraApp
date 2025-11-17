import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import notificationService from '../services/notificationService';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const { user } = useAuth();
  const socketRef = useRef(null);
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    const userId = user?._id || user?.id;
    console.log('🔍 SocketContext initializing');
    console.log('   - User exists:', !!user);
    console.log('   - User ID:', userId);
    
    if (socketRef.current) {
      console.log('🧹 Cleaning up existing socket');
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      setConnectionStatus('disconnected');
    }

    if (!user) {
      console.warn('⚠️ No user found, skipping socket connection');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      console.error('❌ No authentication token found');
      return;
    }

    console.log('✅ Token found, initializing connection');

    const SOCKET_URL = window.location.hostname.includes('chyraapp.com')
      ? 'https://api.chyraapp.com'
      : 'http://localhost:5000';

    console.log('🔌 Connecting to:', SOCKET_URL);
    setConnectionStatus('connecting');

    try {
      const newSocket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10,
        timeout: 20000
      });

      socketRef.current = newSocket;
      window.socket = newSocket;

      newSocket.on('connect', () => {
        console.log('✅ Socket connected successfully');
        console.log('   - Socket ID:', newSocket.id);
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;
        
        console.log('📤 Sending user:online event');
        newSocket.emit('user:online');
      });

      newSocket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected');
        console.log('   - Reason:', reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
      });

      newSocket.on('connect_error', (error) => {
        reconnectAttempts.current++;
        console.error('❌ Connection error #' + reconnectAttempts.current);
        console.error('   - Message:', error.message);
        setIsConnected(false);
        setConnectionStatus('error');
      });

      newSocket.on('error', (error) => {
        console.error('❌ Socket error:', error);
      });

      newSocket.on('reconnect', (attemptNumber) => {
        console.log('🔄 Reconnected after', attemptNumber, 'attempts');
      });

      newSocket.on('reconnect_attempt', (attemptNumber) => {
        console.log('🔄 Reconnection attempt', attemptNumber);
      });

      newSocket.on('reconnect_error', (error) => {
        console.error('❌ Reconnection error:', error);
      });

      newSocket.on('reconnect_failed', () => {
        console.error('❌ Reconnection failed completely');
        setConnectionStatus('error');
      });

      newSocket.on('users:online', (userIds) => {
        console.log('📡 Received online users list:', userIds);
        console.log('   - Count:', userIds.length);
        console.log('   - User IDs:', userIds);
        setOnlineUsers(userIds);
        window.onlineUsers = userIds;
      });

      newSocket.on('user:online', ({ userId }) => {
        console.log('👤 User came online:', userId);
        setOnlineUsers(prev => {
          if (!prev.includes(userId)) {
            const updated = [...prev, userId];
            console.log('   - Updated online users:', updated);
            return updated;
          }
          return prev;
        });
      });

      newSocket.on('user:offline', ({ userId }) => {
        console.log('👤 User went offline:', userId);
        setOnlineUsers(prev => {
          const updated = prev.filter(id => id !== userId);
          console.log('   - Updated online users:', updated);
          return updated;
        });
      });

      newSocket.on('message:receive', (message) => {
        console.log('📨 Received message:', message._id);
        const senderId = message.sender?._id || message.sender;
        if (senderId !== userId) {
          const senderName = message.sender?.username || message.sender?.fullName || 'Someone';
          notificationService.notifyNewMessage(
            senderName,
            message.content,
            message.chat
          );
        }
      });

      newSocket.on('friend_request_received', (request) => {
        console.log('👥 Friend request received');
        const senderName = request.sender?.username || request.sender?.fullName || 'Someone';
        notificationService.notifyFriendRequest(senderName);
      });

      newSocket.on('group_message', (message) => {
        console.log('👥 Group message received');
        const senderId = message.sender?._id || message.sender;
        if (senderId !== userId) {
          const senderName = message.sender?.username || message.sender?.fullName || 'Someone';
          notificationService.notifyGroupMessage(
            message.groupName,
            senderName,
            message.content,
            message.groupId
          );
        }
      });

      setSocket(newSocket);
      console.log('✅ Socket instance created and stored');

    } catch (error) {
      console.error('❌ Fatal error creating socket:', error);
      setConnectionStatus('error');
    }

    return () => {
      console.log('🧹 SocketContext cleanup - disconnecting');
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      setConnectionStatus('disconnected');
      setOnlineUsers([]);
    };
  }, [user]);

  const emitTyping = (conversationId) => {
    if (socket && isConnected) {
      console.log('⌨️ Emitting typing for conversation:', conversationId);
      socket.emit('user:typing', { conversationId });
    } else {
      console.warn('⚠️ Cannot emit typing - socket not connected');
    }
  };

  const emitStopTyping = (conversationId) => {
    if (socket && isConnected) {
      console.log('⏸️ Emitting stop typing for conversation:', conversationId);
      socket.emit('user:stop_typing', { conversationId });
    }
  };

  const joinConversation = (conversationId) => {
    if (socket && isConnected) {
      console.log('🚪 Joining conversation:', conversationId);
      socket.emit('conversation:join', { conversationId });
    } else {
      console.warn('⚠️ Cannot join conversation - socket not connected');
    }
  };

  const leaveConversation = (conversationId) => {
    if (socket && isConnected) {
      console.log('🚪 Leaving conversation:', conversationId);
      socket.emit('conversation:leave', { conversationId });
    }
  };

  const sendMessage = (messageData) => {
    if (socket && isConnected) {
      console.log('📤 Sending message via socket');
      socket.emit('message:send', messageData);
      notificationService.notifyMessageSent();
    } else {
      console.error('❌ Cannot send message - socket not connected');
    }
  };

  const markMessageAsRead = (messageId, conversationId) => {
    if (socket && isConnected) {
      console.log('👁️ Marking message as read:', messageId);
      socket.emit('message:read', { messageId, conversationId });
    }
  };

  const joinGroup = (groupId) => {
    if (socket && isConnected) {
      console.log('👥 Joining group:', groupId);
      socket.emit('join_group', { groupId });
    }
  };

  const leaveGroup = (groupId) => {
    if (socket && isConnected) {
      console.log('👥 Leaving group:', groupId);
      socket.emit('leave_group', { groupId });
    }
  };

  const sendGroupMessage = (groupId, message) => {
    if (socket && isConnected) {
      console.log('👥 Sending group message');
      socket.emit('group_message', { groupId, message });
      notificationService.notifyMessageSent();
    }
  };

  console.log('🔍 SocketProvider render state:');
  console.log('   - Connected:', isConnected);
  console.log('   - Status:', connectionStatus);
  console.log('   - Online users count:', onlineUsers.length);

  const value = {
    socket,
    isConnected,
    connectionStatus,
    onlineUsers,
    emitTyping,
    emitStopTyping,
    joinConversation,
    leaveConversation,
    sendMessage,
    markMessageAsRead,
    joinGroup,
    leaveGroup,
    sendGroupMessage
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};