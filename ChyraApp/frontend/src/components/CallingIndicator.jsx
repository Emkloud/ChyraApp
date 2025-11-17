import { useCall } from '../context/CallContext';
import UserAvatar from './UserAvatar';

export default function CallingIndicator() {
  const { activeCall, callState, endCall } = useCall();

  if (!activeCall || callState !== 'calling') return null;

  const otherParty = activeCall.isCaller
    ? { username: activeCall.receiverName, id: activeCall.receiverId }
    : { username: activeCall.callerName, id: activeCall.callerId };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center animate-fadeIn">
      <div className="text-center text-white p-8">
        <div className="relative inline-block mb-6">
          <UserAvatar user={otherParty} size="3xl" />
          <div className="absolute inset-0 rounded-full border-4 border-white/30 animate-ping" />
          <div className="absolute inset-0 rounded-full border-4 border-white/20" />
        </div>

        <h2 className="text-3xl font-bold mb-2">{otherParty.username}</h2>
        <p className="text-xl text-white/90 mb-1">Calling...</p>
        <p className="text-sm text-white/70">Waiting for {otherParty.username} to answer</p>

        <button
          onClick={endCall}
          className="mt-8 w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center mx-auto transition-all transform hover:scale-110 active:scale-95 shadow-lg"
          title="Cancel call"
        >
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <p className="text-sm text-white/70 mt-3">Cancel</p>
      </div>
    </div>
  );
}
