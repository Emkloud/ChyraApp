const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  // Basic fields
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Group-specific fields
  isGroup: {
    type: Boolean,
    default: false
  },
  
  groupName: {
    type: String,
    trim: true,
    maxlength: 100
  },
  
  groupPhoto: {
    type: String,
    default: null
  },
  
  groupDescription: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Settings
  settings: {
    onlyAdminsCanSend: {
      type: Boolean,
      default: false
    },
    onlyAdminsCanEditInfo: {
      type: Boolean,
      default: true
    },
    membersCanAddOthers: {
      type: Boolean,
      default: false
    }
  },
  
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  
  lastMessageAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
conversationSchema.index({ 'participants.user': 1 });
conversationSchema.index({ isGroup: 1 });
conversationSchema.index({ lastMessageAt: -1 });

// Methods
conversationSchema.methods.isAdmin = function(userId) {
  const participant = this.participants.find(
    p => p.user.toString() === userId.toString()
  );
  return participant && participant.role === 'admin';
};

conversationSchema.methods.isMember = function(userId) {
  return this.participants.some(
    p => p.user.toString() === userId.toString()
  );
};

conversationSchema.methods.addMember = function(userId, addedBy) {
  if (!this.isMember(userId)) {
    this.participants.push({
      user: userId,
      role: 'member',
      addedBy: addedBy,
      joinedAt: new Date()
    });
  }
};

conversationSchema.methods.removeMember = function(userId) {
  this.participants = this.participants.filter(
    p => p.user.toString() !== userId.toString()
  );
};

conversationSchema.methods.makeAdmin = function(userId) {
  const participant = this.participants.find(
    p => p.user.toString() === userId.toString()
  );
  if (participant) {
    participant.role = 'admin';
  }
};

conversationSchema.methods.removeAdmin = function(userId) {
  const participant = this.participants.find(
    p => p.user.toString() === userId.toString()
  );
  if (participant && this.createdBy.toString() !== userId.toString()) {
    participant.role = 'member';
  }
};

module.exports = mongoose.model('Conversation', conversationSchema);