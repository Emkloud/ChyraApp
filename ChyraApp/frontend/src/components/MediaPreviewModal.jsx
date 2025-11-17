import { useState } from 'react';

export default function MediaPreviewModal({ files, onSend, onCancel }) {
  const [caption, setCaption] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sending, setSending] = useState(false);

  const currentFile = files[currentIndex];
  const isImage = currentFile?.type.startsWith('image/');
  const isVideo = currentFile?.type.startsWith('video/');

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? files.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === files.length - 1 ? 0 : prev + 1));
  };

  const handleSend = async () => {
    setSending(true);
    await onSend(files, caption);
    setSending(false);
  };

  const previewUrl = currentFile ? URL.createObjectURL(currentFile) : null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header - Only close button and file count */}
      <div className="flex items-center justify-between p-4 bg-black/50">
        <button
          onClick={onCancel}
          className="text-white hover:bg-white/10 rounded-full p-2 transition"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-white text-center flex-1">
          <div className="font-medium">
            {files.length} {files.length === 1 ? 'file' : 'files'} selected
          </div>
          {files.length > 1 && (
            <div className="text-sm text-gray-400">
              {currentIndex + 1} / {files.length}
            </div>
          )}
        </div>

        {/* Empty space for symmetry */}
        <div className="w-10"></div>
      </div>

      {/* Media Preview Area */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {/* Navigation arrows */}
        {files.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-4 z-10 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={handleNext}
              className="absolute right-4 z-10 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Media content */}
        <div className="max-w-5xl max-h-[70vh] flex items-center justify-center">
          {isImage && (
            <img
              src={previewUrl}
              alt={currentFile.name}
              className="max-w-full max-h-full object-contain"
            />
          )}
          {isVideo && (
            <video
              src={previewUrl}
              controls
              className="max-w-full max-h-full"
            />
          )}
          {!isImage && !isVideo && (
            <div className="bg-gray-800 p-8 rounded-lg text-center">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <p className="text-white text-lg font-medium">{currentFile.name}</p>
              <p className="text-gray-400 text-sm mt-2">
                {(currentFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Thumbnail strip */}
      {files.length > 1 && (
        <div className="bg-black/50 px-4 py-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600">
            {files.map((file, index) => {
              const thumbUrl = URL.createObjectURL(file);
              const isActive = index === currentIndex;
              return (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${
                    isActive ? 'border-purple-500' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  {file.type.startsWith('image/') ? (
                    <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ✅ FIX: Caption input with Send button at bottom right */}
      <div className="bg-gray-900 p-4 border-t border-gray-800">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2">
            {/* Caption Input */}
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption..."
              className="flex-1 bg-gray-800 text-white placeholder-gray-400 px-4 py-3 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500"
              maxLength={1000}
              disabled={sending}
            />
            
            {/* ✅ Send Button at bottom right beside input */}
            <button
              onClick={handleSend}
              disabled={sending}
              className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full px-6 py-3 font-medium transition flex items-center gap-2 flex-shrink-0"
            >
              {sending ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending...
                </>
              ) : (
                <>
                  <span>Send</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </>
              )}
            </button>
          </div>
          
          {/* Character count */}
          {caption.length > 0 && (
            <div className="text-right text-xs text-gray-500 mt-1">
              {caption.length} / 1000
            </div>
          )}
          
          {/* File count indicator */}
          {files.length > 1 && (
            <p className="text-gray-400 text-xs mt-2 text-center">
              Sending {files.length} files
            </p>
          )}
        </div>
      </div>
    </div>
  );
}