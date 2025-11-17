import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function SyncContacts() {
  const [syncing, setSyncing] = useState(false);
  const [matches, setMatches] = useState([]);
  const [stats, setStats] = useState(null);
  const [sending, setSending] = useState({});
  const { addToast } = useToast();
  const navigate = useNavigate();

  // ✅ NEW: Request native contacts access
  const handleRequestContacts = async () => {
    try {
      // Check if Contacts API is supported
      if (!('contacts' in navigator)) {
        addToast('Contact sync is not supported on this device/browser', 'error');
        return;
      }

      setSyncing(true);
      addToast('📱 Requesting contacts access...', 'info');

      // Request contacts from device
      const props = ['name', 'tel'];
      const opts = { multiple: true };

      const contacts = await navigator.contacts.select(props, opts);
      
      if (!contacts || contacts.length === 0) {
        addToast('No contacts selected', 'info');
        setSyncing(false);
        return;
      }

      // Format contacts for API
      const phoneNumbers = contacts
        .map(contact => {
          const phones = contact.tel || [];
          return phones.map(tel => tel.replace(/\D/g, '')); // Remove non-digits
        })
        .flat()
        .filter(phone => phone.length >= 10); // Valid phone numbers

      if (phoneNumbers.length === 0) {
        addToast('No valid phone numbers found', 'error');
        setSyncing(false);
        return;
      }

      // Send to backend
      await syncWithBackend(phoneNumbers);

    } catch (error) {
      console.error('Contact access error:', error);
      if (error.name === 'AbortError') {
        addToast('Contact access cancelled', 'info');
      } else {
        addToast('Failed to access contacts', 'error');
      }
    } finally {
      setSyncing(false);
    }
  };

  const syncWithBackend = async (phoneNumbers) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/contacts/sync`,
        { contacts: phoneNumbers.map(phone => ({ phone: `+${phone}` })) },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setMatches(response.data.data.matches || []);
        setStats({
          scanned: response.data.data.totalScanned,
          matched: response.data.data.totalMatched
        });

        if (response.data.data.totalMatched > 0) {
          addToast(`🎉 Found ${response.data.data.totalMatched} contacts on ChyraApp!`, 'success');
        } else {
          addToast('No contacts found on ChyraApp yet', 'info');
        }
      }
    } catch (error) {
      console.error('Sync error:', error);
      addToast(error.response?.data?.message || 'Failed to sync contacts', 'error');
    }
  };

  const handleSendRequest = async (userId) => {
    try {
      setSending({ ...sending, [userId]: true });
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/contacts/request`,
        { receiverId: userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      addToast('Friend request sent!', 'success');
      setMatches(prev => prev.filter(u => u._id !== userId));
    } catch (error) {
      console.error('Send request error:', error);
      addToast(error.response?.data?.message || 'Failed to send request', 'error');
    } finally {
      setSending({ ...sending, [userId]: false });
    }
  };

  // Check if Contacts API is supported
  const isContactsSupported = 'contacts' in navigator && 'ContactsManager' in window;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Sync Contacts
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-w-2xl mx-auto">
        {/* Feature Not Supported Warning */}
        {!isContactsSupported && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 mb-4">
            <div className="flex gap-3">
              <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                  Contact Sync Not Available
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                  Your browser doesn't support automatic contact syncing. Please use:
                </p>
                <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1 ml-4 list-disc">
                  <li>Chrome or Edge on Android</li>
                  <li>Safari on iOS (coming soon)</li>
                  <li>Or search by phone number manually</li>
                </ul>
                <button
                  onClick={() => navigate('/find-friends')}
                  className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 transition text-sm"
                >
                  Search by Phone Number
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sync Button */}
        {isContactsSupported && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Find Your Contacts
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Sync your phone contacts to see who's on ChyraApp
              </p>
            </div>

            <button
              onClick={handleRequestContacts}
              disabled={syncing}
              className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {syncing ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Syncing Contacts...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Sync Phone Contacts</span>
                </>
              )}
            </button>

            <div className="mt-4 flex items-start gap-2 text-sm text-gray-500 dark:text-gray-400">
              <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>
                Your contacts are securely encrypted. We never store your phone numbers or share them with anyone.
              </p>
            </div>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-semibold text-blue-900 dark:text-blue-100">
                  Scanned {stats.scanned} contacts
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Found {stats.matched} on ChyraApp
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Matched Contacts */}
        {matches.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
              Contacts on ChyraApp ({matches.length})
            </h3>
            {matches.map(match => (
              <div
                key={match._id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold">
                  {match.username?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    @{match.username}
                  </h3>
                  {match.fullName && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {match.fullName}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleSendRequest(match._id)}
                  disabled={sending[match._id]}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition disabled:opacity-50 text-sm"
                >
                  {sending[match._id] ? 'Sending...' : 'Add Friend'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* No matches yet */}
        {stats && matches.length === 0 && (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Contacts on ChyraApp Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Invite your friends to join ChyraApp!
            </p>
            <button
              onClick={() => navigate('/find-friends?tab=invite')}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition"
            >
              Share Invite Link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}