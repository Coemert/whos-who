import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { socket } from '../socket';
import { useStore } from '../store';

export default function Home() {
  const { code: prefilledCode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { myName, setSession, sessionToken, lobby, clearSession } = useStore();
  const wasKicked = location.state?.kicked;

  const [tab, setTab] = useState(prefilledCode ? 'join' : 'create');
  const [name, setName] = useState(myName || '');
  const [code, setCode] = useState(prefilledCode || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If we already have a live lobby, redirect straight in
  useEffect(() => {
    if (lobby) navigate(`/lobby/${lobby.code}`, { replace: true });
  }, [lobby, navigate]);

  useEffect(() => {
    const onError = ({ message }) => {
      setError(message);
      setLoading(false);
    };
    socket.on('error:game', onError);
    return () => socket.off('error:game', onError);
  }, []);

  function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Enter your name first.');
    setError('');
    setLoading(true);
    // Store name optimistically so App.jsx can pick it up
    useStore.setState({ myName: name.trim() });
    socket.emit('lobby:create', { playerName: name.trim() });
  }

  function handleJoin(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Enter your name first.');
    if (!code.trim()) return setError('Enter the lobby code.');
    setError('');
    setLoading(true);
    useStore.setState({ myName: name.trim() });
    socket.emit('lobby:join', {
      code: code.trim().toUpperCase(),
      playerName: name.trim(),
      sessionToken: sessionToken || null,
    });
  }

  const decoBubbles = [
    { top:'8%',  left:'5%',  size:90, bg:'var(--bub-a)', anim:'float-b', dur:'4.1s', del:'0s'   },
    { top:'15%', right:'8%', size:70, bg:'var(--bub-c)', anim:'float-a', dur:'3.7s', del:'.8s'  },
    { top:'65%', left:'3%',  size:60, bg:'var(--bub-d)', anim:'float-c', dur:'3.4s', del:'.3s'  },
    { top:'72%', right:'5%', size:80, bg:'var(--bub-b)', anim:'float-b', dur:'4.5s', del:'1.2s' },
    { top:'40%', left:'1%',  size:50, bg:'var(--bub-e)', anim:'float-a', dur:'3.9s', del:'.6s'  },
    { top:'45%', right:'2%', size:55, bg:'var(--bub-f)', anim:'float-c', dur:'3.2s', del:'1.5s' },
  ];

  return (
    <div className="page" style={{ position:'relative', overflow:'hidden' }}>
      {/* Background decorative bubbles */}
      {decoBubbles.map((b, i) => (
        <div
          key={i}
          style={{
            position:'absolute', width:b.size, height:b.size,
            borderRadius:'50%', background:b.bg, opacity:.55,
            top:b.top, left:b.left, right:b.right,
            animation:`${b.anim} ${b.dur} ${b.del} ease-in-out infinite`,
            pointerEvents:'none',
          }}
        />
      ))}

      <div className="container" style={{ maxWidth:480, position:'relative', zIndex:1 }}>
        {/* Kicked banner */}
        {wasKicked && (
          <div
            style={{
              background:'#ff4757', color:'#fff',
              padding:'.8rem 1.25rem', borderRadius:'.9rem',
              fontWeight:700, marginBottom:'1.25rem',
              animation:'fadeInUp .3s ease', textAlign:'center',
            }}
          >
            You were removed from the lobby by the host.
          </div>
        )}

        {/* Logo */}
        <div className="text-center mb-4">
          <div className="logo" style={{ fontSize:'3.5rem' }}>
            Who<span>?</span>
          </div>
          <p className="text-muted mt-1" style={{ fontSize:'1.05rem', fontWeight:600 }}>
            The game where you find out how well you really know each other.
          </p>
        </div>

        <div className="card" style={{ animation:'fadeInUp .4s ease' }}>
          {/* Tabs */}
          <div
            style={{
              display:'grid', gridTemplateColumns:'1fr 1fr',
              background:'var(--surface-2)', borderRadius:'0.75rem',
              padding:'.3rem', gap:'.3rem', marginBottom:'1.5rem',
            }}
          >
            {['create','join'].map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); }}
                style={{
                  padding:'.55rem', borderRadius:'.55rem', border:'none',
                  cursor:'pointer', fontFamily:'Nunito,sans-serif',
                  fontWeight:800, fontSize:'.95rem',
                  background: tab === t ? 'var(--surface)' : 'transparent',
                  color: tab === t ? 'var(--primary)' : 'var(--text-muted)',
                  boxShadow: tab === t ? 'var(--shadow-sm)' : 'none',
                  transition: 'all .2s',
                }}
              >
                {t === 'create' ? '✦ Create lobby' : '→ Join lobby'}
              </button>
            ))}
          </div>

          {tab === 'create' ? (
            <form onSubmit={handleCreate} className="flex-col gap-2">
              <div>
                <label style={{ fontWeight:700, display:'block', marginBottom:'.35rem' }}>
                  Your name
                </label>
                <input
                  className="input"
                  placeholder="What should we call you?"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={24}
                  autoFocus
                />
              </div>
              {error && <p style={{ color:'#ff4757', fontWeight:700, fontSize:'.9rem' }}>{error}</p>}
              <button
                type="submit"
                className="btn btn-primary btn-lg btn-full"
                disabled={loading}
                style={{ marginTop:'.5rem' }}
              >
                {loading ? 'Creating…' : '✦ Create lobby'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="flex-col gap-2">
              <div>
                <label style={{ fontWeight:700, display:'block', marginBottom:'.35rem' }}>
                  Your name
                </label>
                <input
                  className="input"
                  placeholder="What should we call you?"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={24}
                  autoFocus={!prefilledCode}
                />
              </div>
              <div>
                <label style={{ fontWeight:700, display:'block', marginBottom:'.35rem' }}>
                  Lobby code
                </label>
                <input
                  className="input"
                  placeholder="e.g. ABC123"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  autoFocus={!!prefilledCode}
                  style={{ letterSpacing:'.15em', fontWeight:800, fontSize:'1.1rem' }}
                />
              </div>
              {error && <p style={{ color:'#ff4757', fontWeight:700, fontSize:'.9rem' }}>{error}</p>}
              <button
                type="submit"
                className="btn btn-primary btn-lg btn-full"
                disabled={loading}
                style={{ marginTop:'.5rem' }}
              >
                {loading ? 'Joining…' : '→ Join lobby'}
              </button>
            </form>
          )}

          {sessionToken && (
            <p
              style={{
                marginTop:'1rem', fontSize:'.8rem', color:'var(--text-muted)',
                textAlign:'center', fontWeight:600,
              }}
            >
              Have an active session?{' '}
              <button
                onClick={() => socket.emit('lobby:rejoin', { sessionToken })}
                style={{
                  background:'none', border:'none', cursor:'pointer',
                  color:'var(--primary)', fontWeight:700, fontFamily:'Nunito,sans-serif',
                  fontSize:'.8rem',
                }}
              >
                Rejoin it
              </button>
              {' '}or{' '}
              <button
                onClick={() => clearSession()}
                style={{
                  background:'none', border:'none', cursor:'pointer',
                  color:'var(--text-muted)', fontWeight:700, fontFamily:'Nunito,sans-serif',
                  fontSize:'.8rem',
                }}
              >
                clear session
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
