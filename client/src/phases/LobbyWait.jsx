import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { socket } from '../socket';
import PlayerChip, { getPlayerColor } from '../components/PlayerChip';

export default function LobbyWait() {
  const { lobby, myPlayerId } = useStore();
  const isHost = lobby.hostId === myPlayerId;

  const [newQ, setNewQ]       = useState('');
  const [error, setError]     = useState('');
  const [toast, setToast]     = useState('');
  const fileRef               = useRef(null);

  useEffect(() => {
    const handle = ({ message }) => setError(message);
    socket.on('error:game', handle);
    return () => socket.off('error:game', handle);
  }, []);

  const shareUrl = `${window.location.origin}/join/${lobby.code}`;

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).then(() => showToast('Link copied!'));
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  function addQuestion(e) {
    e.preventDefault();
    if (!newQ.trim()) return;
    socket.emit('questions:add', { code: lobby.code, text: newQ.trim() });
    setNewQ('');
  }

  function removeQuestion(id) {
    socket.emit('questions:remove', { code: lobby.code, questionId: id });
  }

  function startGame() {
    setError('');
    socket.emit('game:start', { code: lobby.code });
  }

  function importFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target.result);
        const questions = Array.isArray(json) ? json : json.questions;
        if (!questions) throw new Error('Expected { questions: [...] } or a plain array.');
        socket.emit('questions:import', { code: lobby.code, questions });
        showToast(`Imported ${questions.length} questions`);
      } catch (err) {
        setError('Invalid JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function kickPlayer(targetPlayerId, targetName) {
    if (!window.confirm(`Remove "${targetName}" from the lobby?`)) return;
    socket.emit('player:kick', { code: lobby.code, hostId: myPlayerId, targetPlayerId });
  }

  function exportQuestions() {
    const blob = new Blob(
      [JSON.stringify({ questions: lobby.questions.map((q) => q.text) }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'who-questions.json';
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="page" style={{ alignItems:'stretch' }}>
      {toast && <div className="toast">{toast}</div>}

      <div className="container" style={{ maxWidth:720 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3" style={{ flexWrap:'wrap', gap:'.75rem' }}>
          <div>
            <div className="logo" style={{ fontSize:'2rem' }}>Who<span>?</span></div>
            <p className="text-muted" style={{ fontWeight:600 }}>Waiting for everyone to join…</p>
          </div>

          <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={copyLink}>
              📋 Copy link
            </button>
            <div
              style={{
                padding:'.4rem .9rem', borderRadius:100,
                background:'var(--surface)', border:'2px solid var(--border)',
                fontWeight:900, fontSize:'1.1rem', letterSpacing:'.12em',
                color:'var(--primary)',
              }}
            >
              {lobby.code}
            </div>
          </div>
        </div>

        <div style={{ display:'grid', gap:'1.25rem', gridTemplateColumns:'1fr 1fr' }}>

          {/* Players */}
          <div className="card">
            <h3 style={{ marginBottom:'1rem' }}>
              Players{' '}
              <span className="badge badge-primary">{lobby.players.length}</span>
            </h3>
            <div className="flex-col gap-1">
              {lobby.players.map((p, i) => (
                <div key={p.id} style={{ display:'flex', alignItems:'center', gap:'.4rem' }}>
                  <PlayerChip
                    player={p}
                    index={i}
                    isMe={p.id === myPlayerId}
                    style={{ flex:1 }}
                  />
                  {isHost && p.id !== myPlayerId && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => kickPlayer(p.id, p.name)}
                      title={`Remove ${p.name}`}
                      style={{ padding:'.3rem .65rem', flexShrink:0 }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Questions */}
          <div className="card flex-col" style={{ gap:'1rem' }}>
            <div className="flex items-center justify-between">
              <h3>
                Questions{' '}
                <span className="badge badge-primary">{lobby.questions?.length || 0}</span>
              </h3>
              {isHost && lobby.questions?.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={exportQuestions}>
                  ↓ Export
                </button>
              )}
            </div>

            {isHost ? (
              <>
                <form onSubmit={addQuestion} style={{ display:'flex', gap:'.5rem' }}>
                  <input
                    className="input"
                    placeholder="Type a question…"
                    value={newQ}
                    onChange={(e) => setNewQ(e.target.value)}
                    style={{ flex:1 }}
                  />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={!newQ.trim()}>
                    +
                  </button>
                </form>

                <div className="flex-col gap-1" style={{ maxHeight:220, overflowY:'auto' }}>
                  {(lobby.questions || []).map((q, i) => (
                    <div
                      key={q.id}
                      style={{
                        display:'flex', alignItems:'center', gap:'.5rem',
                        padding:'.4rem .65rem', borderRadius:'.6rem',
                        background:'var(--surface-2)', animation:'fadeInUp .25s ease',
                      }}
                    >
                      <span
                        style={{
                          fontWeight:800, fontSize:'.78rem',
                          color:'var(--text-muted)', minWidth:'1.2rem',
                        }}
                      >
                        {i + 1}.
                      </span>
                      <span style={{ flex:1, fontSize:'.9rem', fontWeight:600 }}>{q.text}</span>
                      <button
                        onClick={() => removeQuestion(q.id)}
                        style={{
                          background:'none', border:'none', cursor:'pointer',
                          color:'var(--text-muted)', fontSize:'1rem', lineHeight:1,
                          padding:'.1rem .3rem', borderRadius:'.3rem',
                        }}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {(!lobby.questions || lobby.questions.length === 0) && (
                    <p className="text-muted text-sm" style={{ padding:'.5rem', fontWeight:600 }}>
                      No questions yet. Add some above or import a file.
                    </p>
                  )}
                </div>

                <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap' }}>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".json"
                    style={{ display:'none' }}
                    onChange={importFile}
                  />
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => fileRef.current?.click()}
                  >
                    ↑ Import JSON
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-col gap-1" style={{ maxHeight:240, overflowY:'auto' }}>
                {(lobby.questions || []).length === 0 ? (
                  <p className="text-muted text-sm" style={{ fontWeight:600 }}>
                    The host is adding questions…
                  </p>
                ) : (
                  (lobby.questions || []).map((q, i) => (
                    <div
                      key={q.id}
                      style={{
                        padding:'.4rem .65rem', borderRadius:'.6rem',
                        background:'var(--surface-2)', fontSize:'.9rem', fontWeight:600,
                      }}
                    >
                      <span style={{ color:'var(--text-muted)', fontWeight:800, marginRight:'.4rem' }}>
                        {i + 1}.
                      </span>
                      {q.text}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Start */}
        {isHost && (
          <div style={{ marginTop:'1.5rem', textAlign:'center' }}>
            {error && (
              <p style={{ color:'#ff4757', fontWeight:700, marginBottom:'.75rem' }}>
                {error}
              </p>
            )}
            <button
              className="btn btn-primary btn-xl"
              onClick={startGame}
              disabled={!lobby.questions?.length || lobby.players.length < 2}
            >
              Start game →
            </button>
            <p className="text-muted text-sm mt-1" style={{ fontWeight:600 }}>
              {lobby.players.length < 2
                ? 'Waiting for at least 2 players…'
                : !lobby.questions?.length
                ? 'Add at least one question first.'
                : `${lobby.players.filter(p=>p.isConnected).length} player${lobby.players.filter(p=>p.isConnected).length !== 1 ? 's' : ''} ready`}
            </p>
          </div>
        )}

        {!isHost && (
          <p className="text-muted text-center mt-4" style={{ fontWeight:600 }}>
            Waiting for the host to start…
          </p>
        )}
      </div>
    </div>
  );
}
