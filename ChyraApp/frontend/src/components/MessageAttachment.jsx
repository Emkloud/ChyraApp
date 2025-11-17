import { useState } from 'react';
import { formatFileSize } from '../services/uploadService';

export default function MessageAttachment({ attachment, isSender }) {
  const [showFullImage, setShowFullImage] = useState(false);

  const getFileIcon = () => {
    switch (attachment.type) {
      case 'document':
      case 'file':
        return (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
      case 'audio':
      case 'voice':
        return (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        );
      default:
        return null;
    }
  };

  // Image attachment - SMALLER SIZE, THINNER BORDER
  if (attachment.type === 'image') {
    return (
      <>
        <div 
          className="relative max-w-xs cursor-pointer group"
          onClick={() => setShowFullImage(true)}
        >
          <img
            src={attachment.url}
            alt={attachment.filename || 'Image'}
            className="rounded-lg w-full h-auto max-h-64 object-cover border border-gray-600"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition rounded-lg flex items-center justify-center">
            <svg className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </div>
        </div>

        {/* Full screen image modal */}
        {showFullImage && (
          <div 
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setShowFullImage(false)}
          >
            <button
              onClick={() => setShowFullImage(false)}
              className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={attachment.url}
              alt={attachment.filename || 'Image'}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </>
    );
  }

  // Video attachment - SMALLER SIZE, THINNER BORDER
  if (attachment.type === 'video') {
    return (
      <div className="max-w-xs">
        <video
          src={attachment.url}
          controls
          className="rounded-lg w-full max-h-64 border border-gray-600"
          preload="metadata"
        />
      </div>
    );
  }

  // Audio/Voice attachment
  if (attachment.type === 'audio' || attachment.type === 'voice') {
    return (
      <div className={`
        flex items-center gap-3 p-3 rounded-lg max-w-xs
        ${isSender 
          ? 'bg-white/10' 
          : 'bg-gray-700'}
      `}>
        <div className={`
          w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
          ${isSender 
            ? 'bg-white/20 text-white' 
            : 'bg-purple-900/30 text-purple-400'}
        `}>
          {getFileIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <audio
            src={attachment.url}
            controls
            className="w-full h-8"
          />
        </div>
      </div>
    );
  }

  // Document/File attachment - COMPACT
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`
        flex items-center gap-3 p-3 rounded-lg max-w-xs border
        ${isSender 
          ? 'bg-white/10 hover:bg-white/20 border-purple-500/50' 
          : 'bg-gray-700 hover:bg-gray-600 border-gray-600'}
        transition cursor-pointer
      `}
    >
      <div className={`
        w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
        ${isSender 
          ? 'bg-white/20 text-white' 
          : 'bg-purple-900/30 text-purple-400'}
      `}>
        {getFileIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-medium text-sm truncate ${isSender ? 'text-white' : 'text-white'}`}>
          {attachment.filename || attachment.name || 'File'}
        </p>
        {attachment.size && (
          <p className={`text-xs ${isSender ? 'text-white/70' : 'text-gray-400'}`}>
            {formatFileSize ? formatFileSize(attachment.size) : `${(attachment.size / 1024).toFixed(1)} KB`}
          </p>
        )}
      </div>
      <svg className={`w-5 h-5 flex-shrink-0 ${isSender ? 'text-white/70' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    </a>
  );
}