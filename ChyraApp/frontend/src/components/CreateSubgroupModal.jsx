import { useState, useEffect } from 'react';
import groupService from '../services/groupService';
import { useToast } from './Toast';

export default function CreateSubgroupModal({ parentGroup, onClose, onSubgroupCreated }) {
    const { addToast } = useToast();

    const [subgroupName, setSubgroupName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState('👥');
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [creating, setCreating] = useState(false);

    const availableAvatars = [
        '👥', '💻', '📱', '🎨', '🎵', '📚',
        '⚽', '🎮', '🍕', '✈️', '💼', '🎓'
    ];

    // Get parent group members (excluding current user if needed)
    const parentMembers = parentGroup?.participants?.filter(p => p.isActive) || [];

    const filteredMembers = searchQuery.trim() === ''
        ? parentMembers
        : parentMembers.filter(p => {
            const user = p.user;
            const username = user?.username?.toLowerCase() || '';
            const fullName = user?.fullName?.toLowerCase() || '';
            const query = searchQuery.toLowerCase();
            return username.includes(query) || fullName.includes(query);
        });

    const toggleMember = (participantId) => {
        if (selectedMembers.includes(participantId)) {
            setSelectedMembers(selectedMembers.filter(id => id !== participantId));
        } else {
            setSelectedMembers([...selectedMembers, participantId]);
        }
    };

    const handleCreate = async () => {
        if (!subgroupName.trim()) {
            addToast('Subgroup name is required', 'error');
            return;
        }

        if (subgroupName.trim().length < 2) {
            addToast('Subgroup name must be at least 2 characters', 'error');
            return;
        }

        if (selectedMembers.length === 0) {
            addToast('Please select at least one member', 'error');
            return;
        }

        try {
            setCreating(true);

            const subgroupData = {
                name: subgroupName.trim(),
                description: description.trim(),
                avatar: selectedAvatar,
                memberIds: selectedMembers
            };

            const newSubgroup = await groupService.createSubgroup(parentGroup._id, subgroupData);

            addToast('🎉 Subgroup created successfully!', 'success');
            onSubgroupCreated?.(newSubgroup);
            onClose();
        } catch (error) {
            console.error('Failed to create subgroup:', error);
            addToast(error.response?.data?.message || 'Failed to create subgroup', 'error');
        } finally {
            setCreating(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black bg-opacity-50 z-[60] animate-fadeIn"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl animate-scaleIn flex flex-col max-h-[85vh]">

                    {/* Header */}
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white flex-shrink-0">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-2xl font-bold">Create Subgroup</h2>
                            <button
                                onClick={onClose}
                                disabled={creating}
                                className="p-2 hover:bg-white/20 rounded-full transition disabled:opacity-50"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <p className="text-sm text-white/80">
                            From: {parentGroup?.name}
                        </p>
                    </div>

                    {/* Content - Scrollable */}
                    <div className="flex-1 overflow-y-auto">
                        <div className="p-6 space-y-4">

                            {/* Avatar Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Subgroup Avatar
                                </label>
                                <div className="grid grid-cols-6 gap-2">
                                    {availableAvatars.map((avatar) => (
                                        <button
                                            key={avatar}
                                            type="button"
                                            onClick={() => setSelectedAvatar(avatar)}
                                            disabled={creating}
                                            className={`text-3xl p-2 rounded-lg transition ${selectedAvatar === avatar
                                                    ? 'bg-indigo-100 dark:bg-indigo-900/30 ring-2 ring-indigo-500'
                                                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                                        >
                                            {avatar}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Subgroup Name */}
                            <div>
                                <label htmlFor="subgroupName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Subgroup Name *
                                </label>
                                <input
                                    id="subgroupName"
                                    type="text"
                                    value={subgroupName}
                                    onChange={(e) => setSubgroupName(e.target.value)}
                                    placeholder="e.g., Engineering, Marketing"
                                    maxLength={100}
                                    disabled={creating}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {subgroupName.length}/100 characters
                                </p>
                            </div>

                            {/* Description */}
                            <div>
                                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Description (Optional)
                                </label>
                                <textarea
                                    id="description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="What's this subgroup for?"
                                    rows="2"
                                    maxLength={500}
                                    disabled={creating}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none disabled:opacity-50"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {description.length}/500 characters
                                </p>
                            </div>

                            {/* Member Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Select Members * ({selectedMembers.length} selected)
                                </label>

                                {/* Search */}
                                <div className="relative mb-3">
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search members..."
                                        disabled={creating}
                                        className="w-full px-4 py-2 pl-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                                    />
                                    <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>

                                {/* Members List */}
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-64 overflow-y-auto">
                                    {filteredMembers.length === 0 ? (
                                        <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                                            {searchQuery ? 'No members found' : 'No members available'}
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                            {filteredMembers.map((participant) => {
                                                const user = participant.user;
                                                const userId = user?._id || user?.id || user;
                                                const isSelected = selectedMembers.includes(userId.toString());

                                                return (
                                                    <button
                                                        key={userId}
                                                        onClick={() => toggleMember(userId.toString())}
                                                        disabled={creating}
                                                        className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
                                                    >
                                                        {/* Avatar */}
                                                        <div className="relative flex-shrink-0">
                                                            {user?.profilePicture ? (
                                                                <img
                                                                    src={user.profilePicture}
                                                                    alt={user.username}
                                                                    className="w-10 h-10 rounded-full object-cover"
                                                                />
                                                            ) : (
                                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-semibold">
                                                                    {(user?.fullName || user?.username || 'U').charAt(0).toUpperCase()}
                                                                </div>
                                                            )}

                                                            {isSelected && (
                                                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800">
                                                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                    </svg>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* User Info */}
                                                        <div className="flex-1 text-left min-w-0">
                                                            <p className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm">
                                                                {user?.fullName || user?.username}
                                                            </p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                                @{user?.username}
                                                            </p>
                                                        </div>

                                                        {/* Checkbox */}
                                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${isSelected
                                                                ? 'border-indigo-600 bg-indigo-600'
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

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-3 flex-shrink-0">
                        <button
                            onClick={handleCreate}
                            disabled={!subgroupName.trim() || subgroupName.trim().length < 2 || selectedMembers.length === 0 || creating}
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-md"
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
                                    <span>Create Subgroup</span>
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

            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes scaleIn {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .animate-scaleIn {
          animation: scaleIn 0.2s ease-out;
        }
      `}</style>
        </>
    );
}