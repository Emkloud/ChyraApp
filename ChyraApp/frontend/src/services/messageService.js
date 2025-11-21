// frontend/src/services/messageService.js
// 🚀 Ultra-stable Message Service for ChyraApp
// Works with api.js (messagesAPI) + new backend message routes

import { messagesAPI } from "./api";

const messageService = {
  /**
   * Fetch messages for a conversation.
   * Aligned with backend:
   * GET /messages/:conversationId?page=1&limit=50
   *
   * Expected backend response:
   * {
   *   success: true,
   *   data: { messages, meta: { page, totalPages, total } }
   * }
   */
  async getMessages(conversationId, { page = 1, limit = 50 } = {}) {
    if (!conversationId) {
      console.warn("⚠️ messageService.getMessages called without conversationId");
      return {
        success: false,
        messages: [],
        page: 1,
        totalPages: 1,
        total: 0,
      };
    }

    try {
      const res = await messagesAPI.getMessages(conversationId, { page, limit });

      const base = res?.data || {};
      const payload = base.data || base; // supports both {data:{}} and flat

      const messages = Array.isArray(payload.messages)
        ? payload.messages
        : [];

      const meta = payload.meta || {};

      return {
        success: base.success !== false,
        messages,
        page: meta.page || page,
        totalPages: meta.totalPages || 1,
        total: meta.total || messages.length,
      };
    } catch (err) {
      console.error("❌ messageService.getMessages error:", err);

      return {
        success: false,
        messages: [],
        page: 1,
        totalPages: 1,
        total: 0,
      };
    }
  },

  /**
   * Optional HTTP-based sendMessage — MOST sending happens via socket.io.
   * But we keep this for uploads, media, fallbacks, or future features.
   */
  async sendMessage(conversationId, payload = {}) {
    if (!conversationId) {
      console.warn("⚠️ sendMessage called without conversationId");
      return null;
    }

    const text =
      payload.text?.trim() ||
      payload.content?.text?.trim() ||
      "";

    if (!text && !payload.media) {
      console.warn("⚠️ sendMessage called with empty content");
      return null;
    }

    try {
      const body = {
        conversationId,
        content: {
          text,
          type: payload.type || payload.content?.type || "text",
        },
        media: payload.media,
        replyTo: payload.replyTo,
      };

      const res = await messagesAPI.sendMessage(conversationId, body);
      const base = res?.data || {};

      return (
        base.data?.message ||
        base.message ||
        null
      );
    } catch (err) {
      console.error("❌ messageService.sendMessage error:", err);
      return null;
    }
  },
};

export default messageService;
