const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  // ✅ Phone number (REQUIRED)
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true
  },
  // ✅ Hashed phone for privacy
  hashedPhone: {
    type: String,
    index: true
  },
  // ✅ Phone visibility setting
  phoneVisibility: {
    type: String,
    enum: ['everyone', 'contacts', 'nobody'],
    default: 'contacts'
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  fullName: {
    type: String,
    trim: true
  },
  profilePicture: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    maxlength: [150, 'Bio cannot exceed 150 characters']
  },

  // ✅ Presence fields used for Online / Last seen
  status: {
    type: String,
    enum: ['online', 'offline', 'away', 'busy'],
    default: 'offline'
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  socketId: {
    type: String
  },

  // ✅ Friends / contacts
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  contacts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // ✅ Synced phone contacts (hashed)
  syncedContacts: [{
    phoneHash: String,
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],

  isActive: {
    type: Boolean,
    default: true
  },

  refreshTokens: [{
    token: String,
    expiresAt: Date
  }],

  settings: {
    notifications: {
      type: Boolean,
      default: true
    },
    darkMode: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// ✅ Helpful indexes for presence queries
userSchema.index({ isOnline: 1 });
userSchema.index({ lastSeen: -1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Hash password if modified
  if (this.isModified('password')) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
      return next(error);
    }
  }

  // Hash phone number if modified
  if (this.isModified('phoneNumber') && this.phoneNumber) {
    this.hashedPhone = crypto
      .createHash('sha256')
      .update(this.phoneNumber)
      .digest('hex');
  }

  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// ✅ Check if user is friends with another user
userSchema.methods.isFriendsWith = function(userId) {
  return this.friends.some(
    friendId => friendId.toString() === userId.toString()
  );
};

// ✅ Add friend
userSchema.methods.addFriend = async function(userId) {
  if (!this.isFriendsWith(userId)) {
    this.friends.push(userId);
    await this.save();
  }
};

// ✅ Remove friend
userSchema.methods.removeFriend = async function(userId) {
  this.friends = this.friends.filter(
    friendId => friendId.toString() !== userId.toString()
  );
  await this.save();
};

module.exports = mongoose.model('User', userSchema);
