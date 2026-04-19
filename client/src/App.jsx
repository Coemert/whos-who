import React, { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { socket } from './socket';
import { useStore } from './store';
import Home from './pages/Home';
import GameRoom from './pages/GameRoom';
import ThemePicker from './components/ThemePicker';

export default function App() {
  const navigate = useNavigate();
  const {
    theme,
    sessionToken,
    setSession,
    setLobby,
    setVotingData,
    setRevealData,
    setMyAnswerId,
    clearRevealHistory,
  } = useStore();

  // Apply theme attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Wire up socket once
  useEffect(() => {
    socket.connect();

    socket.on('lobby:joined', ({ lobby, sessionToken: token, myPlayerId, rejoined }) => {
      setSession(token, myPlayerId, useStore.getState().myName);
      setLobby(lobby);
      // navigate to game room if not already there
      navigate(`/lobby/${lobby.code}`, { replace: true });
    });

    socket.on('lobby:update', (lobby) => {
      setLobby(lobby);
      // Clear history when game resets to lobby so a new round starts fresh
      if (lobby.phase === 'LOBBY') clearRevealHistory();
    });

    socket.on('voting:data', (data) => {
      setVotingData(data);
    });

    socket.on('my:answerId', ({ answerId }) => {
      setMyAnswerId(answerId);
    });

    socket.on('reveal:data', (data) => {
      setRevealData(data);
    });

    socket.on('error:game', ({ message }) => {
      console.warn('[game error]', message);
    });

    // Kicked by host
    socket.on('kicked', () => {
      useStore.getState().clearSession();
      navigate('/', { replace: true, state: { kicked: true } });
    });

    // Auto-rejoin on reconnect
    socket.on('connect', () => {
      const { sessionToken: token } = useStore.getState();
      if (token) {
        socket.emit('lobby:rejoin', { sessionToken: token });
      }
    });

    return () => {
      socket.off('lobby:joined');
      socket.off('lobby:update');
      socket.off('voting:data');
      socket.off('my:answerId');
      socket.off('reveal:data');
      socket.off('error:game');
      socket.off('kicked');
      socket.off('connect');
    };
  }, [navigate, setSession, setLobby, setVotingData, setRevealData]);

  return (
    <>
      <ThemePicker />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join/:code" element={<Home />} />
        <Route path="/lobby/:code" element={<GameRoom />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </>
  );
}
