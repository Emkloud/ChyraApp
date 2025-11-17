const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateToken, generateRefreshToken, protect, verifyRefreshToken } = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../middleware/validation');
const { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } = require('../config/constants');

// @route   POST /api/auth/register
// @desc    Register a new user with phone number
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, fullName, phoneNumber } = req.body;

    // Validate required fields
    if (!username || !email || !password || !phoneNumber) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Please provide username, email, password, and phone number'
      });
    }

    // Validate phone number format
    const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
    if (!/^\+?[1-9]\d{1,14}$/.test(cleanPhone)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Please provide a valid phone number with country code (e.g., +1234567890)'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }, { phoneNumber: cleanPhone }]
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          message: 'Email already registered'
        });
      }
      if (existingUser.username === username) {
        return res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          message: 'Username already taken'
        });
      }
      if (existingUser.phoneNumber === cleanPhone) {
        return res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          message: 'Phone number already registered'
        });
      }
    }

    // Create new user
    const user = await User.create({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password,
      phoneNumber: cleanPhone,
      fullName
    });

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token to user
    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
    await user.save();

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: SUCCESS_MESSAGES.REGISTER_SUCCESS,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          phoneNumber: user.phoneNumber,
          fullName: user.fullName,
          profilePicture: user.profilePicture,
          status: user.status
        },
        token,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', validateLogin, async (req, res) => {
  try {
    console.log('🔵 Login attempt received');
    console.log('📧 Email:', req.body.email);
    console.log('🔑 Has password:', !!req.body.password);
    
    const { email, password } = req.body;

    console.log('🔍 Searching for user...');
    const user = await User.findOne({ email }).select('+password');
    
    console.log('👤 User found:', !!user);
    if (user) {
      console.log('   User ID:', user._id);
      console.log('   Email:', user.email);
      console.log('   Has password:', !!user.password);
      console.log('   Is active:', user.isActive);
    }

    if (!user) {
      console.log('❌ No user found with email:', email);
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.INVALID_CREDENTIALS
      });
    }

    if (!user.isActive) {
      console.log('❌ User account deactivated');
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Your account has been deactivated'
      });
    }

    console.log('🔐 Checking password...');
    const isPasswordCorrect = await user.comparePassword(password);
    console.log('✓ Password correct:', isPasswordCorrect);

    if (!isPasswordCorrect) {
      console.log('❌ Password mismatch');
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.INVALID_CREDENTIALS
      });
    }

    console.log('🎫 Generating tokens...');
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    const refreshTokens = user.refreshTokens.filter(rt => rt.expiresAt > Date.now());
    refreshTokens.push({
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    console.log('💾 Updating user...');
    await User.findByIdAndUpdate(user._id, {
      status: 'online',
      lastSeen: Date.now(),
      refreshTokens
    }, { runValidators: false });

    console.log('✅ Login successful!');
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: SUCCESS_MESSAGES.LOGIN_SUCCESS,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          phoneNumber: user.phoneNumber,
          fullName: user.fullName,
          profilePicture: user.profilePicture,
          bio: user.bio,
          status: user.status,
          settings: user.settings
        },
        token,
        refreshToken
      }
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/auth/refresh
// @desc    Refresh access token
// @access  Public
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    const user = await verifyRefreshToken(refreshToken);

    const newToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    const refreshTokens = user.refreshTokens.filter(rt => rt.token !== refreshToken);
    refreshTokens.push({
      token: newRefreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    await User.findByIdAndUpdate(user._id, {
      refreshTokens
    }, { runValidators: false });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', protect, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    const refreshTokens = refreshToken 
      ? req.user.refreshTokens.filter(rt => rt.token !== refreshToken)
      : req.user.refreshTokens;

    await User.findByIdAndUpdate(req.user._id, {
      status: 'offline',
      socketId: null,
      refreshTokens
    }, { runValidators: false });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: SUCCESS_MESSAGES.LOGOUT_SUCCESS
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR
    });
  }
});

module.exports = router;