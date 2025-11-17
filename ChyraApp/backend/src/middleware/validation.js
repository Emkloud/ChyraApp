const { body, param, query, validationResult } = require('express-validator');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  
  next();
};

// Auth validation rules
const validateRegister = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores')
    .toLowerCase(),
  
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .toLowerCase(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('fullName')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ max: 100 })
    .withMessage('Full name cannot exceed 100 characters'),
  
  handleValidationErrors
];

// ✅ FIXED: Removed .normalizeEmail() to preserve dots in email addresses
const validateLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .toLowerCase(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];

const validateUpdateProfile = [
  body('fullName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Full name cannot exceed 100 characters'),
  
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),
  
  body('phoneNumber')
    .optional()
    .trim()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  
  body('status')
    .optional()
    .isIn(['online', 'offline', 'away', 'busy'])
    .withMessage('Invalid status value'),
  
  handleValidationErrors
];

// Message validation rules
const validateSendMessage = [
  body('conversationId')
    .notEmpty()
    .withMessage('Conversation ID is required')
    .isMongoId()
    .withMessage('Invalid conversation ID format'),
  
  body('content')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Message content cannot exceed 5000 characters'),
  
  body('type')
    .optional()
    .isIn(['text', 'image', 'video', 'audio', 'file', 'voice', 'location'])
    .withMessage('Invalid message type'),
  
  body('replyTo')
    .optional()
    .isMongoId()
    .withMessage('Invalid reply message ID format'),
  
  handleValidationErrors
];

const validateEditMessage = [
  param('messageId')
    .isMongoId()
    .withMessage('Invalid message ID format'),
  
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Message content is required')
    .isLength({ max: 5000 })
    .withMessage('Message content cannot exceed 5000 characters'),
  
  handleValidationErrors
];

const validateDeleteMessage = [
  param('messageId')
    .isMongoId()
    .withMessage('Invalid message ID format'),
  
  body('deleteType')
    .optional()
    .isIn(['for_me', 'for_everyone'])
    .withMessage('Invalid delete type'),
  
  handleValidationErrors
];

const validateReactToMessage = [
  param('messageId')
    .isMongoId()
    .withMessage('Invalid message ID format'),
  
  body('emoji')
    .notEmpty()
    .withMessage('Emoji is required')
    .isLength({ min: 1, max: 10 })
    .withMessage('Invalid emoji format'),
  
  handleValidationErrors
];

// Conversation validation rules
const validateCreateConversation = [
  body('participantId')
    .optional()
    .isMongoId()
    .withMessage('Invalid participant ID format'),
  
  body('name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Conversation name cannot exceed 100 characters'),
  
  body('isGroup')
    .optional()
    .isBoolean()
    .withMessage('isGroup must be a boolean value'),
  
  body('participants')
    .optional()
    .isArray({ min: 2 })
    .withMessage('Group conversations must have at least 2 participants'),
  
  body('participants.*')
    .optional()
    .isMongoId()
    .withMessage('Invalid participant ID format'),
  
  handleValidationErrors
];

const validateUpdateConversation = [
  param('conversationId')
    .isMongoId()
    .withMessage('Invalid conversation ID format'),
  
  body('name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Conversation name cannot exceed 100 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  
  handleValidationErrors
];

const validateAddParticipant = [
  param('conversationId')
    .isMongoId()
    .withMessage('Invalid conversation ID format'),
  
  body('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .isMongoId()
    .withMessage('Invalid user ID format'),
  
  handleValidationErrors
];

const validateRemoveParticipant = [
  param('conversationId')
    .isMongoId()
    .withMessage('Invalid conversation ID format'),
  
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID format'),
  
  handleValidationErrors
];

// Search validation
const validateSearch = [
  query('q')
    .trim()
    .notEmpty()
    .withMessage('Search query is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
  
  handleValidationErrors
];

// Pagination validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  
  handleValidationErrors
];

// MongoDB ID validation
const validateMongoId = (paramName = 'id') => [
  param(paramName)
    .isMongoId()
    .withMessage(`Invalid ${paramName} format`),
  
  handleValidationErrors
];

// File upload validation
const validateFileUpload = [
  body('type')
    .optional()
    .isIn(['image', 'video', 'audio', 'file'])
    .withMessage('Invalid file type'),
  
  handleValidationErrors
];

module.exports = {
  // Auth
  validateRegister,
  validateLogin,
  validateUpdateProfile,
  
  // Messages
  validateSendMessage,
  validateEditMessage,
  validateDeleteMessage,
  validateReactToMessage,
  
  // Conversations
  validateCreateConversation,
  validateUpdateConversation,
  validateAddParticipant,
  validateRemoveParticipant,
  
  // General
  validateSearch,
  validatePagination,
  validateMongoId,
  validateFileUpload,
  handleValidationErrors
};