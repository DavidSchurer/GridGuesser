"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { useGameStore } from "@/lib/gameStore";
import { useAuth } from "@/lib/authContext";
import { GameRoom, GameMode, RoyalePhase, RoyalePlacement, AiDifficulty } from "@/lib/types";
import GameGrid from "@/components/GameGrid";
import GameStatus from "@/components/GameStatus";
import GuessInput from "@/components/GuessInput";
import RoomCodeDisplay from "@/components/RoomCodeDisplay";
import InviteToWatchModal from "@/components/InviteToWatchModal";
import PowerUpsSidebar from "@/components/PowerUpsSidebar";
import PlayerInfo from "@/components/PlayerInfo";
import CategorySelector from "@/components/CategorySelector";
import PhaseTimer from "@/components/PhaseTimer";
import RoyaleLeaderboard from "@/components/RoyaleLeaderboard";
import GridSelector from "@/components/GridSelector";
import Icon from "@/components/Icon";
import { motion, AnimatePresence } from "framer-motion";

export default function GameRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const { user, refreshProfile } = useAuth();

  const {
    playerIndex,
    gameRoom,
    setPlayerIndex,
    setGameRoom,
    setRoomId,
    reset,
    royalePlacements,
  } = useGameStore();

  const [socket, setSocket] = useState<ReturnType<typeof connectSocket> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [lastRevealedTile, setLastRevealedTile] = useState<number | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [selectedPowerUp, setSelectedPowerUp] = useState<string | null>(null);
  const [showRematchModal, setShowRematchModal] = useState(false);
  const [rematchRequested, setRematchRequested] = useState(false);
  const [opponentRematchRequested, setOpponentRematchRequested] = useState(false);
  const [gameResetKey, setGameResetKey] = useState(0); // Force full reset on rematch

  // Rematch category selection
  const [rematchCategory, setRematchCategory] = useState<string>('');
  const [rematchCustomQuery, setRematchCustomQuery] = useState('');
  const [opponentRematchCategory, setOpponentRematchCategory] = useState<string | null>(null);
  const [opponentRematchCustomQuery, setOpponentRematchCustomQuery] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // Revealed image names shown after game ends
  const [revealedImageNames, setRevealedImageNames] = useState<[string, string] | null>(null);

  // New power-up states
  const [peekTiles, setPeekTiles] = useState<number[]>([]); // tiles temporarily visible via Peek
  const [peekTargetPlayerIndex, setPeekTargetPlayerIndex] = useState<number | null>(null); // which grid has peek (royale)
  const [isFrozen, setIsFrozen] = useState(false); // whether this player is frozen
  const [lineDirection, setLineDirection] = useState<'row' | 'col'>('col'); // revealLine direction

  // Invite link join flow: prompt for name when arriving without one
  const [showJoinPrompt, setShowJoinPrompt] = useState(false);
  const [joinName, setJoinName] = useState("");

  // Spectator invite
  const [showInviteWatchModal, setShowInviteWatchModal] = useState(false);
  const [spectatorCount, setSpectatorCount] = useState(0);

  // Royale-specific state
  const [royalePhase, setRoyalePhase] = useState<RoyalePhase>('idle');
  const [phaseEndTime, setPhaseEndTime] = useState(0);
  const [phaseRound, setPhaseRound] = useState(0);
  const [hasActedThisPhase, setHasActedThisPhase] = useState(false);
  const [royaleGuessTarget, setRoyaleGuessTarget] = useState<number | null>(null);
  const [showRoyaleLeaderboard, setShowRoyaleLeaderboard] = useState(false);
  const [royaleImageNames, setRoyaleImageNames] = useState<string[]>([]);
  const [waitingPlayerCount, setWaitingPlayerCount] = useState(1);

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  // Join room helper – called immediately for hosts / code-joiners,
  // or after the name prompt for invite-link joiners.
  const joinRoomWithName = (socketInstance: ReturnType<typeof connectSocket>, name: string) => {
    console.log(`🎮 Joining room ${roomId} as "${name}"`);
    socketInstance.emit("join-room", { roomId, playerName: name }, (success: boolean, index?: 0 | 1, errorMsg?: string) => {
      if (success && index !== undefined) {
        setPlayerIndex(index);
        // Fetch room to get our player ID for rejoin support
        socketInstance.emit("get-game-state", roomId, (room: GameRoom | null) => {
          if (room && room.players[index]) {
            saveActiveGame(index, room.players[index].id);
          }
        });
      } else {
        setError(errorMsg || "Failed to join room");
      }
    });
  };

  // Called when the joiner submits their name from the invite-link prompt
  const handleJoinSubmit = () => {
    if (!socket) return;
    const finalName = user?.username || joinName.trim() || 'Guest';
    if (!user && !joinName.trim()) return;
    setShowJoinPrompt(false);
    joinRoomWithName(socket, finalName);
  };

  // Save active game to localStorage so the home page can offer rejoin
  const saveActiveGame = (pIndex: number, playerId: string) => {
    try {
      localStorage.setItem('gridguesser_active_game', JSON.stringify({ roomId, playerIndex: pIndex, playerId }));
    } catch {}
  };

  const clearActiveGame = () => {
    try { localStorage.removeItem('gridguesser_active_game'); } catch {}
  };

  useEffect(() => {
    const socketInstance = connectSocket();
    setSocket(socketInstance);
    setRoomId(roomId);

    const searchParams = new URLSearchParams(window.location.search);
    const playerName = searchParams.get('name');
    const selectedCategory = searchParams.get('category') || 'landmarks';
    const customQuery = searchParams.get('customQuery') || '';
    const isRejoin = searchParams.get('rejoin') === '1';
    const gameModeParam = (searchParams.get('gameMode') || 'normal') as GameMode;
    const maxPlayersParam = parseInt(searchParams.get('maxPlayers') || '2', 10);
    const vsAiParam = searchParams.get('vsAi') === '1';
    const aiDifficultyParam = (searchParams.get('aiDifficulty') || 'medium') as AiDifficulty;

    const savedGame = (() => { try { return JSON.parse(localStorage.getItem('gridguesser_active_game') || 'null'); } catch { return null; } })();
    const canTryRejoin = isRejoin && savedGame?.roomId === roomId && savedGame?.playerId;

    socketInstance.emit("get-game-state", roomId, (room: GameRoom | null) => {
      if (!room) {
        if (canTryRejoin) {
          clearActiveGame();
          setError("Game no longer exists");
          return;
        }
        const roomData = { 
          roomId, 
          playerName: playerName || 'Player', 
          category: selectedCategory,
          ...(customQuery && { customQuery }),
          gameMode: gameModeParam,
          maxPlayers: gameModeParam === 'royale' ? maxPlayersParam : 2,
          ...(vsAiParam && gameModeParam === 'normal' ? { vsAi: true, aiDifficulty: aiDifficultyParam } : {}),
        };
        
        socketInstance.emit("create-room-with-id", roomData, (success: boolean, errorMsg?: string) => {
          if (success) {
            setPlayerIndex(0);
            if (vsAiParam && gameModeParam === 'normal') {
              setOpponentConnected(true);
            }
            console.log(`✅ Room created with category: ${selectedCategory}${customQuery ? ` (custom: "${customQuery}")` : ''}`);
            socketInstance.emit("get-game-state", roomId, (newRoom: GameRoom | null) => {
              if (newRoom) {
                setGameRoom(newRoom);
                // Save session for rejoin — player id is in the room data
                if (newRoom.players[0]) saveActiveGame(0, newRoom.players[0].id);
              }
            });
          } else {
            setError(errorMsg || "Failed to create room");
          }
        });
      } else if (canTryRejoin && room.players.length >= 2) {
        socketInstance.emit("rejoin-room", { roomId, playerId: savedGame.playerId }, (success: boolean, pIndex?: number, errMsg?: string) => {
          if (success && pIndex !== undefined) {
            setPlayerIndex(pIndex);
            setOpponentConnected(true);
            socketInstance.emit("get-game-state", roomId, (freshRoom: GameRoom | null) => {
              if (freshRoom) {
                setGameRoom(freshRoom);
                saveActiveGame(pIndex, savedGame.playerId);
              }
            });
            showNotification("Reconnected to game!");
          } else {
            clearActiveGame();
            setError(errMsg || "Failed to rejoin game");
          }
        });
      } else if (room.gameState === 'waiting' && room.players.length < (room.maxPlayers ?? 2)) {
        // Room exists with space for more players – this is a joiner
        const joinAs = playerName || (user?.username);
        if (joinAs) {
          joinRoomWithName(socketInstance, joinAs);
        } else {
          setShowJoinPrompt(true);
        }
      } else if (room.gameState === 'playing') {
        setError(`Game is already in progress with ${room.players.length} players`);
      } else {
        setError("Unable to join this room");
      }
    });

    // Listen for player joined (for royale lobby)
    socketInstance.on("player-joined", (data: { playerIndex: number; playerName: string; playerCount: number; maxPlayers: number }) => {
      setWaitingPlayerCount(data.playerCount);
      showNotification(`${data.playerName} joined! (${data.playerCount}/${data.maxPlayers})`);
      // Refresh room state to get updated player list
      socketInstance.emit("get-game-state", roomId, (room: GameRoom | null) => {
        if (room) setGameRoom(room);
      });
    });

    // Listen for game start
    socketInstance.on("game-start", (data: { roomId: string; players: any[]; currentTurn: number; gameMode?: GameMode; maxPlayers?: number; vsAi?: boolean }) => {
      setOpponentConnected(true);
      const vsAi = !!data.vsAi;
      showNotification(
        data.gameMode === 'royale'
          ? "All players joined! Game starting..."
          : vsAi
            ? "Playing vs GridBot. Game on!"
            : "Opponent joined! Game starting..."
      );
      
      const currentRoom = useGameStore.getState().gameRoom;
      const n = data.maxPlayers || data.players.length;
      if (currentRoom) {
        setGameRoom({
          ...currentRoom,
          revealedTiles: Array.from({ length: n }, () => []),
          points: Array(n).fill(0),
          currentTurn: data.currentTurn,
          gameState: 'playing',
        });
      }
      
      socketInstance.emit("get-game-state", roomId, (room: GameRoom | null) => {
        if (room) {
          setGameRoom(room);
        }
      });
    });

    // Royale: phase changes
    socketInstance.on("phase-change", (data: { phase: RoyalePhase; phaseEndTime: number; round: number; activePlayers: number[] }) => {
      setRoyalePhase(data.phase);
      setPhaseEndTime(data.phaseEndTime);
      setPhaseRound(data.round);
      setHasActedThisPhase(false);
      setRoyaleGuessTarget(null);

      const currentPlayerIndex = useGameStore.getState().playerIndex;
      const isActive = currentPlayerIndex !== null && data.activePlayers.includes(currentPlayerIndex);

      if (data.phase === 'reveal') {
        showNotification(isActive ? `Round ${data.round}: Reveal a tile!` : "Reveal phase started");
      } else if (data.phase === 'guess') {
        showNotification(isActive ? "Guess phase: Submit your guess!" : "Guess phase started");
      }
    });

    // Royale: tile revealed
    socketInstance.on("royale-tile-revealed", (data: { tileIndex: number; targetPlayerIndex: number; revealedBy: number; revealedTiles: number[][]; points: number[] }) => {
      const currentRoom = useGameStore.getState().gameRoom;
      if (currentRoom) {
        setGameRoom({
          ...currentRoom,
          revealedTiles: data.revealedTiles,
          points: data.points,
        });
      }
      const currentPlayerIndex = useGameStore.getState().playerIndex;
      if (data.revealedBy === currentPlayerIndex) {
        showNotification("Tile revealed!");
      }
    });

    // Royale: correct guess
    socketInstance.on("royale-correct-guess", (data: { playerIndex: number; targetPlayerIndex: number; guess: string; correctAnswer: string }) => {
      const currentPlayerIndex = useGameStore.getState().playerIndex;
      const currentRoom = useGameStore.getState().gameRoom;
      const guesserName = currentRoom?.players[data.playerIndex]?.name || `Player ${data.playerIndex + 1}`;
      if (data.playerIndex === currentPlayerIndex) {
        showNotification(`Correct! You guessed "${data.correctAnswer}"!`);
      } else {
        showNotification(`${guesserName} guessed correctly!`);
      }
    });

    // Royale: wrong guess
    socketInstance.on("royale-wrong-guess", (data: { playerIndex: number; targetPlayerIndex: number; guess: string; points: number[] }) => {
      const currentRoom = useGameStore.getState().gameRoom;
      if (currentRoom) {
        setGameRoom({ ...currentRoom, points: data.points });
      }
      const currentPlayerIndex = useGameStore.getState().playerIndex;
      if (data.playerIndex === currentPlayerIndex) {
        showNotification(`Wrong guess: "${data.guess}"`);
      }
    });

    // Royale: placement
    socketInstance.on("royale-placement", (data: RoyalePlacement) => {
      useGameStore.getState().addRoyalePlacement(data);
      const currentPlayerIndex = useGameStore.getState().playerIndex;
      const ordinal = data.place === 1 ? "1st" : data.place === 2 ? "2nd" : data.place === 3 ? "3rd" : "4th";
      if (data.playerIndex === currentPlayerIndex) {
        showNotification(`You got ${ordinal} place!`);
      } else {
        showNotification(`${data.name} got ${ordinal} place!`);
      }

      // Update active players in local state
      socketInstance.emit("get-game-state", roomId, (room: GameRoom | null) => {
        if (room) setGameRoom(room);
      });
    });

    // Royale: game end
    socketInstance.on("royale-game-end", (data: { placements: RoyalePlacement[]; imageNames: string[] }) => {
      try { localStorage.removeItem('gridguesser_active_game'); } catch {}
      setRoyaleImageNames(data.imageNames);

      // Update all placements
      const store = useGameStore.getState();
      store.resetRoyalePlacements();
      data.placements.forEach(p => store.addRoyalePlacement(p));

      // Reveal all tiles
      const currentRoom = store.gameRoom;
      if (currentRoom) {
        const n = currentRoom.maxPlayers;
        const allTiles = Array.from({ length: 100 }, (_, i) => i);
        setGameRoom({
          ...currentRoom,
          gameState: 'finished',
          revealedTiles: Array.from({ length: n }, () => [...allTiles]),
        });
      }

      setTimeout(() => setShowRoyaleLeaderboard(true), 3000);
      refreshProfile().catch(() => {});
    });

    // Listen for tile reveals
    socketInstance.on("tile-revealed", (data: { tileIndex: number; playerIndex: number; revealedBy: number; currentTurn: 0 | 1; imageId: string; points?: [number, number] }) => {
      setLastRevealedTile(data.tileIndex);
      
      // Immediately update local game state
      const currentRoom = useGameStore.getState().gameRoom;
      if (currentRoom) {
        const updatedRevealedTiles = [...currentRoom.revealedTiles] as [number[], number[]];
        if (!updatedRevealedTiles[data.playerIndex].includes(data.tileIndex)) {
          updatedRevealedTiles[data.playerIndex] = [...updatedRevealedTiles[data.playerIndex], data.tileIndex];
        }
        setGameRoom({
          ...currentRoom,
          revealedTiles: updatedRevealedTiles,
          currentTurn: data.currentTurn,
          points: data.points || currentRoom.points,
        });
      }
      
      // Also fetch fresh game state to ensure synchronization
      setTimeout(() => {
        socketInstance.emit("get-game-state", roomId, (room: GameRoom | null) => {
          if (room) {
            setGameRoom(room);
            const idx = useGameStore.getState().playerIndex;
            if (room.freezeActive && idx !== null) {
              setIsFrozen(room.freezeActive[idx]);
            }
          }
        });
      }, 100);

      // Show notification based on who revealed the tile
      // Get current playerIndex from store to avoid stale closure value
      const currentPlayerIndex = useGameStore.getState().playerIndex;
      if (data.revealedBy !== currentPlayerIndex) {
        showNotification(`Opponent revealed a tile!`);
      } else {
        showNotification(`You revealed a tile!`);
      }
    });

    // Listen for power-up usage
    socketInstance.on("power-up-used", (data: {
      powerUpId: string; usedBy: number; message: string; points: [number, number];
      allRevealedTiles?: [number[], number[]]; currentTurn?: 0 | 1;
      foggedTiles?: number[]; freezeActive?: [boolean, boolean];
      peekTiles?: number[]; peekPlayerIndex?: number;
      targetPlayer?: number; lineType?: string; lineIndex?: number;
    }) => {
      const currentPlayerIndex = useGameStore.getState().playerIndex;
      const isCurrentPlayer = data.usedBy === currentPlayerIndex;
      
      // Build personalized notification
      let personalizedMessage = '';
      
      if (data.powerUpId === 'skip') {
        personalizedMessage = isCurrentPlayer ? 'You used Skip Turn! Take an extra turn!' : 'Opponent used Skip Turn! Your next turn is skipped!';
      } else if (data.powerUpId === 'reveal2x2') {
        personalizedMessage = isCurrentPlayer ? 'You used Reveal 2x2!' : 'Opponent used Reveal 2x2 on your image!';
      } else if (data.powerUpId === 'nuke') {
        personalizedMessage = isCurrentPlayer ? 'You used Nuke!' : 'Opponent used Nuke on your image!';
      } else if (data.powerUpId === 'fog') {
        personalizedMessage = isCurrentPlayer
          ? `Fog of War! ${data.foggedTiles?.length || 0} tiles hidden on your image!`
          : `Opponent used Fog of War! ${data.foggedTiles?.length || 0} tiles re-hidden!`;
      } else if (data.powerUpId === 'revealLine') {
        const lineLabel = data.lineType === 'row' ? `Row ${(data.lineIndex ?? 0) + 1}` : `Column ${(data.lineIndex ?? 0) + 1}`;
        personalizedMessage = isCurrentPlayer ? `You revealed ${lineLabel}!` : `Opponent revealed ${lineLabel} on your image!`;
      } else if (data.powerUpId === 'freeze') {
        personalizedMessage = isCurrentPlayer ? 'You froze your opponent!' : 'You\'ve been frozen! No power-ups next turn!';
      } else if (data.powerUpId === 'peek') {
        personalizedMessage = isCurrentPlayer ? 'Peeking for 5 seconds...' : 'Opponent is peeking at your image!';
      } else {
        personalizedMessage = data.message;
      }
      
      showNotification(personalizedMessage);

      // Handle Peek: temporarily show tiles for the player who used it
      if (data.powerUpId === 'peek' && data.peekTiles && data.peekPlayerIndex === currentPlayerIndex) {
        setPeekTiles(data.peekTiles);
        setPeekTargetPlayerIndex(data.targetPlayer ?? null);
        // Auto-hide after 5 seconds
        setTimeout(() => {
          setPeekTiles([]);
          setPeekTargetPlayerIndex(null);
          showNotification('Peek expired!');
        }, 5000);
      }

      // Handle Freeze: update local frozen state
      if (data.freezeActive) {
        if (currentPlayerIndex !== null) {
          setIsFrozen(data.freezeActive[currentPlayerIndex]);
        }
      }
      
      // Update revealed tiles (covers reveal2x2, nuke, fog, revealLine)
      if (data.allRevealedTiles) {
        const currentRoom = useGameStore.getState().gameRoom;
        if (currentRoom) {
          setGameRoom({
            ...currentRoom,
            revealedTiles: data.allRevealedTiles,
            points: data.points,
            currentTurn: data.currentTurn !== undefined ? data.currentTurn : currentRoom.currentTurn,
          });
        }
      } else {
        // For power-ups without tile changes (skip, freeze), just update points
        const currentRoom = useGameStore.getState().gameRoom;
        if (currentRoom) {
          setGameRoom({
            ...currentRoom,
            points: data.points,
            currentTurn: data.currentTurn !== undefined ? data.currentTurn : currentRoom.currentTurn,
          });
        }
      }
      
      // Fetch fresh game state to ensure sync
      setTimeout(() => {
        socketInstance.emit("get-game-state", roomId, (room: GameRoom | null) => {
          if (room) {
            setGameRoom(room);
            // Also sync freeze state from server
            if (room.freezeActive && currentPlayerIndex !== null) {
              setIsFrozen(room.freezeActive[currentPlayerIndex]);
            }
          }
        });
      }, 200);
    });

    // Listen for wrong guesses
    socketInstance.on("wrong-guess", (data: { playerIndex: number; guess: string; currentTurn: 0 | 1; points?: [number, number] }) => {
      if (data.playerIndex === playerIndex) {
        showNotification(`Wrong guess: "${data.guess}". Try again!`);
      } else {
        showNotification(`Opponent guessed wrong: "${data.guess}"`);
      }

      // Immediately update points and turn from the event
      const currentRoom = useGameStore.getState().gameRoom;
      if (currentRoom && data.points) {
        setGameRoom({ ...currentRoom, points: data.points, currentTurn: data.currentTurn });
      }

      // Also fetch fresh state for full sync
      socketInstance.emit("get-game-state", roomId, (room: GameRoom | null) => {
        if (room) {
          setGameRoom(room);
        }
      });
    });

    // Listen for game end
    socketInstance.on("game-end", (data: { winner: number; winnerGuess: string; correctAnswer: string; imageNames?: [string, string] }) => {
      // Game is over — clear the rejoin session
      clearActiveGame();

      // Store both image names so they can be displayed
      if (data.imageNames) {
        setRevealedImageNames(data.imageNames);
      }

      const currentPlayerIndex = useGameStore.getState().playerIndex;
      
      showNotification(
        data.winner === currentPlayerIndex
          ? `You won! The answer was: ${data.correctAnswer}`
          : `You lost! The answer was: ${data.correctAnswer}`
      );

      // Fully reveal all tiles on both grids so players can see the images
      const currentRoom = useGameStore.getState().gameRoom;
      const allTiles = Array.from({ length: 100 }, (_, i) => i);
      if (currentRoom) {
        setGameRoom({
          ...currentRoom,
          gameState: 'finished',
          revealedTiles: [allTiles, allTiles],
          winner: data.winner as 0 | 1,
        });
      }

      // Also fetch the official state from server
      socketInstance.emit("get-game-state", roomId, (room: GameRoom | null) => {
        if (room) {
          setGameRoom({
            ...room,
            revealedTiles: [allTiles, allTiles],
          });
        }
      });

      // Refresh user profile to get updated stats
      refreshProfile().catch(error => console.error("Error refreshing profile:", error));
      
      // Show rematch modal after 6 seconds so players can see both full images and answers
      setTimeout(() => {
        const latestRoom = useGameStore.getState().gameRoom;
        if (latestRoom?.vsAi) return;
        if (latestRoom?.category) {
          setRematchCategory(latestRoom.category);
          setRematchCustomQuery(latestRoom.customQuery || '');
        }
        setShowRematchModal(true);
      }, 6000);
    });

    // Listen for rematch requests
    socketInstance.on("rematch-requested", (data: { playerIndex: number; category?: string; customQuery?: string }) => {
      const currentPlayerIndex = useGameStore.getState().playerIndex;
      if (data.playerIndex !== currentPlayerIndex) {
        setOpponentRematchRequested(true);
        setOpponentRematchCategory(data.category || null);
        setOpponentRematchCustomQuery(data.customQuery || null);
        const catLabel = data.category === 'custom' && data.customQuery
          ? `"${data.customQuery}"`
          : data.category || 'same category';
        showNotification(`Opponent wants a rematch with ${catLabel}!`);
      }
    });

    // Listen for rematch start
    socketInstance.on("rematch-start", (data: { roomId: string }) => {
      console.log("🔄 REMATCH START - Resetting all tiles");
      showNotification("Rematch starting...");
      setShowRematchModal(false);
      setRematchRequested(false);
      setOpponentRematchRequested(false);
      setLastRevealedTile(null);
      setShowCategoryPicker(false);
      setOpponentRematchCategory(null);
      setOpponentRematchCustomQuery(null);
      setPeekTiles([]);
      setIsFrozen(false);
      setSelectedPowerUp(null);
      setLineDirection('col');
      setRevealedImageNames(null);
      
      // Increment reset key to force full component remount
      setGameResetKey(prev => {
        const newKey = prev + 1;
        console.log(`🔑 Game reset key: ${prev} → ${newKey}`);
        return newKey;
      });
      
      // Immediately clear the revealed tiles in local state
      const currentRoom = useGameStore.getState().gameRoom;
      if (currentRoom) {
        console.log("🧹 Clearing revealed tiles:", currentRoom.revealedTiles, "→ [[], []]");
        setGameRoom({
          ...currentRoom,
          revealedTiles: [[], []],
          points: [0, 0],
          gameState: 'waiting',
        });
      }
      
      // Fetch updated game state with new images
      setTimeout(() => {
        socketInstance.emit("get-game-state", roomId, (room: GameRoom | null) => {
          if (room) {
            console.log("📥 New game state received:", {
              revealedTiles: room.revealedTiles,
              imageHashes: room.imageHashes,
            });
            setGameRoom(room);
            showNotification("New game started!");
          }
        });
      }, 500);
    });

    // Listen for hint reveals
    socketInstance.on(
      "hint-revealed",
      (data: {
        playerIndex: number;
        targetPlayerIndex: number;
        charIndex: number;
        char: string;
        revealedHints: number[][];
        royaleLetterHints?: number[][][];
        points: number[];
      }) => {
        const currentPlayerIndex = useGameStore.getState().playerIndex;
        const currentRoom = useGameStore.getState().gameRoom;
        if (currentRoom) {
          const updatedMasked = [...(currentRoom.maskedImageNames || [])];
          if (data.playerIndex === currentPlayerIndex) {
            if (currentRoom.gameMode === "royale") {
              const raw = updatedMasked[data.playerIndex];
              if (raw) {
                try {
                  const arr = JSON.parse(raw) as { playerIndex: number; masked: string }[];
                  const entry = arr.find((e) => e.playerIndex === data.targetPlayerIndex);
                  if (entry) {
                    const chars = entry.masked.split("");
                    if (data.charIndex < chars.length) {
                      chars[data.charIndex] = data.char;
                    }
                    entry.masked = chars.join("");
                  }
                  updatedMasked[data.playerIndex] = JSON.stringify(arr);
                } catch {
                  /* ignore */
                }
              }
            } else {
              const row = updatedMasked[data.playerIndex] || "";
              const chars = row.split("");
              if (data.charIndex < chars.length) {
                chars[data.charIndex] = data.char;
              }
              updatedMasked[data.playerIndex] = chars.join("");
            }
          }
          setGameRoom({
            ...currentRoom,
            revealedHints: data.revealedHints,
            ...(data.royaleLetterHints !== undefined
              ? { royaleLetterHints: data.royaleLetterHints }
              : {}),
            maskedImageNames: updatedMasked,
            points: data.points,
          });
        }
        if (data.playerIndex === currentPlayerIndex) {
          showNotification(`Hint: letter "${data.char.toUpperCase()}" revealed!`);
        } else {
          showNotification("Opponent used a hint!");
        }
      }
    );

    // Listen for rematch declined
    socketInstance.on("rematch-declined", () => {
      showNotification("Opponent declined rematch");
      setShowRematchModal(false);
      setRematchRequested(false);
      setOpponentRematchRequested(false);
      setShowCategoryPicker(false);
      setOpponentRematchCategory(null);
      setOpponentRematchCustomQuery(null);
    });

    // Listen for player disconnection
    socketInstance.on("player-disconnected", (data: { playerIndex: number; message: string }) => {
      setOpponentConnected(false);
      showNotification(data.message);
    });

    // Listen for player reconnection
    socketInstance.on("player-reconnected", (data: { playerIndex: number; message: string }) => {
      setOpponentConnected(true);
      showNotification(data.message);
    });

    // Spectator count updates
    socketInstance.on("spectator-count-changed", (data: { count: number }) => {
      setSpectatorCount(data.count);
    });

    return () => {
      disconnectSocket();
      reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only re-run when roomId changes
  }, [roomId]);

  // Keyboard listener for revealLine mode: R for row, C for column
  useEffect(() => {
    if (selectedPowerUp !== 'revealLine') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'r') {
        setLineDirection('row');
      } else if (key === 'c') {
        setLineDirection('col');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPowerUp]);

  const handleTileClick = (tileIndex: number) => {
    if (!socket || playerIndex === null || !gameRoom) return;

    // If reveal2x2 is selected, use it on this tile
    if (selectedPowerUp === 'reveal2x2') {
      handleUsePowerUp('reveal2x2', tileIndex);
      setSelectedPowerUp(null);
      return;
    }

    // If peek is selected, use it on this tile
    if (selectedPowerUp === 'peek') {
      handleUsePowerUp('peek', tileIndex);
      setSelectedPowerUp(null);
      return;
    }

    // If revealLine is selected, compute the row/col index from the tile
    if (selectedPowerUp === 'revealLine') {
      const lineIndex = lineDirection === 'row'
        ? Math.floor(tileIndex / 10)
        : tileIndex % 10;
      handleUsePowerUp('revealLine', undefined, lineDirection, lineIndex);
      setSelectedPowerUp(null);
      setLineDirection('col');
      return;
    }

    socket.emit("reveal-tile", { roomId, tileIndex }, (success: boolean, errorMsg?: string) => {
      if (!success) {
        showNotification(errorMsg || "Failed to reveal tile");
      }
    });
  };

  const handleUsePowerUp = (powerUpId: string, tileIndex?: number, lineType?: 'row' | 'col', lineIndex?: number, targetPlayerIndex?: number) => {
    if (!socket) return;

    if (powerUpId === 'cancel') {
      setSelectedPowerUp(null);
      return;
    }

    if ((powerUpId === 'reveal2x2' || powerUpId === 'peek' || powerUpId === 'revealLine') && tileIndex === undefined && lineType === undefined) {
      setSelectedPowerUp(powerUpId);
      if (powerUpId === 'revealLine') setLineDirection('col');
      return;
    }

    socket.emit("use-power-up", { roomId, powerUpId, tileIndex, lineType, lineIndex, targetPlayerIndex }, (success: boolean, errorMsg?: string) => {
      if (!success) {
        showNotification(errorMsg || "Failed to use power-up");
      } else if (gameRoom?.gameMode === 'royale' && royalePhase === 'reveal' && (powerUpId === 'reveal2x2' || powerUpId === 'peek' || powerUpId === 'revealLine')) {
        setHasActedThisPhase(true);
      }
    });
  };

  const handleUseHint = (targetPlayerIndex?: number) => {
    if (!socket) return;

    socket.emit(
      "use-hint",
      { roomId, ...(targetPlayerIndex !== undefined ? { targetPlayerIndex } : {}) },
      (success: boolean, errorMsg?: string) => {
        if (!success) {
          showNotification(errorMsg || "Failed to use hint");
        }
      }
    );
  };

  const handleSubmitGuess = (guess: string) => {
    if (!socket || playerIndex === null) return;

    if (gameRoom?.gameMode === 'royale') {
      if (royaleGuessTarget === null) {
        showNotification("Select which player's image to guess first");
        return;
      }
      socket.emit("royale-submit-guess", { roomId, guess, targetPlayerIndex: royaleGuessTarget }, (success: boolean, correct?: boolean, errorMsg?: string) => {
        if (!success) {
          showNotification(errorMsg || "Failed to submit guess");
        } else {
          setHasActedThisPhase(true);
        }
      });
      return;
    }

    socket.emit("submit-guess", { roomId, guess }, (success: boolean, correct?: boolean, errorMsg?: string) => {
      if (!success) {
        showNotification(errorMsg || "Failed to submit guess");
      }
    });
  };

  const handleRoyaleTileClick = (tileIndex: number, targetPlayerIndex: number) => {
    if (!socket || playerIndex === null || !gameRoom) return;
    if (hasActedThisPhase) return;
    if (royalePhase !== 'reveal') return;

    // If a tile-based power-up is selected, use it on this grid
    if (selectedPowerUp === 'reveal2x2') {
      handleUsePowerUp('reveal2x2', tileIndex, undefined, undefined, targetPlayerIndex);
      setSelectedPowerUp(null);
      return;
    }
    if (selectedPowerUp === 'peek') {
      handleUsePowerUp('peek', tileIndex, undefined, undefined, targetPlayerIndex);
      setSelectedPowerUp(null);
      return;
    }
    if (selectedPowerUp === 'revealLine') {
      const lineIndex = lineDirection === 'row' ? Math.floor(tileIndex / 10) : tileIndex % 10;
      handleUsePowerUp('revealLine', undefined, lineDirection, lineIndex, targetPlayerIndex);
      setSelectedPowerUp(null);
      setLineDirection('col');
      return;
    }

    socket.emit("royale-reveal-tile", { roomId, tileIndex, targetPlayerIndex }, (success: boolean, errorMsg?: string) => {
      if (success) {
        setHasActedThisPhase(true);
      } else {
        showNotification(errorMsg || "Failed to reveal tile");
      }
    });
  };

  const handleRoyaleSkipGuess = () => {
    if (!socket) return;
    socket.emit("royale-skip-guess", { roomId }, (success: boolean, errorMsg?: string) => {
      if (success) {
        setHasActedThisPhase(true);
      }
    });
  };

  const handleRematchRequest = (category?: string, customQuery?: string) => {
    if (!socket || playerIndex === null) return;
    
    setRematchRequested(true);
    socket.emit(
      "request-rematch",
      { roomId, category, customQuery },
      (success: boolean, errorMsg?: string) => {
        if (!success) {
          showNotification(errorMsg || "Failed to request rematch");
          setRematchRequested(false);
        } else {
          showNotification("Rematch requested! Waiting for opponent...");
        }
      }
    );
  };

  const handleDeclineRematch = () => {
    if (!socket) return;
    
    socket.emit("decline-rematch", { roomId });
    setShowRematchModal(false);
    setRematchRequested(false);
    setOpponentRematchRequested(false);
    setShowCategoryPicker(false);
    setOpponentRematchCategory(null);
    setOpponentRematchCustomQuery(null);
  };

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
            Error
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-semibold transition-all duration-200"
          >
            Back to Home
          </button>
        </div>
      </main>
    );
  }

  // Invite-link join prompt: ask the joiner for their name before connecting
  if (showJoinPrompt) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              GridGuesser
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              You&apos;ve been invited to join a game!
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
              {user ? `Ready to play, ${user.username}?` : "Enter your name"}
            </h2>

            {!user && (
              <input
                type="text"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value.slice(0, 20))}
                onKeyDown={(e) => e.key === "Enter" && handleJoinSubmit()}
                placeholder="Your name"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-lg"
                maxLength={20}
                autoFocus
              />
            )}

            <button
              onClick={handleJoinSubmit}
              disabled={!user && joinName.trim().length === 0}
              className="w-full py-4 px-6 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl font-semibold text-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              Join Game
            </button>

            <button
              onClick={() => router.push("/")}
              className="w-full py-3 px-6 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!gameRoom || playerIndex === null) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md text-center">
          <div className="animate-pulse-slow mb-4 flex justify-center">
            <Icon name="gamepad" size={64} className="text-blue-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
            Connecting...
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Waiting for players to join...
          </p>
          <RoomCodeDisplay roomCode={roomId} />
        </div>
      </main>
    );
  }

  // Royale lobby: waiting for more players
  const isRoyale = gameRoom.gameMode === 'royale';
  if (isRoyale && gameRoom.gameState === 'waiting' && gameRoom.players.length < gameRoom.maxPlayers) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md text-center">
          <div className="mb-4 flex justify-center text-5xl">&#128081;</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
            Grid Royale
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Waiting for players... ({gameRoom.players.length}/{gameRoom.maxPlayers})
          </p>
          <div className="space-y-2 mb-4">
            {gameRoom.players.map((p, i) => (
              <div key={i} className="flex items-center gap-2 justify-center">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="text-gray-700 dark:text-gray-300 font-medium">
                  {p.name} {p.playerIndex === playerIndex && "(You)"}
                </span>
              </div>
            ))}
            {Array.from({ length: gameRoom.maxPlayers - gameRoom.players.length }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-2 justify-center">
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"></span>
                <span className="text-gray-400 dark:text-gray-500">Waiting...</span>
              </div>
            ))}
          </div>
          <RoomCodeDisplay roomCode={roomId} />
        </div>
      </main>
    );
  }

  const isMyTurn = gameRoom.currentTurn === playerIndex;
  const myImageHash = gameRoom.imageHashes?.[playerIndex] || '';
  const myRevealedTiles = gameRoom.revealedTiles?.[playerIndex] || [];
  const myPoints = gameRoom.points?.[playerIndex] || 0;
  const myName = gameRoom.players[playerIndex]?.name || 'You';

  // Normal mode variables
  const opponentImageHash = !isRoyale ? (gameRoom.imageHashes?.[1 - playerIndex] || '') : '';
  const opponentRevealedTiles = !isRoyale ? (gameRoom.revealedTiles?.[1 - playerIndex] || []) : [];
  const opponentPoints = !isRoyale ? (gameRoom.points?.[1 - playerIndex] || 0) : 0;
  const opponentName = !isRoyale ? (gameRoom.players[1 - playerIndex]?.name || 'Opponent') : '';

  // Royale-specific computed values
  const royaleActivePlayers = gameRoom.activePlayers || [];
  const royalePlacedPlayers = gameRoom.placements || [];
  const isPlayerActive = isRoyale ? royaleActivePlayers.includes(playerIndex) : true;

  /** Masked title line for another player’s image (royale JSON from server) */
  const getRoyaleMaskedLineForTarget = (targetPlayerIdx: number): string | null => {
    if (!isRoyale || !gameRoom.maskedImageNames) return null;
    const raw = gameRoom.maskedImageNames[playerIndex];
    if (!raw) return null;
    try {
      const arr = JSON.parse(raw) as { playerIndex: number; masked: string }[];
      return arr.find((e) => e.playerIndex === targetPlayerIdx)?.masked ?? null;
    } catch {
      return null;
    }
  };

  return (
    <main className={`min-h-screen ${isRoyale ? 'p-3 md:p-4' : 'p-4 md:p-8'}`}>
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className={`flex justify-between items-center ${isRoyale ? 'mb-4' : 'mb-6'} gap-2`}>
          <button
            onClick={() => { clearActiveGame(); router.push("/"); }}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors shrink-0"
          >
            ← Leave Game
          </button>
          <div className="text-center flex-1 min-w-0">
            <h1 className={`font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2 ${isRoyale ? 'text-xl md:text-2xl' : 'text-3xl'}`}>
              GridGuesser
            </h1>
            <RoomCodeDisplay roomCode={roomId} />
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <button
              onClick={() => setShowInviteWatchModal(true)}
              className="px-3 py-2 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-800/50 text-amber-800 dark:text-amber-200 rounded-lg transition-colors text-sm font-semibold flex items-center gap-1.5 whitespace-nowrap"
              title="Invite a spectator"
            >
              <span aria-hidden>&#128065;</span>
              <span className="hidden sm:inline">Invite Spectator</span>
              <span className="sm:hidden">Spectate</span>
            </button>
            {spectatorCount > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <span aria-hidden>&#128065;</span> {spectatorCount} watching
              </span>
            )}
          </div>
        </div>

        <InviteToWatchModal
          isOpen={showInviteWatchModal}
          onClose={() => setShowInviteWatchModal(false)}
          spectatorCode={gameRoom.spectatorCode || null}
          watcherCount={spectatorCount}
        />

        {/* Word hints are now shown under the opponent's grid */}

        {/* Notification */}
        <AnimatePresence>
          {notification && (
            <motion.div
              key="notification"
              initial={{ opacity: 0, y: -50, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={{ 
                type: "spring",
                stiffness: 300,
                damping: 20
              }}
              className="fixed top-4 right-4 z-50 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg"
            >
              {notification}
            </motion.div>
          )}
        </AnimatePresence>

        {isRoyale ? (
          /* ═══ ROYALE MODE UI ═══ */
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
            {/* Left: Royale content */}
            <div className="space-y-4">
              {/* Phase Timer */}
              {gameRoom.gameState === 'playing' && (
                <PhaseTimer
                  phase={royalePhase}
                  phaseEndTime={phaseEndTime}
                  round={phaseRound}
                  hasActed={hasActedThisPhase}
                  compact
                />
              )}

              {/* Player Info Cards - compact */}
              <div className={`flex flex-wrap gap-2 justify-center ${gameRoom.maxPlayers === 3 ? '' : ''}`}>
                {gameRoom.players.map((p) => (
                  <PlayerInfo
                    key={p.playerIndex}
                    playerName={p.name}
                    points={gameRoom.points[p.playerIndex] || 0}
                    isActive={royaleActivePlayers.includes(p.playerIndex) && gameRoom.gameState === 'playing'}
                    isYou={p.playerIndex === playerIndex}
                    compact
                  />
                ))}
              </div>

              {/* Placement badges */}
              {royalePlacements.length > 0 && gameRoom.gameState === 'playing' && (
                <div className="flex gap-2 flex-wrap">
                  {royalePlacements.map((p) => {
                    const ordinal = p.place === 1 ? "1st" : p.place === 2 ? "2nd" : p.place === 3 ? "3rd" : "4th";
                    return (
                      <span key={p.playerIndex} className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-full text-xs font-medium">
                        {p.name}: {ordinal}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Notification */}
              {!isPlayerActive && gameRoom.gameState === 'playing' && (
                <div className="p-2 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg text-center">
                  <p className="text-green-700 dark:text-green-300 text-sm font-medium">
                    You&apos;ve been placed! Watching the remaining players...
                  </p>
                </div>
              )}

              {/* Grid Layout: 3 players = row, 4 players = 2x2 */}
              <div className={`grid gap-4 ${gameRoom.maxPlayers === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                {gameRoom.players.map((p) => {
                  const isMe = p.playerIndex === playerIndex;
                  const canClick = !isMe && isPlayerActive && royalePhase === 'reveal' && !hasActedThisPhase && gameRoom.gameState === 'playing';
                  const placement = royalePlacements.find(pl => pl.playerIndex === p.playerIndex);

                  return (
                    <div key={p.playerIndex} className={`flex flex-col items-center ${isMe ? 'opacity-90' : ''}`}>
                      <h3 className="text-sm font-semibold mb-1 text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        <span className={isMe ? "text-blue-600 dark:text-blue-400" : "text-purple-600 dark:text-purple-400"}>
                          {isMe ? "Your" : `${p.name}'s`}
                        </span> Grid
                        {isMe && <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full text-blue-600 dark:text-blue-400">You</span>}
                        {placement && (
                          <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full text-amber-700 dark:text-amber-300">
                            {placement.place === 1 ? "1st" : placement.place === 2 ? "2nd" : placement.place === 3 ? "3rd" : "4th"}
                          </span>
                        )}
                      </h3>
                      <GameGrid
                        key={`royale-${p.playerIndex}-${gameRoom.imageHashes[p.playerIndex]}-${gameResetKey}`}
                        imageHash={gameRoom.imageHashes[p.playerIndex] || ''}
                        revealedTiles={gameRoom.revealedTiles[p.playerIndex] || []}
                        isMyTurn={canClick}
                        isOpponentGrid={!isMe}
                        onTileClick={canClick ? (tileIndex) => handleRoyaleTileClick(tileIndex, p.playerIndex) : undefined}
                        disabled={!canClick}
                        compact
                        reveal2x2Mode={selectedPowerUp === 'reveal2x2'}
                        peekMode={selectedPowerUp === 'peek'}
                        peekTiles={peekTargetPlayerIndex === p.playerIndex ? peekTiles : []}
                        revealLineMode={selectedPowerUp === 'revealLine'}
                        lineDirection={lineDirection}
                      />

                      {!isMe && gameRoom.gameState === 'playing' && gameRoom.maskedImageNames && playerIndex !== null && (
                        <div className="mt-2 w-full max-w-[min(100%,420px)] px-0.5">
                          <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
                                Guess {p.name}&apos;s image
                              </p>
                              <div className="font-mono text-base sm:text-lg tracking-[0.2em] text-gray-800 dark:text-gray-100 overflow-x-auto whitespace-nowrap">
                                {(getRoyaleMaskedLineForTarget(p.playerIndex) || '________').split('').map((ch, i) => (
                                  <span
                                    key={i}
                                    className={
                                      ch === '_'
                                        ? 'text-gray-400 dark:text-gray-500'
                                        : 'text-green-600 dark:text-green-400 font-bold'
                                    }
                                  >
                                    {ch === ' ' ? '\u00A0\u00A0' : ch}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleUseHint(p.playerIndex)}
                              disabled={myPoints < 3 || gameRoom.gameState !== 'playing'}
                              className="shrink-0 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors flex flex-col items-center leading-tight"
                              title="Reveal a random letter in this image name (costs 3 points)"
                            >
                              <span>Hint</span>
                              <span className="text-[10px] opacity-90">(3 pts)</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Guess Phase UI */}
              {royalePhase === 'guess' && isPlayerActive && gameRoom.gameState === 'playing' && (
                <div className="max-w-2xl mx-auto space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Select whose image to guess, then type your answer:
                    </p>
                    <GridSelector
                      players={gameRoom.players}
                      myPlayerIndex={playerIndex}
                      activePlayers={royaleActivePlayers}
                      placedPlayers={royalePlacedPlayers}
                      selectedTarget={royaleGuessTarget}
                      onSelectTarget={setRoyaleGuessTarget}
                    />
                  </div>
                  <GuessInput
                    onSubmitGuess={handleSubmitGuess}
                    disabled={hasActedThisPhase || royaleGuessTarget === null}
                    gameState={gameRoom.gameState}
                  />
                  {!hasActedThisPhase && (
                    <button
                      onClick={handleRoyaleSkipGuess}
                      className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                    >
                      Skip guessing this round
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Right: PowerUps Sidebar */}
            <div className="xl:sticky xl:top-8 xl:self-start">
              <PowerUpsSidebar
                myPoints={myPoints}
                opponentPoints={Math.max(
                  0,
                  ...gameRoom.players
                    .filter((p) => p.playerIndex !== playerIndex)
                    .map((p) => gameRoom.points[p.playerIndex] || 0)
                )}
                allPlayerPoints={gameRoom.points}
                isMyTurn={isPlayerActive && (royalePhase === 'reveal' || royalePhase === 'guess')}
                selectedPowerUp={selectedPowerUp}
                onUsePowerUp={(powerUpId, tileIndex, lineType, lineIndex, targetPlayerIndex) => {
                  handleUsePowerUp(powerUpId, tileIndex, lineType, lineIndex, targetPlayerIndex);
                }}
                disabled={gameRoom.gameState !== 'playing'}
                isFrozen={isFrozen}
                gameMode="royale"
                players={gameRoom.players}
                myPlayerIndex={playerIndex}
                activePlayers={royaleActivePlayers}
              />
            </div>
          </div>
        ) : (
          /* ═══ NORMAL MODE UI ═══ */
          <>
        {/* Player Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <PlayerInfo
            playerName={myName}
            points={myPoints}
            isActive={isMyTurn}
            isYou={true}
          />
          <PlayerInfo
            playerName={opponentName}
            points={opponentPoints}
            isActive={!isMyTurn && gameRoom.gameState === 'playing'}
            isYou={false}
            aiBadge={!!gameRoom.vsAi}
            aiDifficultyLabel={gameRoom.aiDifficulty}
          />
        </div>

        {/* Game Status */}
        <GameStatus
          isMyTurn={isMyTurn}
          opponentConnected={opponentConnected}
          gameState={gameRoom.gameState}
          winner={gameRoom.winner}
          playerIndex={playerIndex}
          myName={myName}
          opponentName={opponentName}
        />

        {/* Main Content with Sidebar */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_350px] gap-6">
          {/* Left: Game Area */}
          <div className="space-y-6">
            {/* Game Grids */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Opponent's Grid */}
          <div className="flex flex-col items-center">
            <h3 className="text-xl font-semibold mb-4 text-purple-600 dark:text-purple-400">
              Opponent&apos;s Grid
            </h3>
            <GameGrid
              key={`opponent-${opponentImageHash}-${gameResetKey}`}
              imageHash={opponentImageHash}
              revealedTiles={opponentRevealedTiles}
              isMyTurn={isMyTurn}
              isOpponentGrid={true}
              onTileClick={handleTileClick}
              disabled={gameRoom.gameState !== 'playing'}
              reveal2x2Mode={selectedPowerUp === 'reveal2x2'}
              peekMode={selectedPowerUp === 'peek'}
              peekTiles={peekTiles}
              revealLineMode={selectedPowerUp === 'revealLine'}
              lineDirection={lineDirection}
            />

            {/* Revealed answer after game ends */}
            {gameRoom.gameState === 'finished' && revealedImageNames && playerIndex !== null && (
              <div className="mt-4 w-full max-w-[600px]">
                <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg px-4 py-3 text-center">
                  <p className="text-xs text-green-600 dark:text-green-400 mb-1 font-medium">Answer</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300 capitalize">{revealedImageNames[1 - playerIndex]}</p>
                </div>
              </div>
            )}

            {/* Word Hint Display */}
            {gameRoom.gameState === 'playing' && gameRoom.maskedImageNames && playerIndex !== null && (
              <div className="mt-4 w-full max-w-[600px]">
                <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Opponent&apos;s Image</p>
                    <div className="font-mono text-2xl tracking-[0.3em] text-gray-800 dark:text-gray-100 overflow-x-auto whitespace-nowrap">
                      {gameRoom.maskedImageNames[playerIndex]?.split("").map((ch, i) => (
                        <span
                          key={i}
                          className={ch === "_" ? "text-gray-400 dark:text-gray-500" : "text-green-600 dark:text-green-400 font-bold"}
                        >
                          {ch === " " ? "\u00A0\u00A0" : ch}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => handleUseHint()}
                    disabled={myPoints < 3 || gameRoom.gameState !== 'playing'}
                    className="shrink-0 px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                    title="Reveal a random letter (costs 3 points)"
                  >
                    <span>Hint</span>
                    <span className="text-xs opacity-90">(3 pts)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* My Grid */}
          <div className="flex flex-col items-center">
            <h3 className="text-xl font-semibold mb-4 text-blue-600 dark:text-blue-400">
              Your Grid
            </h3>
            <GameGrid
              key={`my-${myImageHash}-${gameResetKey}`}
              imageHash={myImageHash}
              revealedTiles={myRevealedTiles}
              isMyTurn={false}
              isOpponentGrid={false}
              disabled={true}
            />

            {/* Revealed answer after game ends */}
            {gameRoom.gameState === 'finished' && revealedImageNames && playerIndex !== null && (
              <div className="mt-4 w-full max-w-[600px]">
                <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg px-4 py-3 text-center">
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-1 font-medium">Answer</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 capitalize">{revealedImageNames[playerIndex]}</p>
                </div>
              </div>
            )}
              </div>
            </div>

            {/* Guess Input */}
            <div className="max-w-2xl mx-auto">
              <GuessInput
                onSubmitGuess={handleSubmitGuess}
                disabled={!isMyTurn}
                gameState={gameRoom.gameState}
              />
            </div>

            {/* Rematch Modal */}
            <AnimatePresence>
              {showRematchModal && gameRoom.gameState === 'finished' && (
                <motion.div
                  key="rematch-modal"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
                >
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0, y: 50 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.8, opacity: 0, y: 50 }}
                    transition={{ 
                      type: "spring",
                      stiffness: 300,
                      damping: 25
                    }}
                    className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-8 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
                  >
                  <h2 className="text-2xl font-bold text-white text-center mb-4">
                    Game Over!
                  </h2>

                  {/* ── STATE 1: No requests yet – show "Rematch" button / category picker ── */}
                  {!rematchRequested && !opponentRematchRequested && !showCategoryPicker && (
                    <>
                      <p className="text-gray-300 text-center mb-6">
                        Would you like a rematch?
                      </p>
                      <div className="space-y-3">
                        <button
                          onClick={() => setShowCategoryPicker(true)}
                          className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-semibold transition-all duration-200"
                        >
                          Rematch
                        </button>
                        <button
                          onClick={handleDeclineRematch}
                          className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-all duration-200"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => router.push("/")}
                          className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-semibold transition-all duration-200"
                        >
                          Back to Home
                        </button>
                      </div>
                    </>
                  )}

                  {/* ── STATE 1b: Category picker open ── */}
                  {!rematchRequested && !opponentRematchRequested && showCategoryPicker && (
                    <>
                      <p className="text-gray-300 text-center mb-4">
                        Pick a category for the rematch:
                      </p>
                      <div className="mb-4">
                        <CategorySelector
                          selectedCategory={rematchCategory}
                          onCategoryChange={setRematchCategory}
                          customQuery={rematchCustomQuery}
                          onCustomQueryChange={setRematchCustomQuery}
                        />
                      </div>
                      <div className="space-y-3">
                        <button
                          onClick={() => {
                            const cat = rematchCategory || gameRoom.category || 'landmarks';
                            const cq = cat === 'custom' ? rematchCustomQuery : undefined;
                            handleRematchRequest(cat, cq);
                          }}
                          disabled={rematchCategory === 'custom' && !rematchCustomQuery.trim()}
                          className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all duration-200"
                        >
                          Start Rematch
                        </button>
                        <button
                          onClick={() => setShowCategoryPicker(false)}
                          className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-all duration-200"
                        >
                          Back
                        </button>
                      </div>
                    </>
                  )}

                  {/* ── STATE 2: I requested, waiting on opponent ── */}
                  {rematchRequested && !opponentRematchRequested && (
                    <>
                      <p className="text-gray-300 text-center mb-6">
                        Waiting for opponent to accept rematch...
                      </p>
                      <button
                        onClick={handleDeclineRematch}
                        className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-all duration-200"
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  {/* ── STATE 3: Opponent requested, I haven't accepted yet ── */}
                  {!rematchRequested && opponentRematchRequested && (
                    <>
                      <p className="text-gray-300 text-center mb-2">
                        Your opponent wants a rematch!
                      </p>
                      {opponentRematchCategory && (
                        <p className="text-blue-400 text-center text-sm mb-4">
                          Category:{' '}
                          <span className="font-semibold">
                            {opponentRematchCategory === 'custom' && opponentRematchCustomQuery
                              ? `"${opponentRematchCustomQuery}"`
                              : opponentRematchCategory}
                          </span>
                        </p>
                      )}
                      <div className="space-y-3">
                        <button
                          onClick={() => handleRematchRequest()}
                          className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-semibold transition-all duration-200"
                        >
                          Accept Rematch
                        </button>
                        <button
                          onClick={handleDeclineRematch}
                          className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-all duration-200"
                        >
                          Decline
                        </button>
                      </div>
                    </>
                  )}

                  {/* ── STATE 4: Both ready ── */}
                  {rematchRequested && opponentRematchRequested && (
                    <p className="text-green-400 text-center font-semibold">
                      Both players ready! Starting rematch...
                    </p>
                  )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right: PowerUps Sidebar */}
          <div className="xl:sticky xl:top-8 xl:self-start">
            <PowerUpsSidebar
              myPoints={myPoints}
              opponentPoints={opponentPoints}
              isMyTurn={isMyTurn}
              selectedPowerUp={selectedPowerUp}
              onUsePowerUp={(powerUpId, tileIndex, lineType, lineIndex, targetPlayerIndex) => {
                handleUsePowerUp(powerUpId, tileIndex, lineType, lineIndex, targetPlayerIndex);
              }}
              disabled={gameRoom.gameState !== 'playing'}
              isFrozen={isFrozen}
              gameMode={gameRoom.gameMode}
              players={gameRoom.players}
              myPlayerIndex={playerIndex}
              activePlayers={royaleActivePlayers}
            />
          </div>
        </div>
          </>
        )}

        {/* Royale Leaderboard Modal */}
        <AnimatePresence>
          {showRoyaleLeaderboard && isRoyale && gameRoom.gameState === 'finished' && (
            <RoyaleLeaderboard
              placements={royalePlacements}
              imageNames={royaleImageNames}
              players={gameRoom.players}
              imageHashes={gameRoom.imageHashes ?? []}
              myPlayerIndex={playerIndex}
              onClose={() => setShowRoyaleLeaderboard(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

