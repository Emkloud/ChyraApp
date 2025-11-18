import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function CreateGroupModal({ onClose, onGroupCreated }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const token = localStorage.getItem('token');

  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('👥');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [availableFriends, setAvailableFriends] = useState([]);
  const [filteredFriends, setFilteredFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const availableAvatars = [
    '👥', '👨‍👩‍👧‍👦', '💼', '🔧', '🎮', '⚽', '🎵', '🍕',
    '✈️', '💻', '📚', '🎨', '🏃', '🏠', '❤️', '🔥'
  ];

  // Load friends/contacts
  useEffect(() => {
    loadFriends();
  }, []);

  // Filter friends based on search
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredFriends(availableFriends);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredFriends(
        availableFriends.filter(friend =>
          friend.username?.toLowerCase().includes(query) ||
          friend.fullName?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, availableFriends]);

  const loadFriends = async () => {
    try {
      setLoading(true);
      
      // Try multiple endpoints to get contacts/friends
      const endpoints = ['/contacts', '/users/friends', '/users'];
      let friends = [];

      for (const endpoint of endpoints) {
        try {
          const response = await axios.get(`${API_URL}${endpoint}`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (Array.isArray(response.data)) {
            friends = response.data;
          } else if (Array.isArray(response.data?.data)) {
            friends = response.data.data;
          } else if (Array.isArray(response.data?.contacts)) {
            friends = response.data.contacts;
          } else if (Array.isArray(response.data?.friends)) {
            friends = response.data.friends;
          } else if (response.data?.data?.contacts) {
            friends = response.data.data.contacts;
          }

          if (friends.length > 0) break;
        } catch (err) {
          console.log(`${endpoint} failed`);
        }
      }

      // Filter out current user
      const filteredFriends = friends.filter(f => {
        const fId = f._id || f.id;
        return fId !== user?.id && fId !== user?._id;
      });

      setAvailableFriends(filteredFriends);
      setFilteredFriends(filteredFriends);
    } catch (error) {
      console.error('Failed to load friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleMember = (friendId) => {
    if (selectedMembers.includes(friendId)) {
      setSelectedMembers(selectedMembers.filter(id => id !== friendId));
    } else {
      setSelectedMembers([...selectedMembers, friendId]);
    }
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      addToast('Group name is required', 'error');
      return;
    }

    if (groupName.trim().length < 2) {
      addToast('Group name must be at least 2 characters', 'error');
      return;
    }

    try {
      setCreating(true);

      const response = await axios.post(
        `${API_URL}/groups`,
        {
          name: groupName.trim(),
          description: description.trim(),
          avatar: selectedAvatar,
          memberIds: selectedMembers
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        addToast('🎉 Group created successfully!', 'success');
        onGroupCreated?.(response.data.data);
        onClose();
      }
    } catch (error) {
      console.error('Failed to create group:', error);
      addToast(error.response?.data?.message || 'Failed to create group', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />

      {/* Modal - Full screen on mobile for better UX */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div className="bg-white dark:bg-gray-800 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[85vh] sm:m-4">
          
          {/* Header - Fixed */}
          <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Create Group
              </h2>
              <button
                onClick={onClose}
                disabled={creating}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"
              >
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-5">
              
              {/* Avatar Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Group Avatar
                </label>
                <div className="grid grid-cols-8 gap-2">
                  {availableAvatars.map((avatar) => (
                    <button
                      key={avatar}
                      type="button"
                      onClick={() => setSelectedAvatar(avatar)}
                      disabled={creating}
                      className={`text-2xl p-2 rounded-lg transition ${
                        selectedAvatar === avatar
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Group Name *
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Enter group name"
                  maxLength={100}
                  disabled={creating}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this group about?"
                  rows="2"
                  maxLength={500}
                  disabled={creating}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none disabled:opacity-50"
                />
              </div>

              {/* Add Members */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Add Members (Optional)
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  You can add members now or later
                </p>

                {/* Search */}
                <div className="relative mb-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search friends..."
                    disabled={creating}
                    className="w-full px-4 py-2 pl-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
                  />
                  <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {/* Selected count */}
                {selectedMembers.length > 0 && (
                  <div className="mb-2 px-3 py-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-between">
                    <span className="text-sm font-medium text-purple-800 dark:text-purple-300">
                      {selectedMembers.length} selected
                    </span>
                    <button
                      onClick={() => setSelectedMembers([])}
                      className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                )}

                {/* Friends List */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-40 overflow-y-auto">
                  {loading ? (
                    <div className="p-4 text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto"></div>
                    </div>
                  ) : filteredFriends.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                      {searchQuery ? 'No friends found' : 'No friends available'}
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredFriends.map((friend) => {
                        const friendId = friend._id || friend.id;
                        const isSelected = selectedMembers.includes(friendId);

                        return (
                          <button
                            key={friendId}
                            onClick={() => toggleMember(friendId)}
                            disabled={creating}
                            className="w-full px-3 py-2 flex items-center space-x-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
                          >
                            {friend.profilePicture ? (
                              <img
                                src={friend.profilePicture}
                                alt=""
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm font-semibold">
                                {(friend.fullName || friend.username || 'U').charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 text-left min-w-0">
                              <p className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">
                                {friend.fullName || friend.username}
                              </p>
                            </div>
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              isSelected
                                ? 'border-purple-600 bg-purple-600'
                                : 'border-gray-300 dark:border-gray-600'
                            }`}>
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
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
          </div>

          {/* Footer - Fixed */}
          <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 space-y-3 bg-white dark:bg-gray-800">
            <button
              onClick={handleCreate}
              disabled={!groupName.trim() || groupName.trim().length < 2 || creating}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-3 rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-md"
            >
              {creating ? (
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

            <button
              onClick={onClose}
              disabled={creating}
              className="w-full px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}