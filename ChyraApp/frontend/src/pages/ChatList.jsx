import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { chatService } from '../services/chatService';
import { userService } from '../services/userService';
import BottomNav from '../components/BottomNav';
import SearchBar from '../components/SearchBar';
import Loading from '../components/Loading';

export default function ChatList() {
  const [chats, setChats] = useState([]);
  const [filteredChats, setFilteredChats] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const { user } = useAuth();
  const { socket, isConnected, onlineUsers } = useSocket();
  const navigate = useNavigate();

  const currentUserId = user?._id || user?.id;

  useEffect(() => {
    loadChats();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message) => {
      setChats(prev => prev.map(chat => {
        if (chat._id === message.chat) {
          return {
            ...chat,
            lastMessage: message
          };
        }
        return chat;
      }));
    };

    socket.on('message:receive', handleNewMessage);

    return () => {
      socket.off('message:receive', handleNewMessage);
    };
  }, [socket]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredChats(chats);
    } else {
      const filtered = chats.filter(chat => {
        const otherUser = chat.participants?.find(p => p?.user?._id !== currentUserId);
        return otherUser?.user?.username?.toLowerCase().includes(searchQuery.toLowerCase());
      });
      setFilteredChats(filtered);
    }
  }, [searchQuery, chats, currentUserId]);

  const loadChats = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('🔵 Loading chats...');
      
      const chatsData = await chatService.getUserChats();
      console.log('✅ Chats loaded:', chatsData);
      
      const chatArray = Array.isArray(chatsData) ? chatsData : [];
      
      setChats(chatArray);
      setFilteredChats(chatArray);
    } catch (err) {
      console.error('❌ Load chats error:', err);
      setError(err.message || 'Failed to load chats. Please try again.');
      setChats([]);
      setFilteredChats([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const usersData = await userService.getAllUsers();
      const filteredUsers = Array.isArray(usersData) 
        ? usersData.filter(u => u._id !== currentUserId) 
        : [];
      setUsers(filteredUsers);
    } catch (err) {
      console.error('Failed to load users:', err);
      setError('Failed to load users');
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleNewChat = async () => {
    await loadUsers();
    setShowNewChat(true);
  };

  const handleStartChat = async (recipientId) => {
    try {
      const chat = await chatService.createChat(recipientId);
      setShowNewChat(false);
      if (chat && chat._id) {
        navigate(`/chat/${chat._id}`);
      }
    } catch (err) {
      console.error('Failed to create chat:', err);
      setError('Failed to create chat');
    }
  };

  const formatTime = (date) => {
    if (!date) return '';
    
    try {
      const now = new Date();
      const messageDate = new Date(date);
      const diffInHours = (now - messageDate) / (1000 * 60 * 60);

      if (diffInHours < 24) {
        return messageDate.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit' 
        });
      } else if (diffInHours < 48) {
        return 'Yesterday';
      } else {
        return messageDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        });
      }
    } catch (e) {
      return '';
    }
  };

  const checkIfUserIsOnline = (userId) => {
    if (!userId) return false;
    return Array.isArray(onlineUsers) && onlineUsers.includes(userId);
  };

  if (loading) {
    return <Loading message="Loading your chats..." />;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Chats</h1>
              {isConnected ? (
                <div className="flex items-center space-x-1 text-green-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs">Online</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-gray-400">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  <span className="text-xs">Connecting...</span>
                </div>
              )}
            </div>
            <button
              onClick={handleNewChat}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-full hover:from-purple-700 hover:to-pink-700 transition duration-200 shadow-md flex items-center space-x-2 hover-lift"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>New</span>
            </button>
          </div>

          <SearchBar 
            onSearch={setSearchQuery}
            placeholder="Search chats..."
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 mx-4 mt-4 animate-slideDown">
          <div className="flex items-center justify-between">
            <p className="text-red-700 dark:text-red-400">{error}</p>
            <button 
              onClick={() => {
                setError('');
                loadChats();
              }}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-20">
        {filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            {searchQuery ? (
              <>
                <svg className="w-24 h-24 text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">No chats found</h2>
                <p className="text-gray-500 dark:text-gray-500">Try a different search term</p>
              </>
            ) : (
              <>
                <svg className="w-24 h-24 text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">No chats yet</h2>
                <p className="text-gray-500 dark:text-gray-500 mb-4">Start a conversation by clicking "New Chat"</p>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredChats.map((chat) => {
              if (!chat || !chat.participants) return null;
              
              const otherUser = chat.participants.find(p => p?.user?._id !== currentUserId)?.user;
              if (!otherUser) return null;
              
              const isOnline = checkIfUserIsOnline(otherUser._id);
              
              return (
                <div
                  key={chat._id}
                  onClick={() => navigate(`/chat/${chat._id}`)}
                  className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-all duration-150 p-4 hover-lift animate-slideUp"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0 relative">
                      <div className="avatar avatar-md avatar-gradient shadow-md">
                        {otherUser.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                      {isOnline && (
                        <div className="status-online absolute bottom-0 right-0"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {otherUser.username || 'Unknown User'}
                        </h3>
                        {chat.lastMessage && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatTime(chat.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      {chat.lastMessage && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                          {chat.lastMessage.sender === currentUserId ? 'You: ' : ''}
                          {chat.lastMessage.content || '📷 Photo'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showNewChat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden shadow-2xl animate-scaleIn">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">New Chat</h2>
              <button
                onClick={() => setShowNewChat(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh]">
              {loadingUsers ? (
                <div className="flex items-center justify-center py-12">
                  <div className="spinner"></div>
                  <p className="ml-3 text-gray-600 dark:text-gray-400">Loading users...</p>
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">No users available</p>
                  <button
                    onClick={() => navigate('/find-friends')}
                    className="btn-primary"
                  >
                    Find Friends
                  </button>
                </div>
              ) : (
                users.map((u) => {
                  if (!u) return null;
                  const isUserOnline = checkIfUserIsOnline(u._id);
                  
                  return (
                    <div
                      key={u._id}
                      onClick={() => handleStartChat(u._id)}
                      className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 flex items-center space-x-3 transition"
                    >
                      <div className="relative">
                        <div className="avatar avatar-md avatar-gradient">
                          {u.username?.charAt(0).toUpperCase() || '?'}
                        </div>
                        {isUserOnline && (
                          <div className="status-online absolute bottom-0 right-0"></div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{u.username || 'Unknown'}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {isUserOnline ? (
                            <span className="text-green-500">Online</span>
                          ) : (
                            'Offline'
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}