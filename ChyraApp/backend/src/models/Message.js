const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: [true, 'Conversation ID is required'],
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender ID is required'],
    index: true
  },
  content: {
    type: String,
    trim: true,
    maxlength: [5000, 'Message content cannot exceed 5000 characters']
  },
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'audio', 'file', 'voice', 'location', 'system', 'media_group'],
    default: 'text'
  },
  media: {
    url: String,
    filename: String,
    size: Number,
    mimeType: String,
    thumbnail: String,
    duration: Number,
    width: Number,
    height: Number
  },
  mediaGroup: [{
    type: {
      type: String,
      enum: ['image', 'video', 'audio', 'file']
    },
    url: String,
    filename: String,
    size: Number,
    mimeType: String,
    thumbnail: String,
    duration: Number,
    width: Number,
    height: Number
  }],
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    emoji: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  deliveredTo: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deliveredAt: {
      type: Date,
      default: Date.now
    }
  }],
  deletedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deletedAt: {
      type: Date,
      default: Date.now
    },
    deleteType: {
      type: String,
      enum: ['for_me', 'for_everyone'],
      default: 'for_me'
    }
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  editHistory: [{
    content: String,
    editedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isForwarded: {
    type: Boolean,
    default: false
  },
  forwardedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  metadata: {
    clientId: String,
    location: {
      latitude: Number,
      longitude: Number,
      address: String
    },
    linkPreview: {
      url: String,
      title: String,
      description: String,
      image: String
    }
  },
  isSystemMessage: {
    type: Boolean,
    default: false
  },
  systemMessageType: {
    type: String,
    enum: ['user_added', 'user_removed', 'group_created', 'group_name_changed', 'group_picture_changed']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ 'readBy.user': 1 });
messageSchema.index({ 'deliveredTo.user': 1 });
messageSchema.index({ content: 'text' });

messageSchema.pre('validate', function(next) {
  if (this.type === 'text' && !this.content && !this.mediaGroup?.length) {
    return next(new Error('Text messages must have content'));
  }
  next();
});

messageSchema.pre('save', function(next) {
  if (!this.reactions) this.reactions = [];
  if (!this.readBy) this.readBy = [];
  if (!this.deliveredTo) this.deliveredTo = [];
  if (!this.deletedBy) this.deletedBy = [];
  if (!this.editHistory) this.editHistory = [];
  if (!this.mentions) this.mentions = [];
  if (!this.mediaGroup) this.mediaGroup = [];
  next();
});

messageSchema.methods.isReadBy = function(userId) {
  if (!this.readBy || !Array.isArray(this.readBy)) return false;
  return this.readBy.some(r => r && r.user && r.user.toString() === userId.toString());
};

messageSchema.methods.markAsRead = function(userId) {
  if (!this.readBy) this.readBy = [];
  if (!this.isReadBy(userId)) {
    this.readBy.push({
      user: userId,
      readAt: Date.now()
    });
  }
  return this;
};

messageSchema.methods.isDeliveredTo = function(userId) {
  if (!this.deliveredTo || !Array.isArray(this.deliveredTo)) return false;
  return this.deliveredTo.some(d => d && d.user && d.user.toString() === userId.toString());
};

messageSchema.methods.markAsDelivered = function(userId) {
  if (!this.deliveredTo) this.deliveredTo = [];
  if (!this.isDeliveredTo(userId)) {
    this.deliveredTo.push({
      user: userId,
      deliveredAt: Date.now()
    });
  }
  return this;
};

messageSchema.methods.addReaction = function(userId, emoji) {
  if (!this.reactions) this.reactions = [];
  
  const existingReactionIndex = this.reactions.findIndex(
    r => r && r.user && r.user.toString() === userId.toString()
  );
  
  if (existingReactionIndex !== -1) {
    this.reactions[existingReactionIndex].emoji = emoji;
    this.reactions[existingReactionIndex].createdAt = Date.now();
  } else {
    this.reactions.push({
      user: userId,
      emoji: emoji,
      createdAt: Date.now()
    });
  }
  
  return this;
};

messageSchema.methods.removeReaction = function(userId) {
  if (!this.reactions || !Array.isArray(this.reactions)) {
    this.reactions = [];
    return this;
  }
  
  this.reactions = this.reactions.filter(
    r => r && r.user && r.user.toString() !== userId.toString()
  );
  
  return this;
};

messageSchema.methods.toggleReaction = function(userId, emoji) {
  if (!this.reactions) this.reactions = [];
  
  const userIdStr = userId.toString();
  const existingReactionIndex = this.reactions.findIndex(
    r => r && r.user && r.user.toString() === userIdStr
  );

  if (existingReactionIndex !== -1) {
    const currentEmoji = this.reactions[existingReactionIndex].emoji;
    
    if (currentEmoji === emoji) {
      this.reactions.splice(existingReactionIndex, 1);
      return { action: 'removed', reactions: this.reactions };
    } else {
      this.reactions[existingReactionIndex].emoji = emoji;
      this.reactions[existingReactionIndex].createdAt = Date.now();
      return { action: 'updated', reactions: this.reactions };
    }
  } else {
    this.reactions.push({
      user: userId,
      emoji: emoji,
      createdAt: Date.now()
    });
    return { action: 'added', reactions: this.reactions };
  }
};

messageSchema.methods.getReactionCounts = function() {
  const counts = {};
  
  if (!this.reactions || !Array.isArray(this.reactions)) {
    return counts;
  }
  
  this.reactions.forEach(reaction => {
    if (reaction && reaction.emoji) {
      const emoji = reaction.emoji;
      if (!counts[emoji]) {
        counts[emoji] = {
          emoji: emoji,
          count: 0,
          users: []
        };
      }
      counts[emoji].count++;
      if (reaction.user) {
        counts[emoji].users.push(reaction.user);
      }
    }
  });
  
  return counts;
};

messageSchema.methods.hasUserReacted = function(userId, emoji) {
  if (!this.reactions || !Array.isArray(this.reactions)) return false;
  
  const userIdStr = userId.toString();
  
  if (emoji) {
    return this.reactions.some(
      r => r && r.user && r.user.toString() === userIdStr && r.emoji === emoji
    );
  } else {
    return this.reactions.some(
      r => r && r.user && r.user.toString() === userIdStr
    );
  }
};

messageSchema.methods.canDelete = function(userId, deleteType = 'for_me') {
  if (deleteType === 'for_everyone') {
    return this.sender && this.sender.toString() === userId.toString();
  }
  return true;
};

messageSchema.methods.deleteFor = function(userId, deleteType = 'for_me') {
  if (!this.canDelete(userId, deleteType)) {
    throw new Error('You cannot delete this message for everyone');
  }
  
  if (!this.deletedBy) this.deletedBy = [];
  
  const alreadyDeleted = this.deletedBy.some(
    d => d && d.user && d.user.toString() === userId.toString()
  );
  
  if (!alreadyDeleted) {
    this.deletedBy.push({
      user: userId,
      deletedAt: Date.now(),
      deleteType: deleteType
    });
  }
  
  return this;
};

messageSchema.methods.isDeletedFor = function(userId) {
  if (!this.deletedBy || !Array.isArray(this.deletedBy)) return false;
  return this.deletedBy.some(d => d && d.user && d.user.toString() === userId.toString());
};

messageSchema.methods.edit = function(newContent) {
  if (!this.editHistory) this.editHistory = [];
  
  if (this.content) {
    this.editHistory.push({
      content: this.content,
      editedAt: Date.now()
    });
  }
  
  this.content = newContent;
  this.isEdited = true;
  this.editedAt = Date.now();
  
  return this;
};

messageSchema.statics.getUnreadCount = async function(conversationId, userId) {
  try {
    return await this.countDocuments({
      conversation: conversationId,
      sender: { $ne: userId },
      'readBy.user': { $ne: userId },
      'deletedBy.user': { $ne: userId }
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};

messageSchema.statics.getForUser = function(query, userId) {
  return this.find({
    ...query,
    'deletedBy.user': { $ne: userId }
  });
};

messageSchema.virtual('reactionCounts').get(function() {
  const counts = {};
  
  if (!this.reactions || !Array.isArray(this.reactions)) {
    return counts;
  }
  
  this.reactions.forEach(reaction => {
    if (reaction && reaction.emoji) {
      counts[reaction.emoji] = (counts[reaction.emoji] || 0) + 1;
    }
  });
  
  return counts;
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;