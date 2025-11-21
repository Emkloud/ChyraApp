import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import groupService from '../services/groupService';
import { useToast } from './Toast';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function AddMembersModal({ group, onClose, onMembersAdded }) {
    const { user } = useAuth();
    const { addToast } = useToast();
    const token = localStorage.getItem('token');

    const [availableMembers, setAvailableMembers] = useState([]);
    const [filteredMembers, setFilteredMembers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);

    // Fetch available users on mount
    useEffect(() => {
        fetchAvailableMembers();
    }, []);

    // Filter members based on search
    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredMembers(availableMembers);
        } else {
            const query = searchQuery.toLowerCase();
            const filtered = availableMembers.filter(member =>
                member.username?.toLowerCase().includes(query) ||
                member.fullName?.toLowerCase().includes(query) ||
                member.email?.toLowerCase().includes(query) ||
                member.phoneNumber?.includes(searchQuery)
            );
            setFilteredMembers(filtered);
        }
    }, [searchQuery, availableMembers]);

    const fetchAvailableMembers = async () => {
        try {
            setLoading(true);
            
            let usersList = [];
            
            // Fetch all users from the API
            const response = await axios.get(`${API_URL}/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            console.log('Users API response:', response.data);
            
            // Parse the response - handle nested data structure
            if (response.data?.data?.users) {
                usersList = response.data.data.users;
            } else if (Array.isArray(response.data?.data)) {
                usersList = response.data.data;
            } else if (Array.isArray(response.data?.users)) {
                usersList = response.data.users;
            } else if (Array.isArray(response.data)) {
                usersList = response.data;
            }
            
            console.log('Parsed users:', usersList.length);

            // Get current group member IDs
            const currentMemberIds = (group?.participants || [])
                .filter(p => p.isActive !== false)
                .map(p => {
                    const id = p.user?._id || p.user?.id || p.user;
                    return id?.toString();
                })
                .filter(Boolean);

            console.log('Current member IDs:', currentMemberIds);

            // Get current user ID
            const currentUserId = user?.id || user?._id;

            // Filter out users already in the group
            const available = usersList.filter(u => {
                const odId = (u._id || u.id)?.toString();
                
                // Skip if no ID
                if (!odId) return false;
                
                // Skip if already in group
                if (currentMemberIds.includes(odId)) return false;
                
                return true;
            });

            console.log('Available to add:', available.length);
            setAvailableMembers(available);
            setFilteredMembers(available);
            
        } catch (error) {
            console.error('Failed to fetch users:', error);
            addToast('Failed to load users', 'error');
        } finally {
            setLoading(false);
        }
    };

    const toggleMember = (member) => {
        const memberId = member._id || member.id;

        if (selectedMembers.find(m => (m._id || m.id) === memberId)) {
            setSelectedMembers(selectedMembers.filter(m => (m._id || m.id) !== memberId));
        } else {
            setSelectedMembers([...selectedMembers, member]);
        }
    };

    const handleAddMembers = async () => {
        if (selectedMembers.length === 0) {
            addToast('Please select at least one member', 'error');
            return;
        }

        try {
            setAdding(true);

            const memberIds = selectedMembers.map(m => m._id || m.id);

            const updatedGroup = await groupService.addMembers(group._id, memberIds);

            addToast(`Added ${selectedMembers.length} member${selectedMembers.length > 1 ? 's' : ''} successfully`, 'success');

            onMembersAdded?.(updatedGroup);
            onClose();
        } catch (error) {
            console.error('Failed to add members:', error);
            addToast(error.response?.data?.message || 'Failed to add members', 'error');
        } finally {
            setAdding(false);
        }
    };

    const isMemberSelected = (member) => {
        const memberId = member._id || member.id;
        return selectedMembers.some(m => (m._id || m.id) === memberId);
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black bg-opacity-50 z-[60]"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center z-[60]">
                <div className="bg-white dark:bg-gray-800 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh]">

                    {/* Header */}
                    <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Add Members</h2>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"
                            >
                                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div className="relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by name or username..."
                                className="w-full px-4 py-2.5 pl-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                            />
                            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>

                        {/* Selected Count */}
                        {selectedMembers.length > 0 && (
                            <div className="mt-3 px-3 py-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-between">
                                <span className="text-sm font-medium text-purple-800 dark:text-purple-300">
                                    {selectedMembers.length} member{selectedMembers.length > 1 ? 's' : ''} selected
                                </span>
                                <button
                                    onClick={() => setSelectedMembers([])}
                                    className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                                >
                                    Clear
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                            </div>
                        ) : filteredMembers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                                <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    {searchQuery ? 'No users found' : 'No users available'}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {searchQuery 
                                        ? 'Try a different search term'
                                        : 'All users are already in this group'
                                    }
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                {filteredMembers.map((member) => {
                                    const memberId = member._id || member.id;
                                    const isSelected = isMemberSelected(member);

                                    return (
                                        <button
                                            key={memberId}
                                            onClick={() => toggleMember(member)}
                                            disabled={adding}
                                            className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
                                        >
                                            {/* Avatar */}
                                            <div className="relative flex-shrink-0">
                                                {member.profilePicture ? (
                                                    <img
                                                        src={member.profilePicture}
                                                        alt={member.username}
                                                        className="w-10 h-10 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold">
                                                        {(member.fullName || member.username || 'U').charAt(0).toUpperCase()}
                                                    </div>
                                                )}

                                                {isSelected && (
                                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800">
                                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>

                                            {/* User Info */}
                                            <div className="flex-1 text-left min-w-0">
                                                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                                    {member.fullName || member.username}
                                                </p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                                    @{member.username}
                                                </p>
                                            </div>

                                            {/* Checkbox */}
                                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
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

                    {/* Footer */}
                    <div className="flex-shrink-0 px-4 py-3 border-t border-gray-200 dark:border-gray-700 space-y-2 bg-white dark:bg-gray-800">
                        <button
                            onClick={handleAddMembers}
                            disabled={selectedMembers.length === 0 || adding}
                            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2.5 rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm"
                        >
                            {adding ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Adding...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                    </svg>
                                    <span>Add {selectedMembers.length > 0 ? `(${selectedMembers.length})` : 'Members'}</span>
                                </>
                            )}
                        </button>

                        <button
                            onClick={onClose}
                            disabled={adding}
                            className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition disabled:opacity-50 text-sm"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}