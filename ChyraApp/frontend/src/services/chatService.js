import api from './api';

/**
 * Chat Service
 * Handles all conversation-related API calls
 */

class ChatService {

  /**
   * Get all conversations
   * @param {Object} params - Query parameters
   * @returns {Promise} List of conversations
   */
  async getConversations(params = {}) {
    try {
      console.log('📡 Calling GET /chats with params:', params);
      const response = await api.get('/chats', { params });
      console.log('📥 Response received:', response);
      return response.data;
    } catch (error) {
      console.error('❌ getConversations error:', error);
      throw this.handleError(error);
    }
  }

  // Convenience: return array of conversations only
  async getUserChats(params = {}) {
    try {
      const res = await this.getConversations(params);
      console.log('📦 Full response:', res);
      console.log('📦 res.data:', res?.data);
      console.log('📦 res.data.conversations:', res?.data?.conversations);
      
      const conversations = res?.data?.conversations || [];
      console.log('✅ Returning conversations:', conversations);
      return conversations;
    } catch (error) {
      console.error('❌ getUserChats error:', error);
      throw error;
    }
  }

  /**
   * Get conversation by ID
   * @param {string} conversationId - Conversation ID
   * @returns {Promise} Conversation details
   */
  async getConversation(conversationId) {
    try {
      const response = await api.get(`/chats/${conversationId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Convenience: return conversation object only
  async getChatById(conversationId) {
    const res = await this.getConversation(conversationId);
    return res?.data?.conversation || res?.data || null;
  }

  /**
   * Create new conversation
   * @param {Object} conversationData - Conversation data
   * @returns {Promise} Created conversation
   */
  async createConversation(conversationData) {
    try {
      const response = await api.post('/chats', conversationData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Create individual chat
   * @param {string} userId - Other user's ID
   * @returns {Promise} Created conversation
   */
  async createIndividualChat(userId) {
    try {
      const response = await api.post('/chats', {
        isGroup: false,
        participantId: userId
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Convenience: create or fetch 1:1 chat and return conversation object
  async createChat(userId) {
    const res = await this.createIndividualChat(userId);
    return res?.data?.conversation || res?.data || null;
  }

  /**
   * Create group chat
   * @param {Object} groupData - Group chat data
   * @returns {Promise} Created group
   */
  async createGroupChat(groupData) {
    try {
      const response = await api.post('/chats', {
        isGroup: true,
        ...groupData
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Update conversation
   * @param {string} conversationId - Conversation ID
   * @param {Object} updateData - Update data
   * @returns {Promise} Updated conversation
   */
  async updateConversation(conversationId, updateData) {
    try {
      const response = await api.put(`/chats/${conversationId}`, updateData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Delete conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Promise} API response
   */
  async deleteConversation(conversationId) {
    try {
      const response = await api.delete(`/chats/${conversationId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Add participants to group
   * @param {string} conversationId - Conversation ID
   * @param {Array} userIds - Array of user IDs
   * @returns {Promise} API response
   */
  async addParticipants(conversationId, userIds) {
    try {
      const response = await api.post(`/chats/${conversationId}/participants`, {
        userIds
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Remove participant from group
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID to remove
   * @returns {Promise} API response
   */
  async removeParticipant(conversationId, userId) {
    try {
      const response = await api.delete(
        `/chats/${conversationId}/participants/${userId}`
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Leave conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Promise} API response
   */
  async leaveConversation(conversationId) {
    try {
      const response = await api.post(`/chats/${conversationId}/leave`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Mute conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Promise} API response
   */
  async muteConversation(conversationId) {
    try {
      const response = await api.post(`/chats/${conversationId}/mute`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Unmute conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Promise} API response
   */
  async unmuteConversation(conversationId) {
    try {
      const response = await api.post(`/chats/${conversationId}/unmute`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Update group settings
   * @param {string} conversationId - Conversation ID
   * @param {Object} settings - Group settings
   * @returns {Promise} API response
   */
  async updateGroupSettings(conversationId, settings) {
    try {
      const response = await api.put(
        `/chats/${conversationId}/settings`,
        settings
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Handle API errors
   * @param {Error} error - Error object
   * @returns {Object} Formatted error
   */
  handleError(error) {
    console.error('🔴 ChatService error:', error);
    
    if (error.response) {
      console.error('Response error:', {
        status: error.response.status,
        data: error.response.data
      });
      return {
        message: error.response.data.message || 'An error occurred',
        errors: error.response.data.errors || [],
        status: error.response.status
      };
    } else if (error.request) {
      console.error('No response received:', error.request);
      return {
        message: 'No response from server. Please check your connection.',
        errors: [],
        status: 0
      };
    } else {
      console.error('Request setup error:', error.message);
      return {
        message: error.message || 'An unexpected error occurred',
        errors: [],
        status: 0
      };
    }
  }
}

const chatService = new ChatService();
export { chatService };
export default chatService;