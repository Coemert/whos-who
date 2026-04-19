const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const gs = require('./gameState');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Allow same-origin and local dev Vite origin
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3001',
  process.env.CLIENT_ORIGIN,
].filter(Boolean);

const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true },
  // Sticky-session not needed for single-instance Railway deploy
});

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// ─── Static client ────────────────────────────────────────────────────────────
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ─── Socket helpers ──────────────────────────────────────────────────────────

function push(lobbyCode, event, data) {
  io.to(lobbyCode).emit(event, data);
}

function pushLobby(lobby) {
  push(lobby.code, 'lobby:update', gs.clientView(lobby));
}

// Tell every player (individually) which answerId is theirs so they can
// auto-assign + hide it from the voting pool.
function broadcastAnswerIds(lobby) {
  if (!lobby.currentRound?.answers) return;
  for (const answer of lobby.currentRound.answers) {
    const player = lobby.players.find((p) => p.id === answer.playerId);
    if (player?.socketId) {
      io.to(player.socketId).emit('my:answerId', { answerId: answer.answerId });
    }
  }
}

// Single-socket variant used on rejoin.
function sendMyAnswerId(lobby, playerId, targetSocket) {
  const answer = lobby.currentRound?.answers?.find((a) => a.playerId === playerId);
  if (answer) targetSocket.emit('my:answerId', { answerId: answer.answerId });
}

