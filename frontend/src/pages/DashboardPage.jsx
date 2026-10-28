import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getErrorMessage } from '../services/api.js';
import { useAuth } from '../services/AuthContext.jsx';

function DashboardPage() {
  const { user, signOut } = useAuth();
  const [name, setName] = useState('Quick sync');
  const [roomId, setRoomId] = useState('');
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/meetings/history').then(({ data }) => setHistory(data.meetings)).catch((requestError) => setError(getErrorMessage(requestError)));
  }, []);

  async function createMeeting(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const { data } = await api.post('/meetings', { name });
      navigate(`/meeting/${data.meeting.roomId}`);
    } catch (requestError) { setError(getErrorMessage(requestError)); setBusy(false); }
  }

  function joinMeeting(event) {
    event.preventDefault();
    const id = roomId.trim();
    if (id) navigate(`/meeting/${encodeURIComponent(id)}`);
  }

  return (
    <main className="dashboard-shell">
      <header className="topbar"><div className="brand"><span className="brand-mark">M</span> MeetSpace</div><div className="topbar-user"><span className="avatar">{user?.name?.slice(0, 1).toUpperCase()}</span><span>{user?.name}</span><button className="text-button" onClick={signOut}>Sign out</button></div></header>
      <section className="welcome-row"><div><span className="kicker">YOUR MEETINGS</span><h1>Hi, {user?.name?.split(' ')[0]}.</h1><p className="muted">Start a room or pick up where you left off.</p></div><div className="date-chip">A good call starts here <span>↘</span></div></section>
      {error && <div className="alert dashboard-alert" role="alert">{error}</div>}
      <section className="action-grid">
        <article className="action-card create-card"><div className="icon-box purple">＋</div><span className="kicker">NEW ROOM</span><h2>Start a meeting</h2><p>Name the room now. You can share its code once you're in.</p><form className="inline-form" onSubmit={createMeeting}><input aria-label="Meeting name" value={name} maxLength="80" onChange={(event) => setName(event.target.value)} placeholder="e.g. Project catch-up" required /><button className="button button-primary" disabled={busy}>{busy ? 'Starting…' : 'Create room'} <span>→</span></button></form></article>
        <article className="action-card join-card"><div className="icon-box green">↗</div><span className="kicker">GOT AN INVITE?</span><h2>Join a room</h2><p>Paste the room code your host sent you.</p><form className="inline-form" onSubmit={joinMeeting}><input aria-label="Meeting ID" value={roomId} onChange={(event) => setRoomId(event.target.value)} placeholder="Room code" required /><button className="button button-dark">Join room <span>→</span></button></form></article>
      </section>
      <section className="history-section"><div className="section-heading"><div><span className="kicker">YOUR ROOM LIST</span><h2>Recent meetings</h2></div><span className="history-count">{history.length} {history.length === 1 ? 'meeting' : 'meetings'}</span></div>
        {history.length ? <div className="history-list">{history.map((meeting) => <button className="history-item" key={meeting.id} onClick={() => navigate(`/meeting/${meeting.roomId}`)}><span className="history-icon">◷</span><span className="history-info"><strong>{meeting.name}</strong><small>Room {meeting.roomId} · {new Date(meeting.createdAt).toLocaleString()}</small></span><span className="history-arrow">↗</span></button>)}</div> : <div className="empty-history"><span className="empty-icon">◷</span><strong>Your recent meetings will appear here.</strong><span>Start a new room or join a team using a room code.</span></div>}
      </section>
      <footer className="dashboard-footer">MeetSpace <span>·</span> Made for the conversations that move work forward.</footer>
    </main>
  );
}

export default DashboardPage;