const { v4: uuidv4 } = require('uuid');
const { similarity } = require('./utils');

const lobbies = new Map();       // code -> lobby
const sessionToLobby = new Map(); // sessionToken -> lobbyCode
const DUPLICATE_THRESHOLD = 0.75;

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  } while (lobbies.has(code));
  return code;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Lobby lifecycle ─────────────────────────────────────────────────────────

function createLobby(hostName, reusedToken) {
  const code = generateCode();
  const hostId = reusedToken || uuidv4();

  const lobby = {
    code,
    hostId,
    phase: 'LOBBY',
    players: [
      {
        id: hostId,
        name: hostName.trim(),
        isHost: true,
        isConnected: false,
        socketId: null,
      },
    ],
    questions: [],
    currentQuestionIndex: -1,
    currentRound: null,
    createdAt: Date.now(),
  };

  lobbies.set(code, lobby);
  sessionToLobby.set(hostId, code);
  return { lobby, sessionToken: hostId };
}

function joinLobby(code, playerName, sessionToken) {
  const uc = code.toUpperCase();
  const lobby = lobbies.get(uc);
  if (!lobby) return { error: 'Lobby not found. Double-check the code.' };

  // Existing session — treat as rejoin regardless of phase
  if (sessionToken) {
    const existing = lobby.players.find((p) => p.id === sessionToken);
    if (existing) {
      return { lobby, sessionToken, player: existing, rejoined: true };
    }
  }

  if (lobby.phase !== 'LOBBY') {
    return { error: 'Game already started. Ask the host for a rejoin link.' };
  }

  const nameTaken = lobby.players.find(
    (p) => p.name.toLowerCase() === playerName.trim().toLowerCase()
  );
  if (nameTaken) return { error: 'That name is already taken. Pick another one.' };

  const playerId = uuidv4();
  const player = {
    id: playerId,
    name: playerName.trim(),
    isHost: false,
    isConnected: false,
    socketId: null,
  };

  lobby.players.push(player);
  sessionToLobby.set(playerId, uc);
  return { lobby, sessionToken: playerId, player, rejoined: false };
}

function rejoinByToken(sessionToken) {
  const code = sessionToLobby.get(sessionToken);
  if (!code) return { error: 'Session expired or not found. Please join again.' };
  const lobby = lobbies.get(code);
  if (!lobby) return { error: 'Lobby no longer exists.' };
  const player = lobby.players.find((p) => p.id === sessionToken);
  if (!player) return { error: 'Player not found in lobby.' };
  return { lobby, sessionToken, player, rejoined: true };
}

// ─── Socket management ───────────────────────────────────────────────────────

function attachSocket(sessionToken, socketId) {
  const code = sessionToLobby.get(sessionToken);
  if (!code) return null;
  const lobby = lobbies.get(code);
  if (!lobby) return null;
  const player = lobby.players.find((p) => p.id === sessionToken);
  if (!player) return null;
  player.socketId = socketId;
  player.isConnected = true;
  return { lobby, player };
}

function detachSocket(socketId) {
  for (const lobby of lobbies.values()) {
    const player = lobby.players.find((p) => p.socketId === socketId);
    if (player) {
      player.isConnected = false;
      player.socketId = null;
      return { lobby, player };
    }
  }
  return null;
}

// ─── Question management ─────────────────────────────────────────────────────

function addQuestion(code, text) {
  const lobby = lobbies.get(code);
  if (!lobby) return { error: 'Lobby not found' };
  lobby.questions.push({ id: uuidv4(), text: text.trim() });
  return { lobby };
}

function removeQuestion(code, questionId) {
  const lobby = lobbies.get(code);
  if (!lobby) return { error: 'Lobby not found' };
  lobby.questions = lobby.questions.filter((q) => q.id !== questionId);
  return { lobby };
}