// ─── Socket handlers ──────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  const fail = (msg) => socket.emit('error:game', { message: msg });

  // ── Create lobby ─────────────────────────────────────────────────────────
  socket.on('lobby:create', ({ playerName, sessionToken } = {}) => {
    if (!playerName?.trim()) return fail('Name is required.');

    const { lobby, sessionToken: token } = gs.createLobby(playerName.trim(), null);
    const attached = gs.attachSocket(token, socket.id);
    if (!attached) return fail('Failed to create lobby.');

    socket.join(lobby.code);
    socket.emit('lobby:joined', {
      lobby: gs.clientView(attached.lobby),
      sessionToken: token,
      myPlayerId: token,
      rejoined: false,
    });
  });

  // ── Join / rejoin ─────────────────────────────────────────────────────────
  socket.on('lobby:join', ({ code, playerName, sessionToken } = {}) => {
    if (!code?.trim()) return fail('Lobby code is required.');
    if (!playerName?.trim()) return fail('Name is required.');

    const result = gs.joinLobby(code.trim(), playerName.trim(), sessionToken || null);
    if (result.error) return fail(result.error);

    const attached = gs.attachSocket(result.sessionToken, socket.id);
    if (!attached) return fail('Failed to connect to lobby.');

    socket.join(result.lobby.code);

    socket.emit('lobby:joined', {
      lobby: gs.clientView(attached.lobby),
      sessionToken: result.sessionToken,
      myPlayerId: result.sessionToken,
      rejoined: result.rejoined,
    });

    // Restore phase-specific data on rejoin
    if (result.rejoined) {
      const vp = gs.votingPayload(attached.lobby);
      if (vp) {
        socket.emit('voting:data', vp);
        sendMyAnswerId(attached.lobby, result.sessionToken, socket);
      }
      const rp = gs.revealPayload(attached.lobby);
      if (rp) socket.emit('reveal:data', rp);
    }

    // Notify room of player list change
    push(result.lobby.code, 'lobby:update', gs.clientView(attached.lobby));
  });

  socket.on('lobby:rejoin', ({ sessionToken } = {}) => {
    if (!sessionToken) return fail('Session token required.');

    const result = gs.rejoinByToken(sessionToken);
    if (result.error) return fail(result.error);

    const attached = gs.attachSocket(sessionToken, socket.id);
    if (!attached) return fail('Could not attach to lobby.');

    socket.join(result.lobby.code);
    socket.emit('lobby:joined', {
      lobby: gs.clientView(attached.lobby),
      sessionToken,
      myPlayerId: sessionToken,
      rejoined: true,
    });

    const vp = gs.votingPayload(attached.lobby);
    if (vp) {
      socket.emit('voting:data', vp);
      sendMyAnswerId(attached.lobby, sessionToken, socket);
    }
    const rp = gs.revealPayload(attached.lobby);
    if (rp) socket.emit('reveal:data', rp);

    push(result.lobby.code, 'lobby:update', gs.clientView(attached.lobby));
  });

  // ── Questions ─────────────────────────────────────────────────────────────
  socket.on('questions:add', ({ code, text } = {}) => {
    if (!text?.trim()) return fail('Question text is required.');
    const r = gs.addQuestion(code, text);
    if (r.error) return fail(r.error);
    pushLobby(r.lobby);
  });

  socket.on('questions:remove', ({ code, questionId } = {}) => {
    const r = gs.removeQuestion(code, questionId);
    if (r.error) return fail(r.error);
    pushLobby(r.lobby);
  });

  socket.on('questions:import', ({ code, questions } = {}) => {
    const r = gs.importQuestions(code, questions);
    if (r.error) return fail(r.error);
    pushLobby(r.lobby);
  });

  // ── Game control ──────────────────────────────────────────────────────────
  socket.on('game:start', ({ code } = {}) => {
    const r = gs.startGame(code);
    if (r.error) return fail(r.error);
    pushLobby(r.lobby);
  });

  socket.on('game:forceNext', ({ code } = {}) => {
    const r = gs.forceNextPhase(code);
    if (r.error) return fail(r.error);
    pushLobby(r.lobby);
    const vp = gs.votingPayload(r.lobby);
    if (vp) {
      push(r.lobby.code, 'voting:data', vp);
      broadcastAnswerIds(r.lobby);
    }
  });

  socket.on('game:nextQuestion', ({ code } = {}) => {
    const r = gs.nextQuestion(code);
    if (r.error) return fail(r.error);
    pushLobby(r.lobby);
  });

  socket.on('game:end', ({ code } = {}) => {
    const r = gs.endGame(code);
    if (r.error) return fail(r.error);
    pushLobby(r.lobby);
  });

  socket.on('game:backToLobby', ({ code } = {}) => {
    const r = gs.backToLobby(code);
    if (r.error) return fail(r.error);
    pushLobby(r.lobby);
  });

  // ── Kick ─────────────────────────────────────────────────────────────────
  socket.on('player:kick', ({ code, hostId, targetPlayerId } = {}) => {
    const r = gs.kickPlayer(code, hostId, targetPlayerId);
    if (r.error) return fail(r.error);

    // Tell the kicked socket it's been removed
    if (r.kickedSocketId) {
      io.to(r.kickedSocketId).emit('kicked');
    }

    // Broadcast updated lobby + any phase-advance data
    pushLobby(r.lobby);
    if (r.advancedVotingData) {
      push(r.lobby.code, 'voting:data', r.advancedVotingData);
      broadcastAnswerIds(r.lobby);
    }
    if (r.advancedRevealData) {
      push(r.lobby.code, 'reveal:data', r.advancedRevealData);
      const adv = gs.nextQuestion(r.lobby.code);
      if (!adv.error) pushLobby(adv.lobby);
    }
  });

  // ── Answering phase ───────────────────────────────────────────────────────
  socket.on('answer:submit', ({ code, playerId, answer } = {}) => {
    if (!answer?.trim()) return fail('Answer cannot be empty.');
    const r = gs.submitAnswer(code, playerId, answer.trim());
    if (r.error) return fail(r.error);

    pushLobby(r.lobby);

    if (r.allAnswered) {
      const vp = gs.votingPayload(r.lobby);
      if (vp) {
        push(r.lobby.code, 'voting:data', vp);
        broadcastAnswerIds(r.lobby);
      }
    }
  });

  // ── Voting phase ──────────────────────────────────────────────────────────
  socket.on('votes:submit', ({ code, playerId, assignments } = {}) => {
    if (!assignments || typeof assignments !== 'object') return fail('Invalid vote data.');
    const r = gs.submitVotes(code, playerId, assignments);
    if (r.error) return fail(r.error);

    pushLobby(r.lobby);

    if (r.allVoted) {
      // Emit results for client history accumulation (end screen), then skip straight past reveal
      const rp = gs.revealPayload(r.lobby);
      if (rp) push(r.lobby.code, 'reveal:data', rp);

      const adv = gs.nextQuestion(r.lobby.code);
      if (!adv.error) pushLobby(adv.lobby);
    }
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const r = gs.detachSocket(socket.id);
    if (r) {
      console.log(`[${r.lobby.code}] ${r.player.name} disconnected`);
      pushLobby(r.lobby);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Who? server running on :${PORT}`);
});
