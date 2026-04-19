import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useStore = create(
  persist(
    (set) => ({
      // ── Persisted across page refreshes ────────────────────────────────────
      sessionToken: null,
      myPlayerId: null,
      myName: null,
      theme: 'light',

      // ── Ephemeral game state ────────────────────────────────────────────────
      lobby: null,
      votingData: null,    // { answers: [{answerId, text}], players: [{id, name}] }
      revealData: null,    // { question, results: [...] } — current question only
      revealHistory: [],   // accumulated across all questions for the end summary
      myAnswerId: null,    // the answerId that belongs to this player (hidden in voting UI)

      // ── Actions ─────────────────────────────────────────────────────────────
      setTheme: (theme) => set({ theme }),

      setSession: (sessionToken, myPlayerId, myName) =>
        set({ sessionToken, myPlayerId, myName }),

      setLobby: (lobby) => set({ lobby }),
      setVotingData: (votingData) => set({ votingData }),
      setRevealData: (revealData) => set((state) => ({
        revealData,
        // Append to history only if this question isn't already recorded
        revealHistory: state.revealHistory.find((r) => r.question.id === revealData.question.id)
          ? state.revealHistory
          : [...state.revealHistory, revealData],
      })),
      setMyAnswerId: (myAnswerId) => set({ myAnswerId }),
      clearRevealHistory: () => set({ revealHistory: [] }),

      clearGame: () =>
        set({ lobby: null, votingData: null, revealData: null, revealHistory: [], myAnswerId: null }),

      clearSession: () =>
        set({
          sessionToken: null,
          myPlayerId: null,
          myName: null,
          lobby: null,
          votingData: null,
          revealData: null,
          revealHistory: [],
          myAnswerId: null,
        }),
    }),
    {
      name: 'whos-who',
      partialize: (s) => ({
        sessionToken: s.sessionToken,
        myPlayerId: s.myPlayerId,
        myName: s.myName,
        theme: s.theme,
      }),
    }
  )
);
