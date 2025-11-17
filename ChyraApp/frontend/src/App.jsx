import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/Toast';
import { CallProvider } from './context/CallContext';
import IncomingCall from './components/IncomingCall';
import ActiveCall from './components/ActiveCall';
import CallingIndicator from './components/CallingIndicator';
import NotificationPermission from './components/NotificationPermission';
import Login from './pages/Login';
import Register from './pages/Register';
import ChatList from './pages/ChatList';
import ChatWindow from './pages/ChatWindow';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Groups from './pages/Group';
import GroupChat from './pages/GroupChat';
import AIChat from './pages/AIChat';
import Calls from './pages/Calls';
import Contacts from './pages/Contacts';
import FindFriends from './pages/FindFriends';
import FriendRequests from './pages/FriendRequests';
import ImportContacts from './pages/ImportContacts';
import SyncContacts from './pages/SyncContacts';
import DeleteAccount from './pages/DeleteAccount';
import NotificationSettings from './pages/NotificationSettings';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

const LoadingScreen = () => (
  <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 animate-fadeIn">
    <div className="text-center">
      <div className="mb-6 animate-scaleIn">
        <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-full flex items-center justify-center shadow-2xl animate-pulse">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
      </div>
      <h2 className="text-3xl font-bold text-gradient-rainbow mb-2">ChyraApp</h2>
      <div className="flex justify-center mb-3">
        <div className="spinner"></div>
      </div>
      <p className="text-gray-600 dark:text-gray-400 font-medium animate-pulse">Loading your experience...</p>
      <div className="flex justify-center space-x-2 mt-4">
        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
        <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
      </div>
    </div>
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? children : <Navigate to="/login" />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? <Navigate to="/chats" /> : children;
};

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <CallProvider>
            <IncomingCall />
            <CallingIndicator />
            <ActiveCall />
            <NotificationPermission />
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
              
              {/* Protected Routes */}
              <Route path="/chats" element={<ProtectedRoute><ChatList /></ProtectedRoute>} />
              <Route path="/chat/:chatId" element={<ProtectedRoute><ChatWindow /></ProtectedRoute>} />
              <Route path="/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
              <Route path="/group/:groupId" element={<ProtectedRoute><GroupChat /></ProtectedRoute>} />
              <Route path="/ai" element={<ProtectedRoute><AIChat /></ProtectedRoute>} />
              <Route path="/calls" element={<ProtectedRoute><Calls /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/settings/notifications" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
              <Route path="/find-friends" element={<ProtectedRoute><FindFriends /></ProtectedRoute>} />
              <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
              <Route path="/friend-requests" element={<ProtectedRoute><FriendRequests /></ProtectedRoute>} />
              <Route path="/import-contacts" element={<ProtectedRoute><ImportContacts /></ProtectedRoute>} />
              <Route path="/sync-contacts" element={<ProtectedRoute><SyncContacts /></ProtectedRoute>} />
              <Route path="/delete-account" element={<ProtectedRoute><DeleteAccount /></ProtectedRoute>} />
              
              {/* Default Route */}
              <Route path="/" element={<Navigate to="/chats" replace />} />
              <Route path="*" element={<Navigate to="/chats" replace />} />
            </Routes>
          </CallProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;