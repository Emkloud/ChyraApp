import { useState } from 'react';

export default function MessageReactionBubble({ reactions, onReactionClick, currentUserId, isOwn }) {
  const [showDetails, setShowDetails] = useState(false);

  if (!reactions || reactions.length === 0) return null;

  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, reaction) => {
    const emoji = reaction.emoji;
    if (!acc[emoji]) {
      acc[emoji] = {
        count: 0,
        users: []
      };
    }
    acc[emoji].count++;
    acc[emoji].users.push(reaction);
    return acc;
  }, {});

  // Get unique emojis with counts
  const reactionSummary = Object.entries(groupedReactions).map(([emoji, data]) => ({
    emoji,
    count: data.count,
    users: data.users,
    hasCurrentUser: data.users.some(r => r.user === currentUserId || r.user?._id === currentUserId)
  }));

  return (
    <div 
      className={`absolute ${isOwn ? 'right-1' : 'left-1'} z-10`}
      style={{ bottom: '-24px' }}
    >
      <div className="flex items-center gap-1">
        {reactionSummary.map(({ emoji, count, hasCurrentUser }) => (
          <button
            key={emoji}
            onClick={(e) => {
              e.stopPropagation();
              onReactionClick && onReactionClick(emoji);
            }}
            onMouseEnter={() => setShowDetails(true)}
            onMouseLeave={() => setShowDetails(false)}
            className="inline-flex items-center gap-0.5 hover:scale-110 transition-transform"
            title={`${count} ${count === 1 ? 'reaction' : 'reactions'}`}
          >
            {/* Just the emoji - NO background */}
            <span className="text-xl leading-none drop-shadow-lg">{emoji}</span>
            {count > 1 && (
              <span className="text-xs font-bold text-white bg-gray-900/80 rounded-full px-1.5 py-0.5 min-w-[20px] text-center leading-none">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tooltip on hover */}
      {showDetails && (
        <div 
          className={`absolute bg-gray-900/95 backdrop-blur-sm rounded-lg shadow-2xl border border-gray-700 p-3 min-w-[180px] z-50 ${
            isOwn ? 'right-0' : 'left-0'
          }`}
          style={{ bottom: '100%', marginBottom: '8px' }}
        >
          <div className="space-y-2">
            {reactionSummary.map(({ emoji, users }) => (
              <div key={emoji} className="flex items-start gap-2">
                <span className="text-base flex-shrink-0">{emoji}</span>
                <div className="flex-1">
                  <div className="text-xs text-gray-300">
                    {users.map((r, idx) => (
                      <span key={idx}>
                        {r.user?.username || r.user?.fullName || 'Someone'}
                        {idx < users.length - 1 && ', '}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}