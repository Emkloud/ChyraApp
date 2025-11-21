// backend/src/routes/chats.js
// Modern, stable, API-aligned chat routes for ChyraApp

const express = require("express");
const router = express.Router();

const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const { protect } = require("../middleware/auth");
const {
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} = require("../config/constants");

/**
 * Helper: emit safely if Socket.IO is available
 */
function getIO(req) {
  return req.app.get("io") || null;
}

/**
 * Helper: normalize group name fields for consistency
 */
function getConversationName(conv) {
  return conv.name || conv.groupName || "Group Chat";
}

/**
 * POST /api/chats
 * Create 1:1 or group conversation
 */
router.post("/", protect, async (req, res) => {
  try {
    const { participantId, name, isGroup, participants } = req.body;
    const currentUserId = req.user._id;
    const io = getIO(req);

    // 1️⃣ Direct 1-on-1 chat
    if (!isGroup && participantId) {
      // Check if 1:1 conversation already exists
      const existing = await Conversation.findOne({
        isGroup: false,
        "participants.user": { $all: [currentUserId, participantId] },
        "participants.isActive": true,
      })
        .populate("participants.user", "username fullName profilePicture")
        .populate("lastMessage");

      if (existing) {
        return res.status(HTTP_STATUS.OK).json({
          success: true,
          message: "Conversation already exists",
          data: { conversation: existing },
        });
      }

      const conversation = await Conversation.create({
        isGroup: false,
        participants: [
          { user: currentUserId, role: "member", isActive: true },
          { user: participantId, role: "member", isActive: true },
        ],
        createdBy: currentUserId,
      });

      await conversation.populate(
        "participants.user",
        "username fullName profilePicture"
      );

      if (io) {
        io.to(`user:${participantId}`).emit(
          "conversation:create",
          conversation
        );
      }

      return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: SUCCESS_MESSAGES.CONVERSATION_CREATED,
        data: { conversation },
      });
    }

    // 2️⃣ Group chat
    if (isGroup && Array.isArray(participants) && participants.length >= 1) {
      // participants is array of user IDs (excluding current user)
      const participantDocs = participants.map((p) => ({
        user: p,
        role: "member",
        isActive: true,
        addedBy: currentUserId,
        joinedAt: new Date(),
      }));

      const conversation = await Conversation.create({
        isGroup: true,
        name: name || undefined,
        participants: [
          {
            user: currentUserId,
            role: "admin",
            isActive: true,
            joinedAt: new Date(),
          },
          ...participantDocs,
        ],
        createdBy: currentUserId,
      });

      await conversation.populate(
        "participants.user",
        "username fullName profilePicture"
      );

      if (io) {
        participants.forEach((pId) => {
          io.to(`user:${pId}`).emit("conversation:create", conversation);
        });
      }

      return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: SUCCESS_MESSAGES.CONVERSATION_CREATED,
        data: { conversation },
      });
    }

    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: "Invalid conversation data",
    });
  } catch (error) {
    console.error("Create conversation error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR,
    });
  }
});

/**
 * GET /api/chats
 * Get all conversations for current user
 */
router.get("/", protect, async (req, res) => {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({
      "participants.user": userId,
      "participants.isActive": true,
    })
      .populate(
        "participants.user",
        "username fullName profilePicture status lastSeen"
      )
      .populate("lastMessage")
      .sort({ lastMessageAt: -1 });

    // Attach unreadCount for each conversation
    const withUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await conv.getUnreadCount(userId);
        const obj = conv.toObject();
        return {
          ...obj,
          unreadCount,
        };
      })
    );

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        conversations: withUnread,
      },
    });
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR,
    });
  }
});

/**
 * GET /api/chats/:id
 * Get single conversation (meta only; messages via /api/messages/:conversationId)
 */
router.get("/:id", protect, async (req, res) => {
  try {
    const conversationId = req.params.id;

    // Guard: invalid id could cause ObjectId cast error
    if (!conversationId || conversationId === "undefined") {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Invalid conversation id",
      });
    }

    const conversation = await Conversation.findById(conversationId)
      .populate(
        "participants.user",
        "username fullName profilePicture status lastSeen"
      )
      .populate("lastMessage");

    if (!conversation) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.CONVERSATION_NOT_FOUND,
      });
    }

    if (!conversation.isParticipant(req.user._id)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: ERROR_MESSAGES.NOT_PARTICIPANT,
      });
    }

    const unreadCount = await conversation.getUnreadCount(req.user._id);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        conversation: {
          ...conversation.toObject(),
          unreadCount,
        },
      },
    });
  } catch (error) {
    console.error("Get conversation error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR,
    });
  }
});

