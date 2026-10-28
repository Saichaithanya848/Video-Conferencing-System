import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../services/AuthContext.jsx';
import { getErrorMessage } from '../services/api.js';

function AuthPage({ initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isRegister = mode === 'register';

  async function handleSubmit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      await signIn(isRegister ? 'register' : 'login', { ...(isRegister ? { name } : {}), email, password });
      navigate(location.state?.from || '/', { replace: true });
    } catch (requestError) { setError(getErrorMessage(requestError)); }
    finally { setBusy(false); }
  }

  return (
    <main className="auth-layout">
      <section className="auth-aside">
        <div className="brand"><span className="brand-mark">M</span> MeetSpace</div>
        <div className="aside-copy"><span className="kicker">MEETSPACE · VIDEO ROOMS</span><h1>Make time<br />for a proper<br /><em>conversation.</em></h1><p>A simple place to meet, share ideas, and get on with your day.</p></div>
        <span className="aside-foot">No download. Just join.</span>
      </section>
      <section className="auth-main"><div className="auth-form-wrap">
        <p className="mobile-brand">MEETSPACE</p><span className="kicker">{isRegister ? 'YOUR ACCOUNT' : 'WELCOME BACK'}</span>
        <h2>{isRegister ? 'Create your account' : 'Sign in to MeetSpace'}</h2>
        <p className="muted">{isRegister ? 'A better way to meet starts here.' : 'Enter your details to continue to your workspace.'}</p>
        <form onSubmit={handleSubmit} className="form-stack">
          {isRegister && <label>Full name<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} minLength="2" maxLength="60" required placeholder="Your name" /></label>}
          <label>Email address<input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" /></label>
          <label>Password<input autoComplete={isRegister ? 'new-password' : 'current-password'} type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength="8" maxLength="72" required placeholder="At least 8 characters" /></label>
          {error && <div className="alert" role="alert">{error}</div>}
          <button className="button button-primary button-wide" disabled={busy}>{busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'} <span aria-hidden="true">→</span></button>
        </form>
        <p className="auth-switch">{isRegister ? 'Already have an account?' : 'New to MeetSpace?'}{' '}<Link to={isRegister ? '/login' : '/register'} onClick={() => setMode(isRegister ? 'login' : 'register')}>{isRegister ? 'Sign in' : 'Create an account'}</Link></p>
      </div></section>
    </main>
  );
}

export default AuthPage;