const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { validateUpdateProfile, validateSearch } = require('../middleware/validation');
const { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } = require('../config/constants');

// @route   GET /api/users
// @desc    Get all users (for contact list)
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const users = await User.find({ 
      _id: { $ne: req.user._id },
      isActive: true 
    })
      .select('username fullName profilePicture status bio lastSeen')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ username: 1 });

    const count = await User.countDocuments({ 
      _id: { $ne: req.user._id },
      isActive: true 
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        users,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        total: count
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR
    });
  }
});

// @route   GET /api/users/search
// @desc    Search users by username or email
// @access  Private
router.get('/search', protect, async (req, res) => {
  try {
    const { q } = req.query;
    
    // Require at least 2 characters
    if (!q || q.length < 2) {
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        data: { users: [] }
      });
    }

    // Search by username or email (case insensitive)
    const users = await User.find({
      _id: { $ne: req.user._id },
      isActive: true,
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { fullName: { $regex: q, $options: 'i' } }
      ]
    })
      .select('username fullName email profilePicture status bio')
      .limit(20);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { users }
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('username fullName profilePicture status bio lastSeen createdAt');

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.USER_NOT_FOUND
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', protect, validateUpdateProfile, async (req, res) => {
  try {
    const { fullName, bio, phoneNumber, profilePicture } = req.body;

    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (bio !== undefined) updateData.bio = bio;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (profilePicture) updateData.profilePicture = profilePicture;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: SUCCESS_MESSAGES.PROFILE_UPDATED,
      data: { user }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR
    });
  }
});

// @route   PUT /api/users/status
// @desc    Update user status
// @access  Private
router.put('/status', protect, async (req, res) => {
  try {
    const { status } = req.body;

    if (!['online', 'offline', 'away', 'busy'].includes(status)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    req.user.status = status;
    await req.user.save();

    // Emit status change via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('user:status', {
        userId: req.user._id,
        status
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Status updated successfully',
      data: { status }
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR
    });
  }
});

// @route   PUT /api/users/settings
// @desc    Update user settings
// @access  Private
router.put('/settings', protect, async (req, res) => {
  try {
    const { settings } = req.body;

    if (settings) {
      req.user.settings = { ...req.user.settings, ...settings };
      await req.user.save();
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Settings updated successfully',
      data: { settings: req.user.settings }
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR
    });
  }
});

// @route   POST /api/users/contacts/:userId
// @desc    Add user to contacts
// @access  Private
router.post('/contacts/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId === req.user._id.toString()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'You cannot add yourself as a contact'
      });
    }

    const contactUser = await User.findById(userId);
    if (!contactUser) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.USER_NOT_FOUND
      });
    }

    if (req.user.contacts.includes(userId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'User is already in your contacts'
      });
    }

    req.user.contacts.push(userId);
    await req.user.save();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Contact added successfully',
      data: { contact: contactUser }
    });
  } catch (error) {
    console.error('Add contact error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR
    });
  }
});

// @route   DELETE /api/users/contacts/:userId
// @desc    Remove user from contacts
// @access  Private
router.delete('/contacts/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;

    req.user.contacts = req.user.contacts.filter(
      contact => contact.toString() !== userId
    );
    await req.user.save();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Contact removed successfully'
    });
  } catch (error) {
    console.error('Remove contact error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR
    });
  }
});

// @route   GET /api/users/contacts/list
// @desc    Get user contacts
// @access  Private
router.get('/contacts/list', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate(
      'contacts',
      'username fullName profilePicture status lastSeen bio'
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { contacts: user.contacts || [] }
    });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR
    });
  }
});

module.exports = router;