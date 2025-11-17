import { soundGenerator } from '../utils/soundGenerator';

class NotificationService {
  constructor() {
    this.permission = 'default';
    this.soundEnabled = false; // ✅ OFF by default
    this.desktopEnabled = false; // ✅ OFF by default
    this.notificationQueue = [];
    this.activeNotifications = new Map();
    this.init();
  }

  init() {
    // Load settings from localStorage
    const settings = this.getSettings();
    this.soundEnabled = settings.soundEnabled;
    this.desktopEnabled = settings.desktopEnabled;

    // Check if browser supports notifications
    if ('Notification' in window) {
      this.permission = Notification.permission;
      console.log('Notification permission status:', this.permission);
    } else {
      console.warn('This browser does not support desktop notifications');
    }

    // Initialize sound generator
    soundGenerator.toggle(this.soundEnabled);

    // Listen for visibility change to manage notifications
    document.addEventListener('visibilitychange', () => {
      if (this.isPageVisible()) {
        this.clearAllNotifications();
      }
    });

    console.log('NotificationService initialized:', {
      soundEnabled: this.soundEnabled,
      desktopEnabled: this.desktopEnabled,
      permission: this.permission
    });
  }

  async requestPermission() {
    if (!('Notification' in window)) {
      console.warn('Browser does not support notifications');
      return false;
    }

    if (this.permission === 'granted') {
      console.log('Notification permission already granted');
      return true;
    }

    if (this.permission === 'denied') {
      console.warn('Notification permission was previously denied. User must enable manually.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      
      if (permission === 'granted') {
        console.log('✅ Notification permission granted!');
        return true;
      } else if (permission === 'denied') {
        console.warn('❌ Notification permission denied');
        return false;
      } else {
        console.log('⏸️ Notification permission dismissed');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  showNotification(title, options = {}) {
    if (!this.desktopEnabled) {
      console.log('Desktop notifications disabled by user');
      return null;
    }

    if (this.isPageVisible() && !options.forceShow) {
      console.log('Page is visible, skipping notification');
      return null;
    }

    if (this.permission !== 'granted') {
      console.warn('Cannot show notification: permission not granted');
      if (this.permission === 'default') {
        this.queueNotification(title, options);
      }
      return null;
    }

    const defaultOptions = {
      icon: '/logo.png',
      badge: '/logo.png',
      vibrate: [200, 100, 200],
      tag: 'chyra-notification',
      requireInteraction: false,
      silent: false,
      ...options
    };

    try {
      const notification = new Notification(title, defaultOptions);
      const notificationId = options.tag || `notification-${Date.now()}`;
      this.activeNotifications.set(notificationId, notification);

      if (!options.requireInteraction) {
        setTimeout(() => {
          notification.close();
          this.activeNotifications.delete(notificationId);
        }, 5000);
      }

      notification.onclick = () => {
        window.focus();
        if (options.onClick) {
          options.onClick();
        }
        notification.close();
        this.activeNotifications.delete(notificationId);
      };

      notification.onclose = () => {
        this.activeNotifications.delete(notificationId);
      };

      notification.onerror = (error) => {
        console.error('Notification error:', error);
        this.activeNotifications.delete(notificationId);
      };

      console.log('✅ Notification shown:', title);
      return notification;
    } catch (error) {
      console.error('Error showing notification:', error);
      return null;
    }
  }

  queueNotification(title, options) {
    this.notificationQueue.push({ title, options, timestamp: Date.now() });
    console.log('Notification queued:', title);
    
    if (this.notificationQueue.length > 10) {
      this.notificationQueue.shift();
    }
  }

  processQueue() {
    if (this.permission !== 'granted' || this.notificationQueue.length === 0) {
      return;
    }

    console.log(`Processing ${this.notificationQueue.length} queued notifications`);
    
    while (this.notificationQueue.length > 0) {
      const { title, options } = this.notificationQueue.shift();
      this.showNotification(title, { ...options, forceShow: true });
    }
  }

  clearAllNotifications() {
    this.activeNotifications.forEach(notification => {
      try {
        notification.close();
      } catch (error) {
        console.error('Error closing notification:', error);
      }
    });
    this.activeNotifications.clear();
    console.log('All notifications cleared');
  }

  playSound(soundType = 'message') {
    if (!this.soundEnabled) {
      console.log('Sound disabled by user');
      return;
    }

    try {
      switch(soundType) {
        case 'message':
          soundGenerator.messageSound();
          break;
        case 'notification':
          soundGenerator.notificationSound();
          break;
        case 'sent':
          soundGenerator.sentSound();
          break;
        case 'call':
          soundGenerator.callSound();
          break;
        default:
          soundGenerator.messageSound();
      }
      console.log('🔊 Sound played:', soundType);
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  }

  notifyNewMessage(sender, message, chatId) {
    console.log('New message notification:', { sender, chatId });
    this.playSound('message');
    
    if (!this.isPageVisible()) {
      this.showNotification(sender, {
        body: message.length > 50 ? message.substring(0, 50) + '...' : message,
        icon: '/logo.png',
        tag: `message-${chatId}`,
        onClick: () => {
          window.location.href = `/chat/${chatId}`;
        }
      });
    }
  }

  notifyFriendRequest(sender) {
    console.log('Friend request notification:', sender);
    this.playSound('notification');
    
    this.showNotification('New Friend Request', {
      body: `${sender} sent you a friend request`,
      icon: '/logo.png',
      tag: 'friend-request',
      forceShow: true,
      onClick: () => {
        window.location.href = '/friend-requests';
      }
    });
  }

  notifyCall(caller, isVideo = false) {
    console.log('Call notification:', { caller, isVideo });
    this.playSound('call');
    
    this.showNotification(`Incoming ${isVideo ? 'Video' : 'Voice'} Call`, {
      body: `${caller} is calling...`,
      icon: '/logo.png',
      tag: 'incoming-call',
      requireInteraction: true,
      forceShow: true,
      vibrate: [300, 200, 300, 200, 300],
      onClick: () => {
        window.focus();
      }
    });
  }

  notifyGroupMessage(groupName, sender, message, groupId) {
    console.log('Group message notification:', { groupName, sender, groupId });
    this.playSound('message');
    
    if (!this.isPageVisible()) {
      this.showNotification(groupName, {
        body: `${sender}: ${message.length > 40 ? message.substring(0, 40) + '...' : message}`,
        icon: '/logo.png',
        tag: `group-${groupId}`,
        onClick: () => {
          window.location.href = `/group/${groupId}`;
        }
      });
    }
  }

  notifyMessageSent() {
    this.playSound('sent');
  }

  // ✅ UPDATED: Return defaults as FALSE (OFF by default)
  getSettings() {
    try {
      const settings = localStorage.getItem('notificationSettings');
      if (settings) {
        const parsed = JSON.parse(settings);
        console.log('Loaded settings from localStorage:', parsed);
        return {
          soundEnabled: parsed.soundEnabled ?? false,
          desktopEnabled: parsed.desktopEnabled ?? false,
          messages: parsed.messages ?? false,
          calls: parsed.calls ?? false,
          friendRequests: parsed.friendRequests ?? false,
          groupMessages: parsed.groupMessages ?? false,
          sound: parsed.sound ?? false
        };
      }
    } catch (error) {
      console.error('Error reading notification settings:', error);
    }
    
    // ✅ Default settings - ALL OFF
    console.log('Using default settings: all OFF');
    return {
      soundEnabled: false,
      desktopEnabled: false,
      messages: false,
      calls: false,
      friendRequests: false,
      groupMessages: false,
      sound: false
    };
  }

  // ✅ UPDATED: Save settings properly
  saveSettings(settings) {
    try {
      const validSettings = {
        soundEnabled: Boolean(settings.soundEnabled ?? settings.sound),
        desktopEnabled: Boolean(settings.desktopEnabled ?? settings.messages),
        messages: Boolean(settings.messages),
        calls: Boolean(settings.calls),
        friendRequests: Boolean(settings.friendRequests),
        groupMessages: Boolean(settings.groupMessages),
        sound: Boolean(settings.sound)
      };
      
      localStorage.setItem('notificationSettings', JSON.stringify(validSettings));
      
      // Apply settings immediately
      this.soundEnabled = validSettings.soundEnabled || validSettings.sound;
      this.desktopEnabled = validSettings.desktopEnabled || validSettings.messages;
      soundGenerator.toggle(this.soundEnabled || validSettings.sound);
      
      console.log('✅ Notification settings saved:', validSettings);
      return true;
    } catch (error) {
      console.error('Error saving notification settings:', error);
      return false;
    }
  }

  toggleSound(enabled) {
    console.log('Sound notifications:', enabled ? 'enabled' : 'disabled');
    this.soundEnabled = enabled;
    soundGenerator.toggle(enabled);
    const settings = this.getSettings();
    this.saveSettings({ ...settings, soundEnabled: enabled, sound: enabled });
  }

  toggleDesktop(enabled) {
    console.log('Desktop notifications:', enabled ? 'enabled' : 'disabled');
    this.desktopEnabled = enabled;
    const settings = this.getSettings();
    this.saveSettings({ ...settings, desktopEnabled: enabled });
    
    if (enabled && this.permission === 'granted') {
      setTimeout(() => this.processQueue(), 100);
    }
  }

  isPageVisible() {
    return document.visibilityState === 'visible';
  }

  isSupported() {
    return 'Notification' in window;
  }

  getPermissionStatus() {
    return this.permission;
  }

  isEnabled() {
    return this.isSupported() && 
           this.permission === 'granted' && 
           this.desktopEnabled;
  }

  testNotification() {
    console.log('Testing notification system...');
    this.playSound('notification');
    
    this.showNotification('Test Notification', {
      body: 'This is a test notification from ChyraApp! 🎉',
      icon: '/logo.png',
      tag: 'test-notification',
      forceShow: true
    });
  }

  reset() {
    console.log('Resetting notification system...');
    this.clearAllNotifications();
    this.notificationQueue = [];
    localStorage.removeItem('notificationSettings');
    this.init();
  }

  getStats() {
    return {
      supported: this.isSupported(),
      permission: this.permission,
      soundEnabled: this.soundEnabled,
      desktopEnabled: this.desktopEnabled,
      queueLength: this.notificationQueue.length,
      activeCount: this.activeNotifications.size,
      isPageVisible: this.isPageVisible(),
      isFullyEnabled: this.isEnabled()
    };
  }
}

const notificationService = new NotificationService();

if (typeof window !== 'undefined') {
  window.notificationService = notificationService;
}

notificationService.subscribeToPush = async () => {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications not supported');
      return null;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: null
    });

    console.log('✅ Subscribed to push notifications');
    return subscription;
  } catch (error) {
    console.error('Push subscription error:', error);
    return null;
  }
};

export default notificationService;