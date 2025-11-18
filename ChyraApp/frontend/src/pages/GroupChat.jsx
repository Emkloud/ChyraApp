import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { groupService } from '../services/groupService';
import { useToast } from '../components/Toast';
import Loading from '../components/Loading';
import EmojiPicker from 'emoji-picker-react';
import CreateSubgroupModal from '../components/CreateSubgroupModal';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function GroupChat() {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showGroupOptions, setShowGroupOptions] = useState(false);
  const [showSubgroupModal, setShowSubgroupModal] = useState(false);
  const [subgroups, setSubgroups] = useState([]);
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const token = localStorage.getItem('token');

  // Load initial data
  useEffect(() => {
    loadGroup();
    loadMessages();
    loadSubgroups();
  }, [groupId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Socket listeners for real-time messages
  useEffect(() => {
    if (!socket || !isConnected) {
      console.log('[SOCKET] Not connected, skipping listeners');
      return;
    }

    console.log('[SOCKET] Setting up message listeners for group:', groupId);

    const handleNewMessage = (message) => {
      console.log('[SOCKET] New message received:', message);
      
      const messageConversation = message.conversation || message.chat;
      if (messageConversation !== groupId) {
        console.log('[SOCKET] Message not for this group, ignoring');
        return;
      }

      setMessages(prev => {
        if (prev.some(m => m._id === message._id)) {
          console.log('[SOCKET] Duplicate message, skipping');
          return prev;
        }
        console.log('[SOCKET] Adding message to state');
        return [...prev, message];
      });
    };

    const handleMessageRead = (data) => {
      if (data.conversationId === groupId) {
        setMessages(prev => prev.map(msg => {
          if (msg._id === data.messageId) {
            return {
              ...msg,
              readBy: [...(msg.readBy || []), { user: data.userId, readAt: data.readAt }]
            };
          }
          return msg;
        }));
      }
    };

    const handleMessageDeleted = (data) => {
      if (data.conversationId === groupId) {
        setMessages(prev => prev.filter(msg => msg._id !== data.messageId));
      }
    };

    const handleMessageEdit = (data) => {
      if (data.conversationId === groupId) {
        setMessages(prev => prev.map(msg => {
          if (msg._id === data.messageId) {
            return { ...msg, content: data.content, isEdited: true, editedAt: data.editedAt };
          }
          return msg;
        }));
      }
    };

    const handleReaction = (data) => {
      if (data.conversationId === groupId) {
        setMessages(prev => prev.map(msg => {
          if (msg._id === data.messageId) {
            return { ...msg, reactions: data.reactions || msg.reactions };
          }
          return msg;
        }));
      }
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:receive', handleNewMessage);
    socket.on('newMessage', handleNewMessage);
    socket.on('message:read', handleMessageRead);
    socket.on('message:delete', handleMessageDeleted);
    socket.on('message:deleted', handleMessageDeleted);
    socket.on('message:edit', handleMessageEdit);
    socket.on('message:edited', handleMessageEdit);
    socket.on('message:reaction_added', handleReaction);
    socket.on('message:react', handleReaction);

    socket.emit('conversation:join', { conversationId: groupId });

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:receive', handleNewMessage);
      socket.off('newMessage', handleNewMessage);
      socket.off('message:read', handleMessageRead);
      socket.off('message:delete', handleMessageDeleted);
      socket.off('message:deleted', handleMessageDeleted);
      socket.off('message:edit', handleMessageEdit);
      socket.off('message:edited', handleMessageEdit);
      socket.off('message:reaction_added', handleReaction);
      socket.off('message:react', handleReaction);
      
      socket.emit('conversation:leave', { conversationId: groupId });
    };
  }, [socket, isConnected, groupId]);

  const loadGroup = async () => {
    try {
      if (!/^[a-fA-F0-9]{24}$/.test(groupId)) {
        addToast('Invalid group link', 'error');
        navigate('/groups');
        setLoading(false);
        return;
      }
      setLoading(true);
      const groupData = await groupService.getGroupById(groupId);
      console.log('[GROUP] Loaded group data:', groupData);
      console.log('[GROUP] Participants:', groupData?.participants);
      setGroup(groupData);
    } catch (error) {
      console.error('Failed to load group:', error);
      addToast('Failed to load group', 'error');
      navigate('/groups');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/groups/${groupId}/messages`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (response.data.success && response.data.data.messages) {
        setMessages(response.data.data.messages);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
      setMessages([]);
    }
  };

  const loadSubgroups = async () => {
    try {
      const subgroupsData = await groupService.getSubgroups(groupId);
      setSubgroups(subgroupsData || []);
    } catch (error) {
      console.error('Failed to load subgroups:', error);
      setSubgroups([]);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const response = await axios.post(
        `${API_URL}/groups/${groupId}/messages`,
        {
          content: messageContent,
          type: 'text'
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        const newMsg = response.data.data.message;
        setMessages(prev => {
          if (prev.some(m => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setNewMessage(messageContent);
      addToast(err.response?.data?.message || 'Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadResponse = await axios.post(
        `${API_URL}/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`
          }
        }
      );

      const fileUrl = uploadResponse.data.data?.url || uploadResponse.data.url;
      
      if (!fileUrl) {
        throw new Error('Upload failed - no URL returned');
      }

      const messagePayload = {
        content: '',
        type: file.type.startsWith('image/') ? 'image' : 'file',
        media: {
          url: fileUrl,
          type: file.type,
          name: file.name,
          size: file.size
        }
      };

      const messageResponse = await axios.post(
        `${API_URL}/groups/${groupId}/messages`,
        messagePayload,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (messageResponse.data.success) {
        const newMsg = messageResponse.data.data.message;
        setMessages(prev => {
          if (prev.some(m => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });
        addToast('File uploaded!', 'success');
      }
    } catch (error) {
      console.error('Upload error:', error);
      addToast(error.response?.data?.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleEmojiClick = (emojiObject) => {
    setNewMessage(prev => prev + emojiObject.emoji);
    setShowEmojiPicker(false);
  };

  const handleLeaveGroup = async () => {
    if (!confirm('Are you sure you want to leave this group?')) return;
    
    try {
      await axios.post(
        `${API_URL}/groups/${groupId}/leave`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      addToast('You have left the group', 'success');
      navigate('/groups');
    } catch (error) {
      console.error('Leave group error:', error);
      addToast(error.response?.data?.message || 'Failed to leave group', 'error');
    }
  };

  const handleDeleteGroup = async () => {
    if (!confirm('Are you sure you want to DELETE this group? This cannot be undone.')) return;
    
    try {
      await axios.delete(
        `${API_URL}/groups/${groupId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      addToast('Group deleted', 'success');
      navigate('/groups');
    } catch (error) {
      console.error('Delete group error:', error);
      addToast(error.response?.data?.message || 'Failed to delete group', 'error');
    }
  };

  const handleSubgroupCreated = (newSubgroup) => {
    setSubgroups(prev => [newSubgroup, ...prev]);
    loadGroup();
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <Loading message="Loading group..." />;
  }

  if (!group) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-4">Group not found</h2>
          <button onClick={() => navigate('/groups')} className="btn-primary">
            Back to Groups
          </button>
        </div>
      </div>
    );
  }

  // Check admin status
  const isAdmin = group.participants?.some(p => 
    p.role === 'admin' && (p.user?._id || p.user) === user.id
  ) || group.admins?.some(admin => 
    (typeof admin === 'string' ? admin : admin._id) === user.id
  );

  const isCreator = (group.createdBy?._id || group.createdBy || group.creator?._id || group.creator) === user.id;

  // ✅ FIX: Better member count calculation
  const memberCount = group.participants?.length || group.members?.length || 0;

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* HEADER */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm fixed top-0 left-0 right-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/groups')}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition flex-shrink-0"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-xl shadow-md flex-shrink-0">
                {group.avatar || group.groupPicture || '👥'}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {group.name}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                  {memberCount} member{memberCount !== 1 ? 's' : ''}
                  {isConnected && (
                    <span className="ml-2 w-2 h-2 bg-green-500 rounded-full" title="Connected"></span>
                  )}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-1 flex-shrink-0">
              {isAdmin && (
                <button 
                  onClick={() => setShowAddMemberModal(true)}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                  title="Add members"
                >
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </button>
              )}

              {/* Options Menu */}
              <div className="relative">
                <button 
                  onClick={() => setShowGroupOptions(!showGroupOptions)}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>

                {showGroupOptions && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowGroupOptions(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 py-2">
                      <button
                        onClick={() => { setShowMembersModal(true); setShowGroupOptions(false); }}
                        className="w-full px-4 py-3 text-left flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                      >
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span className="text-gray-700 dark:text-gray-200">View Members</span>
                      </button>

                      {isAdmin && (
                        <button
                          onClick={() => { setShowAddMemberModal(true); setShowGroupOptions(false); }}
                          className="w-full px-4 py-3 text-left flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                        >
                          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                          </svg>
                          <span className="text-gray-700 dark:text-gray-200">Add Members</span>
                        </button>
                      )}

                      {isAdmin && !group.isSubgroup && (
                        <button
                          onClick={() => { setShowSubgroupModal(true); setShowGroupOptions(false); }}
                          className="w-full px-4 py-3 text-left flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                        >
                          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          <span className="text-gray-700 dark:text-gray-200">Create Subgroup</span>
                        </button>
                      )}

                      {subgroups.length > 0 && (
                        <div className="px-4 py-2">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Subgroups ({subgroups.length})</p>
                          {subgroups.slice(0, 3).map(sub => (
                            <button
                              key={sub._id}
                              onClick={() => { navigate(`/groups/${sub._id}`); setShowGroupOptions(false); }}
                              className="w-full px-2 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition flex items-center space-x-2"
                            >
                              <span>{sub.avatar || '👥'}</span>
                              <span className="truncate">{sub.name}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>

                      {!isCreator && (
                        <button
                          onClick={() => { setShowGroupOptions(false); handleLeaveGroup(); }}
                          className="w-full px-4 py-3 text-left flex items-center space-x-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                        >
                          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          <span className="text-red-600 dark:text-red-400">Leave Group</span>
                        </button>
                      )}

                      {isCreator && (
                        <button
                          onClick={() => { setShowGroupOptions(false); handleDeleteGroup(); }}
                          className="w-full px-4 py-3 text-left flex items-center space-x-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                        >
                          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span className="text-red-600 dark:text-red-400">Delete Group</span>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MESSAGES */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 chat-background"
        style={{ 
          paddingTop: '80px',
          paddingBottom: '100px',
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-full flex items-center justify-center shadow-xl animate-pulse">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                No messages yet
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Be the first to send a message
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const senderId = message.sender?._id || message.sender;
              const isOwn = senderId === user.id;
              const showAvatar = index === 0 || (messages[index - 1].sender?._id || messages[index - 1].sender) !== senderId;
              
              return (
                <div
                  key={message._id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-end space-x-2 max-w-[80%] sm:max-w-[75%] ${isOwn ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    {!isOwn && showAvatar && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {message.sender?.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                    )}
                    {!isOwn && !showAvatar && <div className="w-8"></div>}

                    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                      {!isOwn && showAvatar && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 px-2">
                          {message.sender?.username || message.sender?.fullName || 'Unknown'}
                        </span>
                      )}
                      
                      <div
                        className={`rounded-2xl px-4 py-2 shadow-md ${
                          isOwn
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-br-sm'
                            : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-bl-sm'
                        }`}
                      >
                        {message.type === 'image' && message.media?.url ? (
                          <div className="space-y-2">
                            <img 
                              src={message.media.url} 
                              alt="Shared image" 
                              className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition"
                              onClick={() => window.open(message.media.url, '_blank')}
                            />
                            {message.content && (
                              <p className="break-words text-sm">{message.content}</p>
                            )}
                          </div>
                        ) : message.type === 'file' && message.media?.url ? (
                          <a 
                            href={message.media.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center space-x-2 hover:underline"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="truncate">{message.media.name || 'Download file'}</span>
                          </a>
                        ) : (
                          <p className="break-words">{message.content}</p>
                        )}
                      </div>

                      <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 px-2">
                        {formatTime(message.createdAt)}
                        {message.isEdited && ' (edited)'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* INPUT */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 shadow-lg fixed bottom-0 left-0 right-0 z-40">
        {showEmojiPicker && (
          <div className="absolute bottom-20 right-4 z-50">
            <EmojiPicker onEmojiClick={handleEmojiClick} />
          </div>
        )}

        <form onSubmit={handleSend} className="flex items-end space-x-2">
          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={handleFileSelect}
            accept="image/*,video/*,.pdf,.doc,.docx"
          />

          <button
            type="button"
            onClick={handleFileClick}
            disabled={uploading}
            className="p-3 text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 flex-shrink-0"
            title="Attach file"
          >
            {uploading ? (
              <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            )}
          </button>

          <div className="flex-1">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder="Type a message..."
              disabled={sending}
              rows="1"
              className="w-full px-4 py-3 rounded-2xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 dark:disabled:bg-gray-800 transition resize-none max-h-32"
              style={{ minHeight: '48px' }}
            />
          </div>

          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-3 text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0 hidden sm:block"
            title="Add emoji"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="p-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 shadow-lg flex-shrink-0"
          >
            {sending ? (
              <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </form>
      </div>

      {/* Modals */}
      {showAddMemberModal && (
        <AddMemberModal 
          groupId={groupId} 
          currentMembers={group.participants || group.members || []}
          onClose={() => { setShowAddMemberModal(false); loadGroup(); }} 
        />
      )}

      {showMembersModal && (
        <ViewMembersModal 
          group={group}
          isAdmin={isAdmin}
          currentUserId={user.id}
          onClose={() => { setShowMembersModal(false); loadGroup(); }} 
        />
      )}

      {showSubgroupModal && (
        <CreateSubgroupModal
          parentGroup={group}
          onClose={() => setShowSubgroupModal(false)}
          onSubgroupCreated={handleSubgroupCreated}
        />
      )}
    </div>
  );
}

// ✅ FIXED AddMemberModal component
function AddMemberModal({ groupId, currentMembers, onClose }) {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const { addToast } = useToast();
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchAvailableUsers();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(users.filter(user =>
        user.username?.toLowerCase().includes(query) ||
        user.fullName?.toLowerCase().includes(query)
      ));
    }
  }, [searchQuery, users]);

  const fetchAvailableUsers = async () => {
    try {
      setLoading(true);
      let availableUsers = [];
      
      // Try contacts/friends first, then all users
      const endpoints = ['/contacts', '/users/friends', '/users'];

      for (const endpoint of endpoints) {
        try {
          const response = await axios.get(`${API_URL}${endpoint}`, { 
            headers: { Authorization: `Bearer ${token}` } 
          });
          
          console.log(`[ADD_MEMBER] ${endpoint} response:`, response.data);
          
          // Extract users from various response formats
          if (Array.isArray(response.data)) {
            availableUsers = response.data;
          } else if (Array.isArray(response.data?.data)) {
            availableUsers = response.data.data;
          } else if (Array.isArray(response.data?.contacts)) {
            availableUsers = response.data.contacts;
          } else if (Array.isArray(response.data?.friends)) {
            availableUsers = response.data.friends;
          } else if (Array.isArray(response.data?.users)) {
            availableUsers = response.data.users;
          } else if (response.data?.data?.contacts) {
            availableUsers = response.data.data.contacts;
          }
          
          if (availableUsers.length > 0) {
            console.log(`[ADD_MEMBER] Found ${availableUsers.length} users from ${endpoint}`);
            break;
          }
        } catch (err) {
          console.log(`[ADD_MEMBER] ${endpoint} failed:`, err.response?.status);
        }
      }

      // Extract current member IDs
      const memberIds = currentMembers.map(m => {
        // Handle different formats
        if (typeof m === 'string') return m;
        if (m.user?._id) return m.user._id.toString();
        if (m.user && typeof m.user === 'string') return m.user;
        if (m._id) return m._id.toString();
        return null;
      }).filter(Boolean);

      console.log('[ADD_MEMBER] Current member IDs:', memberIds);

      // Filter out users already in group
      const filtered = availableUsers.filter(u => {
        const uId = (u._id || u.id)?.toString();
        const isAlreadyMember = memberIds.includes(uId);
        return uId && !isAlreadyMember;
      });

      console.log('[ADD_MEMBER] Available to add:', filtered.length);

      setUsers(filtered);
      setFilteredUsers(filtered);
    } catch (error) {
      console.error('[ADD_MEMBER] Fetch users error:', error);
      addToast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMembers = async () => {
    if (selectedUsers.length === 0) {
      addToast('Please select at least one user', 'error');
      return;
    }
    try {
      setAdding(true);
      await axios.post(
        `${API_URL}/groups/${groupId}/members`, 
        { memberIds: selectedUsers }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      addToast(`Added ${selectedUsers.length} member(s)!`, 'success');
      onClose();
    } catch (error) {
      console.error('[ADD_MEMBER] Error:', error);
      addToast(error.response?.data?.message || 'Failed to add members', 'error');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add Members</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users..."
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto"></div>
              <p className="mt-3 text-gray-500">Loading contacts...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 px-4">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-gray-600 dark:text-gray-400 font-medium">No contacts available</p>
              <p className="text-sm text-gray-500 mt-2">Add friends first to invite them to groups</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.map(user => {
                const userId = user._id || user.id;
                const isSelected = selectedUsers.includes(userId);
                return (
                  <button
                    key={userId}
                    onClick={() => setSelectedUsers(prev => 
                      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
                    )}
                    className="w-full px-6 py-4 flex items-center space-x-4 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    {user.profilePicture ? (
                      <img src={user.profilePicture} alt="" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold">
                        {(user.fullName || user.username || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 text-left">
                      <p className="font-medium text-gray-900 dark:text-white">{user.fullName || user.username}</p>
                      <p className="text-sm text-gray-500">@{user.username}</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-purple-600 bg-purple-600' : 'border-gray-300'}`}>
                      {isSelected && <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
          <button
            onClick={handleAddMembers}
            disabled={adding || selectedUsers.length === 0}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {adding ? 'Adding...' : `Add ${selectedUsers.length > 0 ? `(${selectedUsers.length})` : 'Members'}`}
          </button>
          <button onClick={onClose} className="w-full py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ✅ FIXED ViewMembersModal component
function ViewMembersModal({ group, isAdmin, currentUserId, onClose }) {
  const [removing, setRemoving] = useState(null);
  const { addToast } = useToast();
  const token = localStorage.getItem('token');
  
  // ✅ FIX: Get all participants without problematic filter
  const members = group.participants || group.members || [];
  
  console.log('[VIEW_MEMBERS] Group:', group);
  console.log('[VIEW_MEMBERS] Participants:', members);

  const handleRemoveMember = async (userId, username) => {
    if (!confirm(`Remove ${username}?`)) return;
    try {
      setRemoving(userId);
      await axios.delete(`${API_URL}/groups/${group._id}/members/${userId}`, { headers: { Authorization: `Bearer ${token}` } });
      addToast('Member removed', 'success');
      onClose();
    } catch (error) {
      addToast(error.response?.data?.message || 'Failed', 'error');
    } finally {
      setRemoving(null);
    }
  };

  const handlePromoteToAdmin = async (userId, username) => {
    if (!confirm(`Make ${username} admin?`)) return;
    try {
      await axios.post(`${API_URL}/groups/${group._id}/admins/${userId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      addToast('Promoted to admin', 'success');
      onClose();
    } catch (error) {
      addToast(error.response?.data?.message || 'Failed', 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Members ({members.length})</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {members.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No members found</p>
              <p className="text-sm mt-2">This might be a data issue</p>
            </div>
          ) : (
            members.map((member, index) => {
              // ✅ FIX: Handle both populated and unpopulated user objects
              const memberData = member.user || member;
              const memberId = memberData._id || memberData.id || (typeof member.user === 'string' ? member.user : null);
              const isMemberAdmin = member.role === 'admin';
              const creatorId = group.createdBy?._id || group.createdBy;
              const isMemberCreator = memberId && creatorId && memberId.toString() === creatorId.toString();
              
              // If user data isn't populated, show placeholder
              const displayName = memberData.fullName || memberData.username || `Member ${index + 1}`;
              const username = memberData.username || 'unknown';
              
              return (
                <div key={memberId || index} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
                  <div className="flex items-center flex-1 min-w-0">
                    {memberData.profilePicture ? (
                      <img src={memberData.profilePicture} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="ml-3 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{displayName}</p>
                        {isMemberCreator && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 rounded">Creator</span>}
                        {isMemberAdmin && !isMemberCreator && <span className="text-xs bg-blue-100 text-blue-800 px-2 rounded">Admin</span>}
                      </div>
                      <p className="text-sm text-gray-500 truncate">@{username}</p>
                    </div>
                  </div>
                  
                  {isAdmin && memberId && memberId !== currentUserId && !isMemberCreator && (
                    <div className="flex space-x-2 ml-2">
                      {!isMemberAdmin && (
                        <button onClick={() => handlePromoteToAdmin(memberId, displayName)} className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Admin</button>
                      )}
                      <button onClick={() => handleRemoveMember(memberId, displayName)} disabled={removing === memberId} className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
                        {removing === memberId ? '...' : 'Remove'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="w-full py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">Close</button>
        </div>
      </div>
    </div>
  );
}