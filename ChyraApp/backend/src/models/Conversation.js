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
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],

  // Group-specific fields
  isGroup: {
    type: Boolean,
    default: false
  },

  name: {
    type: String,
    trim: true,
    maxlength: 100
  },

  // Legacy field support
  groupName: {
    type: String,
    trim: true,
    maxlength: 100
  },

  groupPhoto: {
    type: String,
    default: null
  },

  groupPicture: {
    type: String,
    default: null
  },

  description: {
    type: String,
    trim: true,
    maxlength: 500
  },

  groupDescription: {
    type: String,
    trim: true,
    maxlength: 500
  },

  avatar: {
    type: String,
    default: '👥'
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // ✅ NEW: Subgroup support
  isSubgroup: {
    type: Boolean,
    default: false
  },

  parentGroup: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    default: null
  },

  subgroups: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation'
  }],

  // Settings
  settings: {
    onlyAdminsCanSend: {
      type: Boolean,
      default: false
    },
    onlyAdminsCanMessage: {
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
    },
    onlyAdminsCanAddMembers: {
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
conversationSchema.index({ 'participants.isActive': 1 });
conversationSchema.index({ isGroup: 1 });
conversationSchema.index({ isSubgroup: 1 });
conversationSchema.index({ parentGroup: 1 });
conversationSchema.index({ lastMessageAt: -1 });

// Virtual for compatibility
conversationSchema.virtual('members').get(function () {
  return this.participants
    .filter(p => p.isActive)
    .map(p => p.user);
});

// Methods
conversationSchema.methods.isAdmin = function (userId) {
  const participant = this.participants.find(
    p => p.user.toString() === userId.toString() && p.isActive
  );
  return participant && participant.role === 'admin';
};

conversationSchema.methods.isMember = function (userId) {
  return this.participants.some(
    p => p.user.toString() === userId.toString() && p.isActive
  );
};

conversationSchema.methods.addMember = function (userId, addedBy) {
  const existingParticipant = this.participants.find(
    p => p.user.toString() === userId.toString()
  );

  if (existingParticipant) {
    // Reactivate if previously removed
    existingParticipant.isActive = true;
    existingParticipant.joinedAt = new Date();
  } else {
    // Add new participant
    this.participants.push({
      user: userId,
      role: 'member',
      addedBy: addedBy,
      joinedAt: new Date(),
      isActive: true
    });
  }
};

conversationSchema.methods.removeMember = function (userId) {
  const participant = this.participants.find(
    p => p.user.toString() === userId.toString()
  );
  if (participant) {
    participant.isActive = false;
  }
};

conversationSchema.methods.makeAdmin = function (userId) {
  const participant = this.participants.find(
    p => p.user.toString() === userId.toString() && p.isActive
  );
  if (participant) {
    participant.role = 'admin';
  }
};

conversationSchema.methods.removeAdmin = function (userId) {
  const participant = this.participants.find(
    p => p.user.toString() === userId.toString() && p.isActive
  );
  if (participant && this.createdBy.toString() !== userId.toString()) {
    participant.role = 'member';
  }
};

// ✅ NEW: Subgroup methods
conversationSchema.methods.canCreateSubgroup = function (userId) {
  // Only parent group admins can create subgroups
  return !this.isSubgroup && this.isAdmin(userId);
};

conversationSchema.methods.addSubgroup = function (subgroupId) {
  if (!this.subgroups.includes(subgroupId)) {
    this.subgroups.push(subgroupId);
  }
};

conversationSchema.methods.removeSubgroup = function (subgroupId) {
  this.subgroups = this.subgroups.filter(
    id => id.toString() !== subgroupId.toString()
  );
};

// Pre-save hook to sync legacy fields
conversationSchema.pre('save', function (next) {
  // Sync name fields
  if (this.name && !this.groupName) {
    this.groupName = this.name;
  } else if (this.groupName && !this.name) {
    this.name = this.groupName;
  }

  // Sync description fields
  if (this.description && !this.groupDescription) {
    this.groupDescription = this.description;
  } else if (this.groupDescription && !this.description) {
    this.description = this.groupDescription;
  }

  // Sync picture fields
  if (this.groupPicture && !this.groupPhoto) {
    this.groupPhoto = this.groupPicture;
  } else if (this.groupPhoto && !this.groupPicture) {
    this.groupPicture = this.groupPhoto;
  }

  next();
});

module.exports = mongoose.model('Conversation', conversationSchema);