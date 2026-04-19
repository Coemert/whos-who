import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { socket } from '../socket';
import PlayerChip, { getPlayerColor } from '../components/PlayerChip';

export default function Answering() {
  const { lobby, myPlayerId } = useStore();
  const isHost = lobby.hostId === myPlayerId;
  const round  = lobby.currentRound;
  const me     = lobby.players.find((p) => p.id === myPlayerId);

  const [answer, setAnswer]   = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]     = useState('');

  const myHasAnswered = lobby.players.find((p) => p.id === myPlayerId)?.hasAnswered;

  // Reset when question changes
  useEffect(() => {
    setAnswer('');
    setSubmitted(false);
    setError('');
  }, [lobby.currentQuestionIndex]);

  // Sync submitted from server-side hasAnswered
  useEffect(() => {
    if (myHasAnswered) setSubmitted(true);
  }, [myHasAnswered]);

  function submit(e) {
    e.preventDefault();
    if (!answer.trim()) return;
    socket.emit('answer:submit', { code: lobby.code, playerId: myPlayerId, answer: answer.trim() });
    setSubmitted(true);
  }

  function forceNext() {
    socket.emit('game:forceNext', { code: lobby.code });
  }

  const totalPlayers = lobby.players.filter((p) => p.isConnected).length;
  const answered     = lobby.players.filter((p) => p.hasAnswered).length;

  return (
    <div className="page">
      <div className="container" style={{ maxWidth:580 }}>

        {/* Progress */}
        <div className="flex items-center justify-between mb-3" style={{ gap:'1rem' }}>
          <div className="logo" style={{ fontSize:'1.6rem' }}>Who<span>?</span></div>
          <div style={{ flex:1 }}>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width:`${((lobby.currentQuestionIndex + 1) / lobby.totalQuestions) * 100}%` }}
              />
            </div>
            <p className="text-muted text-sm" style={{ fontWeight:600, marginTop:'.25rem', textAlign:'right' }}>
              Question {lobby.currentQuestionIndex + 1} / {lobby.totalQuestions}
            </p>
          </div>
        </div>

        {/* Question card */}
        <div className="card" style={{ textAlign:'center', animation:'fadeInUp .4s ease' }}>
          <p className="text-muted" style={{ fontWeight:700, fontSize:'.85rem', letterSpacing:'.06em', marginBottom:'.75rem' }}>
            QUESTION
          </p>
          <h2 style={{ fontSize:'1.6rem', lineHeight:1.3, marginBottom:'1.5rem' }}>
            {lobby.currentQuestion?.text}
          </h2>

          {!submitted ? (
            <form onSubmit={submit} className="flex-col gap-2">
              <input
                className="input"
                placeholder="Your answer…"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                autoFocus
                style={{ textAlign:'center', fontSize:'1.05rem' }}
              />
              {error && <p style={{ color:'#ff4757', fontWeight:700 }}>{error}</p>}
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={!answer.trim()}
                style={{ margin:'0 auto' }}
              >
                Submit answer →
              </button>
            </form>
          ) : (
            <div style={{ animation:'popIn .4s ease' }}>
              <div
                style={{
                  display:'inline-flex', alignItems:'center', gap:'.6rem',
                  padding:'1rem 1.75rem', borderRadius:100,
                  background:'var(--primary-dim)', color:'var(--primary)',
                  fontWeight:800, fontSize:'1.05rem', marginBottom:'1rem',
                }}
              >
                ✓ Answer submitted!
              </div>
              <p className="text-muted" style={{ fontWeight:600 }}>
                Waiting for others…
              </p>
            </div>
          )}
        </div>

        {/* Who's answered */}
        <div className="card card-sm" style={{ marginTop:'1rem' }}>
          <div className="flex items-center justify-between mb-2">
            <p style={{ fontWeight:800, fontSize:'.9rem' }}>
              Answered: {answered} / {totalPlayers}
            </p>
            {isHost && answered >= 2 && answered < totalPlayers && (
              <button className="btn btn-ghost btn-sm" onClick={forceNext}>
                Skip waiting →
              </button>
            )}
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'.5rem' }}>
            {lobby.players.filter(p => p.isConnected).map((p, i) => (
              <PlayerChip
                key={p.id}
                player={{ ...p, isConnected: true }}
                index={i}
                isMe={p.id === myPlayerId}
                style={{
                  borderColor: p.hasAnswered ? 'var(--accent)' : undefined,
                  background:  p.hasAnswered ? 'rgba(67,198,172,.1)' : undefined,
                }}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
