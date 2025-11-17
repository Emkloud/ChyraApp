import { useState } from 'react';

export default function ReactionPicker({ message, onReact, onClose, position }) {
  const [showAllEmojis, setShowAllEmojis] = useState(false);

  // Quick reactions (most common)
  const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '🙏', '👍'];

  // Extended emoji list (organized by category)
  const ALL_EMOJIS = [
    // Smileys & Emotion
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇',
    '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝',
    '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄',
    '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧',
    '🥵', '🥶', '😶‍🌫️', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐',
    
    // Hearts & Love
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹',
    '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟',
    
    // Hand Gestures
    '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️',
    '✋', '🤚', '🖐️', '🖖', '👋', '🤝', '🙏', '✍️', '💪', '🦵', '🦶',
    
    // Objects & Symbols
    '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '⭐', '🌟', '✨', '💫',
    '🔥', '💯', '✅', '❌', '⚠️', '💢', '💥', '💨', '💦',
    
    // Nature
    '🌈', '☀️', '⛅', '☁️', '🌙', '⭐', '💧', '❄️', '⚡', '🌸', '🌺', '🌻', '🌹'
  ];

  const handleReaction = (emoji) => {
    onReact(emoji);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 z-[9998]" 
        onClick={onClose}
      />

      {/* Reaction Picker */}
      <div
        className="fixed z-[9999] bg-gray-800/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-700 animate-scaleIn max-w-[90vw]"
        style={{
          left: '50%',
          top: position?.top || '50%',
          transform: 'translate(-50%, -50%)',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm">Pick a reaction</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded-full transition"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Quick Reactions */}
        {!showAllEmojis && (
          <div className="p-4">
            <div className="grid grid-cols-6 gap-3 mb-3">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className="text-4xl p-3 hover:bg-gray-700 rounded-xl transition-all hover:scale-110 active:scale-95"
                >
                  {emoji}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setShowAllEmojis(true)}
              className="w-full py-2 text-sm text-purple-400 hover:text-purple-300 font-medium transition"
            >
              Show all emojis →
            </button>
          </div>
        )}

        {/* All Emojis (Scrollable) */}
        {showAllEmojis && (
          <div className="overflow-y-auto p-4" style={{ maxHeight: '60vh' }}>
            <div className="grid grid-cols-6 gap-2">
              {ALL_EMOJIS.map((emoji, index) => (
                <button
                  key={index}
                  onClick={() => handleReaction(emoji)}
                  className="text-3xl p-2 hover:bg-gray-700 rounded-lg transition-all hover:scale-110 active:scale-95"
                >
                  {emoji}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setShowAllEmojis(false)}
              className="w-full mt-4 py-2 text-sm text-gray-400 hover:text-gray-300 font-medium transition"
            >
              ← Show less
            </button>
          </div>
        )}
      </div>

      <style>{`
        .animate-scaleIn {
          animation: scaleIn 0.2s ease-out;
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
      `}</style>
    </>
  );
}