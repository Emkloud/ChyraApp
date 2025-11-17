const { SOCKET_EVENTS } = require('../config/constants');
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const logger = require('../utils/logger');

/**
 * Initialize Socket.IO event handlers
 * @param {Object} io - Socket.IO server instance
 */
const initializeSocket = (io) => {
  io.on(SOCKET_EVENTS.CONNECTION, async (socket) => {
    try {
      const userId = socket.userId;
      logger.info(`User connected: ${userId} (Socket ID: ${socket.id})`);

      // Update user status to online
      await User.findByIdAndUpdate(userId, {
        status: 'online',
        socketId: socket.id,
        lastSeen: Date.now()
      });

      // Join user's personal room
      socket.join(`user:${userId}`);

      // Emit user online status to all connected users
      socket.broadcast.emit(SOCKET_EVENTS.USER_ONLINE, {
        userId,
        status: 'online'
      });

      // Handle user joining conversation room
      socket.on(SOCKET_EVENTS.CONVERSATION_JOIN, async ({ conversationId }) => {
        try {
          // Verify user is participant
          const conversation = await Conversation.findById(conversationId);
          
          if (conversation && conversation.isParticipant(userId)) {
            socket.join(`conversation:${conversationId}`);
            logger.info(`User ${userId} joined conversation ${conversationId}`);

            // Mark messages as delivered
            const undeliveredMessages = await Message.find({
              conversation: conversationId,
              sender: { $ne: userId },
              'deliveredTo.user': { $ne: userId }
            });

            for (const message of undeliveredMessages) {
              message.markAsDelivered(userId);
              await message.save();

              // Emit delivery status to sender
              io.to(`user:${message.sender}`).emit(SOCKET_EVENTS.MESSAGE_DELIVERED, {
                messageId: message._id,
                userId,
                conversationId
              });
            }
          }
        } catch (error) {
          logger.error('Error joining conversation:', error);
          socket.emit(SOCKET_EVENTS.ERROR, {
            message: 'Failed to join conversation'
          });
        }
      });

      // Handle user leaving conversation room
      socket.on(SOCKET_EVENTS.CONVERSATION_LEAVE, ({ conversationId }) => {
        socket.leave(`conversation:${conversationId}`);
        logger.info(`User ${userId} left conversation ${conversationId}`);
      });

      // Handle user typing
      socket.on(SOCKET_EVENTS.USER_TYPING, ({ conversationId }) => {
        socket.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.USER_TYPING, {
          userId,
          conversationId
        });
      });

      // Handle user stop typing
      socket.on(SOCKET_EVENTS.USER_STOP_TYPING, ({ conversationId }) => {
        socket.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.USER_STOP_TYPING, {
          userId,
          conversationId
        });
      });

      // Handle new message (real-time broadcast)
      socket.on(SOCKET_EVENTS.MESSAGE_SEND, async (messageData) => {
        try {
          const { conversationId, tempId } = messageData;

          // Emit to conversation room (including sender for confirmation)
          io.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.MESSAGE_RECEIVE, {
            ...messageData,
            tempId // For client-side optimistic updates
          });

          logger.info(`Message sent in conversation ${conversationId} by user ${userId}`);
        } catch (error) {
          logger.error('Error sending message:', error);
          socket.emit(SOCKET_EVENTS.ERROR, {
            message: 'Failed to send message',
            tempId: messageData.tempId
          });
        }
      });

      // Handle message read
      socket.on(SOCKET_EVENTS.MESSAGE_READ, async ({ messageId, conversationId }) => {
        try {
          const message = await Message.findById(messageId);
          
          if (message && !message.isReadBy(userId)) {
            message.markAsRead(userId);
            await message.save();

            // Emit read receipt to conversation
            io.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.MESSAGE_READ, {
              messageId,
              userId,
              conversationId,
              readAt: Date.now()
            });

            logger.info(`Message ${messageId} marked as read by user ${userId}`);
          }
        } catch (error) {
          logger.error('Error marking message as read:', error);
        }
      });

      // Handle message edit
      socket.on(SOCKET_EVENTS.MESSAGE_EDIT, ({ messageId, conversationId, content }) => {
        io.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.MESSAGE_EDIT, {
          messageId,
          content,
          editedAt: Date.now(),
          userId
        });
        logger.info(`Message ${messageId} edited by user ${userId}`);
      });

      // Handle message delete
      socket.on(SOCKET_EVENTS.MESSAGE_DELETE, ({ messageId, conversationId, deleteType }) => {
        if (deleteType === 'for_everyone') {
          io.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.MESSAGE_DELETE, {
            messageId,
            conversationId,
            deleteType
          });
          logger.info(`Message ${messageId} deleted for everyone by user ${userId}`);
        }
      });

      // Handle message reaction
      socket.on(SOCKET_EVENTS.MESSAGE_REACT, ({ messageId, conversationId, emoji }) => {
        io.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.MESSAGE_REACT, {
          messageId,
          userId,
          emoji,
          conversationId
        });
        logger.info(`User ${userId} reacted to message ${messageId} with ${emoji}`);
      });

      // Handle conversation update
      socket.on(SOCKET_EVENTS.CONVERSATION_UPDATE, ({ conversationId, updates }) => {
        io.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.CONVERSATION_UPDATE, {
          conversationId,
          updates,
          userId
        });
        logger.info(`Conversation ${conversationId} updated by user ${userId}`);
      });

      // Handle user status change
      socket.on('user:status', async ({ status }) => {
        try {
          await User.findByIdAndUpdate(userId, { status });
          
          // Broadcast status change to all users
          socket.broadcast.emit('user:status', {
            userId,
            status
          });

          logger.info(`User ${userId} status changed to ${status}`);
        } catch (error) {
          logger.error('Error updating user status:', error);
        }
      });

      // Handle call initiation (for future video/voice calls)
      socket.on(SOCKET_EVENTS.CALL_INITIATE, ({ conversationId, callType, callerId }) => {
        socket.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.CALL_INITIATE, {
          conversationId,
          callType,
          callerId,
          callerName: socket.user.fullName
        });
        logger.info(`Call initiated in conversation ${conversationId} by user ${userId}`);
      });

      // Handle call accept
      socket.on(SOCKET_EVENTS.CALL_ACCEPT, ({ conversationId, callerId }) => {
        io.to(`user:${callerId}`).emit(SOCKET_EVENTS.CALL_ACCEPT, {
          conversationId,
          acceptedBy: userId
        });
        logger.info(`Call accepted in conversation ${conversationId} by user ${userId}`);
      });

      // Handle call reject
      socket.on(SOCKET_EVENTS.CALL_REJECT, ({ conversationId, callerId }) => {
        io.to(`user:${callerId}`).emit(SOCKET_EVENTS.CALL_REJECT, {
          conversationId,
          rejectedBy: userId
        });
        logger.info(`Call rejected in conversation ${conversationId} by user ${userId}`);
      });

      // Handle call end
      socket.on(SOCKET_EVENTS.CALL_END, ({ conversationId }) => {
        io.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.CALL_END, {
          conversationId,
          endedBy: userId
        });
        logger.info(`Call ended in conversation ${conversationId} by user ${userId}`);
      });

      // Handle disconnect
      socket.on(SOCKET_EVENTS.DISCONNECT, async () => {
        try {
          // Update user status to offline
          await User.findByIdAndUpdate(userId, {
            status: 'offline',
            socketId: null,
            lastSeen: Date.now()
          });

          // Broadcast user offline status
          socket.broadcast.emit(SOCKET_EVENTS.USER_OFFLINE, {
            userId,
            lastSeen: Date.now()
          });

          logger.info(`User disconnected: ${userId}`);
        } catch (error) {
          logger.error('Error handling disconnect:', error);
        }
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error(`Socket error for user ${userId}:`, error);
      });

    } catch (error) {
      logger.error('Socket connection error:', error);
      socket.disconnect();
    }
  });

  // Handle connection errors
  io.on('connect_error', (error) => {
    logger.error('Socket.IO connection error:', error);
  });

  logger.info('Socket.IO initialized successfully');
};

module.exports = initializeSocket;