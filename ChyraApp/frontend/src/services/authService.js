import api from './api';

/**
 * Authentication Service (Fixed & Improved)
 * Provides BOTH class-based methods AND standalone exported functions
 * so your app can safely import either style.
 */

class AuthService {
  async register(userData) {
    try {
      const response = await api.post('/auth/register', userData);

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

  async login(credentialsOrEmail, maybePassword) {
    try {
      const credentials =
        typeof credentialsOrEmail === 'string'
          ? { email: credentialsOrEmail, password: maybePassword }
          : credentialsOrEmail;

      const response = await api.post('/auth/login', credentials);

      if (response.data.success) {
        const { token, user } = response.data.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
      }

      return {
        ...response.data,
        token: response?.data?.data?.token,
        user: response?.data?.data?.user,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async logout() {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }

  async getCurrentUser() {
    try {
      const response = await api.get('/auth/me');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateProfile(profileData) {
    try {
      const response = await api.put('/auth/update-profile', profileData);

      if (response.data.success) {
        localStorage.setItem('user', JSON.stringify(response.data.data));
      }

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async changePassword(passwordData) {
    try {
      const response = await api.put('/auth/change-password', passwordData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  isAuthenticated() {
    return !!(localStorage.getItem('token') && localStorage.getItem('user'));
  }

  getToken() {
    return localStorage.getItem('token');
  }

  getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  handleError(error) {
    if (error.response) {
      return {
        message: error.response.data.message || "An error occurred",
        errors: error.response.data.errors || [],
        status: error.response.status,
      };
    }

    if (error.request) {
      return {
        message: "No response from server. Please check your connection.",
        errors: [],
        status: 0,
      };
    }

    return {
      message: error.message || "An unexpected error occurred",
      errors: [],
      status: 0,
    };
  }
}

// -------------------------------------------------------
// NEW: Standalone wrapper functions to fix your imports
// -------------------------------------------------------

const authService = new AuthService();

/** FIX: Login function required by Login.jsx */
export const loginUser = (email, password) =>
  authService.login(email, password);

/** Optional: Matches register() for consistency */
export const registerUser = (data) =>
  authService.register(data);

/** Default export (original structure preserved) */
export default authService;
export { authService };
