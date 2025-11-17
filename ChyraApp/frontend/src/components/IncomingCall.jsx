import { useEffect, useState } from 'react';
import { useCall } from '../context/CallContext';
import UserAvatar from './UserAvatar';

export default function IncomingCall() {
  const { incomingCall, answerCall, declineCall } = useCall();
  const [ringing, setRinging] = useState(false);

  useEffect(() => {
    if (incomingCall) {
      setRinging(true);
      const interval = setInterval(() => {
        setRinging(r => !r);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [incomingCall]);

  if (!incomingCall) return null;

  const callTypeIcon = incomingCall.callType === 'video' ? (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ) : (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-fadeIn" />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-3xl shadow-2xl max-w-md w-full p-8 text-white animate-slideUp">
          <div className="flex justify-center mb-6">
            <div className={`
              px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2
              ${ringing ? 'bg-white/30 scale-105' : 'bg-white/20'}
              transition-all duration-300
            `}>
              {callTypeIcon}
              <span className="capitalize">{incomingCall.callType} Call</span>
            </div>
          </div>

          <div className="flex justify-center mb-4">
            <div className={`${ringing ? 'scale-110' : 'scale-100'} transition-transform duration-300`}>
              <UserAvatar user={{ username: incomingCall.callerName }} size="3xl" />
            </div>
          </div>

          <h2 className="text-3xl font-bold text-center mb-2">{incomingCall.callerName}</h2>
          <p className="text-center text-white/90 mb-8 text-lg">Incoming {incomingCall.callType} call...</p>

          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className={`w-24 h-24 rounded-full bg-white/20 ${ringing ? 'scale-100 opacity-100' : 'scale-150 opacity-0'} transition-all duration-1000`} />
              <div className={`absolute inset-0 w-24 h-24 rounded-full bg-white/10 ${ringing ? 'scale-150 opacity-0' : 'scale-100 opacity-100'} transition-all duration-1000`} />
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={declineCall}
              className="w-20 h-20 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 shadow-lg"
              title="Decline"
            >
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <button
              onClick={answerCall}
              className="w-20 h-20 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 shadow-lg animate-pulse"
              title="Answer"
            >
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </button>
          </div>

          <div className="flex gap-4 justify-center mt-4">
            <span className="w-20 text-center text-sm">Decline</span>
            <span className="w-20 text-center text-sm">Answer</span>
          </div>
        </div>
      </div>
    </>
  );
}
