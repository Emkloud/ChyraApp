import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import './index.css'

// ============================================
// SERVICE WORKER REGISTRATION
// ============================================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    registerServiceWorker();
  });
}

async function registerServiceWorker() {
  try {
    // Service worker registration disabled to avoid stale cached assets.
    // If you want to re-enable, uncomment the line below:
    // await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (error) {
    console.error('❌ Service Worker registration failed:', error);
  }
}

// ============================================
// UPDATE NOTIFICATION
// ============================================

function showUpdateNotification(registration) {
  // Check if user has dismissed update notification recently
  const lastDismissed = localStorage.getItem('sw-update-dismissed');
  if (lastDismissed) {
    const timeSinceDismissed = Date.now() - parseInt(lastDismissed);
    // Don't show again for 24 hours
    if (timeSinceDismissed < 24 * 60 * 60 * 1000) {
      return;
    }
  }

  // Create update notification
  const updateBanner = document.createElement('div');
  updateBanner.id = 'sw-update-banner';
  updateBanner.innerHTML = `
    <div style="
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 15px;
      max-width: 90%;
      animation: slideUp 0.3s ease-out;
    ">
      <div style="flex: 1;">
        <div style="font-weight: 600; font-size: 15px; margin-bottom: 4px;">
          🎉 New Version Available!
        </div>
        <div style="font-size: 13px; opacity: 0.95;">
          Update now to get the latest features
        </div>
      </div>
      <button id="sw-update-btn" style="
        background: white;
        color: #764ba2;
        border: none;
        padding: 10px 20px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        transition: transform 0.2s;
      ">
        Update
      </button>
      <button id="sw-dismiss-btn" style="
        background: transparent;
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        padding: 10px 16px;
        border-radius: 8px;
        font-weight: 500;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
      ">
        Later
      </button>
    </div>
    <style>
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
      #sw-update-btn:hover {
        transform: scale(1.05);
      }
      #sw-dismiss-btn:hover {
        background: rgba(255, 255, 255, 0.1);
      }
    </style>
  `;

  document.body.appendChild(updateBanner);

  // Update button click
  document.getElementById('sw-update-btn').addEventListener('click', () => {
    // Tell SW to skip waiting
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    updateBanner.remove();
  });

  // Dismiss button click
  document.getElementById('sw-dismiss-btn').addEventListener('click', () => {
    localStorage.setItem('sw-update-dismissed', Date.now().toString());
    updateBanner.remove();
  });
}

// ============================================
// ONLINE/OFFLINE DETECTION
// ============================================

window.addEventListener('online', () => {
  console.log('🌐 Back online!');
  
  // Show notification
  if (document.visibilityState === 'visible') {
    showToast('🌐 Back online! Syncing...', 'success');
    
    // Trigger background sync if available
    if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then(registration => {
        return registration.sync.register('sync-messages');
      }).catch(err => console.log('Sync registration failed:', err));
    }
  }
});

window.addEventListener('offline', () => {
  console.log('📡 You are offline');
  
  // Show notification
  if (document.visibilityState === 'visible') {
    showToast('📡 You are offline. Some features may be limited.', 'warning');
  }
});

// ============================================
// HELPER: Show Toast Notification
// ============================================

function showToast(message, type = 'info') {
  // Remove existing toasts
  const existingToast = document.getElementById('connection-toast');
  if (existingToast) {
    existingToast.remove();
  }

  const colors = {
    success: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    warning: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    info: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
  };

  const toast = document.createElement('div');
  toast.id = 'connection-toast';
  toast.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type] || colors.info};
      color: white;
      padding: 14px 20px;
      border-radius: 10px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      z-index: 10001;
      font-size: 14px;
      font-weight: 500;
      animation: slideIn 0.3s ease-out;
      max-width: 350px;
    ">
      ${message}
    </div>
    <style>
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateX(100px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
    </style>
  `;

  document.body.appendChild(toast);

  // Auto remove after 4 seconds
  setTimeout(() => {
    if (toast && toast.parentNode) {
      toast.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}

// ============================================
// CHECK INITIAL CONNECTION STATUS
// ============================================

if (!navigator.onLine) {
  console.log('📡 Starting offline');
  // Don't show toast on initial load if offline
}

// ============================================
// RENDER REACT APP
// ============================================

console.log('🚀 Frontend loaded at', new Date().toISOString());

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <App />
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

// ============================================
// PERFORMANCE MONITORING (Optional)
// ============================================

if (import.meta.env.PROD) {
  // Report web vitals in production
  if ('PerformanceObserver' in window) {
    // Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      console.log('LCP:', lastEntry.renderTime || lastEntry.loadTime);
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

    // First Input Delay (FID)
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        console.log('FID:', entry.processingStart - entry.startTime);
      });
    });
    fidObserver.observe({ entryTypes: ['first-input'] });

    // Cumulative Layout Shift (CLS)
    let clsScore = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsScore += entry.value;
        }
      }
      console.log('CLS:', clsScore);
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });
  }
}

// ============================================
// CONSOLE WELCOME MESSAGE
// ============================================

if (import.meta.env.DEV) {
  console.log(
    '%c🎉 ChyraApp Development Mode',
    'font-size: 20px; font-weight: bold; color: #9333ea;'
  );
  console.log(
    '%cProviders loaded: BrowserRouter, AuthProvider, SocketProvider',
    'font-size: 14px; color: #10b981;'
  );
}