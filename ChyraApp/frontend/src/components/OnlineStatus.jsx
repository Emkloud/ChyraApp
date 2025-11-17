import { useSocket } from '../context/SocketContext';

export default function OnlineStatus({ user, showLabel = false, className = '' }) {
  const { onlineUsers } = useSocket();
  const userId = user?._id || user?.id;
  const isOnline = userId ? onlineUsers.has(userId) : false;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={isOnline ? 'status-online' : 'status-offline'} />
      {showLabel && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {isOnline ? 'Online' : 'Offline'}
        </span>
      )}
    </div>
  );
}
