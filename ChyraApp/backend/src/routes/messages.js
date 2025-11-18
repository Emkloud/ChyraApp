const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { protect } = require('../middleware/auth');
const { validateSendMessage, validateEditMessage, validateDeleteMessage, validateReactToMessage } = require('../middleware/validation');
const { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } = require('../config/constants');

// @route   POST /api/messages
// @desc    Send a new message
// @access  Private
router.post('/', protect, validateSendMessage, async (req, res) => {
  try {
    const { conversationId, content, type, media, mediaGroup, replyTo } = req.body;

    // Check if conversation exists and user is participant
    const conversation = await Conversation.findById(conversationId)
      .populate('participants.user', '_id username fullName profilePicture');
    
    if (!conversation) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.CONVERSATION_NOT_FOUND
      });
    }

    if (!conversation.isParticipant(req.user._id)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: ERROR_MESSAGES.NOT_PARTICIPANT
      });
    }

    // Check if only admins can message (for group settings)
    if (conversation.isGroup && 
        conversation.settings?.onlyAdminsCanMessage && 
        !conversation.isAdmin(req.user._id)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Only admins can send messages in this group'
      });
    }

    // Create message
    const message = await Message.create({
      conversation: conversationId,
      sender: req.user._id,
      content: content || '',
      type: type || 'text',
      media: media || null,
      mediaGroup: mediaGroup || null,
      replyTo: replyTo || null
    });

    // Update conversation's last message
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = Date.now();
    await conversation.save();

    // Populate message
    await message.populate('sender', 'username fullName profilePicture avatar');
    if (replyTo) {
      await message.populate('replyTo');
    }

    // Build payload for emit and response
    const messageToEmit = {
      ...message.toObject(),
      chat: conversationId,
      conversation: conversationId,
      _id: message._id.toString()
    };

    // ✅ CRITICAL FIX: Emit to ALL participants' personal rooms for instant delivery
    const io = req.app.get('io');
    if (io) {
      // Get all participant IDs
      const participantIds = conversation.participants
        .filter(p => p.isActive !== false)
        .map(p => {
          if (p.user && p.user._id) return p.user._id.toString();
          if (p.user) return p.user.toString();
          return null;
        })
        .filter(Boolean);

      console.log('[MESSAGE] Emitting to participants:', participantIds);

      // ✅ Emit to each participant's personal room (they join this on connection)
      participantIds.forEach(participantId => {
        io.to(`user:${participantId}`).emit('message:new', messageToEmit);
        
        // Also emit legacy event names for compatibility
        io.to(`user:${participantId}`).emit('message:receive', messageToEmit);
        io.to(`user:${participantId}`).emit('newMessage', messageToEmit);
      });

      // Also emit to conversation room for users who have joined it
      io.to(`conversation:${conversationId}`).emit('message:new', messageToEmit);
      io.to(`conversation:${conversationId}`).emit('message:receive', messageToEmit);

      // Mark as delivered for online users
      participantIds.forEach(participantId => {
        if (participantId !== req.user._id.toString()) {
          // Check if user has active socket connections
          const userRoom = io.sockets.adapter.rooms.get(`user:${participantId}`);
          if (userRoom && userRoom.size > 0) {
            if (!message.deliveredTo?.some(d => d.user?.toString() === participantId)) {
              message.markAsDelivered(participantId);
            }
          }
        }
      });

      // Save delivery status
      if (message.deliveredTo && message.deliveredTo.length > 0) {
        await message.save();
        
        // Emit delivery receipts
        io.to(`user:${req.user._id}`).emit('message:delivered', {
          messageId: message._id.toString(),
          conversationId,
          deliveredTo: message.deliveredTo
        });
      }
    }

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: SUCCESS_MESSAGES.MESSAGE_SENT,
      data: { message: messageToEmit }
    });
  } catch (error) {
    console.error('❌ Send message error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/messages/:conversationId
// @desc    Get messages for a conversation
// @access  Private
router.get('/:conversationId', protect, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50, cursor } = req.query;

    // Check if conversation exists and user is participant
    const conversation = await Conversation.findById(conversationId);
    
    if (!conversation) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.CONVERSATION_NOT_FOUND
      });
    }

    if (!conversation.isParticipant(req.user._id)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: ERROR_MESSAGES.NOT_PARTICIPANT
      });
    }

    // Build query - exclude deleted messages for this user
    const query = {
      conversation: conversationId,
      'deletedBy.user': { $ne: req.user._id }
    };

    // Add cursor-based pagination if cursor is provided
    if (cursor) {
      query._id = { $lt: cursor };
    }

    // Get messages with proper population
    const messages = await Message.find(query)
      .populate('sender', 'username fullName profilePicture avatar')
      .populate('replyTo', 'content sender')
      .populate('reactions.user', 'username fullName avatar')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(cursor ? 0 : (page - 1) * parseInt(limit));

    const count = await Message.countDocuments(query);

    // Mark unread messages as read
    const unreadMessages = messages.filter(msg => 
      msg.sender?._id?.toString() !== req.user._id.toString() && 
      !msg.isReadBy(req.user._id)
    );

    if (unreadMessages.length > 0) {
      // Mark as read in database
      await Promise.all(
        unreadMessages.map(async (msg) => {
          if (!msg.isReadBy(req.user._id)) {
            msg.markAsRead(req.user._id);
            await msg.save();
          }
        })
      );

      // Emit read receipts via Socket.IO
      const io = req.app.get('io');
      if (io) {
        // Get all participant IDs to notify them of read receipts
        const participantIds = conversation.participants
          .filter(p => p.isActive !== false)
          .map(p => {
            if (p.user && p.user._id) return p.user._id.toString();
            if (p.user) return p.user.toString();
            return null;
          })
          .filter(Boolean);

        unreadMessages.forEach(msg => {
          const readReceipt = {
            messageId: msg._id.toString(),
            userId: req.user._id.toString(),
            conversationId,
            readAt: Date.now()
          };

          // Emit to all participants' personal rooms
          participantIds.forEach(participantId => {
            io.to(`user:${participantId}`).emit('message:read', readReceipt);
          });

          // Also emit to conversation room
          io.to(`conversation:${conversationId}`).emit('message:read', readReceipt);
        });
      }
    }

    // Return in chronological order (oldest first)
    const orderedMessages = messages.reverse();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        messages: orderedMessages,
        totalPages: Math.ceil(count / parseInt(limit)),
        currentPage: parseInt(page),
        total: count,
        hasMore: messages.length === parseInt(limit),
        nextCursor: messages.length > 0 ? messages[messages.length - 1]._id : null
      }
    });
  } catch (error) {
    console.error('❌ Get messages error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/messages/:messageId
// @desc    Edit a message
// @access  Private
router.put('/:messageId', protect, validateEditMessage, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.MESSAGE_NOT_FOUND
      });
    }

    // Check if user is the sender
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: ERROR_MESSAGES.CANNOT_EDIT
      });
    }

    // Check if message is deleted
    if (message.isDeletedFor && message.isDeletedFor(req.user._id)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Cannot edit deleted message'
      });
    }

    // Edit message with proper content structure
    if (typeof content === 'string') {
      message.content = content;
    } else if (content && content.text) {
      message.content = content.text;
    }
    
    message.isEdited = true;
    message.editedAt = Date.now();
    await message.save();

    // Get conversation for participants
    const conversation = await Conversation.findById(message.conversation);
    
    // Emit update via Socket.IO to all participants
    const io = req.app.get('io');
    if (io && conversation) {
      const editPayload = {
        messageId: message._id.toString(),
        content: message.content,
        isEdited: true,
        editedAt: message.editedAt,
        conversationId: message.conversation.toString()
      };

      // Get participant IDs
      const participantIds = conversation.participants
        .filter(p => p.isActive !== false)
        .map(p => {
          if (p.user && p.user._id) return p.user._id.toString();
          if (p.user) return p.user.toString();
          return null;
        })
        .filter(Boolean);

      // Emit to all participants' personal rooms
      participantIds.forEach(participantId => {
        io.to(`user:${participantId}`).emit('message:edit', editPayload);
        io.to(`user:${participantId}`).emit('message:edited', editPayload);
      });

      // Also emit to conversation room
      io.to(`conversation:${message.conversation}`).emit('message:edit', editPayload);
    }

    await message.populate('sender', 'username fullName profilePicture avatar');

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: SUCCESS_MESSAGES.MESSAGE_UPDATED,
      data: { message }
    });
  } catch (error) {
    console.error('❌ Edit message error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   DELETE /api/messages/:messageId
// @desc    Delete a message
// @access  Private
router.delete('/:messageId', protect, validateDeleteMessage, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { deleteType = 'for_me', deleteForEveryone } = req.body;
    
    // Support both deleteType and deleteForEveryone for compatibility
    const finalDeleteType = deleteForEveryone === true ? 'for_everyone' : deleteType;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.MESSAGE_NOT_FOUND
      });
    }

    // Check if user can delete
    if (message.canDelete && !message.canDelete(req.user._id, finalDeleteType)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: ERROR_MESSAGES.CANNOT_DELETE
      });
    }

    // Delete message properly
    if (message.deleteFor) {
      message.deleteFor(req.user._id, finalDeleteType);
    }
    await message.save();

    // Emit delete via Socket.IO
    const io = req.app.get('io');
    if (io && finalDeleteType === 'for_everyone') {
      const conversation = await Conversation.findById(message.conversation);
      
      if (conversation) {
        const deletePayload = {
          messageId: message._id.toString(),
          deleteType: finalDeleteType,
          conversationId: message.conversation.toString()
        };

        // Get participant IDs
        const participantIds = conversation.participants
          .filter(p => p.isActive !== false)
          .map(p => {
            if (p.user && p.user._id) return p.user._id.toString();
            if (p.user) return p.user.toString();
            return null;
          })
          .filter(Boolean);

        // Emit to all participants' personal rooms
        participantIds.forEach(participantId => {
          io.to(`user:${participantId}`).emit('message:delete', deletePayload);
          io.to(`user:${participantId}`).emit('message:deleted', deletePayload);
        });

        // Also emit to conversation room
        io.to(`conversation:${message.conversation}`).emit('message:delete', deletePayload);
      }
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: SUCCESS_MESSAGES.MESSAGE_DELETED
    });
  } catch (error) {
    console.error('❌ Delete message error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/messages/:messageId/reactions
// @desc    Add reaction to a message
// @access  Private
router.post('/:messageId/reactions', protect, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Emoji is required'
      });
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.MESSAGE_NOT_FOUND
      });
    }

    // Add or update reaction
    const existingReaction = message.reactions?.find(
      r => (r.user?.toString() || r.user) === req.user._id.toString()
    );

    if (existingReaction) {
      if (existingReaction.emoji === emoji) {
        // Remove reaction if clicking same emoji
        if (message.removeReaction) {
          message.removeReaction(req.user._id);
        }
      } else {
        // Update to new emoji
        existingReaction.emoji = emoji;
      }
    } else {
      // Add new reaction
      if (message.addReaction) {
        message.addReaction(req.user._id, emoji);
      } else {
        if (!message.reactions) message.reactions = [];
        message.reactions.push({ user: req.user._id, emoji });
      }
    }

    await message.save();

    // Get conversation for participants
    const conversation = await Conversation.findById(message.conversation);

    // Emit reaction via Socket.IO to all participants
    const io = req.app.get('io');
    if (io && conversation) {
      const reactionPayload = {
        messageId: message._id.toString(),
        userId: req.user._id.toString(),
        emoji: emoji,
        reactions: message.reactions,
        conversationId: message.conversation.toString()
      };

      // Get participant IDs
      const participantIds = conversation.participants
        .filter(p => p.isActive !== false)
        .map(p => {
          if (p.user && p.user._id) return p.user._id.toString();
          if (p.user) return p.user.toString();
          return null;
        })
        .filter(Boolean);

      // Emit to all participants' personal rooms
      participantIds.forEach(participantId => {
        io.to(`user:${participantId}`).emit('message:reaction_added', reactionPayload);
        io.to(`user:${participantId}`).emit('message:react', reactionPayload);
      });

      // Also emit to conversation room
      io.to(`conversation:${message.conversation}`).emit('message:reaction_added', reactionPayload);
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Reaction updated successfully',
      data: { reactions: message.reactions }
    });
  } catch (error) {
    console.error('❌ React to message error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/messages/:messageId/react (backward compatibility)
// @desc    React to a message (legacy endpoint)
// @access  Private
router.post('/:messageId/react', protect, validateReactToMessage, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.MESSAGE_NOT_FOUND
      });
    }

    // Add reaction
    if (message.addReaction) {
      message.addReaction(req.user._id, emoji);
    } else {
      if (!message.reactions) message.reactions = [];
      message.reactions.push({ user: req.user._id, emoji });
    }
    await message.save();

    // Get conversation for participants
    const conversation = await Conversation.findById(message.conversation);

    // Emit reaction via Socket.IO
    const io = req.app.get('io');
    if (io && conversation) {
      const reactionPayload = {
        messageId: message._id.toString(),
        userId: req.user._id.toString(),
        emoji: emoji,
        conversationId: message.conversation.toString()
      };

      // Get participant IDs
      const participantIds = conversation.participants
        .filter(p => p.isActive !== false)
        .map(p => {
          if (p.user && p.user._id) return p.user._id.toString();
          if (p.user) return p.user.toString();
          return null;
        })
        .filter(Boolean);

      // Emit to all participants' personal rooms
      participantIds.forEach(participantId => {
        io.to(`user:${participantId}`).emit('message:reaction_added', reactionPayload);
      });

      // Also emit to conversation room
      io.to(`conversation:${message.conversation}`).emit('message:reaction_added', reactionPayload);
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Reaction added successfully',
      data: { reactions: message.reactions }
    });
  } catch (error) {
    console.error('❌ React to message error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   DELETE /api/messages/:messageId/reactions
// @desc    Remove reaction from a message
// @access  Private
router.delete('/:messageId/reactions', protect, async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.MESSAGE_NOT_FOUND
      });
    }

    // Remove reaction
    if (message.removeReaction) {
      message.removeReaction(req.user._id);
    } else {
      message.reactions = message.reactions?.filter(
        r => (r.user?.toString() || r.user) !== req.user._id.toString()
      ) || [];
    }
    await message.save();

    // Get conversation for participants
    const conversation = await Conversation.findById(message.conversation);

    // Emit reaction removal via Socket.IO
    const io = req.app.get('io');
    if (io && conversation) {
      const reactionPayload = {
        messageId: message._id.toString(),
        userId: req.user._id.toString(),
        emoji: null,
        reactions: message.reactions,
        conversationId: message.conversation.toString()
      };

      // Get participant IDs
      const participantIds = conversation.participants
        .filter(p => p.isActive !== false)
        .map(p => {
          if (p.user && p.user._id) return p.user._id.toString();
          if (p.user) return p.user.toString();
          return null;
        })
        .filter(Boolean);

      // Emit to all participants' personal rooms
      participantIds.forEach(participantId => {
        io.to(`user:${participantId}`).emit('message:reaction_added', reactionPayload);
      });

      // Also emit to conversation room
      io.to(`conversation:${message.conversation}`).emit('message:reaction_added', reactionPayload);
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Reaction removed successfully'
    });
  } catch (error) {
    console.error('❌ Remove reaction error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   DELETE /api/messages/:messageId/react (backward compatibility)
// @desc    Remove reaction from a message (legacy endpoint)
// @access  Private
router.delete('/:messageId/react', protect, async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.MESSAGE_NOT_FOUND
      });
    }

    // Remove reaction
    if (message.removeReaction) {
      message.removeReaction(req.user._id);
    } else {
      message.reactions = message.reactions?.filter(
        r => (r.user?.toString() || r.user) !== req.user._id.toString()
      ) || [];
    }
    await message.save();

    // Get conversation for participants
    const conversation = await Conversation.findById(message.conversation);

    // Emit reaction removal via Socket.IO
    const io = req.app.get('io');
    if (io && conversation) {
      const reactionPayload = {
        messageId: message._id.toString(),
        userId: req.user._id.toString(),
        emoji: null,
        conversationId: message.conversation.toString()
      };

      // Get participant IDs
      const participantIds = conversation.participants
        .filter(p => p.isActive !== false)
        .map(p => {
          if (p.user && p.user._id) return p.user._id.toString();
          if (p.user) return p.user.toString();
          return null;
        })
        .filter(Boolean);

      // Emit to all participants' personal rooms
      participantIds.forEach(participantId => {
        io.to(`user:${participantId}`).emit('message:reaction_added', reactionPayload);
      });

      // Also emit to conversation room
      io.to(`conversation:${message.conversation}`).emit('message:reaction_added', reactionPayload);
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Reaction removed successfully'
    });
  } catch (error) {
    console.error('❌ Remove reaction error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;