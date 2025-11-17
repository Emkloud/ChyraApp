// Application constants

const USER_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  AWAY: 'away',
  BUSY: 'busy'
};

const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  FILE: 'file',
  VOICE: 'voice',
  LOCATION: 'location',
  SYSTEM: 'system'
};

const CONVERSATION_ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member'
};

const SOCKET_EVENTS = {
  // Connection
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  
  // User events
  USER_ONLINE: 'user:online',
  USER_OFFLINE: 'user:offline',
  USER_TYPING: 'user:typing',
  USER_STOP_TYPING: 'user:stop_typing',
  
  // Message events
  MESSAGE_SEND: 'message:send',
  MESSAGE_RECEIVE: 'message:receive',
  MESSAGE_EDIT: 'message:edit',
  MESSAGE_DELETE: 'message:delete',
  MESSAGE_REACT: 'message:react',
  MESSAGE_DELIVERED: 'message:delivered',
  MESSAGE_READ: 'message:read',
  
  // Conversation events
  CONVERSATION_CREATE: 'conversation:create',
  CONVERSATION_UPDATE: 'conversation:update',
  CONVERSATION_DELETE: 'conversation:delete',
  CONVERSATION_JOIN: 'conversation:join',
  CONVERSATION_LEAVE: 'conversation:leave',
  
  // Call events (for future implementation)
  CALL_INITIATE: 'call:initiate',
  CALL_ACCEPT: 'call:accept',
  CALL_REJECT: 'call:reject',
  CALL_END: 'call:end'
};

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500
};

const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100
};

const FILE_UPLOAD = {
  MAX_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: (process.env.ALLOWED_FILE_TYPES || '').split(',').map(t => t.trim()),
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
  ALLOWED_AUDIO_TYPES: ['audio/mpeg', 'audio/wav', 'audio/ogg'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
};

const RATE_LIMIT = {
  WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
};

const JWT = {
  SECRET: process.env.JWT_SECRET,
  REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
};

const ERROR_MESSAGES = {
  // Auth
  INVALID_CREDENTIALS: 'Invalid email or password',
  EMAIL_EXISTS: 'Email already registered',
  USERNAME_EXISTS: 'Username already taken',
  USER_NOT_FOUND: 'User not found',
  UNAUTHORIZED: 'Not authorized to access this resource',
  TOKEN_INVALID: 'Invalid or expired token',
  
  // Conversations
  CONVERSATION_NOT_FOUND: 'Conversation not found',
  NOT_PARTICIPANT: 'You are not a participant in this conversation',
  NOT_ADMIN: 'Only admins can perform this action',
  
  // Messages
  MESSAGE_NOT_FOUND: 'Message not found',
  CANNOT_EDIT: 'You can only edit your own messages',
  CANNOT_DELETE: 'You can only delete your own messages',
  
  // General
  SERVER_ERROR: 'An error occurred. Please try again later',
  VALIDATION_ERROR: 'Validation failed',
  NOT_FOUND: 'Resource not found'
};

const SUCCESS_MESSAGES = {
  // Auth
  REGISTER_SUCCESS: 'Registration successful',
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  PASSWORD_UPDATED: 'Password updated successfully',
  
  // Profile
  PROFILE_UPDATED: 'Profile updated successfully',
  
  // Conversations
  CONVERSATION_CREATED: 'Conversation created successfully',
  CONVERSATION_UPDATED: 'Conversation updated successfully',
  CONVERSATION_DELETED: 'Conversation deleted successfully',
  PARTICIPANT_ADDED: 'Participant added successfully',
  PARTICIPANT_REMOVED: 'Participant removed successfully',
  
  // Messages
  MESSAGE_SENT: 'Message sent successfully',
  MESSAGE_UPDATED: 'Message updated successfully',
  MESSAGE_DELETED: 'Message deleted successfully'
};

module.exports = {
  USER_STATUS,
  MESSAGE_TYPES,
  CONVERSATION_ROLES,
  SOCKET_EVENTS,
  HTTP_STATUS,
  PAGINATION,
  FILE_UPLOAD,
  RATE_LIMIT,
  JWT,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES
};