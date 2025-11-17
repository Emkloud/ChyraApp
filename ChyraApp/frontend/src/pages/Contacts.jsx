import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from '../services/userService';
import { useToast } from '../components/Toast';
import UserAvatar from '../components/UserAvatar';
import OnlineStatus from '../components/OnlineStatus';
import CallButton from '../components/CallButton';

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const data = await userService.getContacts();
      setContacts(data);
    } catch (error) {
      console.error('Load contacts error:', error);
      addToast(error.message || 'Failed to load contacts', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = async (contactId) => {
    try {
      navigate(`/chats?userId=${contactId}`);
    } catch (error) {
      console.error('Start chat error:', error);
      addToast('Failed to start chat', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Contacts
            </h1>
            <button
              onClick={() => navigate('/sync-contacts')}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition shadow-md"
            >
              📱 Sync Contacts
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4">
        {/* Find Friends Banner */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl shadow-lg p-6 text-white mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold mb-2">📱 Find Friends on ChyraApp</h3>
              <p className="text-sm text-purple-100 mb-4">
                Sync your phone contacts or search by username to connect with friends instantly!
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => navigate('/sync-contacts')}
                  className="px-6 py-2 bg-white text-purple-600 rounded-lg font-medium hover:bg-purple-50 transition shadow-md"
                >
                  📱 Sync Contacts
                </button>
                <button
                  onClick={() => navigate('/find-friends')}
                  className="px-6 py-2 bg-white/20 text-white rounded-lg font-medium hover:bg-white/30 transition"
                >
                  🔍 Search Users
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Contacts List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="text-gray-600 dark:text-gray-400 mt-4">Loading contacts...</p>
          </div>
        ) : contacts.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No Contacts Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Start connecting with friends to see them here
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate('/sync-contacts')}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition shadow-lg"
              >
                📱 Sync Phone Contacts
              </button>
              <button
                onClick={() => navigate('/find-friends')}
                className="px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition"
              >
                🔍 Search by Username
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {contacts.length} {contacts.length === 1 ? 'Contact' : 'Contacts'}
              </p>
            </div>

            {contacts.map((contact) => (
              <div
                key={contact._id}
                className="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center justify-between hover:shadow-md transition border border-gray-200 dark:border-gray-700"
              >
                {/* Left side - User info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="relative flex-shrink-0">
                    <UserAvatar user={contact} size="md" />
                    <OnlineStatus user={contact} className="absolute bottom-0 right-0" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                      {contact.username}
                    </h3>
                    {contact.fullName && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {contact.fullName}
                      </p>
                    )}
                    {contact.bio && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-1">
                        {contact.bio}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right side - Actions */}
                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  {/* Call Button */}
                  <CallButton
                    userId={contact._id}
                    userName={contact.username}
                    size="sm"
                  />

                  {/* Message Button */}
                  <button
                    onClick={() => handleStartChat(contact._id)}
                    className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center hover:bg-purple-200 dark:hover:bg-purple-900/50 transition"
                    title="Send message"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </button>

                  {/* View Profile Button */}
                  <button
                    onClick={() => navigate(`/profile/${contact._id}`)}
                    className="w-10 h-10 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                    title="View profile"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}