// frontend/src/services/chatService.js
// 🚀 Modern, stable Chat Service for ChyraApp

import client, { chatsAPI } from "./api";

const chatService = {
  async getUserChats() {
    try {
      const res = await chatsAPI.getAll();
      return {
        success: res?.data?.success === true,
        conversations: res?.data?.data?.conversations || [],
      };
    } catch (err) {
      console.error("❌ chatService.getUserChats error:", err);
      return { success: false, conversations: [] };
    }
  },

  async getConversation(conversationId) {
    if (!conversationId) return null;
    try {
      const res = await chatsAPI.getById(conversationId);
      return (
        res?.data?.data?.conversation ||
        res?.data?.conversation ||
        null
      );
    } catch (err) {
      console.error(
        `❌ chatService.getConversation(${conversationId}) error:`,
        err
      );
      return null;
    }
  },

  async createDirectMessage(participantId) {
    if (!participantId) return null;
    try {
      const payload = { isGroup: false, participantId };
      const res = await client.post("/chats", payload);
      return res?.data?.data?.conversation || null;
    } catch (err) {
      console.error("❌ chatService.createDirectMessage error:", err);
      return null;
    }
  },

  async createGroupChat({ name, participants = [] }) {
    if (!name || participants.length === 0) return null;
    try {
      const payload = { isGroup: true, name, participants };
      const res = await client.post("/chats", payload);
      return res?.data?.data?.conversation || null;
    } catch (err) {
      console.error("❌ chatService.createGroupChat error:", err);
      return null;
    }
  },

  async updateConversation(conversationId, updates = {}) {
    if (!conversationId) return null;
    try {
      const res = await client.put(`/chats/${conversationId}`, updates);
      return res?.data?.data?.conversation || null;
    } catch (err) {
      console.error("❌ chatService.updateConversation error:", err);
      return null;
    }
  },

  async addParticipant(conversationId, userId) {
    if (!conversationId || !userId) return null;
    try {
      const res = await client.post(`/chats/${conversationId}/participants`, {
        userId,
      });
      return res?.data?.data?.conversation || null;
    } catch (err) {
      console.error("❌ chatService.addParticipant error:", err);
      return null;
    }
  },

  async removeParticipant(conversationId, userId) {
    if (!conversationId || !userId) return false;
    try {
      await client.delete(`/chats/${conversationId}/participants/${userId}`);
      return true;
    } catch (err) {
      console.error("❌ chatService.removeParticipant error:", err);
      return false;
    }
  },

  async deleteConversation(conversationId) {
    if (!conversationId) return false;
    try {
      await client.delete(`/chats/${conversationId}`);
      return true;
    } catch (err) {
      console.error("❌ chatService.deleteConversation error:", err);
      return false;
    }
  },
};

export default chatService;
