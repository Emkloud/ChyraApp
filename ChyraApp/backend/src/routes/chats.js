const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { validateCreateConversation, validateUpdateConversation } = require('../middleware/validation');
const { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } = require('../config/constants');

// @route   POST /api/chats
// @desc    Create new conversation
// @access  Private
router.post('/', protect, validateCreateConversation, async (req, res) => {
  try {
    const { participantId, name, isGroup, participants } = req.body;

    // For 1-on-1 chat
    if (!isGroup && participantId) {
      // Check if conversation already exists
      const existingConversation = await Conversation.findOne({
        isGroup: false,
        'participants.user': { $all: [req.user._id, participantId] }
      }).populate('participants.user', 'username fullName profilePicture status');

      if (existingConversation) {
        return res.status(HTTP_STATUS.OK).json({
          success: true,
          message: 'Conversation already exists',
          data: { conversation: existingConversation }
        });
      }

      // Create new 1-on-1 conversation
      const conversation = await Conversation.create({
        isGroup: false,
        participants: [
          { user: req.user._id, role: 'member' },
          { user: participantId, role: 'member' }
        ],
        createdBy: req.user._id
      });

      await conversation.populate('participants.user', 'username fullName profilePicture status');

      // Emit to both users via Socket.IO
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${participantId}`).emit('conversation:create', conversation);
      }

      return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: SUCCESS_MESSAGES.CONVERSATION_CREATED,
        data: { conversation }
      });
    }

    // For group chat
    if (isGroup && participants && participants.length >= 2) {
      const participantsList = [
        { user: req.user._id, role: 'admin' },
        ...participants.map(p => ({ user: p, role: 'member' }))
      ];

      const conversation = await Conversation.create({
        name,
        isGroup: true,
        participants: participantsList,
        createdBy: req.user._id
      });

      await conversation.populate('participants.user', 'username fullName profilePicture status');

      // Emit to all participants
      const io = req.app.get('io');
      if (io) {
        participants.forEach(participantId => {
          io.to(`user:${participantId}`).emit('conversation:create', conversation);
        });
      }

      return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: SUCCESS_MESSAGES.CONVERSATION_CREATED,
        data: { conversation }
      });
    }

    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: 'Invalid conversation data'
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR
    });
  }
});

// @route   GET /api/chats
// @desc    Get user conversations
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      'participants.user': req.user._id,
      'participants.isActive': true,
      'deletedBy.user': { $ne: req.user._id }
    })
      .populate('participants.user', 'username fullName profilePicture status lastSeen')
      .populate('lastMessage')
      .sort({ lastMessageAt: -1 });

    // Get unread count for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await conv.getUnreadCount(req.user._id);
        return {
          ...conv.toObject(),
          unreadCount
        };
      })
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { conversations: conversationsWithUnread }
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR
    });
  }
});

// @route   GET /api/chats/:id
// @desc    Get conversation by ID
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id)
      .populate('participants.user', 'username fullName profilePicture status lastSeen')
      .populate('lastMessage');

    if (!conversation) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.CONVERSATION_NOT_FOUND
      });
    }

    // Check if user is participant
    if (!conversation.isParticipant(req.user._id)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: ERROR_MESSAGES.NOT_PARTICIPANT
      });
    }

    const unreadCount = await conversation.getUnreadCount(req.user._id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        conversation: {
          ...conversation.toObject(),
          unreadCount
        }
      }
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR
    });
  }
});

// @route   PUT /api/chats/:id
// @desc    Update conversation
// @access  Private
router.put('/:id', protect, validateUpdateConversation, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);

    if (!conversation) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.CONVERSATION_NOT_FOUND
      });
    }

    // Check if user is admin (for group chats)
    if (conversation.isGroup && !conversation.isAdmin(req.user._id)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: ERROR_MESSAGES.NOT_ADMIN
      });
    }

    const { name, description, groupPicture, settings } = req.body;

    if (name) conversation.name = name;
    if (description !== undefined) conversation.description = description;
    if (groupPicture) conversation.groupPicture = groupPicture;
    if (settings) conversation.settings = { ...conversation.settings, ...settings };

    await conversation.save();
    await conversation.populate('participants.user', 'username fullName profilePicture status');

    // Emit update to all participants
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${conversation._id}`).emit('conversation:update', conversation);
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: SUCCESS_MESSAGES.CONVERSATION_UPDATED,
      data: { conversation }
    });
  } catch (error) {
    console.error('Update conversation error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR
    });
  }
});

// @route   DELETE /api/chats/:id
// @desc    Delete conversation (soft delete for user)
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);

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

    // Soft delete for user
    conversation.deletedBy.push({ user: req.user._id });
    await conversation.save();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: SUCCESS_MESSAGES.CONVERSATION_DELETED
    });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR
    });
  }
});

// @route   POST /api/chats/:id/participants
// @desc    Add participant to group
// @access  Private
router.post('/:id/participants', protect, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);

    if (!conversation || !conversation.isGroup) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Group conversation not found'
      });
    }

    if (!conversation.isAdmin(req.user._id)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: ERROR_MESSAGES.NOT_ADMIN
      });
    }

    const { userId } = req.body;
    
    const userToAdd = await User.findById(userId);
    if (!userToAdd) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.USER_NOT_FOUND
      });
    }

    conversation.addParticipant(userId);
    await conversation.save();
    await conversation.populate('participants.user', 'username fullName profilePicture status');

    // Emit to all participants
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${conversation._id}`).emit('conversation:participant_added', {
        conversation,
        addedUser: userToAdd
      });
      io.to(`user:${userId}`).emit('conversation:added', conversation);
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: SUCCESS_MESSAGES.PARTICIPANT_ADDED,
      data: { conversation }
    });
  } catch (error) {
    console.error('Add participant error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR
    });
  }
});

// @route   DELETE /api/chats/:id/participants/:userId
// @desc    Remove participant from group
// @access  Private
router.delete('/:id/participants/:userId', protect, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    const { userId } = req.params;

    if (!conversation || !conversation.isGroup) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Group conversation not found'
      });
    }

    // User can remove themselves or admin can remove others
    if (userId !== req.user._id.toString() && !conversation.isAdmin(req.user._id)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: ERROR_MESSAGES.NOT_ADMIN
      });
    }

    conversation.removeParticipant(userId);
    await conversation.save();

    // Emit to all participants
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${conversation._id}`).emit('conversation:participant_removed', {
        conversationId: conversation._id,
        removedUserId: userId
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: SUCCESS_MESSAGES.PARTICIPANT_REMOVED
    });
  } catch (error) {
    console.error('Remove participant error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR
    });
  }
});

module.exports = router;