function reorderQuestions(code, orderedIds) {
  const lobby = lobbies.get(code);
  if (!lobby) return { error: 'Lobby not found' };
  const map = new Map(lobby.questions.map((q) => [q.id, q]));
  lobby.questions = orderedIds.filter((id) => map.has(id)).map((id) => map.get(id));
  return { lobby };
}

function importQuestions(code, rawQuestions) {
  const lobby = lobbies.get(code);
  if (!lobby) return { error: 'Lobby not found' };
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0)
    return { error: 'Invalid questions format' };

  const parsed = rawQuestions
    .map((q) => (typeof q === 'string' ? q : q.text || q.question || ''))
    .filter(Boolean)
    .map((text) => ({ id: uuidv4(), text: text.trim() }));

  if (parsed.length === 0) return { error: 'No valid questions found in file' };
  lobby.questions = parsed;
  return { lobby };
}

// ─── Game flow ───────────────────────────────────────────────────────────────

function startGame(code) {
  const lobby = lobbies.get(code);
  if (!lobby) return { error: 'Lobby not found' };
  if (lobby.questions.length === 0) return { error: 'Add at least one question first.' };
  const connected = lobby.players.filter((p) => p.isConnected);
  if (connected.length < 2) return { error: 'Need at least 2 connected players to start.' };

  lobby.currentQuestionIndex = 0;
  lobby.phase = 'ANSWERING';
  lobby.currentRound = newRound(lobby, 0);
  return { lobby };
}

function newRound(lobby, qIndex) {
  return {
    questionIndex: qIndex,
    question: lobby.questions[qIndex],
    answers: [],        // { answerId, playerId, playerName, text }
    votingAnswers: null, // anonymised & shuffled, sent to clients
    votes: [],           // { voterId, assignments: { [answerId]: playerId } }
    duplicateGroups: [], // [[playerId, playerId], ...]
    results: null,       // computed after all voted
  };
}

function submitAnswer(code, playerId, text) {
  const lobby = lobbies.get(code);
  if (!lobby || lobby.phase !== 'ANSWERING') return { error: 'Not in answering phase.' };
  const player = lobby.players.find((p) => p.id === playerId);
  if (!player) return { error: 'Player not found.' };

  const round = lobby.currentRound;
  const existing = round.answers.find((a) => a.playerId === playerId);
  if (existing) {
    existing.text = text.trim();
  } else {
    round.answers.push({
      answerId: uuidv4(),
      playerId,
      playerName: player.name,
      text: text.trim(),
    });
  }

  const connected = lobby.players.filter((p) => p.isConnected);
  const allAnswered = connected.every((p) => round.answers.find((a) => a.playerId === p.id));

  if (allAnswered) toVoting(lobby);

  return { lobby, allAnswered };
}

function forceNextPhase(code) {
  // Host can force transition even if not all answered
  const lobby = lobbies.get(code);
  if (!lobby || lobby.phase !== 'ANSWERING') return { error: 'Not in answering phase.' };
  const round = lobby.currentRound;
  if (round.answers.length < 2) return { error: 'Need at least 2 answers to continue.' };
  toVoting(lobby);
  return { lobby };
}

function toVoting(lobby) {
  const round = lobby.currentRound;

  // Detect duplicate answer groups
  const processed = new Set();
  round.duplicateGroups = [];
  for (let i = 0; i < round.answers.length; i++) {
    if (processed.has(i)) continue;
    const group = [round.answers[i].playerId];
    for (let j = i + 1; j < round.answers.length; j++) {
      if (processed.has(j)) continue;
      if (similarity(round.answers[i].text, round.answers[j].text) >= DUPLICATE_THRESHOLD) {
        group.push(round.answers[j].playerId);
        processed.add(j);
      }
    }
    if (group.length > 1) round.duplicateGroups.push(group);
    processed.add(i);
  }

  // Anonymise and shuffle answers for clients
  round.votingAnswers = shuffle(
    round.answers.map((a) => ({ answerId: a.answerId, text: a.text }))
  );

  lobby.phase = 'VOTING';
}

