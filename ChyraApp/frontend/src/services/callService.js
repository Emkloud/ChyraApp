import axios from 'axios';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

export const getCallHistory = async () => {
  const token = localStorage.getItem('token');
  const response = await axios.get(`${API_URL}/calls/history`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const getCall = async (callId) => {
  const token = localStorage.getItem('token');
  const response = await axios.get(`${API_URL}/calls/${callId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const initiateCall = async (receiverId, callType) => {
  const token = localStorage.getItem('token');
  const response = await axios.post(
    `${API_URL}/calls/initiate`,
    { receiverId, callType },
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
};

export const updateCallStatus = async (callId, status, answeredAt = null, endTime = null) => {
  const token = localStorage.getItem('token');
  const response = await axios.put(
    `${API_URL}/calls/${callId}`,
    { status, answeredAt, endTime },
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
};

export const deleteCall = async (callId) => {
  const token = localStorage.getItem('token');
  const response = await axios.delete(`${API_URL}/calls/${callId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};
