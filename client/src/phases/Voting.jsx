import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { socket } from '../socket';
import Bubble from '../components/Bubble';
import { getPlayerColor, getInitial } from '../components/PlayerChip';

export default function Voting() {
  const { lobby, myPlayerId, votingData, myAnswerId } = useStore();

  // assignments: { [answerId]: playerId }
  const [assignments, setAssignments] = useState({});
  // click-to-assign: which answerId is currently "held"
  const [selectedId, setSelectedId]   = useState(null);
  // drag state
  const [draggingId, setDraggingId]   = useState(null);
  const [dragOverPlayerId, setDragOverPlayerId] = useState(null);
  const draggedIdRef = useRef(null); // kept in ref so drop handler always reads latest value
  const [submitted, setSubmitted]     = useState(false);

  const myHasVoted = lobby.players.find((p) => p.id === myPlayerId)?.hasVoted;

  useEffect(() => {
    if (myHasVoted) setSubmitted(true);
  }, [myHasVoted]);

  // Auto-assign own answer to self — server told us which answerId is ours.
  // This keeps the submission complete without showing the bubble in the UI.
  useEffect(() => {
    if (myAnswerId && myPlayerId) {
      setAssignments((prev) =>
        prev[myAnswerId] === myPlayerId ? prev : { ...prev, [myAnswerId]: myPlayerId }
      );
    }
  }, [myAnswerId, myPlayerId]);

  if (!votingData) {
    return (
      <div className="page">
        <div className="spinner" />
        <p className="text-muted mt-3" style={{ fontWeight: 600 }}>
          Loading voting data…
        </p>
      </div>
    );
  }

  const { answers, players } = votingData;

  // Hide the player's own answer — it's auto-assigned above, no need to see it.
  const displayAnswers = answers.filter((a) => a.answerId !== myAnswerId);
  const allAssigned = displayAnswers.every((a) => assignments[a.answerId]);

  // ── Shared assign/clear logic ──────────────────────────────────────────────

  function assign(answerId, playerId) {
    setAssignments((prev) => ({ ...prev, [answerId]: playerId }));
    setSelectedId(null);
  }

  function clearAssignment(answerId) {
    if (submitted) return;
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[answerId];
      return next;
    });
    setSelectedId(null);
  }

  // ── Click-to-assign ────────────────────────────────────────────────────────

  function handleBubbleClick(answerId) {
    if (submitted || draggingId) return;
    setSelectedId((prev) => (prev === answerId ? null : answerId));
  }

  function handlePlayerClick(playerId) {
    if (!selectedId || submitted) return;
    assign(selectedId, playerId);
  }

  // ── Drag-and-drop ──────────────────────────────────────────────────────────

  function handleDragStart(e, answerId) {
    draggedIdRef.current = answerId;
    setDraggingId(answerId);
    setSelectedId(null);
    e.dataTransfer.effectAllowed = 'move';
    // Optionally set a transparent drag image so the ghost is minimal
    const el = e.currentTarget;
    e.dataTransfer.setDragImage(el, el.offsetWidth / 2, el.offsetHeight / 2);
  }

  function handleDragEnd() {
    draggedIdRef.current = null;
    setDraggingId(null);
    setDragOverPlayerId(null);
  }

  function handleDragOver(e, playerId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverPlayerId(playerId);
  }

  function handleDragLeave() {
    setDragOverPlayerId(null);
  }

  function handleDrop(e, playerId) {
    e.preventDefault();
    setDragOverPlayerId(null);
    const aid = draggedIdRef.current;
    if (aid && !submitted) {
      assign(aid, playerId);
    }
    draggedIdRef.current = null;
    setDraggingId(null);
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  function submitVotes() {
    socket.emit('votes:submit', {
      code: lobby.code,
      playerId: myPlayerId,
      assignments,
    });
    setSubmitted(true);
  }

  // ── Waiting screen ─────────────────────────────────────────────────────────

  const answeredCount = lobby.players.filter((p) => p.hasVoted).length;
  const totalVoters   = lobby.players.filter((p) => p.isConnected).length;

  if (submitted) {
    return (
      <div className="page">
        <div className="container" style={{ maxWidth: 520, textAlign: 'center' }}>
          <div className="logo mb-3" style={{ fontSize: '2rem' }}>
            Who<span>?</span>
          </div>
          <div className="card" style={{ animation: 'popIn .4s ease' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗳️</div>
            <h2 style={{ marginBottom: '.5rem' }}>Votes submitted!</h2>
            <p className="text-muted" style={{ fontWeight: 600 }}>
              Waiting for everyone…{' '}
              <strong style={{ color: 'var(--primary)' }}>
                {answeredCount}/{totalVoters}
              </strong>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main voting UI ─────────────────────────────────────────────────────────

  const activeId = draggingId || selectedId; // which answer is "in flight"

  return (
    <div className="page" style={{ alignItems: 'stretch' }}>
      <div className="container" style={{ maxWidth: 740 }}>

        {/* Header */}
        <div
          className="flex items-center justify-between mb-3"
          style={{ flexWrap: 'wrap', gap: '.75rem' }}
        >
          <div>
            <div className="logo" style={{ fontSize: '1.6rem' }}>
              Who<span>?</span>
            </div>
            <p className="text-muted" style={{ fontWeight: 600 }}>
              Who wrote what?
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontWeight: 800, color: 'var(--primary)' }}>
              "{lobby.currentQuestion?.text}"
            </p>
            <p className="text-muted text-sm" style={{ fontWeight: 600 }}>
              Q {lobby.currentQuestionIndex + 1} / {lobby.totalQuestions}
            </p>
          </div>
        </div>

        {/* Instruction */}
        <p
          className="text-center text-muted"
          style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '.95rem' }}
        >
          {activeId
            ? draggingId
              ? `Drop onto a player card ↓`
              : `✦ Now click or drag to a player — "${displayAnswers.find((a) => a.answerId === activeId)?.text}"`
            : 'Drag or click an answer, then assign it to a player.'}
        </p>

        {/* ── Answer bubble pool ── */}
        <div
          style={{
            display: 'flex', flexWrap: 'wrap', gap: '1rem',
            justifyContent: 'center', marginBottom: '1.5rem',
            padding: '1.25rem', borderRadius: '1.2rem',
            background: 'var(--surface)', border: '1px solid var(--border)',
            minHeight: 110,
          }}
        >
          {displayAnswers.map((a, i) => {
            const isAssigned  = !!assignments[a.answerId];
            const isSelected  = selectedId === a.answerId;
            const isDraggingThis = draggingId === a.answerId;
            const assignedTo  = players.find((p) => p.id === assignments[a.answerId]);

            return (
              <div
                key={a.answerId}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.35rem' }}
              >
                <Bubble
                  index={i}
                  floating={!isAssigned && !isDraggingThis}
                  selected={isSelected}
                  assigned={isAssigned}
                  dragging={isDraggingThis}
                  /* click-to-assign */
                  onClick={() => isAssigned ? clearAssignment(a.answerId) : handleBubbleClick(a.answerId)}
                  /* drag-and-drop */
                  draggable={!isAssigned && !submitted}
                  onDragStart={(e) => handleDragStart(e, a.answerId)}
                  onDragEnd={handleDragEnd}
                >
                  {a.text}
                </Bubble>

                {assignedTo && (
                  <span
                    style={{
                      fontSize: '.75rem', fontWeight: 800,
                      color: 'var(--primary)', animation: 'fadeInUp .2s ease',
                      display: 'flex', alignItems: 'center', gap: '.3rem',
                    }}
                  >
                    <span
                      style={{
                        width: 12, height: 12, borderRadius: '50%',
                        background: getPlayerColor(players.findIndex((p) => p.id === assignedTo.id)),
                        display: 'inline-block', flexShrink: 0,
                      }}
                    />
                    {assignedTo.id === myPlayerId ? 'You' : assignedTo.name}
                    <button
                      onClick={() => clearAssignment(a.answerId)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', fontSize: '.8rem', padding: 0,
                        lineHeight: 1,
                      }}
                      title="Clear assignment"
                    >
                      ✕
                    </button>
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Player drop targets ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: '.75rem',
            marginBottom: '1.5rem',
          }}
        >
          {players.filter((p) => p.id !== myPlayerId).map((p, i) => {
            const isDropTarget     = dragOverPlayerId === p.id;
            const hasAssignment    = Object.values(assignments).includes(p.id);
            const isSelectionReady = !!selectedId && !submitted;
            const isMe             = p.id === myPlayerId;
            const color            = getPlayerColor(i);

            // Which answer is assigned to this player (for display)
            const assignedAnswerText = (() => {
              const aid = Object.keys(assignments).find((id) => assignments[id] === p.id);
              return aid ? answers.find((a) => a.answerId === aid)?.text : null;
            })();

            return (
              <div
                key={p.id}
                /* click-to-assign */
                onClick={() => handlePlayerClick(p.id)}
                /* drag-and-drop */
                onDragOver={(e) => handleDragOver(e, p.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, p.id)}
                style={{
                  padding: '.8rem .65rem',
                  borderRadius: '1rem',
                  border: `2px solid ${
                    isDropTarget
                      ? 'var(--accent)'
                      : hasAssignment
                      ? 'var(--primary)'
                      : isSelectionReady
                      ? 'var(--primary)'
                      : 'var(--border)'
                  }`,
                  background: isDropTarget
                    ? 'rgba(67,198,172,.12)'
                    : hasAssignment
                    ? 'var(--primary-dim)'
                    : 'var(--surface)',
                  cursor: (isSelectionReady || draggingId) ? 'pointer' : 'default',
                  transition: 'all .18s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.4rem',
                  transform: isDropTarget ? 'scale(1.04)' : isSelectionReady ? 'translateY(-1px)' : 'none',
                  boxShadow: isDropTarget
                    ? '0 0 0 3px rgba(67,198,172,.3), var(--shadow)'
                    : isSelectionReady
                    ? 'var(--shadow-sm)'
                    : 'none',
                  userSelect: 'none',
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 900, fontSize: '1.15rem',
                    boxShadow: isDropTarget ? `0 0 0 3px rgba(67,198,172,.4)` : 'none',
                    transition: 'box-shadow .18s',
                  }}
                >
                  {getInitial(p.name)}
                </div>

                {/* Name */}
                <span style={{ fontWeight: 800, fontSize: '.85rem', color: 'var(--text)', textAlign: 'center' }}>
                  {isMe ? 'You' : p.name}
                </span>

                {/* Assigned answer preview */}
                {assignedAnswerText ? (
                  <span
                    style={{
                      fontSize: '.72rem', color: 'var(--primary)', fontWeight: 700,
                      textAlign: 'center', lineHeight: 1.3,
                      animation: 'fadeInUp .2s ease',
                      maxWidth: 110, wordBreak: 'break-word',
                    }}
                  >
                    "{assignedAnswerText}"
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '.72rem', color: 'var(--text-muted)', fontWeight: 600,
                      opacity: isDropTarget || isSelectionReady ? 1 : 0.5,
                    }}
                  >
                    {isDropTarget ? 'Drop here ↓' : '— empty —'}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Submit */}
        <div style={{ textAlign: 'center' }}>
          <button
            className="btn btn-primary btn-xl"
            onClick={submitVotes}
            disabled={!allAssigned}
          >
            Submit votes →
          </button>
          <p className="text-muted text-sm mt-1" style={{ fontWeight: 600 }}>
            {allAssigned
              ? 'All answers assigned — ready!'
              : (() => {
                  const left = displayAnswers.filter((a) => !assignments[a.answerId]).length;
                  return `${left} answer${left !== 1 ? 's' : ''} still to assign`;
                })()}
          </p>
        </div>

      </div>
    </div>
  );
}
