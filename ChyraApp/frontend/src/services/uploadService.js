import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ✅ FIXED: Upload single file with correct axios syntax
export const uploadFile = async (file, onProgress) => {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('file', file);

  const response = await axios.post(`${API_URL}/upload`, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress: (progressEvent) => {
      const percentCompleted = Math.round(
        (progressEvent.loaded * 100) / progressEvent.total
      );
      if (onProgress) onProgress(percentCompleted);
    }
  });

  return response.data.data || response.data;
};

// Upload multiple files
export const uploadFiles = async (files, onProgress) => {
  const token = localStorage.getItem('token');
  const uploadedFiles = [];

  for (const file of files) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(`${API_URL}/upload`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        if (onProgress) onProgress(percentCompleted);
      }
    });

    uploadedFiles.push(response.data.data || response.data);
  }

  return uploadedFiles;
};

// ✅ FIXED: Upload voice note with correct axios syntax
export const uploadVoiceNote = async (blob, onProgress) => {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('file', blob, 'voice-note.webm');

  const response = await axios.post(`${API_URL}/upload`, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress: (progressEvent) => {
      const percentCompleted = Math.round(
        (progressEvent.loaded * 100) / progressEvent.total
      );
      if (onProgress) onProgress(percentCompleted);
    }
  });

  return response.data.data || response.data;
};

// Helper: Get file type from mime type
export const getFileType = (file) => {
  const mimeType = file.type;
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'document';
};

// Helper: Format file size
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

// Helper: Validate file
export const validateFile = (file, maxSizeMB = 50) => {
  const maxSize = maxSizeMB * 1024 * 1024;

  if (file.size > maxSize) {
    throw new Error(`File size must be less than ${maxSizeMB}MB`);
  }

  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/wav',
    'audio/webm',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error('File type not supported');
  }

  return true;
};

// ✅ CRITICAL FIX: Export as named export 'uploadService' for compatibility with ChatWindow.jsx
export const uploadService = {
  uploadFile,
  uploadFiles,
  uploadVoiceNote,
  getFileType,
  formatFileSize,
  validateFile
};

// Also export as default for flexibility
export default uploadService;