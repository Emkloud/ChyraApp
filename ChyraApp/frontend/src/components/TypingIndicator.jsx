export default function TypingIndicator({ username = 'Someone' }) {
  return (
    <div className="flex items-end space-x-2 animate-slideUp">
      <div className="avatar avatar-sm avatar-gradient flex-shrink-0">
        {username.charAt(0).toUpperCase()}
      </div>
      <div className="bg-white dark:bg-gray-700 rounded-2xl rounded-bl-sm px-4 py-3 shadow-md border border-gray-200 dark:border-gray-600">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    </div>
  );
}