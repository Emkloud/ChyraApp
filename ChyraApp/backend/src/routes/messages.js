// backend/src/routes/messages.js
// 🚀 Messages API for ChyraApp
// - Returns messages in multiple compatible shapes
// - Works with both legacy and new frontend code

const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const { protect } = require("../middleware/auth");
const { HTTP_STATUS } = require("../config/constants");

// GET /api/messages/:conversationId?page=1&limit=50&search=query
router.get("/:conversationId", protect, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50, search = "" } = req.query;

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ success: false, message: "Conversation not found" });
    }

    // Use the model helper (backwards compatible)
    if (typeof conversation.isParticipant === "function") {
      if (!conversation.isParticipant(req.user._id)) {
        return res
          .status(HTTP_STATUS.FORBIDDEN)
          .json({ success: false, message: "Not a participant" });
      }
    }

    const filters = {
      conversation: conversationId,
    };

    // 🔍 Optional search
    if (search && search.trim() !== "") {
      filters.content = { $regex: search, $options: "i" };
    }

    const messages = await Message.find(filters)
      .populate("sender", "username fullName profilePicture")
      .populate("replyTo")
      .sort({ createdAt: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit));

    // Oldest first for UI
    const ordered = messages.reverse();

    // ✅ Return in MULTIPLE shapes so ALL frontends keep working
    return res.status(HTTP_STATUS.OK).json({
      success: true,

      // Newer style: data.messages
      data: {
        messages: ordered,
      },

      // Legacy style: messages on top-level
      messages: ordered,
    });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Server error",
    });
  }
});

// POST /api/messages  { conversationId, content, type, media, replyTo }
router.post("/", protect, async (req, res) => {
  try {
    const { conversationId, content, type, media, replyTo } = req.body;

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ success: false, message: "Conversation not found" });
    }

    if (typeof conversation.isParticipant === "function") {
      if (!conversation.isParticipant(req.user._id)) {
        return res
          .status(HTTP_STATUS.FORBIDDEN)
          .json({ success: false, message: "Not a participant" });
      }
    }

    const message = await Message.create({
      conversation: conversationId,
      sender: req.user._id,
      content: content || "",
      type: type || "text",
      media: media || null,
      replyTo: replyTo || null,
      // HTTP path doesn't add readBy by default; socket path does.
    });

    // Update last message on conversation
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = message.createdAt || new Date();
    await conversation.save();

    const io = req.app.get("io");
    if (io) {
      io.to(`conversation:${conversationId}`).emit("message:receive", {
        _id: message._id,
        conversationId,
        sender: req.user._id,
        content: message.content,
        type: message.type,
        media: message.media,
        replyTo: message.replyTo,
        createdAt: message.createdAt,
      });
    }

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: {
        message,
      },
      message,
    });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Server error",
    });
  }
});

// POST /api/messages/:id/read
router.post("/:id/read", protect, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ success: false, message: "Message not found" });
    }

    if (typeof message.markAsRead === "function") {
      message.markAsRead(req.user._id);
      await message.save();
    }

    res.status(HTTP_STATUS.OK).json({ success: true });
  } catch (error) {
    console.error("Mark message read error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = router;
