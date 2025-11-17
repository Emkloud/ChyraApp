import axios from 'axios';

const API_BASE = (
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') ||
  (typeof window !== 'undefined' && window.location.hostname.endsWith('chyraapp.com')
    ? 'https://api.chyraapp.com/api'
    : 'http://localhost:5000/api')
);

const client = axios.create({
  baseURL: API_BASE,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const chatsAPI = {
  async getAll() {
    return client.get('/chats');
  },
  async getById(conversationId) {
    return client.get(`/chats/${conversationId}`);
  },
};

export const messagesAPI = {
  async getMessages(conversationId, { page = 1, limit = 50 } = {}) {
    return client.get(`/messages/${conversationId}`, { params: { page, limit } });
  },
  async sendMessage(conversationId, payload) {
    // Backend expects: { conversationId, content, type, media, replyTo }
    const body = {
      conversationId,
      content: payload?.content?.text ?? payload?.content, // basic compatibility
      type: payload?.content?.type || 'text',
      media: payload?.media,
      replyTo: payload?.replyTo,
    };
    return client.post('/messages', body);
  },
};

export default client;
