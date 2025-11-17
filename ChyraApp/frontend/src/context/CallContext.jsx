import { createContext, useContext, useState, useEffect } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { initiateCall, updateCallStatus } from '../services/callService';
import useWebRTC from '../hooks/useWebRTC';

const CallContext = createContext();

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within CallProvider');
  }
  return context;
};

export const CallProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callState, setCallState] = useState('idle'); // idle, calling, ringing, active
  const [callStartTime, setCallStartTime] = useState(null);
  const [callDuration, setCallDuration] = useState(0);

  const webRTC = useWebRTC(socket, activeCall?.callType);

  // Handle incoming call
  useEffect(() => {
    if (!socket) return;

    socket.on('call:incoming', (data) => {
      // If already on a call, send busy signal
      if (activeCall || callState !== 'idle') {
        socket.emit('call:busy', {
          callId: data.callId,
          callerId: data.callerId
        });
        return;
      }

      setIncomingCall(data);
      setCallState('ringing');
      playRingtone();
    });

    socket.on('call:answered', async ({ answer }) => {
      webRTC.handleAnswer(answer);
      setCallState('active');
      setCallStartTime(Date.now());
      if (activeCall) {
        await updateCallStatus(activeCall.callId, 'ongoing', new Date());
      }
    });

    socket.on('call:declined', () => {
      handleCallEnd();
    });

    socket.on('call:ended', () => {
      handleCallEnd();
    });

    socket.on('call:busy', () => {
      setCallState('idle');
      setActiveCall(null);
    });

    socket.on('call:failed', ({ reason }) => {
      handleCallEnd();
    });

    socket.on('call:ice-candidate', ({ candidate }) => {
      webRTC.handleIceCandidate(candidate);
    });

    return () => {
      socket.off('call:incoming');
      socket.off('call:answered');
      socket.off('call:declined');
      socket.off('call:ended');
      socket.off('call:busy');
      socket.off('call:failed');
      socket.off('call:ice-candidate');
    };
  }, [socket, activeCall, callState]);

  // Update call duration
  useEffect(() => {
    let interval;
    
    if (callState === 'active' && callStartTime) {
      interval = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartTime) / 1000));
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState, callStartTime]);

  // Start outgoing call
  const startCall = async (receiverId, receiverName, callType = 'video') => {
    try {
      const call = await initiateCall(receiverId, callType);
      
      setActiveCall({
        callId: call._id,
        receiverId,
        receiverName,
        callType,
        isCaller: true
      });
      setCallState('calling');

      await webRTC.createPeer(receiverId, call._id);
      
    } catch (error) {
      setCallState('idle');
      setActiveCall(null);
      throw error;
    }
  };

  // Answer incoming call
  const answerCall = async () => {
    if (!incomingCall) return;

    try {
      stopRingtone();
      
      setActiveCall({
        callId: incomingCall.callId,
        callerId: incomingCall.callerId,
        callerName: incomingCall.callerName,
        callType: incomingCall.callType,
        isCaller: false
      });
      setIncomingCall(null);
      setCallState('active');
      setCallStartTime(Date.now());

      await webRTC.answerCall(incomingCall.offer, incomingCall.callerId, incomingCall.callId);
      await updateCallStatus(incomingCall.callId, 'ongoing', new Date());
      
    } catch (error) {
      handleCallEnd();
    }
  };

  // Decline incoming call
  const declineCall = () => {
    if (!incomingCall) return;

    stopRingtone();
    
    socket.emit('call:decline', {
      callId: incomingCall.callId,
      callerId: incomingCall.callerId
    });

    updateCallStatus(incomingCall.callId, 'declined');
    
    setIncomingCall(null);
    setCallState('idle');
  };

  // End active call
  const endCall = async () => {
    if (!activeCall) return;

    const otherUserId = activeCall.isCaller ? activeCall.receiverId : activeCall.callerId;
    
    socket.emit('call:end', {
      callId: activeCall.callId,
      otherUserId
    });

    await updateCallStatus(activeCall.callId, 'ended', null, new Date());
    handleCallEnd();
  };

  // Handle call end (cleanup)
  const handleCallEnd = () => {
    stopRingtone();
    webRTC.endCall();
    setActiveCall(null);
    setIncomingCall(null);
    setCallState('idle');
    setCallStartTime(null);
    setCallDuration(0);
  };

  // Ringtone management
  const playRingtone = () => {
    const audio = new Audio('/sounds/ringtone.mp3');
    audio.loop = true;
    audio.play().catch(() => {});
    window.ringtoneAudio = audio;
  };

  const stopRingtone = () => {
    if (window.ringtoneAudio) {
      window.ringtoneAudio.pause();
      window.ringtoneAudio = null;
    }
  };

  const value = {
    activeCall,
    incomingCall,
    callState,
    callDuration,
    startCall,
    answerCall,
    declineCall,
    endCall,
    ...webRTC
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
};