function submitVotes(code, voterId, assignments) {
  // assignments: { [answerId]: guessedPlayerId }
  const lobby = lobbies.get(code);
  if (!lobby || lobby.phase !== 'VOTING') return { error: 'Not in voting phase.' };

  const round = lobby.currentRound;
  const existing = round.votes.find((v) => v.voterId === voterId);
  if (existing) {
    existing.assignments = assignments;
  } else {
    round.votes.push({ voterId, assignments });
  }

  const connected = lobby.players.filter((p) => p.isConnected);
  const allVoted = connected.every((p) => round.votes.find((v) => v.voterId === p.id));

  if (allVoted) {
    computeResults(lobby);
    lobby.phase = 'REVEAL';
  }

  return { lobby, allVoted };
}

function computeResults(lobby) {
  const round = lobby.currentRound;

  const results = round.answers.map((answer) => {
    const dupGroup = round.duplicateGroups.find((g) => g.includes(answer.playerId));
    const acceptableIds = dupGroup || [answer.playerId];

    let correct = 0;
    let total = 0;
    for (const vote of round.votes) {
      if (vote.voterId === answer.playerId) continue; // exclude self-vote
      total++;
      const guess = vote.assignments[answer.answerId];
      if (guess && acceptableIds.includes(guess)) correct++;
    }

    return {
      answerId: answer.answerId,
      playerId: answer.playerId,
      playerName: answer.playerName,
      answer: answer.text,
      correct,
      total,
      correctPercentage: total > 0 ? Math.round((correct / total) * 100) : 0,
    };
  });

  // Ascending: most surprising (low %) revealed first, most obvious (high %) last
  results.sort((a, b) => a.correctPercentage - b.correctPercentage);
  round.results = results;
  round.revealIndex = -1;
}


function nextQuestion(code) {
  const lobby = lobbies.get(code);
  if (!lobby) return { error: 'Lobby not found' };

  lobby.currentQuestionIndex++;
  if (lobby.currentQuestionIndex >= lobby.questions.length) {
    lobby.phase = 'ENDED';
    lobby.currentRound = null;
    return { lobby, ended: true };
  }

  lobby.phase = 'ANSWERING';
  lobby.currentRound = newRound(lobby, lobby.currentQuestionIndex);
  return { lobby, ended: false };
}

function endGame(code) {
  const lobby = lobbies.get(code);
  if (!lobby) return { error: 'Lobby not found' };
  lobby.phase = 'ENDED';
  lobby.currentRound = null;
  return { lobby };
}

function backToLobby(code) {
  const lobby = lobbies.get(code);
  if (!lobby) return { error: 'Lobby not found' };
  lobby.phase = 'LOBBY';
  lobby.currentQuestionIndex = -1;
  lobby.currentRound = null;
  // Remove any kicked players from the list on return to lobby
  lobby.players = lobby.players.filter((p) => !p.kicked);
  return { lobby };
}

