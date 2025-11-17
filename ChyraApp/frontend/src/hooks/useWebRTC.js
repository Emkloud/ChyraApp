import { useState, useRef, useEffect } from 'react';
import SimplePeer from 'simple-peer';

export default function useWebRTC(socket, callType = 'video') {
  const [stream, setStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connectionState, setConnectionState] = useState('new');
  
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  const getUserMedia = async () => {
    try {
      const constraints = {
        audio: true,
        video: callType === 'video' ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = mediaStream;
      setStream(mediaStream);
      return mediaStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw new Error('Could not access camera/microphone. Please check permissions.');
    }
  };

  const createPeer = async (otherUserId, callId) => {
    const mediaStream = await getUserMedia();

    const peer = new SimplePeer({
      initiator: true,
      trickle: true,
      stream: mediaStream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      }
    });

    peer.on('signal', (data) => {
      if (data.type === 'offer') {
        socket.emit('call:initiate', {
          callId,
          receiverId: otherUserId,
          callType,
          offer: data
        });
      } else {
        socket.emit('call:ice-candidate', {
          candidate: data,
          otherUserId
        });
      }
    });

    peer.on('stream', (remoteStream) => {
      setRemoteStream(remoteStream);
      setConnectionState('connected');
    });

    peer.on('connect', () => {
      setConnectionState('connected');
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      setConnectionState('failed');
    });

    peer.on('close', () => {
      setConnectionState('disconnected');
    });

    peerRef.current = peer;
    setConnectionState('connecting');
    return peer;
  };

  const answerCall = async (offer, callerId, callId) => {
    const mediaStream = await getUserMedia();

    const peer = new SimplePeer({
      initiator: false,
      trickle: true,
      stream: mediaStream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      }
    });

    peer.on('signal', (data) => {
      if (data.type === 'answer') {
        socket.emit('call:answer', {
          callId,
          callerId,
          answer: data
        });
      } else {
        socket.emit('call:ice-candidate', {
          candidate: data,
          otherUserId: callerId
        });
      }
    });

    peer.on('stream', (remoteStream) => {
      setRemoteStream(remoteStream);
      setConnectionState('connected');
    });

    peer.on('connect', () => {
      setConnectionState('connected');
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      setConnectionState('failed');
    });

    peer.on('close', () => {
      setConnectionState('disconnected');
    });

    peer.signal(offer);
    peerRef.current = peer;
    setConnectionState('connecting');
    return peer;
  };

  const handleAnswer = (answer) => {
    if (peerRef.current) {
      peerRef.current.signal(answer);
    }
  };

  const handleIceCandidate = (candidate) => {
    if (peerRef.current) {
      peerRef.current.signal(candidate);
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current && callType === 'video') {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      screenStreamRef.current = screenStream;
      
      const screenTrack = screenStream.getVideoTracks()[0];
      const sender = peerRef.current._pc
        .getSenders()
        .find(s => s.track?.kind === 'video');
      
      if (sender) {
        sender.replaceTrack(screenTrack);
        setIsScreenSharing(true);
      }

      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (error) {
      console.error('Error sharing screen:', error);
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    if (localStreamRef.current && peerRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      const sender = peerRef.current._pc
        .getSenders()
        .find(s => s.track?.kind === 'video');
      
      if (sender && videoTrack) {
        sender.replaceTrack(videoTrack);
      }
    }
    
    setIsScreenSharing(false);
  };

  const endCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    setStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    setConnectionState('disconnected');
  };

  useEffect(() => {
    return () => {
      endCall();
    };
  }, []);

  return {
    stream,
    remoteStream,
    isMuted,
    isVideoOff,
    isScreenSharing,
    connectionState,
    getUserMedia,
    createPeer,
    answerCall,
    handleAnswer,
    handleIceCandidate,
    toggleMute,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    endCall
  };
}
