import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext'; // ✅ NEW

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isConnected } = useSocket(); // ✅ NEW
  const [hasNotifications, setHasNotifications] = useState(false); // ✅ NEW

  // ✅ NEW: Simulate checking for notifications (you can connect this to real data later)
  useEffect(() => {
    // Check localStorage for pending friend requests or notifications
    const checkNotifications = () => {
      try {
        const friendRequests = localStorage.getItem('pendingFriendRequests');
        setHasNotifications(friendRequests && JSON.parse(friendRequests).length > 0);
      } catch (error) {
        console.error('Error checking notifications:', error);
      }
    };

    checkNotifications();
    // Check every 30 seconds
    const interval = setInterval(checkNotifications, 30000);

    return () => clearInterval(interval);
  }, []);

  const navItems = [
    {
      name: 'Chats',
      path: '/chats',
      icon: (active) => (
        <svg
          className={`w-6 h-6 ${active ? 'text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      ),
    },
    {
      name: 'Groups',
      path: '/groups',
      icon: (active) => (
        <svg
          className={`w-6 h-6 ${active ? 'text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
    },
    {
      name: 'AI',
      path: '/ai',
      badge: 'New',
      icon: (active) => (
        <div className="relative">
          {/* ✅ ENHANCED: AI icon with gradient and connection status */}
          <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            active 
              ? 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 shadow-lg scale-110' 
              : 'bg-gradient-to-br from-purple-400 via-pink-400 to-orange-400'
          }`}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>
          {/* ✅ NEW: Show connection status on AI tab */}
          {isConnected && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse"></span>
          )}
        </div>
      ),
      special: true, // Mark as special to handle differently
    },
    {
      name: 'Calls',
      path: '/calls',
      icon: (active) => (
        <svg
          className={`w-6 h-6 ${active ? 'text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
          />
        </svg>
      ),
    },
    {
      name: 'Profile',
      path: '/profile',
      showNotificationBadge: true, // ✅ NEW: Flag to show notification badge
      icon: (active) => (
        <div className="relative">
          <svg
            className={`w-6 h-6 ${active ? 'text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          {/* ✅ NEW: Notification badge for friend requests */}
          {hasNotifications && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse"></span>
          )}
        </div>
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg z-50">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path);
          
          return (
            <button
              key={item.name}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-200 relative ${
                item.special ? 'relative -top-4' : ''
              } ${
                isActive 
                  ? 'text-purple-600 dark:text-purple-400' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-purple-500 dark:hover:text-purple-300'
              }`}
            >
              {item.icon(isActive)}
              
              {/* Don't show label for AI (special) */}
              {!item.special && (
                <span className={`text-xs mt-1 font-medium ${
                  isActive 
                    ? 'text-purple-600 dark:text-purple-400' 
                    : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {item.name}
                </span>
              )}

              {/* Show badge for AI */}
              {item.badge && (
                <span className="absolute -top-1 right-1/4 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold shadow-md animate-pulse">
                  {item.badge}
                </span>
              )}

              {/* Active indicator bar */}
              {isActive && !item.special && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-t-full shadow-md" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}