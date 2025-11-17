import api from './api';

/**
 * Authentication Service
 * Handles all authentication-related API calls
 */

class AuthService {
  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @returns {Promise} API response
   */
  async register(userData) {
    try {
      const response = await api.post('/auth/register', userData);
      
      // Store token and user data
      if (response.data.success) {
        const { token, user } = response.data.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
      }
      
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Login user
   * @param {Object|string} credentialsOrEmail - Email and password or just email
   * @param {string} [maybePassword] - Password if email is provided
   * @returns {Promise} API response
   */
  async login(credentialsOrEmail, maybePassword) {
    try {
      const credentials = (typeof credentialsOrEmail === 'string')
        ? { email: credentialsOrEmail, password: maybePassword }
        : credentialsOrEmail;

      const response = await api.post('/auth/login', credentials);
      
      // Store token and user data
      if (response.data.success) {
        const { token, user } = response.data.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
      }

      // Return both original shape and flattened fields for compatibility
      return {
        ...response.data,
        token: response?.data?.data?.token,
        user: response?.data?.data?.user,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Logout user
   * @returns {Promise} API response
   */
  async logout() {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage regardless of API call success
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }

  /**
   * Get current user
   * @returns {Promise} Current user data
   */
  async getCurrentUser() {
    try {
      const response = await api.get('/auth/me');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Update user profile
   * @param {Object} profileData - Profile update data
   * @returns {Promise} API response
   */
  async updateProfile(profileData) {
    try {
      const response = await api.put('/auth/update-profile', profileData);
      
      // Update stored user data
      if (response.data.success) {
        const updatedUser = response.data.data;
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
      
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Change password
   * @param {Object} passwordData - Current and new password
   * @returns {Promise} API response
   */
  async changePassword(passwordData) {
    try {
      const response = await api.put('/auth/change-password', passwordData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Check if user is authenticated
   * @returns {boolean} Authentication status
   */
  isAuthenticated() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    return !!(token && user);
  }

  /**
   * Get stored token
   * @returns {string|null} JWT token
   */
  getToken() {
    return localStorage.getItem('token');
  }

  /**
   * Get stored user
   * @returns {Object|null} User object
   */
  getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  /**
   * Handle API errors
   * @param {Error} error - Error object
   * @returns {Object} Formatted error
   */
  handleError(error) {
    if (error.response) {
      // Server responded with error
      return {
        message: error.response.data.message || 'An error occurred',
        errors: error.response.data.errors || [],
        status: error.response.status
      };
    } else if (error.request) {
      // Request made but no response
      return {
        message: 'No response from server. Please check your connection.',
        errors: [],
        status: 0
      };
    } else {
      // Error setting up request
      return {
        message: error.message || 'An unexpected error occurred',
        errors: [],
        status: 0
      };
    }
  }
}

const authService = new AuthService();
export { authService };
export default authService;