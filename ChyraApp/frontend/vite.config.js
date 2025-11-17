import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      },
      '/socket.io': {
        target: process.env.VITE_API_URL || 'http://localhost:5000',
        changeOrigin: true,
        ws: true
      }
    }
  },
  
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    
    // ✅ PWA OPTIMIZATION: Code splitting for better caching
    rollupOptions: {
      output: {
        // Separate chunks for better caching and faster loading
        manualChunks: {
          // React core
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          
          // Socket.IO (large library, separate chunk)
          'socket-vendor': ['socket.io-client'],
          
          // UI components (if using a UI library, uncomment)
          // 'ui-vendor': ['@headlessui/react', 'framer-motion'],
        },
        
        // Better asset naming
        assetFileNames: (assetInfo) => {
          let extType = assetInfo.name.split('.').at(1);
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            extType = 'images';
          } else if (/woff|woff2|eot|ttf|otf/i.test(extType)) {
            extType = 'fonts';
          }
          return `assets/${extType}/[name]-[hash][extname]`;
        },
        
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      }
    },
    
    // ✅ FIXED: Less aggressive minification to preserve necessary code
    minify: false,
    terserOptions: {
      compress: {
        drop_console: false, // Keep console.logs to prevent aggressive code removal
        drop_debugger: true,
        pure_funcs: [] // Don't treat any functions as pure (side-effect free)
      },
      mangle: {
        // Preserve variable names that might be needed
        keep_fnames: false,
      }
    }
  },
  
  // ✅ Ensure service worker and manifest are copied
  publicDir: 'public',
  
  // ✅ Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'socket.io-client'
    ]
  },
  
  // ✅ Preview server config (for testing production build)
  preview: {
    port: 4173,
    host: true
  }
});