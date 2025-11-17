require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const connectDatabase = require('./config/database');
const { RATE_LIMIT, SOCKET_EVENTS } = require('./config/constants');
const logger = require('./utils/logger');

const { errorHandler, notFound } = require('./middleware/errorHandler');
const { socketAuth } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chats');
const messageRoutes = require('./routes/messages');
const contactRoutes = require('./routes/contacts');
const groupRoutes = require('./routes/groups');
const profileRoutes = require('./routes/profile');
const callRoutes = require('./routes/calls');
const accountRoutes = require('./routes/account');
const uploadRoutes = require('./routes/upload');

const app = express();
const httpServer = createServer(app);

app.set('trust proxy', 1);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

connectDatabase();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

const defaultAllowedOrigins = [
  'https://chyraapp.com',
  'https://www.chyraapp.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
  'http://localhost:8080'
];

const configuredOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) 
  : defaultAllowedOrigins;

const isAllowedOrigin = (origin) => {
  if (!origin) {
    logger.info('✓ CORS: Allowing request with no origin');
    return true;
  }

  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    
    if (hostname === 'chyraapp.com' || hostname === 'www.chyraapp.com') {
      logger.info(`✓ CORS: Allowing main domain: ${origin}`);
      return true;
    }
    
    if (hostname.endsWith('.chyraapp.com')) {
      logger.info(`✓ CORS: Allowing subdomain: ${origin}`);
      return true;
    }
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      logger.info(`✓ CORS: Allowing localhost: ${origin}`);
      return true;
    }
    
    if (configuredOrigins.includes(origin)) {
      logger.info(`✓ CORS: Allowing configured origin: ${origin}`);
      return true;
    }
    
    logger.warn(`✗ CORS: Blocked origin: ${origin}`);
    return false;
  } catch (e) {
    logger.warn(`✗ CORS: Invalid origin format: ${origin}`);
    return false;
  }
};

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400,
  optionsSuccessStatus: 204
}));

app.options('*', cors());

logger.info('✓ CORS Configuration:');
logger.info('  - Main domains: chyraapp.com, www.chyraapp.com');
logger.info('  - Subdomains: *.chyraapp.com');
logger.info('  - Localhost: All ports');
logger.info('  - Configured origins:', configuredOrigins);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(compression());

const limiter = rateLimit({
  windowMs: RATE_LIMIT.WINDOW_MS,
  max: RATE_LIMIT.MAX_REQUESTS,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

app.set('io', io);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'ChyraApp API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    routes: {
      auth: '/api/auth',
      users: '/api/users',
      chats: '/api/chats',
      messages: '/api/messages',
      contacts: '/api/contacts',
      groups: '/api/groups',
      profile: '/api/profile',
      calls: '/api/calls',
      account: '/api/account'
    }
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to ChyraApp API',
    version: '1.0.0',
    documentation: '/api/docs',
    health: '/health'
  });
});

io.use(socketAuth);

const onlineUsersMap = new Map();

const sendOnlineUsersList = () => {
  const userIdList = Array.from(onlineUsersMap.keys());
  io.emit('users:online', userIdList);
  logger.info(`📢 Sent online users list: ${userIdList.length} users online`);
};

