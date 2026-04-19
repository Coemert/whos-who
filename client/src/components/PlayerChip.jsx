import React from 'react';

const COLORS = [
  '#6c63ff','#ff6584','#43c6ac','#ffa94d',
  '#74b9ff','#a29bfe','#fd79a8','#00b894',
  '#e17055','#0984e3','#6c5ce7','#00cec9',
];

export function getPlayerColor(index) {
  return COLORS[index % COLORS.length];
}

export function getInitial(name = '') {
  return name.trim().charAt(0).toUpperCase();
}

/**
 * A small chip showing a player's avatar dot + name.
 * Props: player, index, isMe, style, onClick, selected, dim
 */
export default function PlayerChip({ player, index = 0, isMe, style, onClick, selected, dim }) {
  const color = getPlayerColor(index);

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className="player-chip"
      style={{
        cursor: onClick ? 'pointer' : 'default',
        borderColor: selected ? 'var(--primary)' : undefined,
        background: selected ? 'var(--primary-dim)' : undefined,
        opacity: dim ? .45 : 1,
        ...style,
      }}
    >
      <div className="player-dot" style={{ background: color }}>
        {getInitial(player.name)}
      </div>
      <span>{player.name}{isMe ? ' (you)' : ''}</span>
      {!player.isConnected && (
        <span className="badge badge-muted" style={{ marginLeft: '.25rem', fontSize: '.7rem' }}>
          away
        </span>
      )}
      {player.isHost && (
        <span style={{ fontSize: '.8rem', marginLeft: '.1rem' }} title="Host">👑</span>
      )}
    </div>
  );
}
