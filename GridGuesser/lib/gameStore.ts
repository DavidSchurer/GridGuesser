"use client";

import { create } from "zustand";
import { GameRoom, Player } from "./types";

interface GameStore {
  roomId: string | null;
  playerIndex: 0 | 1 | null;
  gameRoom: GameRoom | null;
  opponentRevealedTiles: number[];
  myRevealedTiles: number[];
  
  setRoomId: (roomId: string) => void;
  setPlayerIndex: (index: 0 | 1) => void;
  setGameRoom: (room: GameRoom) => void;
  updateRevealedTiles: (playerIndex: 0 | 1, tileIndex: number) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  roomId: null,
  playerIndex: null,
  gameRoom: null,
  opponentRevealedTiles: [],
  myRevealedTiles: [],

  setRoomId: (roomId) => set({ roomId }),
  
  setPlayerIndex: (index) => set({ playerIndex: index }),
  
  setGameRoom: (room) => set({ 
    gameRoom: room,
    opponentRevealedTiles: room.revealedTiles[room.players.findIndex(p => p.playerIndex !== room.players[0]?.playerIndex) || 1] || [],
    myRevealedTiles: room.revealedTiles[0] || [],
  }),
  
  updateRevealedTiles: (playerIndex, tileIndex) => set((state) => {
    if (!state.gameRoom) return state;
    
    const newRevealedTiles = [...state.gameRoom.revealedTiles];
    if (!newRevealedTiles[playerIndex].includes(tileIndex)) {
      newRevealedTiles[playerIndex] = [...newRevealedTiles[playerIndex], tileIndex];
    }
    
    return {
      gameRoom: {
        ...state.gameRoom,
        revealedTiles: newRevealedTiles as [number[], number[]],
      },
      opponentRevealedTiles: state.playerIndex !== null 
        ? newRevealedTiles[1 - state.playerIndex] 
        : state.opponentRevealedTiles,
      myRevealedTiles: state.playerIndex !== null 
        ? newRevealedTiles[state.playerIndex] 
        : state.myRevealedTiles,
    };
  }),
  
  reset: () => set({
    roomId: null,
    playerIndex: null,
    gameRoom: null,
    opponentRevealedTiles: [],
    myRevealedTiles: [],
  }),
}));

