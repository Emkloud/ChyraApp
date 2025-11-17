import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { groupService } from '../services/groupService';
import { useToast } from '../components/Toast';
import Loading from '../components/Loading';
import EmojiPicker from 'emoji-picker-react';
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
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    loadGroup();
    loadMessages();
  }, [groupId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
        setMessages(prev => [...prev, response.data.data.message]);
        addToast('Message sent', 'success');
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

  // ✅ File upload with detailed debugging
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      
      console.log('🔵 Starting file upload:', file.name);
      
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

      console.log('📦 Full upload response:', uploadResponse.data);
      console.log('📦 Response structure:', JSON.stringify(uploadResponse.data, null, 2));

      const fileUrl = uploadResponse.data.data?.url || uploadResponse.data.url;
      
      console.log('🔗 Extracted URL:', fileUrl);
      
      if (!fileUrl) {
        console.error('❌ No URL found in response');
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

      console.log('📤 Sending message:', messagePayload);

      const messageResponse = await axios.post(
        `${API_URL}/groups/${groupId}/messages`,
        messagePayload,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      console.log('📥 Message response:', messageResponse.data);

      if (messageResponse.data.success) {
        setMessages(prev => [...prev, messageResponse.data.data.message]);
        addToast('File uploaded!', 'success');
      }
    } catch (error) {
      console.error('❌ Upload error:', error);
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

  const isAdmin = group.admins?.some(admin => 
    (typeof admin === 'string' ? admin : admin._id) === user.id
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/groups')}
              className="text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center space-x-3 flex-1">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-xl shadow-md">
                {group.avatar}
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                  {group.name}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {group.members?.length || 0} members
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
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
              
              <button 
                onClick={() => setShowMembersModal(true)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                title="View members"
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </button>

              <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 chat-background">
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
                Be the first to send a message in this group
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const senderId = message.sender?._id || message.sender;
              const isOwn = senderId === user.id;
              const showAvatar = index === 0 || messages[index - 1].sender?._id !== senderId;
              
              return (
                <div
                  key={message._id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-slideUp`}
                >
                  <div className={`flex items-end space-x-2 max-w-[75%] ${isOwn ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    {!isOwn && showAvatar && (
                      <div className="avatar avatar-sm avatar-gradient flex-shrink-0">
                        {message.sender?.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                    )}
                    {!isOwn && !showAvatar && <div className="w-8"></div>}

                    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                      {!isOwn && showAvatar && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 px-2">
                          {message.sender?.username || 'Unknown'}
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
                              className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition"
                              onClick={() => window.open(message.media.url, '_blank')}
                              onError={(e) => {
                                console.error('Image load error:', message.media.url);
                                e.target.src = '/image-placeholder.png';
                              }}
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
                            <span>{message.media.name || 'Download file'}</span>
                          </a>
                        ) : (
                          <p className="break-words">{message.content}</p>
                        )}
                      </div>

                      <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 px-2">
                        {formatTime(message.createdAt)}
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

      {/* Input */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 shadow-lg relative">
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
            className="p-3 text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
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
              id="groupChatMessage"
              name="groupChatMessage"
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
            className="p-3 text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Add emoji"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="p-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 shadow-lg transform hover:scale-105 disabled:transform-none"
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

      {showAddMemberModal && (
        <AddMemberModal 
          groupId={groupId} 
          onClose={() => {
            setShowAddMemberModal(false);
            loadGroup();
          }} 
        />
      )}

      {showMembersModal && (
        <ViewMembersModal 
          group={group}
          isAdmin={isAdmin}
          currentUserId={user.id}
          onClose={() => {
            setShowMembersModal(false);
            loadGroup();
          }} 
        />
      )}
    </div>
  );
}

// Modal components... (continued in next part due to length)
function AddMemberModal({ groupId, onClose }) {
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const { addToast } = useToast();
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchAvailableFriends();
  }, []);

  const fetchAvailableFriends = async () => {
    try {
      setLoading(true);
      const friendsResponse = await axios.get(`${API_URL}/users/friends`, { headers: { Authorization: `Bearer ${token}` } });
      const groupResponse = await axios.get(`${API_URL}/groups/${groupId}`, { headers: { Authorization: `Bearer ${token}` } });
      const memberIds = groupResponse.data.members.map(m => typeof m === 'string' ? m : m._id);
      const availableFriends = friendsResponse.data.filter(f => !memberIds.includes(f._id));
      setFriends(availableFriends);
    } catch (error) {
      console.error('Fetch friends error:', error);
      addToast('Failed to load friends', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMembers = async () => {
    if (selectedFriends.length === 0) {
      addToast('Please select at least one friend', 'error');
      return;
    }
    try {
      setAdding(true);
      for (const friendId of selectedFriends) {
        await axios.post(`${API_URL}/groups/${groupId}/members`, { userId: friendId }, { headers: { Authorization: `Bearer ${token}` } });
      }
      addToast(`Added ${selectedFriends.length} member(s)!`, 'success');
      onClose();
    } catch (error) {
      console.error('Add members error:', error);
      addToast(error.response?.data?.message || 'Failed to add members', 'error');
    } finally {
      setAdding(false);
    }
  };

  const toggleFriend = (friendId) => {
    setSelectedFriends(prev => prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full max-h-[80vh] overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add Members</h2>
        </div>
        <div className="p-6 overflow-y-auto max-h-96">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Loading friends...</p>
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">No friends available to add</p>
            </div>
          ) : (
            <div className="space-y-2">
              {friends.map(friend => (
                <label key={friend._id} className="flex items-center p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition">
                  <input type="checkbox" checked={selectedFriends.includes(friend._id)} onChange={() => toggleFriend(friend._id)} className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500" />
                  <img src={friend.profilePicture || '/default-avatar.png'} alt={friend.username} className="w-10 h-10 rounded-full ml-3" />
                  <div className="ml-3">
                    <p className="font-medium text-gray-900 dark:text-white">{friend.username}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{friend.email}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          <button onClick={onClose} disabled={adding} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">Cancel</button>
          <button onClick={handleAddMembers} disabled={adding || selectedFriends.length === 0} className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 transition">
            {adding ? 'Adding...' : `Add ${selectedFriends.length} Member(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewMembersModal({ group, isAdmin, currentUserId, onClose }) {
  const [removing, setRemoving] = useState(null);
  const { addToast } = useToast();
  const token = localStorage.getItem('token');

  const handleRemoveMember = async (userId, username) => {
    if (!confirm(`Remove ${username} from the group?`)) return;
    try {
      setRemoving(userId);
      await axios.delete(`${API_URL}/groups/${group._id}/members/${userId}`, { headers: { Authorization: `Bearer ${token}` } });
      addToast('Member removed', 'success');
      onClose();
    } catch (error) {
      console.error('Remove member error:', error);
      addToast(error.response?.data?.message || 'Failed to remove member', 'error');
    } finally {
      setRemoving(null);
    }
  };

  const handlePromoteToAdmin = async (userId, username) => {
    if (!confirm(`Make ${username} an admin?`)) return;
    try {
      await axios.post(`${API_URL}/groups/${group._id}/admins`, { userId }, { headers: { Authorization: `Bearer ${token}` } });
      addToast('Member promoted to admin', 'success');
      onClose();
    } catch (error) {
      console.error('Promote admin error:', error);
      addToast(error.response?.data?.message || 'Failed to promote member', 'error');
    }
  };

  const isUserAdmin = (memberId) => group.admins?.some(admin => (typeof admin === 'string' ? admin : admin._id) === memberId);
  const isCreator = (memberId) => (typeof group.creator === 'string' ? group.creator : group.creator?._id) === memberId;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full max-h-[80vh] overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Group Members ({group.members?.length || 0})</h2>
        </div>
        <div className="p-6 overflow-y-auto max-h-96">
          <div className="space-y-3">
            {group.members?.map(member => {
              const memberId = typeof member === 'string' ? member : member._id;
              const memberData = typeof member === 'string' ? { _id: member, username: 'Unknown' } : member;
              const isMemberAdmin = isUserAdmin(memberId);
              const isMemberCreator = isCreator(memberId);
              return (
                <div key={memberId} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
                  <div className="flex items-center">
                    <img src={memberData.profilePicture || '/default-avatar.png'} alt={memberData.username} className="w-10 h-10 rounded-full" />
                    <div className="ml-3">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {memberData.username}
                        {isMemberCreator && <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Creator</span>}
                        {isMemberAdmin && !isMemberCreator && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Admin</span>}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{memberData.email}</p>
                    </div>
                  </div>
                  {isAdmin && memberId !== currentUserId && !isMemberCreator && (
                    <div className="flex items-center space-x-2">
                      {!isMemberAdmin && <button onClick={() => handlePromoteToAdmin(memberId, memberData.username)} className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition">Make Admin</button>}
                      <button onClick={() => handleRemoveMember(memberId, memberData.username)} disabled={removing === memberId} className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition">
                        {removing === memberId ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition">Close</button>
        </div>
      </div>
    </div>
  );
}