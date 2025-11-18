import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import groupService from '../services/groupService';
import { useToast } from './Toast';

export default function GroupInfoModal({ group, onClose, onGroupUpdated, onGroupDeleted }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { addToast } = useToast();

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const [showAddMembers, setShowAddMembers] = useState(false);
    const [showEditGroup, setShowEditGroup] = useState(false);
    const [showCreateSubgroup, setShowCreateSubgroup] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [leaving, setLeaving] = useState(false);

    const currentUserId = user?._id || user?.id;

    // Check if current user is admin
    const isAdmin = group?.participants?.some(p => {
        const participantId = p.user?._id || p.user?.id || p.user;
        return participantId?.toString() === currentUserId?.toString() && p.role === 'admin' && p.isActive;
    });

    // Check if current user is creator
    const isCreator = (group?.createdBy?._id || group?.createdBy)?.toString() === currentUserId?.toString();

    // Get active members
    const activeMembers = group?.participants?.filter(p => p.isActive) || [];
    const memberCount = activeMembers.length;

    const handleDeleteGroup = async () => {
        if (!isCreator) {
            addToast('Only the creator can delete the group', 'error');
            return;
        }

        try {
            setDeleting(true);
            await groupService.deleteGroup(group._id);
            addToast('Group deleted successfully', 'success');
            onGroupDeleted?.(group._id);
            onClose();
            navigate('/groups');
        } catch (error) {
            console.error('Delete group error:', error);
            addToast(error.response?.data?.message || 'Failed to delete group', 'error');
        } finally {
            setDeleting(false);
        }
    };

    const handleLeaveGroup = async () => {
        if (isCreator) {
            addToast('Creator cannot leave the group. Delete it instead.', 'error');
            return;
        }

        try {
            setLeaving(true);
            await groupService.removeMember(group._id, currentUserId);
            addToast('Left group successfully', 'success');
            onClose();
            navigate('/groups');
        } catch (error) {
            console.error('Leave group error:', error);
            addToast(error.response?.data?.message || 'Failed to leave group', 'error');
        } finally {
            setLeaving(false);
        }
    };

    const canCreateSubgroup = isAdmin && !group?.isSubgroup;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black bg-opacity-50 z-50 animate-fadeIn"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center z-50 animate-slideUp">
                <div className="bg-white dark:bg-gray-800 rounded-t-2xl md:rounded-2xl w-full md:max-w-lg md:mx-4 shadow-2xl overflow-hidden">

                    {/* Header */}
                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
                        <div className="flex items-center space-x-4">
                            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl shadow-lg">
                                {group?.avatar || '👥'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-xl font-bold truncate">{group?.name || 'Group Info'}</h2>
                                <p className="text-sm text-white/80">
                                    {memberCount} member{memberCount !== 1 ? 's' : ''}
                                    {group?.isSubgroup && ' • Subgroup'}
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/20 rounded-full transition"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Delete/Leave Confirmation */}
                    {showDeleteConfirm && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 animate-fadeIn">
                            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 mx-4 max-w-sm w-full shadow-2xl animate-scaleIn">
                                <div className="text-center mb-6">
                                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                                        Delete Group?
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-400">
                                        This will permanently delete "{group?.name}" and all its messages. This action cannot be undone.
                                    </p>
                                </div>
                                <div className="flex space-x-3">
                                    <button
                                        onClick={() => setShowDeleteConfirm(false)}
                                        disabled={deleting}
                                        className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleDeleteGroup}
                                        disabled={deleting}
                                        className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center"
                                    >
                                        {deleting ? (
                                            <>
                                                <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Deleting...
                                            </>
                                        ) : (
                                            'Delete'
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {showLeaveConfirm && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 animate-fadeIn">
                            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 mx-4 max-w-sm w-full shadow-2xl animate-scaleIn">
                                <div className="text-center mb-6">
                                    <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                                        Leave Group?
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-400">
                                        You will no longer receive messages from "{group?.name}". You can be added back by an admin.
                                    </p>
                                </div>
                                <div className="flex space-x-3">
                                    <button
                                        onClick={() => setShowLeaveConfirm(false)}
                                        disabled={leaving}
                                        className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleLeaveGroup}
                                        disabled={leaving}
                                        className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition disabled:opacity-50 flex items-center justify-center"
                                    >
                                        {leaving ? (
                                            <>
                                                <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Leaving...
                                            </>
                                        ) : (
                                            'Leave'
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Menu Options */}
                    <div className="max-h-[60vh] overflow-y-auto">
                        {/* View Members */}
                        <button
                            onClick={() => {
                                // TODO: Implement view members modal
                                addToast('View members feature coming soon', 'info');
                            }}
                            className="w-full px-6 py-4 flex items-center space-x-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition border-b border-gray-100 dark:border-gray-700"
                        >
                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            </div>
                            <div className="flex-1 text-left">
                                <p className="font-medium text-gray-900 dark:text-gray-100">View Members</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{memberCount} member{memberCount !== 1 ? 's' : ''}</p>
                            </div>
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>

                        {/* Add Members (Admin only) */}
                        {isAdmin && (
                            <button
                                onClick={() => setShowAddMembers(true)}
                                className="w-full px-6 py-4 flex items-center space-x-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition border-b border-gray-100 dark:border-gray-700"
                            >
                                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                    </svg>
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-medium text-gray-900 dark:text-gray-100">Add Members</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Invite people to this group</p>
                                </div>
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        )}

                        {/* Edit Group (Admin only) */}
                        {isAdmin && (
                            <button
                                onClick={() => setShowEditGroup(true)}
                                className="w-full px-6 py-4 flex items-center space-x-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition border-b border-gray-100 dark:border-gray-700"
                            >
                                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                                    <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-medium text-gray-900 dark:text-gray-100">Edit Group</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Change name, description, avatar</p>
                                </div>
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        )}

                        {/* Create Subgroup (Parent admin only) */}
                        {canCreateSubgroup && (
                            <button
                                onClick={() => setShowCreateSubgroup(true)}
                                className="w-full px-6 py-4 flex items-center space-x-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition border-b border-gray-100 dark:border-gray-700"
                            >
                                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-medium text-gray-900 dark:text-gray-100">Create Subgroup</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Organize members into subgroups</p>
                                </div>
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        )}

                        {/* Group Settings (Admin only) */}
                        {isAdmin && (
                            <button
                                onClick={() => {
                                    // TODO: Implement settings modal
                                    addToast('Group settings coming soon', 'info');
                                }}
                                className="w-full px-6 py-4 flex items-center space-x-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition border-b border-gray-100 dark:border-gray-700"
                            >
                                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-medium text-gray-900 dark:text-gray-100">Group Settings</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Manage permissions and settings</p>
                                </div>
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        )}

                        {/* Leave Group */}
                        {!isCreator && (
                            <button
                                onClick={() => setShowLeaveConfirm(true)}
                                className="w-full px-6 py-4 flex items-center space-x-4 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition border-b border-gray-100 dark:border-gray-700"
                            >
                                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                                    <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-medium text-orange-600 dark:text-orange-400">Leave Group</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">You can be added back by admins</p>
                                </div>
                            </button>
                        )}

                        {/* Delete Group (Creator only) */}
                        {isCreator && (
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="w-full px-6 py-4 flex items-center space-x-4 hover:bg-red-50 dark:hover:bg-red-900/10 transition"
                            >
                                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                                    <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-medium text-red-600 dark:text-red-400">Delete Group</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Permanently delete this group</p>
                                </div>
                            </button>
                        )}
                    </div>

                    {/* Cancel Button */}
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                            onClick={onClose}
                            className="w-full px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>

            {/* Render other modals */}
            {showAddMembers && (
                <div className="fixed inset-0 z-[60]">
                    {/* AddMembersModal will be imported and used here */}
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full">
                            <h3 className="text-xl font-bold mb-4">Add Members</h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-4">
                                AddMembersModal component coming next...
                            </p>
                            <button
                                onClick={() => setShowAddMembers(false)}
                                className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showEditGroup && (
                <div className="fixed inset-0 z-[60]">
                    {/* EditGroupModal will be imported and used here */}
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full">
                            <h3 className="text-xl font-bold mb-4">Edit Group</h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-4">
                                EditGroupModal component coming next...
                            </p>
                            <button
                                onClick={() => setShowEditGroup(false)}
                                className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showCreateSubgroup && (
                <div className="fixed inset-0 z-[60]">
                    {/* CreateSubgroupModal will be imported and used here */}
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full">
                            <h3 className="text-xl font-bold mb-4">Create Subgroup</h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-4">
                                CreateSubgroupModal component coming next...
                            </p>
                            <button
                                onClick={() => setShowCreateSubgroup(false)}
                                className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
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

        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }

        .animate-scaleIn {
          animation: scaleIn 0.2s ease-out;
        }
      `}</style>
        </>
    );
}