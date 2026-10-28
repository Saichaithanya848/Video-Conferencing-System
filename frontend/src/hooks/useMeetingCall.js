import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from '../services/api.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export function useMeetingCall(roomId, token, enabled = true) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('Preparing your camera and microphone…');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const peersRef = useRef(new Map());
  const pendingIceRef = useRef(new Map());

  const closePeer = useCallback((peerId) => {
    peersRef.current.get(peerId)?.close();
    peersRef.current.delete(peerId);
    pendingIceRef.current.delete(peerId);
    setRemoteStreams((current) => current.filter((entry) => entry.peerId !== peerId));
  }, []);

  const getPeer = useCallback((peerId) => {
    let peer = peersRef.current.get(peerId);
    if (peer) return peer;
    peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current.set(peerId, peer);
    streamRef.current?.getTracks().forEach((track) => peer.addTrack(track, streamRef.current));
    peer.onicecandidate = ({ candidate }) => {
      if (candidate) socketRef.current?.emit('rtc-ice-candidate', { to: peerId, candidate });
    };
    peer.ontrack = ({ streams }) => {
      if (!streams[0]) return;
      setRemoteStreams((current) => current.some((entry) => entry.peerId === peerId)
        ? current.map((entry) => entry.peerId === peerId ? { ...entry, stream: streams[0] } : entry)
        : [...current, { peerId, stream: streams[0] }]);
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'failed') setError('The video connection failed. Check your network or try another network.');
      if (peer.connectionState === 'connected') setStatus('Connected securely peer-to-peer');
      if (peer.connectionState === 'disconnected') setStatus('Video connection interrupted; waiting for the network…');
    };
    return peer;
  }, []);

  const flushIce = useCallback(async (peerId, peer) => {
    const pending = pendingIceRef.current.get(peerId) ?? [];
    pendingIceRef.current.delete(peerId);
    for (const candidate of pending) await peer.addIceCandidate(candidate).catch(() => {});
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus('Checking meeting room…');
      return undefined;
    }
    let socket;
    let stopped = false;
    async function start() {
      setError('');
      setStatus('Requesting camera and microphone access…');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        if (stopped) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        setLocalStream(stream);
        setStatus('Connecting to meeting…');
      } catch (mediaError) {
        const message = mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError'
          ? 'Camera or microphone permission was denied. Allow access in your browser and reload the meeting.'
          : mediaError.name === 'NotFoundError' || mediaError.name === 'DevicesNotFoundError'
            ? 'No camera or microphone was found. Connect a device and reload the meeting.'
            : 'Could not start your camera and microphone. Check that another app is not using them.';
        if (!stopped) { setError(message); setStatus('Media unavailable'); }
        return;
      }

      socket = io(SOCKET_URL, { auth: { token }, autoConnect: false });
      socketRef.current = socket;
      socket.on('connect', () => {
        setConnected(true); setError('');
        socket.emit('join-room', { roomId }, (result) => {
          if (result?.error) {
            setError(result.error);
            setStatus('Could not join meeting');
            streamRef.current?.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
            setLocalStream(null);
            socket.disconnect();
            return;
          }
          setParticipants([result.self, ...result.participants]);
          setStatus(result.participants.length ? 'Connecting to participant…' : 'Waiting for someone to join');
        });
      });
      socket.on('connect_error', (connectError) => {
        setConnected(false); setStatus('Disconnected');
        setError(connectError.message === 'Invalid or expired token.' ? 'Your session expired. Sign in again.' : 'Could not connect to the meeting server. Check that the backend is running.');
      });
      socket.on('disconnect', () => { setConnected(false); setStatus('Disconnected from meeting server'); });
      socket.on('participant-joined', async (participant) => {
        setParticipants((current) => current.some((item) => item.id === participant.id) ? current : [...current, participant]);
        try {
          const peer = getPeer(participant.id);
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          socket.emit('rtc-offer', { to: participant.id, description: peer.localDescription });
        } catch { setError('Could not start a connection with the new participant.'); }
      });
      socket.on('rtc-offer', async ({ from, description }) => {
        try {
          const peer = getPeer(from);
          await peer.setRemoteDescription(description);
          await flushIce(from, peer);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          socket.emit('rtc-answer', { to: from, description: peer.localDescription });
        } catch { setError('Could not establish the incoming video connection.'); }
      });
      socket.on('rtc-answer', async ({ from, description }) => {
        const peer = peersRef.current.get(from);
        if (!peer) return;
        try { await peer.setRemoteDescription(description); await flushIce(from, peer); }
        catch { setError('Could not finish connecting the video call.'); }
      });
      socket.on('rtc-ice-candidate', async ({ from, candidate }) => {
        try {
          const peer = getPeer(from);
          if (peer.remoteDescription) await peer.addIceCandidate(candidate);
          else pendingIceRef.current.set(from, [...(pendingIceRef.current.get(from) ?? []), candidate]);
        } catch { setError('A network route could not be established for the call.'); }
      });
      socket.on('participant-left', ({ id }) => {
        closePeer(id);
        setParticipants((current) => current.filter((participant) => participant.id !== id));
        setStatus('A participant left the meeting');
      });
      socket.on('participants-updated', setParticipants);
      socket.on('chat-message', (message) => setMessages((current) => [...current, message]));
      socket.connect();
    }
    start();
    return () => {
      stopped = true;
      socket?.disconnect();
      socketRef.current = null;
      peersRef.current.forEach((peer) => peer.close());
      peersRef.current.clear();
      pendingIceRef.current.clear();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setLocalStream(null);
    };
  }, [roomId, token, enabled, closePeer, getPeer, flushIce]);

  const toggleMic = useCallback(() => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setMicOn(track.enabled); }
  }, []);
  const toggleCamera = useCallback(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setCameraOn(track.enabled); }
  }, []);
  const sendMessage = useCallback((text) => new Promise((resolve) => {
    if (!socketRef.current?.connected) { resolve({ error: 'Not connected to the meeting.' }); return; }
    socketRef.current.emit('chat-message', { text }, (result) => resolve(result ?? { error: 'Not connected.' }));
  }), []);
  const leaveMeeting = useCallback(async () => {
    await api.post(`/meetings/${encodeURIComponent(roomId)}/leave`).catch(() => {});
    socketRef.current?.disconnect();
  }, [roomId]);

  return { localStream, remoteStreams, participants, messages, status, error, connected, micOn, cameraOn, toggleMic, toggleCamera, sendMessage, leaveMeeting };
}