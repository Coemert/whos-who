import React from 'react';
import { useStore } from '../store';
import { socket } from '../socket';
import { getPlayerColor } from '../components/PlayerChip';

export default function EndScreen() {
  const { lobby, myPlayerId } = useStore();
  const isHost = lobby.hostId === myPlayerId;

  function playAgain() {
    socket.emit('game:backToLobby', { code: lobby.code });
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth:520, textAlign:'center' }}>

        {/* Confetti-ish decorative circles */}
        {Array.from({ length: 8 }, (_, i) => {
          const angle = (i / 8) * 2 * Math.PI;
          const dist  = 160;
          return (
            <div
              key={i}
              style={{
                position:'absolute',
                top:`calc(50% + ${Math.sin(angle) * dist}px)`,
                left:`calc(50% + ${Math.cos(angle) * dist}px)`,
                width: 20 + (i % 3) * 12,
                height: 20 + (i % 3) * 12,
                borderRadius:'50%',
                background:`var(--bub-${['a','b','c','d','e','f'][i % 6]})`,
                opacity:.7,
                animation:`float-${['a','b','c'][i % 3]} ${3+i*.3}s ${i*.2}s ease-in-out infinite`,
                pointerEvents:'none',
              }}
            />
          );
        })}

        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ fontSize:'4rem', marginBottom:'1rem', animation:'popIn .5s ease' }}>🎉</div>

          <div className="logo mb-2" style={{ fontSize:'2.8rem' }}>
            Who<span>?</span>
          </div>

          <p style={{ fontSize:'1.3rem', fontWeight:800, marginBottom:'2rem' }}>
            That's a wrap! Great game everyone.
          </p>

          <div className="card" style={{ marginBottom:'1.5rem', animation:'fadeInUp .4s ease' }}>
            <h3 style={{ marginBottom:'1rem' }}>Players</h3>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'.5rem', justifyContent:'center' }}>
              {lobby.players.map((p, i) => (
                <div
                  key={p.id}
                  style={{
                    display:'flex', alignItems:'center', gap:'.5rem',
                    padding:'.4rem .9rem', borderRadius:100,
                    background:'var(--surface-2)', border:'2px solid var(--border)',
                    fontWeight:700,
                  }}
                >
                  <div
                    style={{
                      width:24, height:24, borderRadius:'50%',
                      background:getPlayerColor(i),
                      display:'flex', alignItems:'center', justifyContent:'center',
                      color:'#fff', fontWeight:900, fontSize:'.7rem',
                    }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  {p.name}{p.id === myPlayerId ? ' (you)' : ''}
                </div>
              ))}
            </div>
          </div>

          {isHost ? (
            <div className="flex-col gap-2 items-center">
              <button className="btn btn-primary btn-xl" onClick={playAgain}>
                ↺ Play another round
              </button>
              <p className="text-muted text-sm" style={{ fontWeight:600 }}>
                Lobby stays open — same code, same players
              </p>
            </div>
          ) : (
            <p className="text-muted" style={{ fontWeight:700 }}>
              The host can start another round from the lobby.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
