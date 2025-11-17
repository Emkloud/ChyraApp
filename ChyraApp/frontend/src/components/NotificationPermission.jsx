import { useState, useEffect } from 'react';
import notificationService from '../services/notificationService';
import { useToast } from './Toast';

export default function NotificationPermission() {
  const [show, setShow] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const { addToast } = useToast();

  // ✅ UPDATED: NO AUTO-PROMPT - Only manual enable
  useEffect(() => {
    const permission = notificationService.getPermissionStatus();
    console.log('Current notification permission:', permission);
    
    // Don't show auto-prompt anymore - user must enable manually in settings
  }, []);

  const handleEnable = async () => {
    try {
      setRequesting(true);
      const granted = await notificationService.requestPermission();
      
      if (granted) {
        await notificationService.subscribeToPush?.();
        addToast('Notifications enabled!', 'success');
        setShow(false);
      } else {
        addToast('Please enable notifications in your browser settings', 'warning');
      }
    } catch (error) {
      console.error('Enable notifications error:', error);
      addToast('Failed to enable notifications', 'error');
    } finally {
      setRequesting(false);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    sessionStorage.setItem('notificationPromptDismissed', 'true');
  };

  // Don't show if dismissed in this session
  if (sessionStorage.getItem('notificationPromptDismissed')) {
    return null;
  }

  // ✅ NO AUTO-PROMPT - Return null (component doesn't show automatically)
  // Users must manually enable in Settings → Notifications
  if (!show) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-slideUp">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>

          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              Enable Notifications
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Get notified about new messages and calls.
            </p>

            <div className="flex gap-2">
              <button
                onClick={handleEnable}
                disabled={requesting}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition disabled:opacity-50"
              >
                {requesting ? 'Enabling...' : 'Enable'}
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition"
              >
                Not now
              </button>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}