import api from './api';

/**
 * User Service
 * Handles all user-related API calls
 */

class UserService {
  /**
   * Search users
   * @param {string} query - Search query
   * @param {number} limit - Number of results
   * @returns {Promise} List of users
   */
  async searchUsers(query, limit = 20) {
    try {
      const response = await api.get('/users/search', {
        params: { query, limit }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get user profile by ID
   * @param {string} userId - User ID
   * @returns {Promise} User profile
   */
  async getUserProfile(userId) {
    try {
      const response = await api.get(`/users/${userId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get user contacts
   * @returns {Promise} List of contacts
   */
  async getContacts() {
    try {
      const response = await api.get('/users/contacts');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Add contact
   * @param {string} userId - User ID to add
   * @returns {Promise} API response
   */
  async addContact(userId) {
    try {
      const response = await api.post('/users/contacts', { userId });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Remove contact
   * @param {string} userId - User ID to remove
   * @returns {Promise} API response
   */
  async removeContact(userId) {
    try {
      const response = await api.delete(`/users/contacts/${userId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Block user
   * @param {string} userId - User ID to block
   * @returns {Promise} API response
   */
  async blockUser(userId) {
    try {
      const response = await api.post('/users/block', { userId });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Unblock user
   * @param {string} userId - User ID to unblock
   * @returns {Promise} API response
   */
  async unblockUser(userId) {
    try {
      const response = await api.delete(`/users/block/${userId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Update profile picture
   * @param {File} file - Image file
   * @returns {Promise} API response
   */
  async updateProfilePicture(file) {
    try {
      const formData = new FormData();
      formData.append('profilePicture', file);

      const response = await api.post('/users/profile-picture', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Convenience: list users (backend: GET /api/users returns { data: { users } })
  async getAllUsers({ page = 1, limit = 50 } = {}) {
    try {
      const res = await api.get('/users', { params: { page, limit } });
      return res?.data?.data?.users || [];
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

const userService = new UserService();
export { userService };
export default userService;