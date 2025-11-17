import api from './api';

export const contactService = {
  // Sync contacts with server
  syncContacts: async (contacts) => {
    try {
      const response = await api.post('/contacts/sync', { contacts });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Send friend request
  sendFriendRequest: async (receiverId) => {
    try {
      const response = await api.post('/contacts/request', { receiverId });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get all friend requests
  getFriendRequests: async () => {
    try {
      const response = await api.get('/contacts/requests');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Accept friend request
  acceptFriendRequest: async (requestId) => {
    try {
      const response = await api.put(`/contacts/request/${requestId}/accept`, {});
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Reject friend request
  rejectFriendRequest: async (requestId) => {
    try {
      const response = await api.put(`/contacts/request/${requestId}/reject`, {});
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Cancel friend request
  cancelFriendRequest: async (requestId) => {
    try {
      const response = await api.delete(`/contacts/request/${requestId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }
};