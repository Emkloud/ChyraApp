// backend/src/services/socketService.js
// 🚀 Real-time engine for ChyraApp (Socket.IO)
// - DB-backed messages + read receipts
// - Online users list (IDs)
// - Rich presence: Online / Last seen via presence:update

const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");

const onlineUsers = new Map(); // Map<userId, socketId>

module.exports = function (io) {
  /**
   * Emit a single user's presence to all clients
   */
  async function emitPresenceUpdate(userId) {
    try {
      const user = await User.findById(userId).select(
        "_id isOnline status lastSeen"
      );
      if (!user) return;

      io.emit("presence:update", {
        userId: String(user._id),
        isOnline: !!user.isOnline,
        status: user.status || (user.isOnline ? "online" : "offline"),
        lastSeen: user.lastSeen,
      });
    } catch (err) {
      console.error("❌ emitPresenceUpdate error:", err);
    }
  }

  /**
   * Update presence fields on auth / disconnect
   */
  async function updateUserPresence(userId, { online, socketId = null }) {
    try {
      const now = new Date();
      const update = {
        isOnline: !!online,
        status: online ? "online" : "offline",
        lastSeen: now,
        socketId: online ? socketId : null,
      };

      await User.findByIdAndUpdate(userId, update, { new: false });
      await emitPresenceUpdate(userId);
    } catch (err) {
      console.error("❌ updateUserPresence error:", err);
    }
  }

  io.on("connection", (socket) => {
    console.log("⚡ Socket connected:", socket.id);

    /**
     * 🔐 AUTHENTICATE USER
     */
    socket.on("auth", async ({ userId }) => {
      try {
        if (!userId) return;

        const uid = String(userId);

        onlineUsers.set(uid, socket.id);
        socket.userId = uid;

        socket.join(`user:${uid}`);

        console.log(`👤 User authenticated: ${uid}`);

        await updateUserPresence(uid, {
          online: true,
          socketId: socket.id,
        });

        broadcastOnlineUsers(io);
      } catch (err) {
        console.error("❌ Auth error:", err);
      }
    });

    /**
     * 📌 Join a conversation room for messaging
     */
    socket.on("conversation:join", async ({ conversationId }) => {
      try {
        if (!conversationId) return;
        socket.join(`conversation:${conversationId}`);

        console.log(
          `💬 User ${socket.userId} joined conversation ${conversationId}`
        );
      } catch (err) {
        console.error("❌ conversation:join error:", err);
      }
    });

    /**
     * ✉️ SEND MESSAGE (DB + realtime broadcast)
     */
    socket.on("message:send", async (msg) => {
      try {
        if (!msg || !msg.conversationId) return;
        if (!socket.userId) return;

        const conversationId = String(msg.conversationId);
        const senderId = String(socket.userId);

        console.log("📨 message:send event received:", {
          conversationId,
          senderId,
        });

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          console.warn(
            "⚠️ message:send: conversation not found:",
            conversationId
          );
          return;
        }

        const isParticipant =
          typeof conversation.isParticipant === "function"
            ? conversation.isParticipant(senderId)
            : conversation.participants.some((p) => {
                const pid = p.user?._id || p.user;
                return (
                  pid &&
                  String(pid) === senderId &&
                  p.isActive !== false
                );
              });

        if (!isParticipant) {
          console.warn(
            "⚠️ message:send: user is not participant of conversation",
            { senderId, conversationId }
          );
          return;
        }

        const rawContent = msg.content || {};
        const text =
          typeof rawContent === "string"
            ? rawContent
            : rawContent.text || "";

        const type =
          msg.type ||
          rawContent.type ||
          (msg.media ? "media" : "text");

        const message = new Message({
          conversation: conversationId,
          sender: senderId,
          type,
          content: text,
          media: msg.media || undefined,
          replyTo: msg.replyTo || null,
          readBy: [{ user: senderId, readAt: new Date() }],
        });

        await message.save();
        await message.populate("sender", "username fullName profilePicture");

        conversation.lastMessage = message._id;
        conversation.lastMessageAt = message.createdAt || new Date();
        await conversation.save();

        const payloadToSend = {
          _id: message._id,
          conversationId,
          conversation: conversationId,
          sender: message.sender,
          text: message.content,
          content: message.content,
          type: message.type,
          media: message.media,
          replyTo: message.replyTo,
          createdAt: message.createdAt,
          readBy: message.readBy || [],
          status: "delivered",
        };

        io.to(`conversation:${conversationId}`).emit(
          "message:receive",
          payloadToSend
        );
      } catch (err) {
        console.error("❌ message:send error:", err);
      }
    });

    /**
     * 👀 READ RECEIPT
     */
    socket.on("message:read", async ({ messageId, conversationId }) => {
      try {
        if (!messageId || !conversationId || !socket.userId) return;

        const msgDoc = await Message.findById(messageId);
        if (!msgDoc) return;

        msgDoc.markAsRead(socket.userId);
        await msgDoc.save();

        const readAt = new Date();

        io.to(`conversation:${conversationId}`).emit(
          "message:read:update",
          {
            messageId,
            conversationId,
            userId: socket.userId,
            readAt,
          }
        );
      } catch (err) {
        console.error("❌ message:read error:", err);
      }
    });

    /**
     * ✏️ TYPING INDICATOR
     */
    socket.on("typing:start", ({ conversationId }) => {
      if (!conversationId || !socket.userId) return;

      socket
        .to(`conversation:${conversationId}`)
        .emit("user:typing", socket.userId);
    });

    socket.on("typing:stop", ({ conversationId }) => {
      if (!conversationId || !socket.userId) return;

      socket
        .to(`conversation:${conversationId}`)
        .emit("user:stopTyping", socket.userId);
    });

    /**
     * 🔧 CONVERSATION UPDATED
     */
    socket.on("conversation:update", (conv) => {
      if (!conv || !conv._id) return;
      io.to(`conversation:${conv._id}`).emit(
        "conversation:update",
        conv
      );
    });

    /**
     * ➕ NEW CONVERSATION CREATED
     */
    socket.on("conversation:create", (conv) => {
      if (!conv || !Array.isArray(conv.participants)) return;

      conv.participants.forEach((p) => {
        const uid = p.user?._id || p.user;
        if (!uid) return;

        const targetSocket = onlineUsers.get(String(uid));
        if (targetSocket) {
          io.to(targetSocket).emit("conversation:create", conv);
        }
      });
    });

    /**
     * 🔌 DISCONNECT HANDLER
     */
    socket.on("disconnect", async () => {
      try {
        if (socket.userId) {
          const uid = String(socket.userId);
          onlineUsers.delete(uid);
          console.log(`❌ User disconnected: ${uid}`);

          await updateUserPresence(uid, {
            online: false,
            socketId: null,
          });
        }
      } catch (err) {
        console.error("❌ disconnect handler error:", err);
      }

      broadcastOnlineUsers(io);
    });
  });

  /**
   * Broadcast online users (IDs array) to everyone
   */
  function broadcastOnlineUsers(io) {
    const online = Array.from(onlineUsers.keys());
    io.emit("onlineUsers", online);
    io.emit("users:online", online);
    console.log("📡 Online users:", online);
  }
};
