import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import SearchBar from '../components/SearchBar';
import { groupService } from '../services/groupService';
import { useToast } from '../components/Toast';
import { useSocket } from '../context/SocketContext';
import Loading from '../components/Loading';

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
  
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { socket, isConnected } = useSocket();

  const availableAvatars = [
    '👨‍👩‍👧‍👦', '💼', '🎓', '🎮', '⚽', '🎵', 
    '🍕', '✈️', '💻', '📚', '🎨', '🏃'
  ];

  useEffect(() => {
    loadGroups();
  }, []);

  // Socket listener for group updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleGroupCreated = ({ groupId }) => {
      console.log('Group created event received:', groupId);
      loadGroups(); // Refresh groups list
    };

    socket.on('group_created', handleGroupCreated);

    return () => {
      socket.off('group_created', handleGroupCreated);
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

  const loadGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading groups...');
      const groupsData = await groupService.getUserGroups();
      console.log('Groups loaded:', groupsData.length);
      
      setGroups(groupsData);
      setFilteredGroups(groupsData);
      setRetryCount(0); // Reset retry count on success
    } catch (error) {
      console.error('Failed to load groups:', error);
      
      const errorMessage = error.message || 'Failed to load groups. Please check your connection.';
      setError(errorMessage);
      
      // Only show toast on first error, not on retries
      if (retryCount === 0) {
        addToast(errorMessage, 'error');
      }
    } finally {
      setLoading(false);
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
      
      console.log('Creating group:', {
        name: groupName.trim(),
        description: groupDescription.trim(),
        avatar: groupAvatar
      });

      const newGroup = await groupService.createGroup({
        name: groupName.trim(),
        description: groupDescription.trim(),
        avatar: groupAvatar
      });

      console.log('Group created successfully:', newGroup);

      // Add to groups list
      setGroups(prev => [newGroup, ...prev]);
      
      // Close modal and reset form
      setShowCreateModal(false);
      setGroupName('');
      setGroupDescription('');
      setGroupAvatar('👥');
      
      addToast('🎉 Group created successfully!', 'success');

      // Notify other users via socket
      if (socket && isConnected) {
        socket.emit('group_created', {
          groupId: newGroup._id,
          members: newGroup.members
        });
      }

      // Navigate to the new group
      setTimeout(() => {
        navigate(`/group/${newGroup._id}`);
      }, 500);

    } catch (error) {
      console.error('Failed to create group:', error);
      
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Failed to create group. Please try again.';
      
      addToast(errorMessage, 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const formatTime = (date) => {
    if (!date) return '';
    
    try {
      const now = new Date();
      const groupDate = new Date(date);
      const diff = (now - groupDate) / 1000 / 60; // minutes

      if (diff < 1) return 'Just now';
      if (diff < 60) return `${Math.floor(diff)}m ago`;
      if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
      if (diff < 10080) return `${Math.floor(diff / 1440)}d ago`;
      
      return groupDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (error) {
      console.error('Error formatting time:', error);
      return '';
    }
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
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {error}
            </p>
            <div className="space-y-3">
              <button
                onClick={handleRetry}
                className="w-full btn-primary hover-lift flex items-center justify-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Retry</span>
              </button>
              {retryCount > 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Retry attempt: {retryCount}
                </p>
              )}
            </div>
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
                  className="btn-primary hover-lift"
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
                onClick={() => navigate(`/group/${group._id}`)}
                className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-all duration-200 p-4 hover-lift animate-slideUp"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0 relative">
                    <div className="w-14 h-14 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-2xl shadow-lg">
                      {group.avatar || '👥'}
                    </div>
                    {group.members && group.members.length > 0 && (
                      <div className="absolute -bottom-1 -right-1 bg-purple-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-medium shadow-md">
                        {group.members.length}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {group.name}
                      </h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">
                        {formatTime(group.updatedAt)}
                      </span>
                    </div>
                    {group.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1 truncate">
                        {group.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                        {group.lastMessage?.content || 'No messages yet'}
                      </p>
                      <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center ml-2 flex-shrink-0">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        {group.members?.length || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full shadow-2xl animate-scaleIn max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Create Group</h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setGroupName('');
                    setGroupDescription('');
                    setGroupAvatar('👥');
                  }}
                  disabled={isCreating}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition disabled:opacity-50"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Avatar Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Group Avatar
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {availableAvatars.map((avatar) => (
                    <button
                      key={avatar}
                      type="button"
                      onClick={() => setGroupAvatar(avatar)}
                      disabled={isCreating}
                      className={`text-3xl p-2 rounded-lg transition ${
                        groupAvatar === avatar
                          ? 'bg-purple-100 dark:bg-purple-900/30 ring-2 ring-purple-500'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {avatar}
                    </button>
                  ))}
                </div>
              </div>

              {/* Group Name */}
              <div>
                <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Group Name *
                </label>
                <input
                  id="groupName"
                  name="groupName"
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g., Family, Work Team"
                  maxLength={100}
                  disabled={isCreating}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {groupName.length}/100 characters
                </p>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="groupDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  id="groupDescription"
                  name="groupDescription"
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="What's this group about?"
                  rows="3"
                  maxLength={500}
                  disabled={isCreating}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {groupDescription.length}/500 characters
                </p>
              </div>

              {/* Create Button */}
              <button
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || isCreating}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isCreating ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Create Group</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}