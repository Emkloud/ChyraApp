import api from './api';

/**
 * Message Service
 * Handles all message-related API calls
 */

class MessageService {

  /**
   * Get messages for a conversation
   * @param {string} conversationId - Conversation ID
   * @param {Object} params - Query parameters (cursor, limit)
   * @returns {Promise} List of messages
   */
  async getMessages(conversationId, params = {}) {
    try {
      const response = await api.get(`/messages/${conversationId}`, { params });
      return response?.data?.data?.messages || [];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Send a message
   * @param {Object} messageData - Message data including conversationId, content, type, etc.
   * @returns {Promise} Sent message
   */
  async sendMessage(messageData) {
    try {
      console.log('[MESSAGE_SERVICE] Sending message:', messageData);
      const response = await api.post('/messages', messageData);
      return response?.data?.data?.message || response?.data?.data || response?.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Send text message
   * @param {string} conversationId - Conversation ID
   * @param {string} text - Message text
   * @param {string} replyTo - Message ID to reply to (optional)
   * @returns {Promise} Sent message
   */
  async sendTextMessage(conversationId, text, replyTo = null) {
    try {
      const messageData = {
        conversationId,
        content: text,
        type: 'text'
      };

      if (replyTo) {
        messageData.replyTo = replyTo;
      }

      return await this.sendMessage(messageData);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Send media message
   * @param {string} conversationId - Conversation ID
   * @param {File} file - Media file
   * @param {string} type - Media type (image, video, audio, document)
   * @returns {Promise} Sent message
   */
  async sendMediaMessage(conversationId, file, type) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const response = await api.post(
        `/messages/${conversationId}/media`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Edit message
   * @param {string} messageId - Message ID
   * @param {string} newText - New message text
   * @returns {Promise} Updated message
   */
  async editMessage(messageId, newText) {
    try {
      const response = await api.put(`/messages/${messageId}`, {
        content: { text: newText }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Delete message
   * @param {string} messageId - Message ID
   * @param {boolean} deleteForEveryone - Delete for everyone or just current user
   * @returns {Promise} API response
   */
  async deleteMessage(messageId, deleteForEveryone = false) {
    try {
      const response = await api.delete(`/messages/${messageId}`, {
        data: { deleteForEveryone }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Add reaction to message
   * @param {string} messageId - Message ID
   * @param {string} emoji - Emoji reaction
   * @returns {Promise} API response
   */
  async addReaction(messageId, emoji) {
    try {
      console.log('[MESSAGE_SERVICE] Adding reaction:', { messageId, emoji });
      const response = await api.post(`/messages/${messageId}/reactions`, {
        emoji
      });
      console.log('[MESSAGE_SERVICE] Reaction added:', response.data);
      return response.data;
    } catch (error) {
      console.error('[MESSAGE_SERVICE] Add reaction error:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Remove reaction from message
   * @param {string} messageId - Message ID
   * @returns {Promise} API response
   */
  async removeReaction(messageId) {
    try {
      console.log('[MESSAGE_SERVICE] Removing reaction:', messageId);
      const response = await api.delete(`/messages/${messageId}/reactions`);
      console.log('[MESSAGE_SERVICE] Reaction removed:', response.data);
      return response.data;
    } catch (error) {
      console.error('[MESSAGE_SERVICE] Remove reaction error:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Mark message as read
   * @param {string} messageId - Message ID
   * @returns {Promise} API response
   */
  async markAsRead(messageId) {
    try {
      const response = await api.put(`/messages/${messageId}/read`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Mark multiple messages as read
   * @param {Array} messageIds - Array of message IDs
   * @returns {Promise} API response
   */
  async markMultipleAsRead(messageIds) {
    try {
      const response = await api.put('/messages/read', { messageIds });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Search messages
   * @param {string} conversationId - Conversation ID
   * @param {string} query - Search query
   * @returns {Promise} Search results
   */
  async searchMessages(conversationId, query) {
    try {
      const response = await api.get(`/messages/${conversationId}/search`, {
        params: { query }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get message by ID
   * @param {string} messageId - Message ID
   * @returns {Promise} Message details
   */
  async getMessage(messageId) {
    try {
      const response = await api.get(`/messages/single/${messageId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Forward message
   * @param {string} messageId - Message ID
   * @param {Array} conversationIds - Array of conversation IDs
   * @returns {Promise} API response
   */
  async forwardMessage(messageId, conversationIds) {
    try {
      const response = await api.post(`/messages/${messageId}/forward`, {
        conversationIds
      });
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
    if (error.response) {
      return {
        message: error.response.data.message || 'An error occurred',
        errors: error.response.data.errors || [],
        status: error.response.status
      };
    } else if (error.request) {
      return {
        message: 'No response from server. Please check your connection.',
        errors: [],
        status: 0
      };
    } else {
      return {
        message: error.message || 'An unexpected error occurred',
        errors: [],
        status: 0
      };
    }
  }
}

const messageService = new MessageService();
export { messageService };
export default messageService;