import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { socket } from '../socket';
import LobbyWait from '../phases/LobbyWait';
import Answering  from '../phases/Answering';
import Voting     from '../phases/Voting';
import Reveal     from '../phases/Reveal';
import EndScreen  from '../phases/EndScreen';

export default function GameRoom() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { lobby, sessionToken, myPlayerId } = useStore();

  // If no lobby in store, try to rejoin with stored session, else kick to home
  useEffect(() => {
    if (!lobby) {
      if (sessionToken) {
        socket.emit('lobby:rejoin', { sessionToken });
      } else {
        navigate(`/join/${code}`, { replace: true });
      }
    }
  }, []); // only on mount

  // Ensure we're in the right lobby
  useEffect(() => {
    if (lobby && lobby.code !== code) {
      navigate(`/lobby/${lobby.code}`, { replace: true });
    }
  }, [lobby, code, navigate]);

  if (!lobby) {
    return (
      <div className="page">
        <div className="spinner" />
        <p className="text-muted mt-3" style={{ fontWeight:600 }}>
          Reconnecting…
        </p>
      </div>
    );
  }

  const phase = lobby.phase;

  return (
    <>
      {phase === 'LOBBY'     && <LobbyWait />}
      {phase === 'ANSWERING' && <Answering />}
      {phase === 'VOTING'    && <Voting />}
      {phase === 'REVEAL'    && <Reveal />}
      {phase === 'ENDED'     && <EndScreen />}
    </>
  );
}
