import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function FindFriends() {
  const [activeTab, setActiveTab] = useState('search'); // search, phone, invite
  const [searchQuery, setSearchQuery] = useState('');
  const [phoneQuery, setPhoneQuery] = useState(''); // ✅ NEW
  const [searchResults, setSearchResults] = useState([]);
  const [phoneResult, setPhoneResult] = useState(null); // ✅ NEW
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState({});
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleSearch = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/users/search?q=${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const users = response.data?.data?.users || response.data?.users || response.data || [];
      setSearchResults(users);
    } catch (error) {
      console.error('Search error:', error);
      addToast('Failed to search users', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: Phone search
  const handlePhoneSearch = async (phone) => {
    if (!phone.trim()) {
      setPhoneResult(null);
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/contacts/search-phone?phone=${phone}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setPhoneResult(response.data.data.user);
      }
    } catch (error) {
      console.error('Phone search error:', error);
      if (error.response?.status === 404) {
        addToast('No user found with this phone number', 'error');
      } else {
        addToast('Failed to search by phone', 'error');
      }
      setPhoneResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery.length >= 2) {
        handleSearch(searchQuery);
      }
    }, 500);

    return () => clearTimeout(debounce);
  }, [searchQuery]);

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
      setSearchResults(prev => prev.filter(u => u._id !== userId));
      setPhoneResult(null);
    } catch (error) {
      console.error('Send request error:', error);
      addToast(error.response?.data?.message || 'Failed to send request', 'error');
    } finally {
      setSending({ ...sending, [userId]: false });
    }
  };

  const handleCopyInviteLink = () => {
    const inviteLink = `${window.location.origin}/register?ref=${user.username}`;
    navigator.clipboard.writeText(inviteLink);
    addToast('Invite link copied!', 'success');
  };

  const handleShareInvite = async () => {
    const inviteLink = `${window.location.origin}/register?ref=${user.username}`;
    const text = `Join me on ChyraApp! 🚀\n\nChyraApp is a modern messaging app with real-time chat, video calls, and file sharing.\n\n${inviteLink}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join ChyraApp',
          text: text,
          url: inviteLink
        });
        addToast('Invite shared!', 'success');
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Share error:', error);
          handleCopyInviteLink();
        }
      }
    } else {
      handleCopyInviteLink();
    }
  };

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
            Find Friends
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 px-4 py-3 font-medium transition ${
              activeTab === 'search'
                ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            🔍 Search
          </button>
          {/* ✅ NEW: Phone tab */}
          <button
            onClick={() => setActiveTab('phone')}
            className={`flex-1 px-4 py-3 font-medium transition ${
              activeTab === 'phone'
                ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            📱 Phone
          </button>
          <button
            onClick={() => setActiveTab('invite')}
            className={`flex-1 px-4 py-3 font-medium transition ${
              activeTab === 'invite'
                ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            ✉️ Invite
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* SEARCH TAB */}
        {activeTab === 'search' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by username or email..."
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                💡 Tip: Search by @username or email address
              </p>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-2">
                {searchResults.map(result => (
                  <div
                    key={result._id}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold">
                      {result.username?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        @{result.username}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {result.email}
                      </p>
                    </div>
                    <button
                      onClick={() => handleSendRequest(result._id)}
                      disabled={sending[result._id]}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition disabled:opacity-50"
                    >
                      {sending[result._id] ? 'Sending...' : 'Add Friend'}
                    </button>
                  </div>
                ))}
              </div>
            ) : searchQuery.length >= 2 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-gray-500 dark:text-gray-400">No users found</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Try a different search term</p>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Find Your Friends
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Search for people by their username or email
                </p>
              </div>
            )}
          </div>
        )}

        {/* ✅ NEW: PHONE TAB */}
        {activeTab === 'phone' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <input
                  type="tel"
                  value={phoneQuery}
                  onChange={(e) => setPhoneQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handlePhoneSearch(phoneQuery);
                    }
                  }}
                  placeholder="+1234567890"
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                📱 Enter phone number with country code (e.g., +1234567890)
              </p>
              <button
                onClick={() => handlePhoneSearch(phoneQuery)}
                disabled={!phoneQuery.trim() || loading}
                className="mt-3 w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition disabled:opacity-50"
              >
                {loading ? 'Searching...' : '🔍 Search by Phone'}
              </button>
            </div>

            {phoneResult && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold">
                  {phoneResult.username?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    @{phoneResult.username}
                  </h3>
                  {phoneResult.fullName && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {phoneResult.fullName}
                    </p>
                  )}
                  {phoneResult.phoneNumber && (
                    <p className="text-xs text-gray-400">
                      {phoneResult.phoneNumber}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleSendRequest(phoneResult._id)}
                  disabled={sending[phoneResult._id]}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition disabled:opacity-50"
                >
                  {sending[phoneResult._id] ? 'Sending...' : 'Add Friend'}
                </button>
              </div>
            )}

            {/* Bulk Sync Option */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                    Have Multiple Contacts?
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                    Sync all your phone contacts at once to find friends faster!
                  </p>
                  <button
                    onClick={() => navigate('/sync-contacts')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition text-sm"
                  >
                    📱 Sync All Contacts
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* INVITE TAB */}
        {activeTab === 'invite' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Invite Friends to ChyraApp
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Share your invite link with friends
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Your Invite Link:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={`${window.location.origin}/register?ref=${user.username}`}
                    readOnly
                    className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white"
                  />
                  <button
                    onClick={handleCopyInviteLink}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-500 transition"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <button
                onClick={handleShareInvite}
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition shadow-lg"
              >
                📤 Share Invite Link
              </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                Why invite friends?
              </h3>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <span className="text-2xl">💬</span>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">Stay Connected</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Chat in real-time with friends and family</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="text-2xl">📞</span>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">Video & Voice Calls</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Make free HD video and voice calls</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="text-2xl">📁</span>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">Share Files</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Send photos, videos, and documents easily</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}