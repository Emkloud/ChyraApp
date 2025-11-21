// backend/src/models/Conversation.js
// ✅ Modern, robust Conversation model for ChyraApp
// - Supports 1:1, groups, subgroups
// - Backwards compatible with legacy fields (groupName, groupDescription, groupPicture)
// - Optimized for chat list performance (lastMessage / lastMessageAt)
// - Safe helper methods used by routes + socket service

const mongoose = require("mongoose");
const { Schema } = mongoose;

const participantSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "member"],
      default: "member",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    addedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const settingsSchema = new Schema(
  {
    // Only admins can send messages (hard mute for regular members)
    onlyAdminsCanSend: {
      type: Boolean,
      default: false,
    },
    // Alias / legacy semantics
    onlyAdminsCanMessage: {
      type: Boolean,
      default: false,
    },
    // Who can edit group info (name, description, picture)
    onlyAdminsCanEditInfo: {
      type: Boolean,
      default: true,
    },
    // Can regular members add others?
    membersCanAddOthers: {
      type: Boolean,
      default: false,
    },
    // Explicit toggle for admin-only member addition
    onlyAdminsCanAddMembers: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const conversationSchema = new Schema(
  {
    // 👥 Participants (1:1 or group)
    participants: [participantSchema],

    // 🔀 1:1 vs Group
    isGroup: {
      type: Boolean,
      default: false,
    },

    // Primary display name for group — preferred field
    name: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    /**
     * Legacy / compatibility fields
     * - groupName ↔ name
     * - groupDescription ↔ description
     * - groupPicture ↔ groupPhoto
     */
    groupName: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    groupPhoto: {
      type: String,
      default: null,
    },

    groupPicture: {
      type: String,
      default: null,
    },

    // Description (primary)
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    groupDescription: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    // Emoji/text avatar fallback
    avatar: {
      type: String,
      default: "👥",
    },

    // Creator of the conversation (usually admin)
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    // 🌲 Subgroup support (for future advanced features)
    isSubgroup: {
      type: Boolean,
      default: false,
    },

    parentGroup: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
    },

    subgroups: [
      {
        type: Schema.Types.ObjectId,
        ref: "Conversation",
      },
    ],

    // ⚙ Group / conversation settings
    settings: settingsSchema,

    // 🔚 Last message info for fast chat list rendering
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: "Message",
    },

    lastMessageAt: {
      type: Date,
      default: Date.now,
    },

    /**
     * Soft-delete per user (used in routes: 'deletedBy.user')
     * - We add this to match your routes even if it wasn’t present before.
     */
    deletedBy: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        deletedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

//
// 📈 Indexes for performance
//
conversationSchema.index({ "participants.user": 1 });
conversationSchema.index({ "participants.isActive": 1 });
conversationSchema.index({ isGroup: 1 });
conversationSchema.index({ isSubgroup: 1 });
conversationSchema.index({ parentGroup: 1 });
conversationSchema.index({ lastMessageAt: -1 });

//
// 🧠 Virtuals
//

// Active members array (convenience; used in sockets / notifications)
conversationSchema.virtual("members").get(function () {
  return this.participants
    .filter((p) => p.isActive !== false)
    .map((p) => p.user);
});

conversationSchema.virtual("activeMembers").get(function () {
  return this.participants
    .filter((p) => p.isActive !== false)
    .map((p) => p.user);
});

//
// 🛠 Instance Methods
//

// Check if user is admin in this conversation
conversationSchema.methods.isAdmin = function (userId) {
  if (!userId) return false;
  const idStr = userId.toString();

  const participant = this.participants.find((p) => {
    const participantId = p.user?._id || p.user;
    return (
      participantId &&
      participantId.toString() === idStr &&
      p.isActive !== false
    );
  });

  return !!participant && participant.role === "admin";
};

// Check if user is (active) member
conversationSchema.methods.isMember = function (userId) {
  if (!userId) return false;
  const idStr = userId.toString();

  return this.participants.some((p) => {
    const participantId = p.user?._id || p.user;
    return (
      participantId &&
      participantId.toString() === idStr &&
      p.isActive !== false
    );
  });
};

// Generic “is participant” helper used by routes & socket service
conversationSchema.methods.isParticipant = function (userId) {
  return this.isMember(userId);
};

// ✅ Get unread message count for user
conversationSchema.methods.getUnreadCount = async function (userId) {
  const Message = mongoose.model("Message");

  if (!userId) return 0;

  try {
    const count = await Message.countDocuments({
      conversation: this._id,
      sender: { $ne: userId },
      "readBy.user": { $ne: userId },
    });

    return count;
  } catch (error) {
    console.error("Error getting unread count:", error);
    return 0;
  }
};

//
// 👥 Participant management
//

// Primary implementation
conversationSchema.methods.addMember = function (userId, addedBy) {
  if (!userId) return;

  const idStr = userId.toString();

  const existing = this.participants.find((p) => {
    const participantId = p.user?._id || p.user;
    return participantId && participantId.toString() === idStr;
  });

  if (existing) {
    // Reactivate
    existing.isActive = true;
    existing.joinedAt = new Date();
    if (addedBy) existing.addedBy = addedBy;
  } else {
    this.participants.push({
      user: userId,
      role: "member",
      addedBy: addedBy || undefined,
      joinedAt: new Date(),
      isActive: true,
    });
  }
};

conversationSchema.methods.removeMember = function (userId) {
  if (!userId) return;

  const idStr = userId.toString();

  const participant = this.participants.find((p) => {
    const participantId = p.user?._id || p.user;
    return participantId && participantId.toString() === idStr;
  });

  if (participant) {
    participant.isActive = false;
  }
};

// Admin promotions / demotions
conversationSchema.methods.makeAdmin = function (userId) {
  if (!userId) return;
  const idStr = userId.toString();

  const participant = this.participants.find((p) => {
    const participantId = p.user?._id || p.user;
    return (
      participantId &&
      participantId.toString() === idStr &&
      p.isActive !== false
    );
  });

  if (participant) {
    participant.role = "admin";
  }
};

conversationSchema.methods.removeAdmin = function (userId) {
  if (!userId) return;
  const idStr = userId.toString();

  const participant = this.participants.find((p) => {
    const participantId = p.user?._id || p.user;
    return (
      participantId &&
      participantId.toString() === idStr &&
      p.isActive !== false
    );
  });

  if (participant && this.createdBy && this.createdBy.toString() !== idStr) {
    participant.role = "member";
  }
};

//
// 🤝 Backwards-compatible aliases
// (your routes use addParticipant/removeParticipant)
//

conversationSchema.methods.addParticipant = function (userId, addedBy) {
  return this.addMember(userId, addedBy);
};

conversationSchema.methods.removeParticipant = function (userId) {
  return this.removeMember(userId);
};

//
// 🌱 Subgroup logic
//

conversationSchema.methods.canCreateSubgroup = function (userId) {
  // Only admins in a parent group can create subgroups
  return !this.isSubgroup && this.isAdmin(userId);
};

conversationSchema.methods.addSubgroup = function (subgroupId) {
  if (!subgroupId) return;

  const exists = this.subgroups.some(
    (id) => id.toString() === subgroupId.toString()
  );
  if (!exists) {
    this.subgroups.push(subgroupId);
  }
};

conversationSchema.methods.removeSubgroup = function (subgroupId) {
  if (!subgroupId) return;

  this.subgroups = this.subgroups.filter(
    (id) => id.toString() !== subgroupId.toString()
  );
};

//
// 🔁 Pre-save hooks
//

conversationSchema.pre("save", function (next) {
  // Sync name / groupName
  if (this.name && !this.groupName) {
    this.groupName = this.name;
  } else if (this.groupName && !this.name) {
    this.name = this.groupName;
  }

  // Sync description / groupDescription
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

  // Auto-update lastMessageAt if lastMessage changed
  if (this.isModified("lastMessage") && this.lastMessage) {
    this.lastMessageAt = new Date();
  }

  next();
});

module.exports = mongoose.model("Conversation", conversationSchema);
