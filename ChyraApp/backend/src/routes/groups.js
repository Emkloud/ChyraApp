const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { protect } = require('../middleware/auth');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

// All routes require authentication
router.use(protect);

// ==================== MAIN GROUP ROUTES ====================

// Get all user's groups
router.get('/', groupController.getUserGroups);

// Create group
router.post('/', groupController.createGroup);

// Get group details
router.get('/:id', groupController.getGroupById);

// Update group info (admin only)
router.put('/:id', groupController.updateGroup);

// Delete group (creator only)
router.delete('/:id', groupController.deleteGroup);

// ==================== MEMBER MANAGEMENT ====================

// Add members to group
router.post('/:id/members', groupController.addMembers);

// Remove member from group
router.delete('/:id/members/:memberId', groupController.removeMember);

// ==================== ADMIN MANAGEMENT ====================

// Make member an admin
router.post('/:id/admins/:memberId', groupController.makeAdmin);

// Remove admin role
router.delete('/:id/admins/:memberId', groupController.removeAdmin);

// ==================== LEAVE GROUP ====================

// @route   POST /api/groups/:id/leave
// @desc    Leave a group
// @access  Private
router.post('/:id/leave', async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const groupId = req.params.id;

    console.log('[GROUP] User leaving group:', { userId: userId.toString(), groupId });

    const group = await Conversation.findById(groupId);

    if (!group || !group.isGroup) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Check if user is a member
    const isMember = group.participants.some(p => {
      const participantId = p.user?._id || p.user;
      return participantId && participantId.toString() === userId.toString() && p.isActive !== false;
    });

    if (!isMember) {
      return res.status(400).json({
        success: false,
        message: 'You are not a member of this group'
      });
    }

    // Creator cannot leave
    const creatorId = group.createdBy?._id || group.createdBy;
    if (creatorId && creatorId.toString() === userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Creator cannot leave the group. Transfer ownership or delete the group instead.'
      });
    }

    // Find and deactivate member
    const memberIndex = group.participants.findIndex(p => {
      const participantId = p.user?._id || p.user;
      return participantId && participantId.toString() === userId.toString();
    });

    if (memberIndex !== -1) {
      group.participants[memberIndex].isActive = false;
      group.participants[memberIndex].leftAt = new Date();
    }

    await group.save();

    console.log('[GROUP] User left group:', groupId);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${userId}`).emit('group:left', { groupId });
      
      // Notify other members
      group.participants.forEach(p => {
        if (p.isActive !== false) {
          const participantId = p.user?._id || p.user;
          if (participantId) {
            io.to(`user:${participantId}`).emit('group:memberLeft', { 
              groupId, 
              userId: userId.toString()
            });
          }
        }
      });
    }

    res.json({
      success: true,
      message: 'You have left the group'
    });
  } catch (error) {
    console.error('[GROUP] Leave group error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to leave group',
      error: error.message
    });
  }
});

// ==================== GROUP MESSAGES ====================

// @route   GET /api/groups/:id/messages
// @desc    Get messages for a group
// @access  Private
router.get('/:id/messages', async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.id || req.user._id;
    const { limit = 50, page = 1, cursor } = req.query;

    console.log('📥 Loading messages for group:', groupId);

    const group = await Conversation.findById(groupId);

    if (!group || !group.isGroup) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Check membership
    const isMember = group.participants.some(p => {
      const participantId = p.user?._id || p.user;
      return participantId && participantId.toString() === userId.toString() && p.isActive !== false;
    });

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this group'
      });
    }

    // Build query - exclude messages deleted by this user
    const query = {
      conversation: groupId,
      $and: [
        { 'deletedBy.user': { $ne: userId } },
        { 'deletedForEveryone': { $ne: true } }
      ]
    };

    if (cursor) {
      query._id = { $lt: cursor };
    }

    const messages = await Message.find(query)
      .populate('sender', 'username fullName profilePicture avatar')
      .populate('replyTo', 'content sender')
      .populate('reactions.user', 'username fullName avatar')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(cursor ? 0 : (page - 1) * parseInt(limit));

    const count = await Message.countDocuments(query);

    console.log('✅ Found', messages.length, 'messages');

    // Mark unread as read
    const unreadMessages = messages.filter(msg => 
      msg.sender?._id?.toString() !== userId.toString() && 
      msg.isReadBy && !msg.isReadBy(userId)
    );

    if (unreadMessages.length > 0) {
      await Promise.all(
        unreadMessages.map(async (msg) => {
          if (msg.markAsRead && !msg.isReadBy(userId)) {
            msg.markAsRead(userId);
            await msg.save();
          }
        })
      );

      // Emit read receipts
      const io = req.app.get('io');
      if (io) {
        const participantIds = group.participants
          .filter(p => p.isActive !== false)
          .map(p => (p.user?._id || p.user)?.toString())
          .filter(Boolean);

        unreadMessages.forEach(msg => {
          const readReceipt = {
            messageId: msg._id.toString(),
            userId: userId.toString(),
            conversationId: groupId,
            readAt: Date.now()
          };

          participantIds.forEach(participantId => {
            io.to(`user:${participantId}`).emit('message:read', readReceipt);
          });
        });
      }
    }

    // Return in chronological order
    const orderedMessages = messages.reverse();

    res.json({
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
    console.error('❌ Get group messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message
    });
  }
});

// @route   POST /api/groups/:id/messages
// @desc    Send message to group
// @access  Private
router.post('/:id/messages', async (req, res) => {
  try {
    const groupId = req.params.id;
    const { content, type, media, replyTo } = req.body;
    const userId = req.user.id || req.user._id;

    console.log('📤 Sending message to group:', groupId);

    const group = await Conversation.findById(groupId)
      .populate('participants.user', '_id username fullName profilePicture');

    if (!group || !group.isGroup) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Check membership
    const isMember = group.participants.some(p => {
      const participantId = p.user?._id || p.user;
      return participantId && participantId.toString() === userId.toString() && p.isActive !== false;
    });

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this group'
      });
    }

    // Check group settings
    if (group.settings?.onlyAdminsCanMessage) {
      const isAdmin = group.participants.some(p => {
        const participantId = p.user?._id || p.user;
        return participantId && participantId.toString() === userId.toString() && p.role === 'admin';
      });
      
      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Only admins can send messages in this group'
        });
      }
    }

    // Create message
    const message = await Message.create({
      conversation: groupId,
      sender: userId,
      content: content || '',
      type: type || 'text',
      media: media || null,
      replyTo: replyTo || null,
      deletedBy: [],
      deletedForEveryone: false
    });

    // Update group's last message
    group.lastMessage = message._id;
    group.lastMessageAt = Date.now();
    await group.save();

    // Populate message
    await message.populate('sender', 'username fullName profilePicture avatar');
    if (replyTo) {
      await message.populate('replyTo', 'content sender');
    }

    const messageToEmit = {
      ...message.toObject(),
      chat: groupId,
      conversation: groupId,
      _id: message._id.toString()
    };

    console.log('✅ Message created:', message._id);

    // Emit to ALL participants for instant delivery
    const io = req.app.get('io');
    if (io) {
      const participantIds = group.participants
        .filter(p => p.isActive !== false)
        .map(p => {
          if (p.user && p.user._id) return p.user._id.toString();
          if (p.user) return p.user.toString();
          return null;
        })
        .filter(Boolean);

      console.log('[MESSAGE] Emitting to', participantIds.length, 'participants');

      // Emit to each participant's personal room
      participantIds.forEach(participantId => {
        io.to(`user:${participantId}`).emit('message:new', messageToEmit);
        io.to(`user:${participantId}`).emit('message:receive', messageToEmit);
        io.to(`user:${participantId}`).emit('newMessage', messageToEmit);
      });

      // Also emit to conversation room
      io.to(`conversation:${groupId}`).emit('message:new', messageToEmit);
      io.to(`conversation:${groupId}`).emit('message:receive', messageToEmit);

      // Mark as delivered for online users
      participantIds.forEach(participantId => {
        if (participantId !== userId.toString()) {
          const userRoom = io.sockets.adapter.rooms.get(`user:${participantId}`);
          if (userRoom && userRoom.size > 0) {
            if (message.markAsDelivered && !message.deliveredTo?.some(d => d.user?.toString() === participantId)) {
              message.markAsDelivered(participantId);
            }
          }
        }
      });

      if (message.deliveredTo && message.deliveredTo.length > 0) {
        await message.save();
      }
    }

    res.status(201).json({
      success: true,
      message: 'Message sent',
      data: { message: messageToEmit }
    });
  } catch (error) {
    console.error('❌ Send group message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
});

// ==================== DELETE MESSAGE ROUTES ====================

// @route   DELETE /api/groups/:id/messages/clear
// @desc    Clear all messages for current user
// @access  Private
router.delete('/:id/messages/clear', async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.id || req.user._id;

    console.log('🗑️ Clearing chat for user:', userId, 'in group:', groupId);

    const group = await Conversation.findById(groupId);

    if (!group || !group.isGroup) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Check membership
    const isMember = group.participants.some(p => {
      const participantId = p.user?._id || p.user;
      return participantId && participantId.toString() === userId.toString() && p.isActive !== false;
    });

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this group'
      });
    }

    // Add user to deletedBy array for all messages in this group
    const result = await Message.updateMany(
      { 
        conversation: groupId,
        'deletedBy.user': { $ne: userId }
      },
      { 
        $push: { 
          deletedBy: { 
            user: userId, 
            deletedAt: new Date() 
          } 
        } 
      }
    );

    console.log('✅ Cleared', result.modifiedCount, 'messages for user');

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${userId}`).emit('chat:cleared', {
        conversationId: groupId,
        groupId: groupId,
        clearedBy: userId.toString(),
        clearedAt: Date.now()
      });
    }

    res.json({
      success: true,
      message: 'Chat cleared',
      data: { clearedCount: result.modifiedCount }
    });
  } catch (error) {
    console.error('❌ Clear chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear chat',
      error: error.message
    });
  }
});

