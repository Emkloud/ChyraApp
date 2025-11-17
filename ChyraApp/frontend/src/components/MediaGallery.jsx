import { useState } from 'react';
import { formatFileSize } from '../services/uploadService';

export default function MediaGallery({ media, isSender }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showFullscreen, setShowFullscreen] = useState(false);

  const handlePrev = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? media.length - 1 : prev - 1));
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === media.length - 1 ? 0 : prev + 1));
  };

  const currentMedia = media[currentIndex];
  const isImage = currentMedia.type === 'image';
  const isVideo = currentMedia.type === 'video';

  return (
    <>
      {/* Thumbnail Grid View */}
      <div className="relative max-w-md">
        {media.length === 1 ? (
          // Single media
          <div 
            className="relative cursor-pointer group"
            onClick={() => setShowFullscreen(true)}
          >
            {isImage ? (
              <img
                src={currentMedia.url}
                alt={currentMedia.filename}
                className="rounded-lg w-full h-auto max-h-96 object-cover"
                loading="lazy"
              />
            ) : isVideo ? (
              <video
                src={currentMedia.url}
                className="rounded-lg w-full h-auto max-h-96"
                controls={false}
                preload="metadata"
              />
            ) : null}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition rounded-lg flex items-center justify-center">
              <svg className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            </div>
          </div>
        ) : media.length === 2 ? (
          // Two items - side by side
          <div className="grid grid-cols-2 gap-1">
            {media.map((item, idx) => (
              <div
                key={idx}
                className="relative cursor-pointer overflow-hidden rounded-lg h-48"
                onClick={() => {
                  setCurrentIndex(idx);
                  setShowFullscreen(true);
                }}
              >
                {item.type === 'image' ? (
                  <img
                    src={item.url}
                    alt={item.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <video
                    src={item.url}
                    className="w-full h-full object-cover"
                    preload="metadata"
                  />
                )}
              </div>
            ))}
          </div>
        ) : media.length === 3 ? (
          // Three items - 1 large + 2 small
          <div className="grid grid-cols-2 gap-1">
            <div
              className="relative cursor-pointer overflow-hidden rounded-lg row-span-2 h-full"
              onClick={() => {
                setCurrentIndex(0);
                setShowFullscreen(true);
              }}
            >
              {media[0].type === 'image' ? (
                <img src={media[0].url} alt="" className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <video src={media[0].url} className="w-full h-full object-cover" preload="metadata" />
              )}
            </div>
            {media.slice(1, 3).map((item, idx) => (
              <div
                key={idx + 1}
                className="relative cursor-pointer overflow-hidden rounded-lg h-24"
                onClick={() => {
                  setCurrentIndex(idx + 1);
                  setShowFullscreen(true);
                }}
              >
                {item.type === 'image' ? (
                  <img src={item.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <video src={item.url} className="w-full h-full object-cover" preload="metadata" />
                )}
              </div>
            ))}
          </div>
        ) : (
          // 4+ items - show grid with +N overlay
          <div className="grid grid-cols-2 gap-1">
            {media.slice(0, 4).map((item, idx) => (
              <div
                key={idx}
                className="relative cursor-pointer overflow-hidden rounded-lg h-32"
                onClick={() => {
                  setCurrentIndex(idx);
                  setShowFullscreen(true);
                }}
              >
                {item.type === 'image' ? (
                  <img src={item.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <video src={item.url} className="w-full h-full object-cover" preload="metadata" />
                )}
                {idx === 3 && media.length > 4 && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">+{media.length - 4}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Media counter for multiple items */}
        {media.length > 1 && (
          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
            {media.length} {media.length === 1 ? 'item' : 'items'}
          </div>
        )}
      </div>

      {/* Fullscreen Gallery View */}
      {showFullscreen && (
        <div 
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={() => setShowFullscreen(false)}
        >
          {/* Close button */}
          <button
            onClick={() => setShowFullscreen(false)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white z-10"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Media counter */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full z-10">
            {currentIndex + 1} / {media.length}
          </div>

          {/* Previous button */}
          {media.length > 1 && (
            <button
              onClick={handlePrev}
              className="absolute left-4 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white z-10"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Media content */}
          <div className="max-w-5xl max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
            {isImage ? (
              <img
                src={currentMedia.url}
                alt={currentMedia.filename}
                className="max-w-full max-h-full object-contain"
              />
            ) : isVideo ? (
              <video
                src={currentMedia.url}
                controls
                autoPlay
                className="max-w-full max-h-full"
              />
            ) : null}
          </div>

          {/* Next button */}
          {media.length > 1 && (
            <button
              onClick={handleNext}
              className="absolute right-4 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white z-10"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Download button */}
          <a
            href={currentMedia.url}
            download={currentMedia.filename}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-full flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </a>
        </div>
      )}
    </>
  );
}