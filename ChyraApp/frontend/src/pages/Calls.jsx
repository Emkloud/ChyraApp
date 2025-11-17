import { useEffect, useMemo, useState } from 'react';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import { getCallHistory } from '../services/callService';
import Loading from '../components/Loading';
import { userService } from '../services/userService';
import UserAvatar from '../components/UserAvatar';
import CallButton from '../components/CallButton';
import { useSocket } from '../context/SocketContext';

export default function Calls() {
  const [activeTab, setActiveTab] = useState('history'); // 'history' | 'contacts'
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'missed' | 'outgoing'
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const { onlineUsers } = useSocket();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const history = await getCallHistory();
        // Normalize records
        const items = (history || []).map((c) => {
          const callerId = c.caller?._id || c.callerId;
          const receiverId = c.receiver?._id || c.receiverId;
          const isOutgoing = callerId === user.id;
          const other = isOutgoing ? (c.receiver || {}) : (c.caller || {});
          const name = other.username || other.name || 'Unknown';
          const startedAt = c.startedAt ? new Date(c.startedAt) : new Date();
          const hasVideo = (c.callType || c.type) === 'video';
          const status = c.status || (c.endedAt ? 'ended' : 'ongoing');
          const durationSec = c.durationSec || c.duration || 0;
          return {
            id: c._id,
            name,
            type: isOutgoing ? 'outgoing' : 'incoming',
            status,
            durationSec,
            time: startedAt,
            hasVideo
          };

  useEffect(() => {
    const handler = setTimeout(async () => {
      const q = searchQuery.trim();
      if (q.length < 2) {
        setSearchResults([]);
        return;
      }
      try {
        setSearching(true);
        const results = await userService.searchUsers(q, 20);
        setSearchResults(results || []);
      } catch (e) {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);
        });
        setCalls(items);
      } catch (e) {
        setError(e.message || 'Failed to load call history');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user.id]);

  const filteredCalls = useMemo(() => {
    return calls.filter(call => {
      if (historyFilter === 'all') return true;
      if (historyFilter === 'missed') return call.status === 'missed';
      if (historyFilter === 'outgoing') return call.type === 'outgoing';
      return true;
    });
  }, [calls, historyFilter]);

  const formatTime = (date) => {
    const now = new Date();
    const diff = (now - date) / 1000 / 60; // minutes

    if (diff < 60) return `${Math.floor(diff)} minutes ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)} hours ago`;
    if (diff < 2880) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getCallIcon = (call) => {
    // ✅ NEW: Different icons for incoming/outgoing/missed
    if (call.status === 'missed') {
      return (
        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
        </svg>
      );
    }

    if (call.type === 'incoming') {
      return (
        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      );
    }

    // Outgoing call
    return (
      <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    );
  };

  const getCallTypeText = (call) => {
    if (call.status === 'missed') return 'Missed';
    if (call.type === 'incoming') return 'Incoming';
    return 'Outgoing';
  };

  const getCallTypeColor = (call) => {
    if (call.status === 'missed') return 'text-red-500';
    if (call.type === 'incoming') return 'text-green-500';
    return 'text-blue-500';
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Calls</h1>

          {/* Top-level Tabs */}
          <div className="flex space-x-2 mb-3">
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'history'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              History
            </button>
            <button
              onClick={() => setActiveTab('contacts')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'contacts'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Make a Call
            </button>
          </div>

          {/* History filters */}
          {activeTab === 'history' && (
            <div className="flex space-x-2">
              <button
                onClick={() => setHistoryFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  historyFilter === 'all'
                    ? 'bg-gray-900 text-white dark:bg-gray-700'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setHistoryFilter('missed')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  historyFilter === 'missed'
                    ? 'bg-gray-900 text-white dark:bg-gray-700'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Missed
              </button>
              <button
                onClick={() => setHistoryFilter('outgoing')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  historyFilter === 'outgoing'
                    ? 'bg-gray-900 text-white dark:bg-gray-700'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Outgoing
              </button>
            </div>
          )}

          {/* Search bar for contacts */}
          {activeTab === 'contacts' && (
            <div className="relative mt-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users to call..."
                className="w-full px-4 py-3 pl-12 bg-gray-100 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none text-gray-900 dark:text-white"
              />
              <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-20">
        {activeTab === 'history' && loading && (
          <div className="h-full flex items-center justify-center"><Loading message="Loading calls..." /></div>
        )}
        {activeTab === 'history' && !loading && error && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center p-8">
              <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">Failed to load calls</h2>
              <p className="text-gray-500 dark:text-gray-400">{error}</p>
            </div>
          </div>
        )}
        {activeTab === 'history' && !loading && !error && filteredCalls.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8">
              <svg className="w-24 h-24 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">No Calls</h2>
              <p className="text-gray-500 dark:text-gray-500">No {historyFilter} calls to display</p>
            </div>
          </div>
        ) : (activeTab === 'history' && !loading && !error && (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredCalls.map((call) => (
              <div
                key={call.id}
                className="bg-white dark:bg-gray-800 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition animate-slideUp"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="avatar avatar-md avatar-gradient">
                      {call.name.charAt(0)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {call.name}
                      </h3>
                      {call.hasVideo && (
                        <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      {getCallIcon(call)}
                      <span className={getCallTypeColor(call)}>
                        {getCallTypeText(call)}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">•</span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {formatTime(call.time)}
                      </span>
                    </div>
                    {call.durationSec ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Duration: {Math.floor(call.durationSec / 60)}:{String(call.durationSec % 60).padStart(2,'0')}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center space-x-2"></div>
                </div>
              </div>
            ))}
          </div>
        ))}

        {activeTab === 'contacts' && (
          <div className="p-4">
            {searchQuery.trim().length < 2 ? (
              <div className="text-center py-16">
                <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-gray-600 dark:text-gray-400">Search for users to call</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Type at least 2 characters</p>
              </div>
            ) : searching ? (
              <div className="text-center py-16">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Searching users...</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-600 dark:text-gray-400">No users found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {searchResults.map((u) => {
                  const uid = u._id || u.id;
                  const isOnline = onlineUsers?.has ? onlineUsers.has(uid) : false;
                  return (
                    <div key={uid} className="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center justify-between hover:shadow-md transition">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="relative">
                          <UserAvatar user={u} size="md" />
                          {isOnline && <div className="status-online absolute -bottom-0.5 -right-0.5"></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 dark:text-white truncate flex items-center gap-2">
                            {u.username || u.name}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {isOnline ? <span className="text-green-500">Online</span> : 'Offline'}
                            {u.email ? ` • ${u.email}` : ''}
                          </p>
                        </div>
                      </div>
                      <CallButton userId={uid} userName={u.username || u.name} size="sm" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <button className="fixed bottom-24 right-6 w-14 h-14 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full shadow-2xl hover:from-purple-700 hover:to-pink-700 transition flex items-center justify-center hover-lift z-10">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      <BottomNav />
    </div>
  );
}