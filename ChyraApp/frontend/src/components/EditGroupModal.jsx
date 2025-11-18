import { useState } from 'react';
import groupService from '../services/groupService';
import { useToast } from './Toast';

export default function EditGroupModal({ group, onClose, onGroupUpdated }) {
    const { addToast } = useToast();

    const [groupName, setGroupName] = useState(group?.name || '');
    const [description, setDescription] = useState(group?.description || '');
    const [selectedAvatar, setSelectedAvatar] = useState(group?.avatar || '👥');
    const [saving, setSaving] = useState(false);

    const availableAvatars = [
        '👥', '👨‍👩‍👧‍👦', '💼', '🎓', '🎮', '⚽',
        '🎵', '🍕', '✈️', '💻', '📚', '🎨',
        '🏃', '🎬', '🎤', '🎸', '🏀', '⚡'
    ];

    const handleSave = async () => {
        if (!groupName.trim()) {
            addToast('Group name is required', 'error');
            return;
        }

        if (groupName.trim().length < 2) {
            addToast('Group name must be at least 2 characters', 'error');
            return;
        }

        try {
            setSaving(true);

            const updateData = {
                name: groupName.trim(),
                description: description.trim(),
                avatar: selectedAvatar
            };

            const updatedGroup = await groupService.updateGroup(group._id, updateData);

            addToast('Group updated successfully', 'success');
            onGroupUpdated?.(updatedGroup);
            onClose();
        } catch (error) {
            console.error('Failed to update group:', error);
            addToast(error.response?.data?.message || 'Failed to update group', 'error');
        } finally {
            setSaving(false);
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
                <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl animate-scaleIn overflow-hidden">

                    {/* Header */}
                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-bold">Edit Group</h2>
                            <button
                                onClick={onClose}
                                disabled={saving}
                                className="p-2 hover:bg-white/20 rounded-full transition disabled:opacity-50"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">

                        {/* Avatar Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                Group Avatar
                            </label>
                            <div className="grid grid-cols-6 gap-3">
                                {availableAvatars.map((avatar) => (
                                    <button
                                        key={avatar}
                                        type="button"
                                        onClick={() => setSelectedAvatar(avatar)}
                                        disabled={saving}
                                        className={`text-3xl p-3 rounded-xl transition transform hover:scale-110 ${selectedAvatar === avatar
                                                ? 'bg-purple-100 dark:bg-purple-900/30 ring-2 ring-purple-500 scale-110'
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
                                type="text"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                placeholder="e.g., Family, Work Team"
                                maxLength={100}
                                disabled={saving}
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <div className="flex items-center justify-between mt-2">
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {groupName.length}/100 characters
                                </p>
                                {groupName.trim().length > 0 && groupName.trim().length < 2 && (
                                    <p className="text-xs text-red-500">
                                        Too short (min 2 characters)
                                    </p>
                                )}
                            </div>
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
                                placeholder="What's this group about?"
                                rows="4"
                                maxLength={500}
                                disabled={saving}
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                {description.length}/500 characters
                            </p>
                        </div>

                        {/* Preview */}
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Preview</p>
                            <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-2xl shadow-md">
                                    {selectedAvatar}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                                        {groupName || 'Group Name'}
                                    </p>
                                    {description && (
                                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                            {description}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-gray-200 dark:border-gray-700 space-y-3">
                        <button
                            onClick={handleSave}
                            disabled={!groupName.trim() || groupName.trim().length < 2 || saving}
                            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                        >
                            {saving ? (
                                <>
                                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Save Changes</span>
                                </>
                            )}
                        </button>

                        <button
                            onClick={onClose}
                            disabled={saving}
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