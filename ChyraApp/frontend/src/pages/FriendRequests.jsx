import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { contactService } from '../services/contactService';
import { useToast } from '../components/Toast';
import Loading from '../components/Loading';

export default function FriendRequests() {
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('received');
  const { addToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await contactService.getFriendRequests();
      setReceivedRequests(data.received || []);
      setSentRequests(data.sent || []);
    } catch (error) {
      console.error('Failed to load requests:', error);
      addToast('Failed to load friend requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requestId) => {
    try {
      await contactService.acceptFriendRequest(requestId);
      addToast('Friend request accepted!', 'success');
      setReceivedRequests(prev => prev.filter(r => r._id !== requestId));
    } catch (error) {
      addToast(error.message || 'Failed to accept request', 'error');
    }
  };

  const handleReject = async (requestId) => {
    try {
      await contactService.rejectFriendRequest(requestId);
      addToast('Friend request rejected', 'info');
      setReceivedRequests(prev => prev.filter(r => r._id !== requestId));
    } catch (error) {
      addToast(error.message || 'Failed to reject request', 'error');
    }
  };

  const handleCancel = async (requestId) => {
    try {
      await contactService.cancelFriendRequest(requestId);
      addToast('Friend request cancelled', 'info');
      setSentRequests(prev => prev.filter(r => r._id !== requestId));
    } catch (error) {
      addToast(error.message || 'Failed to cancel request', 'error');
    }
  };

  const formatTime = (date) => {
    const now = new Date();
    const requestDate = new Date(date);
    const diffInHours = (now - requestDate) / (1000 * 60 * 60);

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return requestDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return <Loading message="Loading friend requests..." />;
  }

  const requests = activeTab === 'received' ? receivedRequests : sentRequests;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center space-x-3 mb-4">
            <button
              onClick={() => navigate(-1)}
              className="text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Friend Requests</h1>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('received')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition relative ${
                activeTab === 'received'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Received
              {receivedRequests.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                  {receivedRequests.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('sent')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'sent'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Sent ({sentRequests.length})
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {requests.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-24 h-24 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">
              No {activeTab} requests
            </h3>
            <p className="text-gray-500 dark:text-gray-500 mb-6">
              {activeTab === 'received' 
                ? "You don't have any pending friend requests"
                : "You haven't sent any friend requests"}
            </p>
            {activeTab === 'received' && (
              <button
                onClick={() => navigate('/find-friends')}
                className="btn-primary"
              >
                Find Friends
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => {
              const user = activeTab === 'received' ? request.sender : request.receiver;
              return (
                <div
                  key={request._id}
                  className="card dark:bg-gray-800 hover-lift animate-slideUp"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="avatar avatar-md avatar-gradient flex-shrink-0">
                        {user.username?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {user.username}
                        </h3>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                          {user.email}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {formatTime(request.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="ml-3 flex items-center space-x-2">
                      {activeTab === 'received' ? (
                        <>
                          <button
                            onClick={() => handleAccept(request._id)}
                            className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg text-sm font-medium hover:from-green-600 hover:to-green-700 transition shadow-md"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleReject(request._id)}
                            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <>
                          {request.status === 'pending' ? (
                            <button
                              onClick={() => handleCancel(request._id)}
                              className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition"
                            >
                              Cancel
                            </button>
                          ) : (
                            <span className={`px-4 py-2 rounded-lg text-sm font-medium ${
                              request.status === 'accepted' 
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                            }`}>
                              {request.status === 'accepted' ? 'Accepted' : 'Rejected'}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}