io.on(SOCKET_EVENTS.CONNECTION, (socket) => {
  const currentUserId = socket.userId;
  logger.info(`✅ User connected: ${currentUserId}`);

  onlineUsersMap.set(currentUserId, socket.id);

  socket.join(`user:${currentUserId}`);

  (async () => {
    try {
      const User = require('./models/User');
      await User.findByIdAndUpdate(currentUserId, {
        isOnline: true,
        socketId: socket.id,
        lastSeen: Date.now()
      });

      socket.broadcast.emit(SOCKET_EVENTS.USER_ONLINE, { userId: currentUserId });
      sendOnlineUsersList();
      
      logger.info(`👤 User ${currentUserId} marked as online`);
    } catch (error) {
      logger.error('Error updating user online status:', error);
    }
  })();

  socket.on(SOCKET_EVENTS.USER_ONLINE, async () => {
    try {
      const User = require('./models/User');
      await User.findByIdAndUpdate(currentUserId, {
        isOnline: true,
        socketId: socket.id,
        lastSeen: Date.now()
      });

      onlineUsersMap.set(currentUserId, socket.id);
      socket.broadcast.emit(SOCKET_EVENTS.USER_ONLINE, { userId: currentUserId });
      sendOnlineUsersList();
      
      logger.info(`👤 User ${currentUserId} sent online status`);
    } catch (error) {
      logger.error('User online event error:', error);
    }
  });

  socket.on(SOCKET_EVENTS.USER_TYPING, ({ conversationId }) => {
    socket.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.USER_TYPING, {
      userId: currentUserId,
      conversationId
    });
  });

  socket.on(SOCKET_EVENTS.USER_STOP_TYPING, ({ conversationId }) => {
    socket.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.USER_STOP_TYPING, {
      userId: currentUserId,
      conversationId
    });
  });

  socket.on(SOCKET_EVENTS.CONVERSATION_JOIN, ({ conversationId }) => {
    socket.join(`conversation:${conversationId}`);
    logger.info(`🚪 User ${currentUserId} joined conversation ${conversationId}`);
  });

  socket.on(SOCKET_EVENTS.CONVERSATION_LEAVE, ({ conversationId }) => {
    socket.leave(`conversation:${conversationId}`);
    logger.info(`🚪 User ${currentUserId} left conversation ${conversationId}`);
  });

  socket.on(SOCKET_EVENTS.MESSAGE_SEND, async (messageData) => {
    try {
      const conversationId = messageData.conversationId || messageData.conversation;
      
      io.to(`conversation:${conversationId}`).emit(
        SOCKET_EVENTS.MESSAGE_RECEIVE,
        {
          ...messageData,
          chat: conversationId,
          conversation: conversationId
        }
      );
      
      logger.info(`📨 Message sent in conversation ${conversationId}`);
    } catch (error) {
      logger.error('Message send error:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to send message' });
    }
  });

  socket.on('message:read', async ({ messageId, conversationId }) => {
    try {
      const Message = require('./models/Message');
      const message = await Message.findById(messageId);
      
      if (message && !message.isReadBy(currentUserId)) {
        message.markAsRead(currentUserId);
        await message.save();
        
        io.to(`conversation:${conversationId}`).emit('message:read', {
          messageId,
          userId: currentUserId,
          conversationId
        });
        
        logger.info(`👁️ Message ${messageId} read by ${currentUserId}`);
      }
    } catch (error) {
      logger.error('Message read error:', error);
    }
  });

  socket.on('friend_request_sent', ({ receiverId, request }) => {
    io.to(`user:${receiverId}`).emit('friend_request_received', request);
    logger.info(`👥 Friend request: ${currentUserId} → ${receiverId}`);
  });

  socket.on('friend_request_accepted', ({ senderId, receiverId }) => {
    io.to(`user:${senderId}`).emit('friend_request_accepted', { userId: receiverId });
    io.to(`user:${receiverId}`).emit('friend_added', { userId: senderId });
    logger.info(`✅ Friend request accepted: ${senderId} ↔ ${receiverId}`);
  });

  socket.on('friend_request_rejected', ({ senderId }) => {
    io.to(`user:${senderId}`).emit('friend_request_rejected');
    logger.info(`❌ Friend request rejected by ${currentUserId}`);
  });

  socket.on('group_created', ({ groupId, members }) => {
    members.forEach(memberId => {
      io.to(`user:${memberId}`).emit('group_created', { groupId });
    });
    logger.info(`👥 Group created: ${groupId}`);
  });

  socket.on('group_message', ({ groupId, message }) => {
    socket.to(`group:${groupId}`).emit('group_message', message);
  });

  socket.on('join_group', ({ groupId }) => {
    socket.join(`group:${groupId}`);
    logger.info(`👥 User ${currentUserId} joined group ${groupId}`);
  });

  socket.on('leave_group', ({ groupId }) => {
    socket.leave(`group:${groupId}`);
    logger.info(`👥 User ${currentUserId} left group ${groupId}`);
  });

  socket.on('call:initiate', ({ callId, receiverId, callType, offer }) => {
    logger.info(`📞 Call initiated: ${callId} (${currentUserId} → ${receiverId})`);
    io.to(`user:${receiverId}`).emit('call:incoming', {
      callId,
      callerId: currentUserId,
      callerName: socket.username || 'Unknown',
      callType,
      offer
    });
  });

  socket.on('call:answer', ({ callId, callerId, answer }) => {
    logger.info(`📞 Call answered: ${callId}`);
    io.to(`user:${callerId}`).emit('call:answered', { callId, answer });
  });

  socket.on('call:decline', ({ callId, callerId }) => {
    logger.info(`📞 Call declined: ${callId}`);
    io.to(`user:${callerId}`).emit('call:declined', { callId });
  });

  socket.on('call:end', ({ callId, otherUserId }) => {
    logger.info(`📞 Call ended: ${callId}`);
    io.to(`user:${otherUserId}`).emit('call:ended', { callId });
  });

  socket.on('call:ice-candidate', ({ candidate, otherUserId }) => {
    io.to(`user:${otherUserId}`).emit('call:ice-candidate', { candidate });
  });

  socket.on('call:busy', ({ callId, callerId }) => {
    logger.info(`📞 Call busy: ${callId}`);
    io.to(`user:${callerId}`).emit('call:busy', { callId });
  });

  socket.on('call:failed', ({ callId, otherUserId, reason }) => {
    logger.info(`📞 Call failed: ${callId}, reason: ${reason}`);
    io.to(`user:${otherUserId}`).emit('call:failed', { callId, reason });
  });

  socket.on(SOCKET_EVENTS.DISCONNECT, async () => {
    try {
      onlineUsersMap.delete(currentUserId);

      const User = require('./models/User');
      await User.findByIdAndUpdate(currentUserId, {
        isOnline: false,
        socketId: null,
        lastSeen: Date.now()
      });

      socket.broadcast.emit(SOCKET_EVENTS.USER_OFFLINE, { userId: currentUserId });
      sendOnlineUsersList();

      logger.info(`❌ User disconnected: ${currentUserId}`);
    } catch (error) {
      logger.error('Disconnect error:', error);
    }
  });
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  logger.info('=================================');
  logger.info(`🚀 ChyraApp Server Running`);
  logger.info(`✓ Server running on port ${PORT}`);
  logger.info(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`✓ API: http://localhost:${PORT}`);
  logger.info(`✓ Health: http://localhost:${PORT}/health`);
  logger.info(`✓ Socket.IO: Enabled with online users tracking`);
  logger.info(`✓ Routes loaded:`);
  logger.info(`   - /api/auth`);
  logger.info(`   - /api/users`);
  logger.info(`   - /api/chats`);
  logger.info(`   - /api/messages ✅`);
  logger.info(`   - /api/contacts`);
  logger.info(`   - /api/groups`);
  logger.info(`   - /api/profile`);
  logger.info(`   - /api/calls`);
  logger.info(`   - /api/account`);
  logger.info(`   - /api/upload`);
  logger.info('=================================');
});

process.on('unhandledRejection', (err) => {
  logger.error('❌ Unhandled Rejection:', err);
  httpServer.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  logger.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('⚠️ SIGTERM received. Closing server gracefully...');
  httpServer.close(() => {
    logger.info('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('⚠️ SIGINT received. Closing server gracefully...');
  httpServer.close(() => {
    logger.info('✅ Server closed');
    process.exit(0);
  });
});

module.exports = { app, httpServer, io };