/**
 * PUT /api/chats/:id
 * Update conversation (name, description, settings, picture)
 */
router.put("/:id", protect, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);

    if (!conversation) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.CONVERSATION_NOT_FOUND,
      });
    }

    if (conversation.isGroup && !conversation.isAdmin(req.user._id)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: ERROR_MESSAGES.NOT_ADMIN,
      });
    }

    const { name, description, groupPicture, settings } = req.body;

    if (name) conversation.name = name;
    if (description !== undefined) conversation.description = description;
    if (groupPicture) conversation.groupPicture = groupPicture;
    if (settings) {
      conversation.settings = {
        ...conversation.settings,
        ...settings,
      };
    }

    await conversation.save();
    await conversation.populate(
      "participants.user",
      "username fullName profilePicture status"
    );

    const io = getIO(req);
    if (io) {
      io.to(`conversation:${conversation._id}`).emit(
        "conversation:update",
        conversation
      );
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: SUCCESS_MESSAGES.CONVERSATION_UPDATED,
      data: { conversation },
    });
  } catch (error) {
    console.error("Update conversation error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR,
    });
  }
});

/**
 * DELETE /api/chats/:id
 * Soft-delete / leave conversation for current user
 * (we use participants.isActive = false for that user)
 */
router.delete("/:id", protect, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);

    if (!conversation) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.CONVERSATION_NOT_FOUND,
      });
    }

    if (!conversation.isParticipant(req.user._id)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: ERROR_MESSAGES.NOT_PARTICIPANT,
      });
    }

    // Use model helper to "leave" / deactivate membership
    conversation.removeMember(req.user._id);
    await conversation.save();

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: SUCCESS_MESSAGES.CONVERSATION_DELETED,
    });
  } catch (error) {
    console.error("Delete conversation error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR,
    });
  }
});

/**
 * POST /api/chats/:id/participants
 * Add participant to group
 */
router.post("/:id/participants", protect, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    const { userId } = req.body;

    if (!conversation || !conversation.isGroup) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: "Group conversation not found",
      });
    }

    if (!conversation.isAdmin(req.user._id)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: ERROR_MESSAGES.NOT_ADMIN,
      });
    }

    const userToAdd = await User.findById(userId);
    if (!userToAdd) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    // Use model helper defined in Conversation schema
    conversation.addMember(userId, req.user._id);
    await conversation.save();
    await conversation.populate(
      "participants.user",
      "username fullName profilePicture status"
    );

    const io = getIO(req);
    if (io) {
      io.to(`conversation:${conversation._id}`).emit(
        "conversation:participant_added",
        {
          conversation,
          addedUser: userToAdd,
        }
      );
      io.to(`user:${userId}`).emit("conversation:added", conversation);
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: SUCCESS_MESSAGES.PARTICIPANT_ADDED,
      data: { conversation },
    });
  } catch (error) {
    console.error("Add participant error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR,
    });
  }
});

/**
 * DELETE /api/chats/:id/participants/:userId
 * Remove participant from group
 */
router.delete("/:id/participants/:userId", protect, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    const { userId } = req.params;

    if (!conversation || !conversation.isGroup) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: "Group conversation not found",
      });
    }

    const isSelf = userId === req.user._id.toString();

    if (!isSelf && !conversation.isAdmin(req.user._id)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: ERROR_MESSAGES.NOT_ADMIN,
      });
    }

    // Use model helper
    conversation.removeMember(userId);
    await conversation.save();

    const io = getIO(req);
    if (io) {
      io.to(`conversation:${conversation._id}`).emit(
        "conversation:participant_removed",
        {
          conversationId: conversation._id,
          removedUserId: userId,
        }
      );
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: SUCCESS_MESSAGES.PARTICIPANT_REMOVED,
    });
  } catch (error) {
    console.error("Remove participant error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR,
    });
  }
});

module.exports = router;
