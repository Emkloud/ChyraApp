import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import groupService from '../services/groupService';
import { useToast } from './Toast';

export default function AddMembersModal({ group, onClose, onMembersAdded }) {
    const { user } = useAuth();
    const { addToast } = useToast();

    const [availableMembers, setAvailableMembers] = useState([]);
    const [filteredMembers, setFilteredMembers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        // For now, show empty state
        // TODO: Replace with actual friends/contacts API
        setLoading(false);
        setAvailableMembers([]);
        setFilteredMembers([]);
    }, []);

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredMembers(availableMembers);
        } else {
            const filtered = availableMembers.filter(member =>
                member.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                member.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                member.email?.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setFilteredMembers(filtered);
        }
    }, [searchQuery, availableMembers]);

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
                className="fixed inset-0 bg-black bg-opacity-50 z-[60] animate-fadeIn"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl animate-scaleIn flex flex-col max-h-[80vh]">

                    {/* Header */}
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Add Members</h2>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"
                            >
                                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                placeholder="Search by phone or username..."
                                className="w-full px-4 py-3 pl-11 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>

                        {/* Selected Count */}
                        {selectedMembers.length > 0 && (
                            <div className="mt-4 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-between">
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
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                                <svg className="w-20 h-20 text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    Add Members By Phone or Username
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                    {searchQuery
                                        ? 'Search for a phone number or username above'
                                        : 'Enter a phone number or username to add members'}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                    Coming soon: Contact sync and friend suggestions
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                        <button
                            onClick={handleAddMembers}
                            disabled={selectedMembers.length === 0 || adding}
                            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                        >
                            {adding ? (
                                <>
                                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Adding...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                    </svg>
                                    <span>Add {selectedMembers.length > 0 ? `(${selectedMembers.length})` : 'Members'}</span>
                                </>
                            )}
                        </button>

                        <button
                            onClick={onClose}
                            disabled={adding}
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