function kickPlayer(code, hostId, targetPlayerId) {
  const lobby = lobbies.get(code);
  if (!lobby) return { error: 'Lobby not found' };
  if (lobby.hostId !== hostId) return { error: 'Only the host can kick players.' };
  if (targetPlayerId === hostId) return { error: 'You cannot kick yourself.' };

  const player = lobby.players.find((p) => p.id === targetPlayerId);
  if (!player) return { error: 'Player not found.' };

  const kickedSocketId = player.socketId;

  if (lobby.phase === 'LOBBY') {
    // Remove entirely during lobby — clean slate
    lobby.players = lobby.players.filter((p) => p.id !== targetPlayerId);
  } else {
    // During a game keep them in the list so answer/vote history is intact,
    // but mark as disconnected + kicked so they can't rejoin
    player.isConnected = false;
    player.socketId = null;
    player.kicked = true;
  }

  // Always revoke session so they can't sneak back in
  sessionToLobby.delete(targetPlayerId);

  // Re-evaluate phase transitions now that player count changed
  let advancedVotingData = null;
  let advancedRevealData = null;

  if (lobby.phase === 'ANSWERING') {
    const connected = lobby.players.filter((p) => p.isConnected);
    const round = lobby.currentRound;
    if (connected.length >= 1 && round.answers.length >= 2) {
      const allAnswered = connected.every((p) => round.answers.find((a) => a.playerId === p.id));
      if (allAnswered) {
        toVoting(lobby);
        advancedVotingData = votingPayload(lobby);
      }
    }
  } else if (lobby.phase === 'VOTING') {
    const connected = lobby.players.filter((p) => p.isConnected);
    const round = lobby.currentRound;
    if (connected.length >= 1) {
      const allVoted = connected.every((p) => round.votes.find((v) => v.voterId === p.id));
      if (allVoted) {
        computeResults(lobby);
        lobby.phase = 'REVEAL';
        advancedRevealData = revealPayload(lobby);
      }
    }
  }

  return { lobby, kickedSocketId, advancedVotingData, advancedRevealData };
}

// ─── Getters ─────────────────────────────────────────────────────────────────

function getLobby(code) {
  return lobbies.get(code?.toUpperCase());
}

/**
 * Returns a sanitised lobby object safe to send to clients.
 * Sensitive data (actual answers during ANSWERING, answer-player links during VOTING)
 * is omitted; phase-specific data is sent via separate events.
 */
function clientView(lobby) {
  if (!lobby) return null;

  const base = {
    code: lobby.code,
    hostId: lobby.hostId,
    phase: lobby.phase,
    players: lobby.players.map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      isConnected: p.isConnected,
    })),
    currentQuestionIndex: lobby.currentQuestionIndex,
    totalQuestions: lobby.questions.length,
    currentQuestion: lobby.currentRound?.question || null,
  };

  if (lobby.phase === 'LOBBY') {
    base.questions = lobby.questions;
  }

  if (lobby.phase === 'ANSWERING' && lobby.currentRound) {
    const answeredIds = new Set(lobby.currentRound.answers.map((a) => a.playerId));
    base.players = base.players.map((p) => ({ ...p, hasAnswered: answeredIds.has(p.id) }));
  }

  if (lobby.phase === 'VOTING' && lobby.currentRound) {
    const votedIds = new Set(lobby.currentRound.votes.map((v) => v.voterId));
    base.players = base.players.map((p) => ({ ...p, hasVoted: votedIds.has(p.id) }));
  }

  return base;
}

function votingPayload(lobby) {
  if (!lobby?.currentRound?.votingAnswers) return null;
  return {
    answers: lobby.currentRound.votingAnswers,
    players: lobby.players
      .filter((p) => p.isConnected)
      .map((p) => ({ id: p.id, name: p.name })),
  };
}

function revealPayload(lobby) {
  if (!lobby?.currentRound?.results) return null;
  return {
    question: lobby.currentRound.question,
    results: lobby.currentRound.results,
  };
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

setInterval(() => {
  const cutoff = Date.now() - 4 * 60 * 60 * 1000; // 4 hours
  for (const [code, lobby] of lobbies.entries()) {
    if (lobby.createdAt < cutoff) {
      lobby.players.forEach((p) => sessionToLobby.delete(p.id));
      lobbies.delete(code);
    }
  }
}, 15 * 60 * 1000);

module.exports = {
  createLobby,
  joinLobby,
  rejoinByToken,
  attachSocket,
  detachSocket,
  addQuestion,
  removeQuestion,
  reorderQuestions,
  importQuestions,
  startGame,
  submitAnswer,
  forceNextPhase,
  submitVotes,
  nextQuestion,
  endGame,
  backToLobby,
  kickPlayer,
  getLobby,
  clientView,
  votingPayload,
  revealPayload,
};
