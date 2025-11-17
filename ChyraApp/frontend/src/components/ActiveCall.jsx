import { useEffect, useRef, useState } from 'react';
import { useCall } from '../context/CallContext';
import UserAvatar from './UserAvatar';

export default function ActiveCall() {
  const {
    activeCall,
    callState,
    stream,
    remoteStream,
    callDuration,
    connectionState,
    isMuted,
    isVideoOff,
    isScreenSharing,
    toggleMute,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    endCall,
  } = useCall();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    if (localVideoRef.current && stream) {
      localVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (!activeCall || (callState !== 'active' && callState !== 'calling' && callState !== 'ringing')) return null;

  const isVideoCall = activeCall.callType === 'video';
  const otherParty = activeCall.isCaller
    ? { username: activeCall.receiverName, id: activeCall.receiverId }
    : { username: activeCall.callerName, id: activeCall.callerId };

  const formatDuration = (seconds) => {
    if (typeof seconds !== 'number') return null;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <>
      {/* Full-screen */}
      <div
        className={`fixed inset-0 z-50 bg-gray-900 ${isMinimized ? 'hidden' : 'block'}`}
        onMouseMove={() => setShowControls(true)}
        onClick={() => setShowControls(true)}
      >
        <div className="relative w-full h-full text-white">
          {/* Remote video or placeholder */}
          {isVideoCall && remoteStream ? (
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-600 to-pink-600">
              <div className="text-center">
                <div className="mx-auto mb-4">
                  <UserAvatar user={otherParty} size="3xl" />
                </div>
                <h2 className="text-3xl font-bold mb-2">{otherParty.username}</h2>
                <p className="text-white/80 text-lg">
                  {callState === 'calling' && 'Calling...'}
                  {callState === 'ringing' && 'Ringing...'}
                  {callState === 'active' && (formatDuration(callDuration) || 'In call')}
                </p>
              </div>
            </div>
          )}

          {/* Local PiP */}
          {isVideoCall && (
            <div className="absolute top-4 right-4 w-32 h-40 rounded-xl overflow-hidden shadow-2xl border-2 border-white/30 bg-black/40">
              {isVideoOff || !stream ? (
                <div className="w-full h-full flex items-center justify-center">
                  <UserAvatar user={otherParty} size="md" />
                </div>
              ) : (
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
              )}
            </div>
          )}

          {/* Connection State */}
          {connectionState && connectionState !== 'connected' && (
            <div className="absolute top-4 left-4">
              <div className="px-4 py-2 bg-yellow-500/90 rounded-full text-sm font-medium flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="capitalize">{connectionState}</span>
              </div>
            </div>
          )}

          {/* Top bar */}
          <div className={`absolute top-0 left-0 right-0 bg-gradient-to-b from-black/50 to-transparent transition-all ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'}`}>
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserAvatar user={otherParty} size="sm" />
                <div>
                  <h3 className="font-semibold">{otherParty.username}</h3>
                  {callState === 'active' && formatDuration(callDuration) && (
                    <p className="text-sm text-white/80">{formatDuration(callDuration)}</p>
                  )}
                </div>
              </div>
              <button onClick={() => setIsMinimized(true)} className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center" title="Minimize">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
              </button>
            </div>
          </div>

          {/* Bottom controls */}
          <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent transition-all ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'}`}>
            <div className="p-6">
              <div className="flex justify-center items-center gap-4">
                <button onClick={toggleMute} className={`w-14 h-14 rounded-full flex items-center justify-center transition ${isMuted ? 'bg-red-600' : 'bg-white/20 hover:bg-white/30'}`} title={isMuted ? 'Unmute' : 'Mute'}>
                  {isMuted ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
                  )}
                </button>

                {isVideoCall && (
                  <button onClick={toggleVideo} className={`w-14 h-14 rounded-full flex items-center justify-center transition ${isVideoOff ? 'bg-red-600' : 'bg-white/20 hover:bg-white/30'}`} title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}>
                    {isVideoOff ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                    ) : (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                    )}
                  </button>
                )}

                {isVideoCall && (
                  isScreenSharing ? (
                    <button onClick={stopScreenShare} className="w-14 h-14 rounded-full flex items-center justify-center bg-blue-500 hover:bg-blue-600" title="Stop sharing">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  ) : (
                    <button onClick={startScreenShare} className="w-14 h-14 rounded-full flex items-center justify-center bg-white/20 hover:bg-white/30" title="Share screen">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                    </button>
                  )
                )}

                <button onClick={endCall} className="w-16 h-16 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center shadow-lg" title="End call">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Minimized tile */}
      {isMinimized && (
        <div className="fixed bottom-24 right-4 z-50 animate-slideUp">
          <div className="w-64 bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border-2 border-purple-500 text-white">
            <div className="relative h-36 bg-gradient-to-br from-purple-600 to-pink-600">
              {isVideoCall && remoteStream ? (
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <UserAvatar user={otherParty} size="lg" />
                </div>
              )}
              <button onClick={() => setIsMinimized(false)} className="absolute top-2 right-2 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
              </button>
            </div>
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{otherParty.username}</span>
                {callState === 'active' && formatDuration(callDuration) && (
                  <span className="text-xs text-white/70">{formatDuration(callDuration)}</span>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={toggleMute} className={`flex-1 py-2 rounded-lg text-sm ${isMuted ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20'}`}>{isMuted ? 'Unmute' : 'Mute'}</button>
                <button onClick={endCall} className="flex-1 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-sm">End</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
