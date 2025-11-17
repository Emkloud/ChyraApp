import { useState, useEffect, useRef } from 'react';

export default function MessageActions({ 
  message, 
  isOwn, 
  onEdit, 
  onReply, 
  onReact, 
  onDelete 
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const canEdit = () => {
    if (!isOwn || message.type !== 'text') return false;
    const messageTime = new Date(message.createdAt).getTime();
    const now = Date.now();
    const tenMinutes = 10 * 60 * 1000;
    return (now - messageTime) < tenMinutes;
  };

  const quickEmojis = ['❤️', '😂', '😮', '😢', '👍', '🙏'];

  return (
    <div className="absolute -top-8 right-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" ref={menuRef}>
      {/* Quick emoji reactions */}
      <div className="flex items-center gap-0.5 bg-white dark:bg-gray-800 rounded-full shadow-lg px-1 py-1 border border-gray-200 dark:border-gray-700">
        {quickEmojis.map((emoji) => (
          <button
            key={emoji}
            onClick={(e) => {
              e.stopPropagation();
              onReact(emoji);
            }}
            className="text-lg hover:scale-125 transition-transform p-1"
            title={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
        
        {/* More emojis button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowEmojiPicker(!showEmojiPicker);
          }}
          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 p-1"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-0.5 bg-white dark:bg-gray-800 rounded-full shadow-lg px-1 py-1 border border-gray-200 dark:border-gray-700">
        {/* Reply */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onReply(message);
            setShowMenu(false);
          }}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"
          title="Reply"
        >
          <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>

        {/* Edit (only for own text messages within 10 mins) */}
        {canEdit() && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(message);
              setShowMenu(false);
            }}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"
            title="Edit (within 10 minutes)"
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}

        {/* More options */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"
          title="More"
        >
          <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      </div>

      {/* Dropdown menu */}
      {showMenu && (
        <div className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[150px] z-10">
          {isOwn && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(message);
                setShowMenu(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          )}
        </div>
      )}

      {/* Show full emoji picker if requested */}
      {showEmojiPicker && (
        <div className="absolute top-full right-0 mt-1 z-20">
          {/* Import and use EmojiPicker component here */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-2">
            <div className="text-sm text-gray-500 dark:text-gray-400">Full emoji picker here</div>
          </div>
        </div>
      )}
    </div>
  );
}