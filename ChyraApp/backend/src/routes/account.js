const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Conversation = require('../models/Conversation'); // ✅ FIXED: Changed from Chat to Conversation
const Message = require('../models/Message');
const FriendRequest = require('../models/FriendRequest');
const { protect } = require('../middleware/auth');

console.log('✅ Account routes loaded');

// @route   POST /api/account/verify-password
// @desc    Verify password before showing delete confirmation
// @access  Private
router.post('/verify-password', protect, async (req, res) => {
  try {
    console.log('Verify password endpoint hit');
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isPasswordCorrect = await user.comparePassword(password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Password verified'
    });
  } catch (error) {
    console.error('Verify password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify password'
    });
  }
});

// @route   DELETE /api/account
// @desc    Delete user account and all associated data
// @access  Private
router.delete('/', protect, async (req, res) => {
  try {
    console.log('Delete account endpoint hit');
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to delete account'
      });
    }

    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password'
      });
    }

    console.log(`Starting account deletion for user: ${user._id}`);

    // Delete user's messages
    const deletedMessages = await Message.deleteMany({ sender: user._id });
    console.log(`Deleted ${deletedMessages.deletedCount} messages`);

    // ✅ FIXED: Changed Chat to Conversation
    await Conversation.updateMany(
      { participants: user._id },
      { $pull: { participants: user._id } }
    );

    // ✅ FIXED: Changed Chat to Conversation
    const deletedConversations = await Conversation.deleteMany({ participants: { $size: 0 } });
    console.log(`Deleted ${deletedConversations.deletedCount} empty conversations`);

    const deletedRequests = await FriendRequest.deleteMany({
      $or: [{ sender: user._id }, { receiver: user._id }]
    });
    console.log(`Deleted ${deletedRequests.deletedCount} friend requests`);

    await User.updateMany(
      { friends: user._id },
      { $pull: { friends: user._id } }
    );

    await User.updateMany(
      { contacts: user._id },
      { $pull: { contacts: user._id } }
    );

    await User.findByIdAndDelete(user._id);
    console.log(`User ${user._id} deleted successfully`);

    const io = req.app.get('io');
    if (io) {
      io.emit('user:deleted', { userId: user._id });
    }

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;