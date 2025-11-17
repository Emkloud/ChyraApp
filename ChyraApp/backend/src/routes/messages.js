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

    // Build payload once for both emit and response
    const messageToEmit = {
      ...message.toObject(),
      chat: conversationId,
      conversation: conversationId,
      _id: message._id.toString()
    };

    // ✅ FIX 1: Mark as delivered to online participants
    const io = req.app.get('io');
    if (io) {
      // ✅ FIX 2: Emit to conversation room
      io.to(`conversation:${conversationId}`).emit('message:receive', messageToEmit);

      // Mark as delivered for online users in the conversation
      conversation.participants.forEach(participant => {
        const userId = participant.user?.toString() || participant.toString();
        if (userId !== req.user._id.toString()) {
          // Check if user has any active socket connections
          const userSockets = Array.from(io.sockets.sockets.values())
            .filter(s => s.userId === userId);
          
          if (userSockets.length > 0 && !message.deliveredTo?.some(d => d.user?.toString() === userId)) {
            message.markAsDelivered(userId);
          }
        }
      });

      // Save delivery status if any were marked
      if (message.deliveredTo && message.deliveredTo.length > 0) {
        await message.save();
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

    // ✅ FIX 3: Build query - exclude deleted messages for this user
    const query = {
      conversation: conversationId,
      'deletedBy.user': { $ne: req.user._id }
    };

    // Add cursor-based pagination if cursor is provided
    if (cursor) {
      query._id = { $lt: cursor };
    }

    // ✅ FIX 4: Get messages with proper population
    const messages = await Message.find(query)
      .populate('sender', 'username fullName profilePicture avatar')
      .populate('replyTo', 'content sender')
      .populate('reactions.user', 'username fullName avatar')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(cursor ? 0 : (page - 1) * parseInt(limit));

    const count = await Message.countDocuments(query);

    // ✅ FIX 5: Mark unread messages as read
    const unreadMessages = messages.filter(msg => 
      msg.sender?.toString() !== req.user._id.toString() && 
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

      // ✅ FIX 6: Emit read receipts via Socket.IO
      const io = req.app.get('io');
      if (io) {
        unreadMessages.forEach(msg => {
          io.to(`conversation:${conversationId}`).emit('message:read', {
            messageId: msg._id.toString(),
            userId: req.user._id.toString(),
            conversationId
          });
        });
      }
    }

    // ✅ FIX 7: Return in chronological order (oldest first)
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
    if (message.isDeletedFor(req.user._id)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Cannot edit deleted message'
      });
    }

    // ✅ FIX 8: Edit message with proper content structure
    if (typeof content === 'string') {
      message.content = content;
    } else if (content && content.text) {
      message.content = content.text;
    }
    
    message.isEdited = true;
    message.editedAt = Date.now();
    await message.save();

    // ✅ FIX 9: Emit update via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${message.conversation}`).emit('message:edit', {
        messageId: message._id.toString(),
        content: message.content,
        isEdited: true,
        editedAt: message.editedAt
      });
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
    if (!message.canDelete(req.user._id, finalDeleteType)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: ERROR_MESSAGES.CANNOT_DELETE
      });
    }

    // ✅ FIX 10: Delete message properly
    message.deleteFor(req.user._id, finalDeleteType);
    await message.save();

    // ✅ FIX 11: Emit delete via Socket.IO
    const io = req.app.get('io');
    if (io) {
      if (finalDeleteType === 'for_everyone') {
        io.to(`conversation:${message.conversation}`).emit('message:delete', {
          messageId: message._id.toString(),
          deleteType: finalDeleteType,
          conversationId: message.conversation.toString()
        });
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
// @desc    Add reaction to a message (updated endpoint for frontend compatibility)
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

    // ✅ FIX 12: Add or update reaction
    const existingReaction = message.reactions?.find(
      r => (r.user?.toString() || r.user) === req.user._id.toString()
    );

    if (existingReaction) {
      if (existingReaction.emoji === emoji) {
        // Remove reaction if clicking same emoji
        message.removeReaction(req.user._id);
      } else {
        // Update to new emoji
        existingReaction.emoji = emoji;
      }
    } else {
      // Add new reaction
      message.addReaction(req.user._id, emoji);
    }

    await message.save();

    // ✅ FIX 13: Emit reaction via Socket.IO (FIXED: message:reaction_added instead of message:react)
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${message.conversation}`).emit('message:reaction_added', {
        messageId: message._id.toString(),
        userId: req.user._id.toString(),
        emoji: emoji,
        reactions: message.reactions
      });
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
    message.addReaction(req.user._id, emoji);
    await message.save();

    // Emit reaction via Socket.IO (FIXED: message:reaction_added)
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${message.conversation}`).emit('message:reaction_added', {
        messageId: message._id.toString(),
        userId: req.user._id.toString(),
        emoji: emoji
      });
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

// @route   DELETE /api/messages/:messageId/reactions (frontend compatibility)
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
    message.removeReaction(req.user._id);
    await message.save();

    // Emit reaction removal via Socket.IO (FIXED: message:reaction_added with null emoji)
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${message.conversation}`).emit('message:reaction_added', {
        messageId: message._id.toString(),
        userId: req.user._id.toString(),
        emoji: null
      });
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
    message.removeReaction(req.user._id);
    await message.save();

    // Emit reaction removal via Socket.IO (FIXED: message:reaction_added with null emoji)
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${message.conversation}`).emit('message:reaction_added', {
        messageId: message._id.toString(),
        userId: req.user._id.toString(),
        emoji: null
      });
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