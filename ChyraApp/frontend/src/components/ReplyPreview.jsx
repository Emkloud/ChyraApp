export default function ReplyPreview({ replyingTo, onCancel }) {
  if (!replyingTo) return null;

  const senderName = replyingTo.sender?.username || replyingTo.sender?.fullName || 'Someone';
  const messagePreview = replyingTo.content 
    ? replyingTo.content.slice(0, 50) + (replyingTo.content.length > 50 ? '...' : '')
    : replyingTo.type === 'image' 
    ? '📷 Photo'
    : replyingTo.type === 'video'
    ? '🎥 Video'
    : replyingTo.type === 'audio'
    ? '🎵 Audio'
    : '📎 File';

  return (
    <div className="bg-gray-100 dark:bg-gray-800 border-l-4 border-purple-500 p-3 flex items-center justify-between">
      <div className="flex-1">
        <div className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-1">
          Replying to {senderName}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
          {messagePreview}
        </div>
      </div>
      <button
        onClick={onCancel}
        className="ml-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}