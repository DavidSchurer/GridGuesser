"use client";

import { create } from "zustand";
import { GameRoom, GameMode, RoyalePhase, RoyalePlacement } from "./types";

interface GameStore {
  roomId: string | null;
  playerIndex: number | null;
  gameRoom: GameRoom | null;
  opponentRevealedTiles: number[];
  myRevealedTiles: number[];

  // Royale-specific UI state
  royalePlacements: RoyalePlacement[];
  
  setRoomId: (roomId: string) => void;
  setPlayerIndex: (index: number) => void;
  setGameRoom: (room: GameRoom) => void;
  updateRevealedTiles: (playerIndex: number, tileIndex: number) => void;
  addRoyalePlacement: (placement: RoyalePlacement) => void;
  resetRoyalePlacements: () => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  roomId: null,
  playerIndex: null,
  gameRoom: null,
  opponentRevealedTiles: [],
  myRevealedTiles: [],
  royalePlacements: [],

  setRoomId: (roomId) => set({ roomId }),
  
  setPlayerIndex: (index) => set({ playerIndex: index }),
  
  setGameRoom: (room) => {
    return set((state) => {
      const myIdx = state.playerIndex;
      // For normal mode, opponent is 1-myIdx; for royale, we don't use single opponent tiles
      const opIdx = room.gameMode === 'normal' && myIdx !== null ? 1 - myIdx : null;
      return {
        gameRoom: room,
        opponentRevealedTiles: opIdx !== null ? (room.revealedTiles[opIdx] || []) : [],
        myRevealedTiles: myIdx !== null ? (room.revealedTiles[myIdx] || []) : [],
      };
    });
  },
  
  updateRevealedTiles: (playerIndex, tileIndex) => set((state) => {
    if (!state.gameRoom) return state;
    
    const newRevealedTiles = state.gameRoom.revealedTiles.map(tiles => [...tiles]);
    if (!newRevealedTiles[playerIndex]?.includes(tileIndex)) {
      if (!newRevealedTiles[playerIndex]) newRevealedTiles[playerIndex] = [];
      newRevealedTiles[playerIndex] = [...newRevealedTiles[playerIndex], tileIndex];
    }
    
    return {
      gameRoom: {
        ...state.gameRoom,
        revealedTiles: newRevealedTiles,
      },
      opponentRevealedTiles: state.playerIndex !== null && state.gameRoom.gameMode === 'normal'
        ? newRevealedTiles[1 - state.playerIndex] || []
        : state.opponentRevealedTiles,
      myRevealedTiles: state.playerIndex !== null 
        ? newRevealedTiles[state.playerIndex] || []
        : state.myRevealedTiles,
    };
  }),

  addRoyalePlacement: (placement) => set((state) => ({
    royalePlacements: [...state.royalePlacements, placement],
  })),

  resetRoyalePlacements: () => set({ royalePlacements: [] }),
  
  reset: () => set({
    roomId: null,
    playerIndex: null,
    gameRoom: null,
    opponentRevealedTiles: [],
    myRevealedTiles: [],
    royalePlacements: [],
  }),
}));
