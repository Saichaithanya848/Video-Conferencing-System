import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMeetingCall } from '../hooks/useMeetingCall.js';
import { api, getErrorMessage } from '../services/api.js';
import { useAuth } from '../services/AuthContext.jsx';

function VideoTile({ stream, label, muted = false, local = false, cameraOn = true }) {
  const videoRef = useRef(null);
  useEffect(() => { if (videoRef.current) videoRef.current.srcObject = stream || null; }, [stream]);
  return <article className={`video-tile ${local ? 'video-local' : ''}`}>
    {stream && (!local || cameraOn) ? <video ref={videoRef} autoPlay playsInline muted={muted} /> : <div className="video-placeholder"><span>{label?.slice(0, 1)?.toUpperCase() || '?'}</span><small>{local && !cameraOn ? 'Camera is off' : 'Camera unavailable'}</small></div>}
    <span className="video-label">{label}{local ? ' · You' : ''}</span>
  </article>;
}

function MeetingPage() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const token = localStorage.getItem('meetspace-token');
  const [meeting, setMeeting] = useState(null);
  const [roomError, setRoomError] = useState('');
  const [chatText, setChatText] = useState('');
  const [panel, setPanel] = useState('chat');
  const [chatError, setChatError] = useState('');
  const messagesEndRef = useRef(null);
  const call = useMeetingCall(roomId, token, Boolean(meeting) && !roomError);

  useEffect(() => {
    api.post(`/meetings/${encodeURIComponent(roomId)}/join`)
      .then(({ data }) => setMeeting(data.meeting))
      .catch((error) => setRoomError(getErrorMessage(error)));
  }, [roomId]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [call.messages]);

  async function sendChat(event) {
    event.preventDefault();
    const text = chatText.trim();
    if (!text) return;
    const result = await call.sendMessage(text);
    if (result?.error) { setChatError(result.error); return; }
    setChatText(''); setChatError('');
  }

  async function leave() { await call.leaveMeeting(); navigate('/', { replace: true }); }

  return <main className="meeting-shell">
    <header className="meeting-topbar"><button className="back-button" onClick={leave}>← <span>Leave room</span></button><div className="meeting-title"><strong>{meeting?.name || 'Meeting room'}</strong><small>Room ID: {roomId}</small></div><div className={`connection-pill ${call.connected ? 'online' : ''}`}><span />{roomError ? 'Room unavailable' : call.connected ? 'Server connected' : 'Connecting…'}</div></header>
    {(roomError || call.error) && <div className="meeting-alert" role="alert">{roomError || call.error}</div>}
    <section className="meeting-content">
      <div className="video-stage"><div className="stage-heading"><div><span className="kicker">LIVE ROOM</span><h1>{meeting?.name || 'Your meeting'}</h1></div><span className="status-label"><span className="status-dot" />{call.status}</span></div>
        <div className="video-grid"><VideoTile stream={call.localStream} label={user?.name || 'You'} muted local cameraOn={call.cameraOn} />{call.remoteStreams.map((item) => { const participant = call.participants.find((entry) => entry.id === item.peerId); return <VideoTile key={item.peerId} stream={item.stream} label={participant?.user?.name || 'Participant'} />; })}
          {!call.remoteStreams.length && <div className="waiting-tile"><span className="waiting-icon">⌁</span><strong>{call.connected ? 'Your room is ready' : 'Connecting to the meeting'}</strong><p>{call.connected ? 'Share this room ID with someone to start a call.' : call.status}</p></div>}
        </div>
        <div className="call-controls"><div className="control-group"><button className={`control-button ${!call.micOn ? 'control-off' : ''}`} onClick={call.toggleMic} disabled={!call.localStream} aria-label={call.micOn ? 'Mute microphone' : 'Turn microphone on'}><span>{call.micOn ? '♩' : '♩̸'}</span><small>{call.micOn ? 'Mute' : 'Unmute'}</small></button><button className={`control-button ${!call.cameraOn ? 'control-off' : ''}`} onClick={call.toggleCamera} disabled={!call.localStream} aria-label={call.cameraOn ? 'Turn camera off' : 'Turn camera on'}><span>{call.cameraOn ? '▣' : '▧'}</span><small>{call.cameraOn ? 'Camera' : 'Camera off'}</small></button></div><button className="button button-leave" onClick={leave}>× <span>Leave meeting</span></button></div>
        <p className="call-note">Audio and video use browser-to-browser WebRTC. This room currently supports best-effort one-to-one calling.</p>
      </div>
      <aside className="meeting-sidebar"><div className="sidebar-tabs"><button className={panel === 'chat' ? 'active' : ''} onClick={() => setPanel('chat')}>Chat <span>{call.messages.length || ''}</span></button><button className={panel === 'people' ? 'active' : ''} onClick={() => setPanel('people')}>People <span>{call.participants.length}</span></button></div>
        {panel === 'people' ? <div className="people-panel"><h2>In this meeting</h2>{call.participants.map((participant) => <div className="person-row" key={participant.id}><span className="avatar">{participant.user?.name?.slice(0, 1).toUpperCase()}</span><span>{participant.user?.name || 'Participant'}{participant.id === call.participants[0]?.id ? ' · You' : ''}</span></div>)}{!call.participants.length && <p className="muted">Waiting for participants to connect.</p>}</div> : <div className="chat-panel"><div className="chat-heading"><h2>Meeting chat</h2><p>Messages are shared with people in this room.</p></div><div className="message-list">{call.messages.map((message) => <article className="chat-message" key={message.id}><div><strong>{message.sender}</strong><time>{new Date(message.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div><p>{message.text}</p></article>)}{!call.messages.length && <div className="chat-empty"><span>✳</span><strong>Start the conversation</strong><small>Say hello to everyone in the meeting.</small></div>}<div ref={messagesEndRef} /></div><form className="chat-form" onSubmit={sendChat}><input aria-label="Write a message" value={chatText} maxLength="1000" onChange={(event) => setChatText(event.target.value)} placeholder="Write a message…" /><button aria-label="Send message" disabled={!chatText.trim()}>↑</button>{chatError && <small className="chat-error">{chatError}</small>}</form></div>}
      </aside>
    </section>
  </main>;
}

export default MeetingPage;