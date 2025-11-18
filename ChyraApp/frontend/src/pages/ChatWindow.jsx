import './ChatWindowBuildMarker';
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { chatService } from '../services/chatService';
import { messageService } from '../services/messageService';
import { uploadService } from '../services/uploadService';
import groupService from '../services/groupService';
import MessageActions from '../components/MessageActions';
import MessageAttachment from '../components/MessageAttachment';
import MessageReactionBubble from '../components/MessageReactionsBubble';
import ReactionPicker from '../components/ReactionPicker';
import GroupInfoModal from '../components/GroupInfoModal';
import AddMembersModal from '../components/AddMembersModal';

export default function ChatWindow() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, isConnected, onlineUsers } = useSocket();

  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);

  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionPickerMessage, setReactionPickerMessage] = useState(null);
  const [reactionPickerPosition, setReactionPickerPosition] = useState(null);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messageIdsRef = useRef(new Set());
  const messageRefs = useRef({});
  const longPressTimer = useRef(null);
  const prevMessagesLengthRef = useRef(0);

  const currentUserId = user?._id || user?.id;

  // Check if this is a group chat
  const isGroup = chat?.isGroup || false;

  // Get group info or other user info
  const otherUser = !isGroup ? chat?.participants?.find(p => {
    const participantUserId = p?.user?._id || p?.user?.id;
    return participantUserId && participantUserId !== currentUserId;
  })?.user : null;

  const otherUserId = otherUser?._id || otherUser?.id;
  const isOtherUserOnline = otherUser && Array.isArray(onlineUsers) && onlineUsers.includes(otherUserId);

  // Check if current user is admin in group
  const isAdmin = isGroup && chat?.participants?.some(p => {
    const participantId = p.user?._id || p.user?.id || p.user;
    return participantId?.toString() === currentUserId?.toString() && p.role === 'admin' && p.isActive;
  });

  // Check if current user is creator
  const isCreator = isGroup && (chat?.createdBy?._id || chat?.createdBy)?.toString() === currentUserId?.toString();

  const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '🙏', '👍'];

  const handleLongPressStart = (e, message) => {
    e.preventDefault();
    const touch = e.touches ? e.touches[0] : e;

    longPressTimer.current = setTimeout(() => {
      setReactionPickerMessage(message);
      setReactionPickerPosition({
        top: touch.clientY - 60,
        left: touch.clientX
      });
      setShowReactionPicker(true);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleReplyToMessage = (message) => {
    setReplyingTo(message);
    setContextMenu(null);
    setTimeout(() => {
      const input = document.querySelector('input[type="text"]');
      if (input) input.focus();
    }, 100);
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const handleReaction = async (emoji) => {
    try {
      const messageId = reactionPickerMessage?._id || contextMenu?.message?._id;
      if (!messageId) return;

      console.log('Adding reaction:', { messageId, emoji });
      const response = await messageService.addReaction(messageId, emoji);
      console.log('Reaction API response:', response);

      if (response?.data?.reactions) {
        setMessages(prev => prev.map(msg => {
          if (msg._id === messageId) {
            console.log('Updating message with reactions:', response.data.reactions);
            return { ...msg, reactions: response.data.reactions };
          }
          return msg;
        }));
      }

      setShowReactionPicker(false);
      setReactionPickerMessage(null);
      setContextMenu(null);
      setShowEmojiPicker(null);
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  };

  const handleCopyMessage = (message) => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      setContextMenu(null);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (confirm('Delete this message?')) {
      try {
        if (isGroup) {
          await groupService.deleteMessage(chatId, messageId);
        } else {
          await messageService.deleteMessage(messageId, false);
        }

        setMessages(prev => prev.filter(m => m._id !== messageId));
        setContextMenu(null);
      } catch (error) {
        console.error('Failed to delete message:', error);
        alert('Failed to delete message. Please try again.');
      }
    }
  };

  const scrollToMessage = (messageId) => {
    const messageElement = messageRefs.current[messageId];
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      messageElement.classList.add('highlight-message');
      setTimeout(() => {
        messageElement.classList.remove('highlight-message');
      }, 2000);
    }
  };

  const getRepliedMessage = (replyToId) => {
    return messages.find(m => m._id === replyToId);
  };

  const getMessageStatus = (message) => {
    if (!message || (message.sender?._id || message.sender) !== currentUserId) {
      return null;
    }

    const readBy = message.readBy || [];
    const deliveredTo = message.deliveredTo || [];

    const isRead = readBy.some(r => {
      const readUserId = r?.user?._id || r?.user || r;
      return readUserId === otherUserId;
    });

    const isDelivered = deliveredTo.some(d => {
      const deliveredUserId = d?.user?._id || d?.user || d;
      return deliveredUserId === otherUserId;
    });

    if (isRead) {
      return 'read';
    } else if (isDelivered) {
      return 'delivered';
    } else {
      return 'sent';
    }
  };

  const renderStatusIcon = (status) => {
    if (!status) return null;

    if (status === 'read') {
      return (
        <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
          <path d="M12.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-1-1a1 1 0 011.414-1.414l.293.293 7.293-7.293a1 1 0 011.414 0z" />
        </svg>
      );
    } else if (status === 'delivered') {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
          <path d="M12.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-1-1a1 1 0 011.414-1.414l.293.293 7.293-7.293a1 1 0 011.414 0z" />
        </svg>
      );
    } else {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
        </svg>
      );
    }
  };

  const getDateSeparator = (date) => {
    const messageDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    messageDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);

    if (messageDate.getTime() === today.getTime()) {
      return 'Today';
    } else if (messageDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    } else {
      return messageDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: messageDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const shouldShowDateSeparator = (currentMsg, previousMsg) => {
    if (!previousMsg) return true;

    const currentDate = new Date(currentMsg.createdAt);
    const previousDate = new Date(previousMsg.createdAt);

    currentDate.setHours(0, 0, 0, 0);
    previousDate.setHours(0, 0, 0, 0);

    return currentDate.getTime() !== previousDate.getTime();
  };

  const formatLastSeen = (lastSeenDate) => {
    if (!lastSeenDate) return 'Offline';

    const lastSeen = new Date(lastSeenDate);
    const now = new Date();
    const diffMs = now - lastSeen;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'a moment ago';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return lastSeen.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getSenderInfo = (message) => {
    const senderId = message.sender?._id || message.sender;

    if (senderId === currentUserId) {
      return { name: 'You', fullName: user?.fullName || user?.username };
    }

    if (isGroup) {
      const sender = chat?.participants?.find(p => {
        const pId = p.user?._id || p.user;
        return pId?.toString() === senderId?.toString();
      })?.user;

      return {
        name: sender?.username || sender?.fullName || 'Unknown',
        fullName: sender?.fullName || sender?.username || 'Unknown'
      };
    }

    return {
      name: otherUser?.username || otherUser?.fullName || 'Unknown',
      fullName: otherUser?.fullName || otherUser?.username || 'Unknown'
    };
  };

  useEffect(() => {
    const loadChatData = async () => {
      try {
        setLoading(true);

        const chatData = isGroup ?
          await groupService.getGroupById(chatId) :
          await chatService.getChatById(chatId);

        setChat(chatData);

        const messagesData = await messageService.getMessages(chatId);

        const validMessages = (
          Array.isArray(messagesData)
            ? messagesData
            : (messagesData?.data?.messages || messagesData?.messages || [])
        ).filter(msg => msg && msg._id);

        setMessages(validMessages);
        messageIdsRef.current = new Set(validMessages.map(m => m._id));
        prevMessagesLengthRef.current = validMessages.length;

      } catch (error) {
        console.error('[ERROR] Error loading chat:', error);
        if (error.response?.status === 404) {
          navigate('/chats');
        }
      } finally {
        setLoading(false);
      }
    };

    if (chatId) {
      loadChatData();
    }

    return () => {
      messageIdsRef.current.clear();
    };
  }, [chatId, navigate, isGroup]);

  useEffect(() => {
    if (!socket || !isConnected || !chatId) {
      return;
    }

    socket.emit('conversation:join', { conversationId: chatId });

    const handleNewMessage = (data) => {
      const message = data.message || data;
      const messageConversationId = message.conversation || message.chat || data.conversationId;

      if (messageConversationId === chatId) {
        if (messageIdsRef.current.has(message._id)) {
          return;
        }

        messageIdsRef.current.add(message._id);

        setMessages(prev => {
          if (prev.some(m => m._id === message._id)) {
            return prev;
          }
          return [...prev, message];
        });

        const senderId = message.sender?._id || message.sender;
        if (senderId && senderId !== currentUserId && socket && isConnected) {
          socket.emit('message:read', {
            messageId: message._id,
            conversationId: chatId
          });
        }
      }
    };

    const handleMessageDelivered = (data) => {
      const { messageId, userId } = data;

      setMessages(prev => prev.map(msg => {
        if (msg._id === messageId) {
          const deliveredTo = msg.deliveredTo || [];
          if (!deliveredTo.some(d => (d?.user?._id || d?.user || d) === userId)) {
            return {
              ...msg,
              deliveredTo: [...deliveredTo, { user: userId, deliveredAt: Date.now() }]
            };
          }
        }
        return msg;
      }));
    };

    const handleMessageRead = (data) => {
      const { messageId, userId } = data;

      setMessages(prev => prev.map(msg => {
        if (msg._id === messageId) {
          const readBy = msg.readBy || [];
          if (!readBy.some(r => (r?.user?._id || r?.user || r) === userId)) {
            return {
              ...msg,
              readBy: [...readBy, { user: userId, readAt: Date.now() }]
            };
          }
        }
        return msg;
      }));
    };

    const handleUserTyping = (data) => {
      const { userId, conversationId } = data;
      if (conversationId === chatId && userId !== currentUserId) {
        setOtherUserTyping(true);
      }
    };

    const handleUserStopTyping = (data) => {
      const { userId, conversationId } = data;
      if (conversationId === chatId && userId !== currentUserId) {
        setOtherUserTyping(false);
      }
    };

    const handleReactionAdded = (data) => {
      console.log('🎉 Reaction received:', data);
      setMessages(prev => {
        const updated = prev.map(msg => {
          if (msg._id === data.messageId) {
            const updatedMsg = { ...msg, reactions: data.reactions };
            console.log('✅ Updated message:', updatedMsg);
            return updatedMsg;
          }
          return msg;
        });
        return updated;
      });
    };

    const handleMessageDeleted = (data) => {
      console.log('🗑️ Message deleted:', data);
      if (data.conversationId === chatId) {
        setMessages(prev => prev.filter(m => m._id !== data.messageId));
      }
    };

    const handleGroupUpdated = (updatedGroup) => {
      if (updatedGroup._id === chatId) {
        setChat(updatedGroup);
      }
    };

    socket.on('message:receive', handleNewMessage);
    socket.on('message:delivered', handleMessageDelivered);
    socket.on('message:read', handleMessageRead);
    socket.on('user:typing', handleUserTyping);
    socket.on('user:stop_typing', handleUserStopTyping);
    socket.on('message:reaction_added', handleReactionAdded);
    socket.on('message:deleted', handleMessageDeleted);
    socket.on('group:updated', handleGroupUpdated);

    return () => {
      socket.emit('conversation:leave', { conversationId: chatId });
      socket.off('message:receive', handleNewMessage);
      socket.off('message:delivered', handleMessageDelivered);
      socket.off('message:read', handleMessageRead);
      socket.off('user:typing', handleUserTyping);
      socket.off('user:stop_typing', handleUserStopTyping);
      socket.off('message:reaction_added', handleReactionAdded);
      socket.off('message:deleted', handleMessageDeleted);
      socket.off('group:updated', handleGroupUpdated);
    };
  }, [socket, isConnected, chatId, currentUserId, otherUserId]);

  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

  const handleTypingInput = (e) => {
    setNewMessage(e.target.value);

    if (!socket || !isConnected || !chatId) return;

    if (!typing) {
      setTyping(true);
      socket.emit('user:typing', { conversationId: chatId, userId: currentUserId });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setTyping(false);
      socket.emit('user:stop_typing', { conversationId: chatId, userId: currentUserId });
    }, 1000);
  };

  const sendMessage = async (e) => {
    e?.preventDefault();

    const messageContent = newMessage.trim();
    if ((!messageContent && attachments.length === 0) || sending) {
      return;
    }

    try {
      setSending(true);

      const conversationIdString = typeof chatId === 'string' ? chatId : String(chatId);

      let messageData;

      if (attachments.length > 0) {
        messageData = {
          conversationId: conversationIdString,
          content: messageContent,
          type: attachments.length > 1 ? 'media_group' : attachments[0].type,
          mediaGroup: attachments.map(att => ({
            type: att.type,
            url: att.url,
            filename: att.name,
            size: att.size,
            mimeType: att.mimeType
          }))
        };
      } else {
        messageData = {
          conversationId: conversationIdString,
          content: messageContent,
          type: 'text'
        };
      }

      if (replyingTo) {
        messageData.replyTo = replyingTo._id;
      }

      const sentMessage = await messageService.sendMessage(messageData);

      if (sentMessage && sentMessage._id) {
        if (!messageIdsRef.current.has(sentMessage._id)) {
          messageIdsRef.current.add(sentMessage._id);

          setMessages(prev => {
            if (prev.some(m => m._id === sentMessage._id)) {
              return prev;
            }
            return [...prev, sentMessage];
          });
        }
      }

      setNewMessage('');
      setAttachments([]);
      setReplyingTo(null);
      setTyping(false);

      if (socket && isConnected) {
        socket.emit('user:stop_typing', { conversationId: chatId, userId: currentUserId });
      }

    } catch (error) {
      console.error('[ERROR] Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      setUploading(true);

      const uploadedFiles = [];

      for (const file of files) {
        const result = await uploadService.uploadFile(file);

        uploadedFiles.push({
          type: file.type.startsWith('image/') ? 'image' :
            file.type.startsWith('video/') ? 'video' : 'file',
          url: result.url,
          name: file.name,
          size: file.size,
          mimeType: file.type
        });
      }

      setAttachments(prev => [...prev, ...uploadedFiles]);

    } catch (error) {
      console.error('[ERROR] Error uploading files:', error);
      alert('Failed to upload files. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading chat...</p>
        </div>
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Chat not found</p>
          <button
            onClick={() => navigate('/chats')}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition"
          >
            Back to Chats
          </button>
        </div>
      </div>
    );
  };

  const renderHeader = () => {
    if (isGroup) {
      const activeMembers = chat.participants?.filter(p => p.isActive) || [];
      const memberCount = activeMembers.length;

      return (
        <>
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-2xl shadow-lg flex-shrink-0">
            {chat.avatar || '👥'}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-white truncate">
              {chat.name || 'Unnamed Group'}
            </h1>
            <p className="text-sm text-gray-400">
              {memberCount} member{memberCount !== 1 ? 's' : ''}
            </p>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
            {otherUser?.fullName?.[0]?.toUpperCase() ||
              otherUser?.username?.[0]?.toUpperCase() || '?'}
          </div>
          {isOtherUserOnline && (
            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-gray-800 rounded-full"></div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-white truncate">
            {otherUser?.fullName || otherUser?.username || 'Unknown User'}
          </h1>
          <p className="text-sm text-gray-400">
            {otherUserTyping ? (
              <span className="text-purple-400 italic">typing...</span>
            ) : isOtherUserOnline ? (
              <span className="text-purple-300">Online</span>
            ) : otherUser?.lastSeen ? (
              <span>Last seen {formatLastSeen(otherUser.lastSeen)}</span>
            ) : (
              <span>Offline</span>
            )}
          </p>
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none z-0"
        style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, rgba(139, 92, 246, 0.3) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}
      ></div>

      {/* FIXED HEADER */}
      <div className="flex-shrink-0 bg-gray-800/95 backdrop-blur-sm border-b border-gray-700 shadow-lg fixed top-0 left-0 right-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <button
                onClick={() => navigate(isGroup ? '/groups' : '/chats')}
                className="p-2 hover:bg-gray-700 rounded-full transition flex-shrink-0"
              >
                <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {renderHeader()}
            </div>

            <div className="flex items-center space-x-2 ml-3">
              {/* Add Member Button (Admin Only) */}
              {isGroup && isAdmin && (
                <button
                  onClick={() => setShowAddMembers(true)}
                  className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full transition shadow-lg"
                  title="Add Members"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </button>
              )}

              {/* Three Dots Menu (Admin/Creator) */}
              {isGroup && (isAdmin || isCreator) && (
                <button
                  onClick={() => setShowGroupInfo(true)}
                  className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full transition shadow-lg"
                  title="Group Options"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MESSAGES - with padding for fixed header/footer */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-3 py-4 space-y-3 relative z-10"
        style={{
          paddingTop: '80px',
          paddingBottom: '120px',
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <svg className="w-20 h-20 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-lg font-medium">No messages yet</p>
            <p className="text-sm text-gray-600">
              {isGroup ? 'Be the first to send a message in this group' : 'Send a message to start the conversation'}
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isOwn = (message.sender?._id || message.sender) === currentUserId;
            const senderInfo = getSenderInfo(message);

            const showAvatar = !isOwn && (
              index === messages.length - 1 ||
              (messages[index + 1]?.sender?._id || messages[index + 1]?.sender) !== (message.sender?._id || message.sender)
            );

            const mediaItems = message.mediaGroup && message.mediaGroup.length > 0
              ? message.mediaGroup
              : message.media
                ? [message.media]
                : [];

            const showDateSeparator = shouldShowDateSeparator(message, messages[index - 1]);
            const messageStatus = getMessageStatus(message);
            const repliedMessage = message.replyTo ? getRepliedMessage(message.replyTo) : null;

            return (
              <div
                key={message._id || `msg-${index}`}
                ref={el => messageRefs.current[message._id] = el}
                className={`${message.reactions && message.reactions.length > 0 ? 'mb-5' : 'mb-2'}`}
              >
                {showDateSeparator && (
                  <div className="flex items-center justify-center my-4">
                    <div className="bg-gray-700/50 px-3 py-1 rounded-full">
                      <span className="text-xs text-gray-300 font-medium">
                        {getDateSeparator(message.createdAt)}
                      </span>
                    </div>
                  </div>
                )}

                <div className={`flex items-end space-x-2 ${isOwn ? 'justify-end' : 'justify-start'} ${isOwn ? 'pr-2' : 'pl-2'}`}>
                  {!isOwn && (
                    <div className="flex-shrink-0 w-8 h-8">
                      {showAvatar && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                          {senderInfo.fullName?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                  )}

                  <div
                    className={`max-w-[75%] ${isOwn ? 'ml-auto' : 'mr-auto'}`}
                    onMouseDown={(e) => handleLongPressStart(e, message)}
                    onMouseUp={handleLongPressEnd}
                    onMouseLeave={handleLongPressEnd}
                    onTouchStart={(e) => handleLongPressStart(e, message)}
                    onTouchEnd={handleLongPressEnd}
                    onTouchCancel={handleLongPressEnd}
                  >
                    <div className="relative inline-block">
                      {isGroup && !isOwn && (
                        <p className="text-xs text-purple-400 font-medium mb-1 px-1">
                          {senderInfo.name}
                        </p>
                      )}

                      <div className={`rounded-2xl px-4 py-2.5 shadow-md ${isOwn ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white rounded-br-sm' : 'bg-gray-700 text-gray-100 rounded-bl-sm'
                        }`}>

                        {repliedMessage && (
                          <div
                            onClick={() => scrollToMessage(repliedMessage._id)}
                            className={`mb-2 p-2 rounded-lg border-l-4 cursor-pointer hover:opacity-80 transition ${isOwn
                                ? 'bg-purple-800/30 border-purple-300'
                                : 'bg-gray-600/50 border-gray-400'
                              }`}
                          >
                            <p className="text-xs opacity-75 mb-1">
                              {(repliedMessage.sender?._id || repliedMessage.sender) === currentUserId ? 'You' : getSenderInfo(repliedMessage).name}
                            </p>
                            <p className="text-sm line-clamp-2 opacity-90">
                              {repliedMessage.content || '📷 Photo'}
                            </p>
                          </div>
                        )}

                        {message.content && (
                          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                            {message.content}
                          </p>
                        )}

                        {mediaItems.length > 0 && (
                          <div className={`${message.content ? 'mt-2' : ''} space-y-2`}>
                            {mediaItems.map((attachment, idx) => (
                              <MessageAttachment key={idx} attachment={attachment} isSender={isOwn} />
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-end space-x-1 mt-1">
                          <span className="text-xs opacity-70">
                            {message.createdAt ? new Date(message.createdAt).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            }) : ''}
                          </span>

                          {isOwn && messageStatus && (
                            <div className="flex items-center">
                              {renderStatusIcon(messageStatus)}
                            </div>
                          )}
                        </div>
                      </div>

                      {message.reactions && message.reactions.length > 0 && (
                        <MessageReactionBubble
                          reactions={message.reactions}
                          currentUserId={currentUserId}
                          isOwn={isOwn}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reaction Picker */}
      {showReactionPicker && reactionPickerMessage && (
        <ReactionPicker
          message={reactionPickerMessage}
          onReact={handleReaction}
          onClose={() => {
            setShowReactionPicker(false);
            setReactionPickerMessage(null);
          }}
          position={reactionPickerPosition}
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-[90]"
            onClick={() => setContextMenu(null)}
          />

          <div
            className="fixed z-[100] bg-gray-800 rounded-lg shadow-2xl border border-gray-700 animate-scaleIn"
            style={{
              top: `${contextMenu.position.y}px`,
              left: `${contextMenu.position.x}px`,
              transform: 'translate(-50%, -100%)',
              marginTop: '-10px'
            }}
          >
            <div className="flex items-center space-x-2 p-3 border-b border-gray-700">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className="text-2xl hover:scale-125 transition-transform p-1"
                >
                  {emoji}
                </button>
              ))}
              <button
                onClick={() => setShowEmojiPicker(contextMenu.message._id)}
                className="text-2xl hover:scale-125 transition-transform p-1 text-gray-400"
              >
                ➕
              </button>
            </div>

            <div className="py-1">
              <button
                onClick={() => handleReplyToMessage(contextMenu.message)}
                className="w-full px-4 py-2.5 text-left flex items-center space-x-3 hover:bg-gray-700 text-gray-200 transition"
              >
                <span className="text-lg">↩️</span>
                <span className="text-sm font-medium">Reply</span>
              </button>

              <button
                onClick={() => handleCopyMessage(contextMenu.message)}
                className="w-full px-4 py-2.5 text-left flex items-center space-x-3 hover:bg-gray-700 text-gray-200 transition"
                disabled={!contextMenu.message.content}
              >
                <span className="text-lg">📋</span>
                <span className="text-sm font-medium">Copy</span>
              </button>

              <button
                onClick={() => handleDeleteMessage(contextMenu.message._id)}
                className="w-full px-4 py-2.5 text-left flex items-center space-x-3 hover:bg-red-500/20 text-red-400 transition"
              >
                <span className="text-lg">🗑️</span>
                <span className="text-sm font-medium">Delete</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* FIXED INPUT AREA */}
      <div className="flex-shrink-0 bg-gray-800/95 backdrop-blur-sm border-t border-gray-700 px-4 py-3 shadow-2xl fixed bottom-0 left-0 right-0 z-40">
        {replyingTo && (
          <div className="mb-3 p-3 bg-gray-700 rounded-lg flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                <span className="text-sm text-purple-400 font-medium">
                  Replying to {(replyingTo.sender?._id || replyingTo.sender) === currentUserId ? 'yourself' : getSenderInfo(replyingTo).name}
                </span>
              </div>
              <p className="text-sm text-gray-300 line-clamp-2">
                {replyingTo.content || '📷 Photo'}
              </p>
            </div>
            <button
              onClick={cancelReply}
              className="ml-2 p-1 hover:bg-gray-600 rounded-full transition flex-shrink-0"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="flex items-center space-x-2 mb-3 overflow-x-auto pb-2">
            {attachments.map((attachment, index) => (
              <div key={index} className="relative flex-shrink-0">
                {attachment.type === 'image' ? (
                  <img src={attachment.url} alt={attachment.name || 'Attachment'} className="w-16 h-16 object-cover rounded-lg" />
                ) : attachment.type === 'video' ? (
                  <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center">
                    <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                <button onClick={() => removeAttachment(index)} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-xs font-bold transition">×</button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={sendMessage} className="flex items-end space-x-2">
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="p-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-full transition flex-shrink-0 shadow-lg">
            {uploading ? (
              <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            )}
          </button>
          <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx" onChange={handleFileSelect} className="hidden" />

          <div className="flex-1 bg-gray-700 rounded-full px-5 py-3 shadow-inner">
            <input
              type="text"
              value={newMessage}
              onChange={handleTypingInput}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(e);
                }
              }}
              placeholder={replyingTo ? "Type your reply..." : "Type a message..."}
              className="w-full bg-transparent text-white placeholder-gray-400 focus:outline-none"
              disabled={sending}
            />
          </div>

          <button type="submit" disabled={(!newMessage.trim() && attachments.length === 0) || sending} className="p-3 bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-full transition flex-shrink-0 shadow-lg">
            {sending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </form>

        {!isConnected && (
          <div className="absolute top-0 left-0 right-0 bg-red-500/90 text-white text-xs text-center py-1">Reconnecting...</div>
        )}
      </div>

      {/* Modals */}
      {showAddMembers && (
        <AddMembersModal
          group={chat}
          onClose={() => setShowAddMembers(false)}
          onMembersAdded={(updatedGroup) => {
            setChat(updatedGroup);
            setShowAddMembers(false);
          }}
        />
      )}

      {showGroupInfo && isGroup && (
        <GroupInfoModal
          group={chat}
          onClose={() => setShowGroupInfo(false)}
          onGroupUpdated={(updatedGroup) => {
            setChat(updatedGroup);
          }}
          onGroupDeleted={() => {
            navigate('/groups');
          }}
        />
      )}

      <style>{`
        .highlight-message {
          animation: highlight 2s ease-in-out;
        }
        
        @keyframes highlight {
          0%, 100% {
            background-color: transparent;
          }
          50% {
            background-color: rgba(139, 92, 246, 0.2);
          }
        }

        .animate-scaleIn {
          animation: scaleIn 0.15s ease-out;
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: translate(-50%, -100%) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -100%) scale(1);
          }
        }
      `}</style>
    </div>
  );
}