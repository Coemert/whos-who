import React from 'react';
import { useStore } from '../store';
import { socket } from '../socket';
import { getPlayerColor } from '../components/PlayerChip';

const BG_VARS = ['--bub-a','--bub-b','--bub-c','--bub-d','--bub-e','--bub-f'];

function PercentageRing({ pct, size = 72 }) {
  const r        = (size - 8) / 2;
  const circ     = 2 * Math.PI * r;
  const filled   = (pct / 100) * circ;
  const color    = pct >= 70 ? 'var(--accent)' : pct >= 40 ? 'var(--primary)' : 'var(--secondary)';

  return (
    <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={7} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={7}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        style={{ transition:'stroke-dasharray .8s ease' }}
      />
      <text
        x={size/2} y={size/2}
        textAnchor="middle" dominantBaseline="central"
        style={{
          transform:`rotate(90deg) translate(0, -${size}px)`,
          transformOrigin:`${size/2}px ${size/2}px`,
          fill:'var(--text)', fontFamily:'Nunito,sans-serif',
          fontSize:13, fontWeight:900,
        }}
      >
        {pct}%
      </text>
    </svg>
  );
}

export default function Reveal() {
  const { lobby, myPlayerId, revealData } = useStore();
  const isHost     = lobby.hostId === myPlayerId;
  const revealIdx  = lobby.revealIndex ?? -1;

  if (!revealData) {
    return (
      <div className="page">
        <div className="spinner" />
        <p className="text-muted mt-3" style={{ fontWeight:600 }}>Loading results…</p>
      </div>
    );
  }

  const { question, results } = revealData;
  // results sorted ascending (most surprising first)
  const revealed = results.slice(0, revealIdx + 1);
  const allRevealed = revealIdx >= results.length - 1;

  // Standard competition rank: entries with the same % share a rank.
  // Number of entries with a strictly higher % determines the rank.
  const rankOf = (entry) =>
    results.filter((r) => r.correctPercentage > entry.correctPercentage).length + 1;

  function nextReveal() {
    socket.emit('reveal:next', { code: lobby.code });
  }

  function nextQuestion() {
    socket.emit('game:nextQuestion', { code: lobby.code });
  }

  return (
    <div className="page" style={{ alignItems:'stretch' }}>
      <div className="container" style={{ maxWidth:680 }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-3" style={{ flexWrap:'wrap', gap:'.75rem' }}>
          <div className="logo" style={{ fontSize:'1.6rem' }}>Who<span>?</span></div>
          <div style={{ textAlign:'right' }}>
            <span className="badge badge-primary">
              Q {lobby.currentQuestionIndex + 1} / {lobby.totalQuestions}
            </span>
          </div>
        </div>

        {/* Question */}
        <div
          className="card text-center"
          style={{ marginBottom:'1.25rem', padding:'1.25rem' }}
        >
          <p className="text-muted" style={{ fontWeight:700, fontSize:'.8rem', letterSpacing:'.06em', marginBottom:'.4rem' }}>
            THE QUESTION WAS
          </p>
          <h2 style={{ fontSize:'1.5rem' }}>"{question.text}"</h2>
        </div>

        {/* Reveal initial prompt */}
        {revealIdx === -1 && (
          <div className="text-center" style={{ animation:'fadeInUp .4s ease' }}>
            <p style={{ fontSize:'1.1rem', fontWeight:700, marginBottom:'1rem', color:'var(--text-muted)' }}>
              {isHost
                ? `Ready to reveal ${results.length} answer${results.length !== 1 ? 's' : ''}?`
                : 'Waiting for the host to start the reveal…'}
            </p>
            {isHost && (
              <button className="btn btn-primary btn-xl" onClick={nextReveal}>
                Start reveal ▶
              </button>
            )}
          </div>
        )}

        {/* Revealed entries */}
        <div className="flex-col gap-2">
          {revealed.map((entry, i) => {
            const playerIdx = lobby.players.findIndex((p) => p.id === entry.playerId);
            const color     = getPlayerColor(playerIdx >= 0 ? playerIdx : i);
            const bg        = `var(${BG_VARS[i % BG_VARS.length]})`;
            const isLastRevealed = i === revealed.length - 1;

            return (
              <div
                key={entry.answerId}
                className="card reveal-entry"
                style={{
                  display:'grid',
                  gridTemplateColumns:'auto 1fr auto',
                  gap:'1rem', alignItems:'center',
                  padding:'1.1rem 1.4rem',
                  animationDelay:`${i * 0.05}s`,
                  borderLeft: isLastRevealed ? `4px solid ${color}` : '4px solid var(--border)',
                  transition:'border-color .4s',
                }}
              >
                {/* Rank */}
                <div
                  style={{
                    width:38, height:38, borderRadius:'50%',
                    background: bg, display:'flex', alignItems:'center',
                    justifyContent:'center', fontWeight:900, fontSize:'.9rem',
                    flexShrink:0,
                  }}
                >
                  #{rankOf(entry)}
                </div>

                {/* Answer + player */}
                <div>
                  <p style={{ fontWeight:900, fontSize:'1.1rem', marginBottom:'.2rem' }}>
                    "{entry.answer}"
                  </p>
                  <div style={{ display:'flex', alignItems:'center', gap:'.4rem' }}>
                    <div
                      style={{
                        width:18, height:18, borderRadius:'50%',
                        background:color, flexShrink:0,
                      }}
                    />
                    <span style={{ fontWeight:700, color:'var(--text-muted)', fontSize:'.9rem' }}>
                      {entry.playerName}
                      {entry.playerId === myPlayerId ? ' (you)' : ''}
                    </span>
                  </div>
                </div>

                {/* Percentage ring */}
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'.2rem' }}>
                  <PercentageRing pct={entry.correctPercentage} />
                  <span style={{ fontSize:'.72rem', fontWeight:700, color:'var(--text-muted)', whiteSpace:'nowrap' }}>
                    {entry.correct}/{entry.total} knew
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Host controls */}
        {isHost && revealIdx >= 0 && (
          <div className="text-center mt-4">
            {!allRevealed ? (
              <button className="btn btn-primary btn-xl" onClick={nextReveal}>
                Next reveal ▶
              </button>
            ) : (
              <div className="flex-col gap-2 items-center">
                <p style={{ fontWeight:700, color:'var(--text-muted)' }}>
                  All {results.length} answers revealed!
                </p>
                <button className="btn btn-primary btn-xl" onClick={nextQuestion}>
                  {lobby.currentQuestionIndex + 1 >= lobby.totalQuestions
                    ? 'See final results →'
                    : 'Next question →'}
                </button>
              </div>
            )}
          </div>
        )}

        {!isHost && revealIdx >= 0 && !allRevealed && (
          <p className="text-center text-muted mt-3" style={{ fontWeight:600 }}>
            Waiting for the host to continue…
          </p>
        )}

        {!isHost && allRevealed && (
          <p className="text-center text-muted mt-3" style={{ fontWeight:600 }}>
            Waiting for the host to go to the next question…
          </p>
        )}

      </div>
    </div>
  );
}