// @route   DELETE /api/groups/:id/messages/:messageId
// @desc    Delete a specific message
// @access  Private
router.delete('/:id/messages/:messageId', async (req, res) => {
  try {
    const groupId = req.params.id;
    const messageId = req.params.messageId;
    const userId = req.user.id || req.user._id;
    const { deleteType } = req.body; // 'forMe' or 'forEveryone'

    console.log('🗑️ Deleting message:', messageId, 'type:', deleteType);

    const group = await Conversation.findById(groupId);

    if (!group || !group.isGroup) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Check membership
    const isMember = group.participants.some(p => {
      const participantId = p.user?._id || p.user;
      return participantId && participantId.toString() === userId.toString() && p.isActive !== false;
    });

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this group'
      });
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if message belongs to this group
    if (message.conversation.toString() !== groupId) {
      return res.status(400).json({
        success: false,
        message: 'Message does not belong to this group'
      });
    }

    const senderId = message.sender?._id || message.sender;
    const isOwnMessage = senderId && senderId.toString() === userId.toString();

    // Check if user is admin
    const isAdmin = group.participants.some(p => {
      const participantId = p.user?._id || p.user;
      return participantId && participantId.toString() === userId.toString() && p.role === 'admin';
    });

    // Handle different delete types
    if (deleteType === 'forEveryone') {
      // Only message sender or admin can delete for everyone
      if (!isOwnMessage && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete your own messages for everyone'
        });
      }

      // Check time limit (1 hour) for non-admins
      const messageAge = Date.now() - new Date(message.createdAt).getTime();
      const oneHour = 60 * 60 * 1000;
      
      if (!isAdmin && messageAge > oneHour) {
        return res.status(400).json({
          success: false,
          message: 'You can only delete messages for everyone within 1 hour of sending'
        });
      }

      // Mark as deleted for everyone
      message.deletedForEveryone = true;
      message.deletedAt = new Date();
      message.deletedBy.push({ user: userId, deletedAt: new Date(), type: 'forEveryone' });
      await message.save();

      console.log('✅ Message deleted for everyone');

      // Emit socket event to all participants
      const io = req.app.get('io');
      if (io) {
        const participantIds = group.participants
          .filter(p => p.isActive !== false)
          .map(p => (p.user?._id || p.user)?.toString())
          .filter(Boolean);

        const deleteEvent = {
          messageId: messageId,
          conversationId: groupId,
          groupId: groupId,
          deleteType: 'forEveryone',
          deletedBy: userId.toString(),
          deletedAt: Date.now()
        };

        participantIds.forEach(participantId => {
          io.to(`user:${participantId}`).emit('message:deleted', deleteEvent);
          io.to(`user:${participantId}`).emit('message:delete', deleteEvent);
        });

        io.to(`conversation:${groupId}`).emit('message:deleted', deleteEvent);
      }

      res.json({
        success: true,
        message: 'Message deleted for everyone'
      });

    } else {
      // Delete for me only
      if (!message.deletedBy) {
        message.deletedBy = [];
      }

      // Check if already deleted for this user
      const alreadyDeleted = message.deletedBy.some(d => 
        d.user && d.user.toString() === userId.toString()
      );

      if (alreadyDeleted) {
        return res.status(400).json({
          success: false,
          message: 'Message already deleted'
        });
      }

      message.deletedBy.push({ 
        user: userId, 
        deletedAt: new Date(),
        type: 'forMe'
      });
      await message.save();

      console.log('✅ Message deleted for user:', userId);

      // Emit socket event only to this user
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${userId}`).emit('message:deleted', {
          messageId: messageId,
          conversationId: groupId,
          groupId: groupId,
          deleteType: 'forMe',
          userId: userId.toString(),
          deletedAt: Date.now()
        });
      }

      res.json({
        success: true,
        message: 'Message deleted for you'
      });
    }
  } catch (error) {
    console.error('❌ Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message',
      error: error.message
    });
  }
});

// ==================== SETTINGS ====================

// Update group settings
router.patch('/:id/settings', groupController.updateSettings);

// ==================== SUBGROUP ROUTES ====================

// Get all subgroups of a group
router.get('/:id/subgroups', groupController.getSubgroups);

// Create subgroup
router.post('/:id/subgroups', groupController.createSubgroup);

// Delete subgroup
router.delete('/:id/subgroups/:subgroupId', groupController.deleteSubgroup);

module.exports = router;