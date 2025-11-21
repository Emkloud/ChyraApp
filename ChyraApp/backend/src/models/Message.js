// backend/src/models/Message.js
// 🚀 Modern, fast, real-time message model for ChyraApp

const mongoose = require("mongoose");
const { Schema } = mongoose;

const readBySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User" },
    readAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const mediaSchema = new Schema(
  {
    type: { type: String, enum: ["image", "video", "audio", "file"], required: true },
    url: { type: String, required: true },
    size: Number,
    thumbnail: String,
    metadata: Schema.Types.Mixed,
  },
  { _id: false }
);

const messageSchema = new Schema(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },

    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: ["text", "media", "system", "reply"],
      default: "text",
    },

    // IMPORTANT:
    // your frontend expects msg.text, but DB uses content.
    // We keep this field EXACTLY as-is (no breaking changes)
    content: {
      type: String,
      trim: true,
      default: "",
    },

    media: mediaSchema,

    replyTo: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    readBy: [readBySchema],
  },
  {
    timestamps: true,
  }
);

/**
 * 📌 INDEXES
 */
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ "readBy.user": 1 });

/**
 * 📌 METHODS
 */
messageSchema.methods.markAsRead = function (userId) {
  if (!userId) return;
  const alreadyRead = this.readBy.some(
    (r) => r.user.toString() === userId.toString()
  );
  if (!alreadyRead) {
    this.readBy.push({ user: userId, readAt: new Date() });
  }
};

/**
 * -------------------------------------------------------------------
 * FIX #1: Add msg.text (virtual) so frontend ALWAYS receives a text field
 * -------------------------------------------------------------------
 */
messageSchema.virtual("text").get(function () {
  return this.content || "";
});

/**
 * -------------------------------------------------------------------
 * FIX #2: Ensure text + content are consistent in JSON response
 * This prevents message bubbles from stacking left or disappearing.
 * -------------------------------------------------------------------
 */
messageSchema.set("toJSON", {
  virtuals: true,
  transform: function (_, ret) {
    // normalize text
    ret.text = ret.text || ret.content || "";

    // normalize content (frontend reads msg.content too)
    ret.content = ret.text;

    return ret;
  },
});

/**
 * -------------------------------------------------------------------
 * FIX #3: Ensure front-end sorting works by returning real timestamps
 * -------------------------------------------------------------------
 */
messageSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Message", messageSchema);
