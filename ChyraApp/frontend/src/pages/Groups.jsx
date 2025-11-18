import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import SearchBar from '../components/SearchBar';
import { groupService } from '../services/groupService';
import { useToast } from '../components/Toast';
import { useSocket } from '../context/SocketContext';
import Loading from '../components/Loading';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupAvatar, setGroupAvatar] = useState('👥');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  
  // Member selection state
  const [friends, setFriends] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { socket, isConnected } = useSocket();
  const token = localStorage.getItem('token');

  const availableAvatars = [
    '👥', '👨‍👩‍👧‍👦', '💼', '🎓', '🎮', '⚽', '🎵', '🍕',
    '✈️', '💻', '📚', '🎨', '🏃', '🏠', '❤️', '🔥'
  ];

  useEffect(() => {
    loadGroups();
  }, []);

  // Socket listener for group updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleGroupCreated = ({ groupId }) => {
      console.log('Group created event received:', groupId);
      loadGroups();
    };

    socket.on('group_created', handleGroupCreated);
    socket.on('group:created', handleGroupCreated);

    return () => {
      socket.off('group_created', handleGroupCreated);
      socket.off('group:created', handleGroupCreated);
    };
  }, [socket, isConnected]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredGroups(groups);
    } else {
      const filtered = groups.filter(group =>
        group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredGroups(filtered);
    }
  }, [searchQuery, groups]);

  // Fetch friends when modal opens
  useEffect(() => {
    if (showCreateModal) {
      fetchFriends();
    }
  }, [showCreateModal]);

  const loadGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading groups...');
      const groupsData = await groupService.getUserGroups();
      console.log('Groups loaded:', groupsData?.length || 0);
      
      setGroups(groupsData || []);
      setFilteredGroups(groupsData || []);
      setRetryCount(0);
    } catch (error) {
      console.error('Failed to load groups:', error);
      
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load groups';
      setError(errorMessage);
      
      if (retryCount === 0) {
        addToast(errorMessage, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchFriends = async () => {
    try {
      setLoadingFriends(true);
      
      let friendsList = [];
      
      // Try multiple endpoints
      const endpoints = ['/contacts', '/users/friends', '/users'];
      
      for (const endpoint of endpoints) {
        try {
          const response = await axios.get(`${API_URL}${endpoint}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (Array.isArray(response.data)) {
            friendsList = response.data;
          } else if (Array.isArray(response.data?.data)) {
            friendsList = response.data.data;
          } else if (Array.isArray(response.data?.contacts)) {
            friendsList = response.data.contacts;
          } else if (Array.isArray(response.data?.friends)) {
            friendsList = response.data.friends;
          } else if (Array.isArray(response.data?.users)) {
            friendsList = response.data.users;
          } else if (response.data?.data?.contacts) {
            friendsList = response.data.data.contacts;
          }
          
          if (friendsList.length > 0) break;
        } catch (err) {
          console.log(`${endpoint} failed`);
        }
      }

      // Get current user ID from localStorage
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      const currentUserId = userData._id || userData.id;

      // Filter out current user
      const filteredFriends = friendsList.filter(f => {
        const friendId = f._id || f.id;
        return friendId !== currentUserId;
      });

      console.log('Available friends:', filteredFriends.length);
      setFriends(filteredFriends);
      
    } catch (error) {
      console.error('Fetch friends error:', error);
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    loadGroups();
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      addToast('Please enter a group name', 'error');
      return;
    }

    if (groupName.trim().length < 2) {
      addToast('Group name must be at least 2 characters', 'error');
      return;
    }

    try {
      setIsCreating(true);
      
      const groupData = {
        name: groupName.trim(),
        description: groupDescription.trim(),
        avatar: groupAvatar,
        memberIds: selectedMembers
      };

      console.log('Creating group with data:', {
        name: groupData.name,
        memberCount: groupData.memberIds.length
      });

      const newGroup = await groupService.createGroup(groupData);

      console.log('Group created successfully:', newGroup);

      setGroups(prev => [newGroup, ...prev]);
      closeModal();
      addToast('🎉 Group created successfully!', 'success');

      if (socket && isConnected) {
        socket.emit('group_created', {
          groupId: newGroup._id,
          members: newGroup.participants || newGroup.members
        });
      }

      setTimeout(() => {
        navigate(`/groups/${newGroup._id}`);
      }, 500);

    } catch (error) {
      console.error('Failed to create group:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create group';
      addToast(errorMessage, 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setGroupName('');
    setGroupDescription('');
    setGroupAvatar('👥');
    setSelectedMembers([]);
    setMemberSearchQuery('');
  };

  const toggleMember = (friendId) => {
    setSelectedMembers(prev => {
      if (prev.includes(friendId)) {
        return prev.filter(id => id !== friendId);
      } else {
        return [...prev, friendId];
      }
    });
  };

  const formatTime = (date) => {
    if (!date) return '';
    
    try {
      const now = new Date();
      const groupDate = new Date(date);
      const diff = (now - groupDate) / 1000 / 60;

      if (diff < 1) return 'Just now';
      if (diff < 60) return `${Math.floor(diff)}m ago`;
      if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
      if (diff < 10080) return `${Math.floor(diff / 1440)}d ago`;
      
      return groupDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (error) {
      return '';
    }
  };

  // Filter friends by search
  const filteredFriends = friends.filter(friend => {
    if (!memberSearchQuery.trim()) return true;
    const query = memberSearchQuery.toLowerCase();
    return (
      friend.username?.toLowerCase().includes(query) ||
      friend.fullName?.toLowerCase().includes(query)
    );
  });

  // Get member count from group
  const getMemberCount = (group) => {
    if (group.participants) {
      return group.participants.filter(p => p.isActive !== false).length;
    }
    if (group.members) {
      return group.members.length;
    }
    return 0;
  };

  // Loading state
  if (loading && groups.length === 0) {
    return <Loading message="Loading groups..." />;
  }

  // Error state
  if (error && groups.length === 0) {
    return (
      <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="px-4 py-4">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Groups</h1>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 mx-auto mb-6 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Failed to Load Groups
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
            <button
              onClick={handleRetry}
              className="w-full btn-primary flex items-center justify-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Retry</span>
            </button>
          </div>
        </div>

        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Groups</h1>
              {groups.length > 0 && (
                <span className="px-2 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
                  {groups.length}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-full hover:from-purple-700 hover:to-pink-700 transition duration-200 shadow-md flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>New</span>
            </button>
          </div>

          <SearchBar 
            onSearch={setSearchQuery}
            placeholder="Search groups..."
          />
        </div>
      </div>

      {/* Groups List */}
      <div className="flex-1 overflow-y-auto pb-20">
        {filteredGroups.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8">
              <svg className="w-32 h-32 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300 mb-2">
                {searchQuery ? 'No groups found' : 'No Groups Yet'}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {searchQuery ? 'Try a different search term' : 'Create your first group to get started'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary"
                >
                  Create Your First Group
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredGroups.map((group, index) => (
              <div
                key={group._id}
                onClick={() => navigate(`/groups/${group._id}`)}
                className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-all duration-200 p-4"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0 relative">
                    <div className="w-14 h-14 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-2xl shadow-lg">
                      {group.avatar || group.groupPicture || '👥'}
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-purple-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-medium shadow-md">
                      {getMemberCount(group)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {group.name}
                      </h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">
                        {formatTime(group.updatedAt || group.lastMessageAt)}
                      </span>
                    </div>
                    {group.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1 truncate">
                        {group.description}
                      </p>
                    )}
                    <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                      {group.lastMessage?.content || 'No messages yet'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ✅ FIXED: Create Group Modal - Mobile Optimized */}
      {showCreateModal && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={closeModal}
          />
          
          {/* Modal - Slides up from bottom on mobile */}
          <div className="fixed inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center z-50 sm:p-4">
            <div className="bg-white dark:bg-gray-800 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh]">
              
              {/* Header - Fixed */}
              <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Create Group</h2>
                  <button
                    onClick={closeModal}
                    disabled={isCreating}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Content - Scrollable */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                {/* Avatar Selection - Compact */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Group Avatar
                  </label>
                  <div className="grid grid-cols-8 gap-1.5">
                    {availableAvatars.map((avatar) => (
                      <button
                        key={avatar}
                        type="button"
                        onClick={() => setGroupAvatar(avatar)}
                        disabled={isCreating}
                        className={`text-xl p-1.5 rounded-lg transition ${
                          groupAvatar === avatar
                            ? 'bg-purple-100 dark:bg-purple-900/30 ring-2 ring-purple-500'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        } disabled:opacity-50`}
                      >
                        {avatar}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Group Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Group Name *
                  </label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g., Family, Work Team"
                    maxLength={100}
                    disabled={isCreating}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 text-sm"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    placeholder="What's this group about?"
                    rows="2"
                    maxLength={500}
                    disabled={isCreating}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none disabled:opacity-50 text-sm"
                  />
                </div>

                {/* Add Members Section */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Add Members (Optional)
                    </label>
                    {selectedMembers.length > 0 && (
                      <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                        {selectedMembers.length} selected
                      </span>
                    )}
                  </div>
                  
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    You can add members now or later
                  </p>

                  {/* Search Members */}
                  <div className="relative mb-2">
                    <input
                      type="text"
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      placeholder="Search friends..."
                      disabled={isCreating}
                      className="w-full px-3 py-2 pl-9 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 text-sm"
                    />
                    <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>

                  {/* Friends List - Compact */}
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    {loadingFriends ? (
                      <div className="p-3 text-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600 mx-auto"></div>
                      </div>
                    ) : filteredFriends.length === 0 ? (
                      <div className="p-3 text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {memberSearchQuery ? 'No friends found' : 'No friends available'}
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredFriends.map(friend => {
                          const friendId = friend._id || friend.id;
                          const isSelected = selectedMembers.includes(friendId);
                          
                          return (
                            <button
                              key={friendId}
                              type="button"
                              onClick={() => toggleMember(friendId)}
                              disabled={isCreating}
                              className="w-full px-3 py-2 flex items-center space-x-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition text-left disabled:opacity-50"
                            >
                              {/* Avatar */}
                              <div className="relative flex-shrink-0">
                                {friend.profilePicture ? (
                                  <img
                                    src={friend.profilePicture}
                                    alt={friend.username}
                                    className="w-7 h-7 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-semibold">
                                    {(friend.fullName || friend.username || 'U').charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {friend.fullName || friend.username}
                                </p>
                              </div>

                              {/* Checkbox */}
                              <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                isSelected 
                                  ? 'bg-purple-600 border-purple-600' 
                                  : 'border-gray-300 dark:border-gray-600'
                              }`}>
                                {isSelected && (
                                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer - Fixed */}
              <div className="flex-shrink-0 px-4 py-3 border-t border-gray-200 dark:border-gray-700 space-y-2 bg-white dark:bg-gray-800">
                <button
                  onClick={handleCreateGroup}
                  disabled={!groupName.trim() || isCreating}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2.5 rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm"
                >
                  {isCreating ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>
                      Create Group{selectedMembers.length > 0 ? ` (${selectedMembers.length})` : ''}
                    </span>
                  )}
                </button>
                
                <button
                  onClick={closeModal}
                  disabled={isCreating}
                  className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition disabled:opacity-50 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <BottomNav />
    </div>
  );
}