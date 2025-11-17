import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import notificationService from '../services/notificationService';
import { useToast } from '../components/Toast';

export default function NotificationSettings() {
  const [permission, setPermission] = useState('default');
  const [settings, setSettings] = useState({
    messages: false,
    calls: false,
    friendRequests: false,
    groupMessages: false,
    sound: false
  });
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();
  const navigate = useNavigate();

  // ✅ UPDATED: Load and apply settings on mount
  useEffect(() => {
    // Get permission status
    const currentPermission = notificationService.getPermissionStatus();
    setPermission(currentPermission);
    
    // Load saved settings from localStorage
    const savedSettings = notificationService.getSettings();
    const uiSettings = {
      messages: savedSettings.messages ?? false,
      calls: savedSettings.calls ?? false,
      friendRequests: savedSettings.friendRequests ?? false,
      groupMessages: savedSettings.groupMessages ?? false,
      sound: savedSettings.sound ?? false
    };
    
    setSettings(uiSettings);
    
    // Apply settings to service
    notificationService.soundEnabled = uiSettings.sound;
    notificationService.desktopEnabled = uiSettings.messages;
    
    console.log('✅ Loaded notification settings:', uiSettings);
  }, []);

  const handleEnableNotifications = async () => {
    try {
      setLoading(true);
      const granted = await notificationService.requestPermission();
      
      if (granted) {
        setPermission('granted');
        await notificationService.subscribeToPush?.();
        addToast('Notifications enabled!', 'success');
      } else {
        addToast('Notification permission denied', 'error');
        setPermission(notificationService.getPermissionStatus());
      }
    } catch (error) {
      console.error('Enable notifications error:', error);
      addToast('Failed to enable notifications', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDisableNotifications = async () => {
    try {
      setLoading(true);
      addToast('Browser permission revoked', 'info');
    } catch (error) {
      console.error('Disable notifications error:', error);
      addToast('Failed to disable notifications', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ✅ UPDATED: Save and apply settings immediately
  const handleSettingChange = (key) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    
    // Save to localStorage
    const success = notificationService.saveSettings(newSettings);
    
    if (success) {
      // Apply immediately to service
      if (key === 'sound') {
        notificationService.toggleSound(newSettings[key]);
      }
      if (key === 'messages') {
        notificationService.desktopEnabled = newSettings[key];
      }
      
      console.log('✅ Setting changed:', key, '=', newSettings[key]);
      addToast(`${key} notifications ${newSettings[key] ? 'enabled' : 'disabled'}`, 'success');
    } else {
      addToast('Failed to save settings', 'error');
    }
  };

  const handleTestSound = () => {
    if (settings.sound) {
      notificationService.playSound('notification');
      addToast('Sound test played!', 'info');
    } else {
      addToast('Please enable sound first', 'warning');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Notifications
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Browser Notifications */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>

            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Browser Notifications
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {permission === 'granted' 
                  ? '✅ Browser notifications are enabled. Control what you receive below.'
                  : permission === 'denied'
                  ? '❌ Notifications are blocked. Enable them in your browser settings.'
                  : '⚪ Click below to enable browser notifications.'}
              </p>

              {!notificationService.isSupported() && (
                <p className="text-sm text-orange-600 dark:text-orange-400 mb-4">
                  ⚠️ Push notifications are not supported in this browser.
                </p>
              )}

              {permission === 'granted' ? (
                <button
                  onClick={handleDisableNotifications}
                  disabled={loading}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Revoke Permission'}
                </button>
              ) : permission === 'default' ? (
                <button
                  onClick={handleEnableNotifications}
                  disabled={loading || !notificationService.isSupported()}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition disabled:opacity-50"
                >
                  {loading ? 'Requesting...' : 'Enable Browser Notifications'}
                </button>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  To enable, go to browser settings and allow notifications for this site.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Notification Preferences
          </h2>

          <div className="space-y-4">
            {/* Messages */}
            <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Messages
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Get notified about new direct messages
                </p>
              </div>
              <button
                onClick={() => handleSettingChange('messages')}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${settings.messages ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'}
                `}
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${settings.messages ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>

            {/* Calls */}
            <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Calls
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Get notified about incoming calls
                </p>
              </div>
              <button
                onClick={() => handleSettingChange('calls')}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${settings.calls ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'}
                `}
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${settings.calls ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>

            {/* Friend Requests */}
            <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Friend Requests
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Get notified about new friend requests
                </p>
              </div>
              <button
                onClick={() => handleSettingChange('friendRequests')}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${settings.friendRequests ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'}
                `}
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${settings.friendRequests ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>

            {/* Group Messages */}
            <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Group Messages
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Get notified about group messages
                </p>
              </div>
              <button
                onClick={() => handleSettingChange('groupMessages')}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${settings.groupMessages ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'}
                `}
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${settings.groupMessages ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>

            {/* Sound */}
            <div className="flex items-center justify-between py-3">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Sound
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Play sound for notifications
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTestSound}
                  disabled={!settings.sound}
                  className="px-3 py-1 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Test
                </button>
                <button
                  onClick={() => handleSettingChange('sound')}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    ${settings.sound ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'}
                  `}
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                      ${settings.sound ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}