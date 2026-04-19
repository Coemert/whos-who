import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { useStore } from '../store';
import { socket } from '../socket';
import { getPlayerColor } from '../components/PlayerChip';

export default function EndScreen() {
  const { lobby, myPlayerId, revealHistory } = useStore();
  const isHost    = lobby.hostId === myPlayerId;
  const snapRef   = useRef(null);
  const [saving, setSaving] = useState(false);

  function playAgain() {
    socket.emit('game:backToLobby', { code: lobby.code });
  }

  async function saveAsImage() {
    if (!snapRef.current || saving) return;
    setSaving(true);
    try {
      const canvas = await html2canvas(snapRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,          // retina quality
        useCORS: true,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = 'who-summary.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('Screenshot failed', e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page no-print" style={{ alignItems: 'stretch', justifyContent: 'flex-start', paddingTop: '2rem' }}>

      {/* Screen header */}
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '.4rem', animation: 'popIn .5s ease' }}>🎉</div>
        <div className="logo" style={{ fontSize: '2.2rem' }}>Who<span>?</span></div>
        <p style={{ fontWeight: 700, color: 'var(--text-muted)', marginTop: '.3rem' }}>
          That's a wrap!
        </p>
      </div>

      <div className="container" style={{ maxWidth: 680 }}>

        {/* ── Snapshot panel ─────────────────────────────────────────────────
            This is what gets turned into an image. Hard-coded light colours
            so the PNG always looks clean regardless of active theme.        */}
        <div
          ref={snapRef}
          style={{
            background: '#ffffff',
            borderRadius: 16,
            padding: '28px 32px 24px',
            fontFamily: "'Nunito', sans-serif",
            color: '#1a1a2e',
          }}
        >
          {/* Snapshot header */}
          <div style={{ textAlign: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '2px solid #eeeaf8' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#6c63ff', letterSpacing: '-.02em' }}>
              Who<span style={{ color: '#ff6584' }}>?</span>
            </div>
            <div style={{ fontSize: 13, color: '#9590c0', fontWeight: 700, marginTop: 4 }}>
              {lobby.players.map((p) => p.name).join(' · ')}
            </div>
          </div>

          {/* Questions + answers */}
          {revealHistory.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#9590c0', fontWeight: 600 }}>
              No results yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {revealHistory.map((round, qi) => {
                const sorted = [...round.results].sort((a, b) => b.correctPercentage - a.correctPercentage);
                return (
                  <div key={round.question.id}>
                    {/* Question label */}
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#6c63ff', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                        Q{qi + 1}
                      </span>
                      <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2, color: '#1a1a2e' }}>
                        {round.question.text}
                      </div>
                    </div>

                    {/* Answer rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {sorted.map((entry, i) => {
                        const playerIdx = lobby.players.findIndex((p) => p.id === entry.playerId);
                        const color     = getPlayerColor(playerIdx >= 0 ? playerIdx : i);
                        const pct       = entry.correctPercentage;
                        const barColor  = pct >= 70 ? '#43c6ac' : pct >= 40 ? '#6c63ff' : '#ff6584';

                        return (
                          <div
                            key={entry.answerId}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '26px 1fr 52px 36px',
                              alignItems: 'center',
                              gap: 8,
                              padding: '7px 10px',
                              borderRadius: 8,
                              background: '#f4f2fc',
                            }}
                          >
                            {/* Avatar dot */}
                            <div style={{
                              width: 26, height: 26, borderRadius: '50%',
                              background: color, flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#fff', fontWeight: 900, fontSize: 11,
                            }}>
                              {entry.playerName.charAt(0).toUpperCase()}
                            </div>

                            {/* Name → answer */}
                            <div style={{ fontSize: 13, lineHeight: 1.3, minWidth: 0 }}>
                              <span style={{ fontWeight: 800 }}>{entry.playerName}</span>
                              <span style={{ color: '#9590c0', fontWeight: 600 }}> → {entry.answer}</span>
                            </div>

                            {/* Mini bar */}
                            <div style={{ height: 5, borderRadius: 100, background: '#e0ddf4', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 100 }} />
                            </div>

                            {/* Percentage */}
                            <div style={{ fontSize: 12, fontWeight: 900, color: barColor, textAlign: 'right' }}>
                              {pct}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Snapshot footer */}
          <div style={{ marginTop: 20, paddingTop: 12, borderTop: '1px solid #eeeaf8', textAlign: 'center', fontSize: 11, color: '#c0b8e0', fontWeight: 700 }}>
            played at who-production.up.railway.app
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary btn-lg"
            onClick={saveAsImage}
            disabled={saving || revealHistory.length === 0}
          >
            {saving ? 'Saving…' : '📸 Save as image'}
          </button>
          {isHost ? (
            <button className="btn btn-primary btn-lg" onClick={playAgain}>
              ↺ Play another round
            </button>
          ) : (
            <p className="text-muted" style={{ fontWeight: 600, alignSelf: 'center' }}>
              Waiting for host to start a new round…
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
