"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { useGameStore } from "@/lib/gameStore";
import { useAuth } from "@/lib/authContext";
import { GameRoom } from "@/lib/types";
import GameGrid from "@/components/GameGrid";
import GameStatus from "@/components/GameStatus";
import GuessInput from "@/components/GuessInput";
import RoomCodeDisplay from "@/components/RoomCodeDisplay";
import PowerUpsSidebar from "@/components/PowerUpsSidebar";
import PlayerInfo from "@/components/PlayerInfo";
import CategorySelector from "@/components/CategorySelector";
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

  // New power-up states
  const [peekTiles, setPeekTiles] = useState<number[]>([]); // tiles temporarily visible via Peek
  const [isFrozen, setIsFrozen] = useState(false); // whether this player is frozen

  // Invite link join flow: prompt for name when arriving without one
  const [showJoinPrompt, setShowJoinPrompt] = useState(false);
  const [joinName, setJoinName] = useState("");

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

  useEffect(() => {
    const socketInstance = connectSocket();
    setSocket(socketInstance);
    setRoomId(roomId);

    // Get player name and category from URL query params or use defaults
    const searchParams = new URLSearchParams(window.location.search);
    const playerName = searchParams.get('name');
    const selectedCategory = searchParams.get('category') || 'landmarks';
    const customQuery = searchParams.get('customQuery') || '';

    // Try to create the room with the specific roomId
    // First check if room exists
    socketInstance.emit("get-game-state", roomId, (room: GameRoom | null) => {
      if (!room) {
        // Room doesn't exist, create it with this roomId
        const roomData = { 
          roomId, 
          playerName: playerName || 'Player', 
          category: selectedCategory,
          ...(customQuery && { customQuery })
        };
        
        socketInstance.emit("create-room-with-id", roomData, (success: boolean, errorMsg?: string) => {
          if (success) {
            setPlayerIndex(0);
            console.log(`✅ Room created with category: ${selectedCategory}${customQuery ? ` (custom: "${customQuery}")` : ''}`);
            // Fetch the newly created room state
            socketInstance.emit("get-game-state", roomId, (newRoom: GameRoom | null) => {
              if (newRoom) {
                setGameRoom(newRoom);
              }
            });
          } else {
            setError(errorMsg || "Failed to create room");
          }
        });
      } else if (room.gameState === 'waiting' && room.players.length === 1) {
        // Room exists with one player – this is a joiner
        if (playerName) {
          // Name provided via URL (e.g. from the landing page join flow)
          joinRoomWithName(socketInstance, playerName);
        } else {
          // No name in URL – arrived via invite link, show name prompt
          setShowJoinPrompt(true);
        }
      } else if (room.gameState === 'playing' && room.players.length === 2) {
        // Game already in progress
        setError("Game is already in progress with 2 players");
      } else {
        setError("Unable to join this room");
      }
    });

    // Listen for game start
    socketInstance.on("game-start", (data: { roomId: string; players: any[]; currentTurn: 0 | 1; images: [string, string] }) => {
      setOpponentConnected(true);
      showNotification("Opponent joined! Game starting...");
      
      // Clear any previous game state (especially for rematches)
      const currentRoom = useGameStore.getState().gameRoom;
      if (currentRoom) {
        setGameRoom({
          ...currentRoom,
          revealedTiles: [[], []],
          points: [0, 0],
          currentTurn: data.currentTurn,
          gameState: 'playing',
        });
      }
      
      // Fetch updated game state with new images
      socketInstance.emit("get-game-state", roomId, (room: GameRoom | null) => {
        if (room) {
          setGameRoom(room);
        }
      });
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
        // Auto-hide after 5 seconds
        setTimeout(() => {
          setPeekTiles([]);
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
    socketInstance.on("wrong-guess", (data: { playerIndex: number; guess: string; currentTurn: 0 | 1 }) => {
      if (data.playerIndex === playerIndex) {
        showNotification(`Wrong guess: "${data.guess}". Try again!`);
      } else {
        showNotification(`Opponent guessed wrong: "${data.guess}"`);
      }

      // Update game state
      socketInstance.emit("get-game-state", roomId, (room: GameRoom | null) => {
        if (room) {
          setGameRoom(room);
        }
      });
    });

    // Listen for game end
    socketInstance.on("game-end", (data: { winner: number; winnerGuess: string; correctAnswer: string }) => {
      // Get current playerIndex from store to avoid stale closure value
      const currentPlayerIndex = useGameStore.getState().playerIndex;
      
      showNotification(
        data.winner === currentPlayerIndex
          ? `You won! The answer was: ${data.correctAnswer}`
          : `You lost! The answer was: ${data.correctAnswer}`
      );

      // Update game state
      socketInstance.emit("get-game-state", roomId, (room: GameRoom | null) => {
        if (room) {
          setGameRoom(room);
        }
      });

      // Refresh user profile to get updated stats
      refreshProfile().catch(error => console.error("Error refreshing profile:", error));
      
      // Show rematch modal after a short delay – pre-fill category from current game
      setTimeout(() => {
        const currentRoom = useGameStore.getState().gameRoom;
        if (currentRoom?.category) {
          setRematchCategory(currentRoom.category);
          setRematchCustomQuery(currentRoom.customQuery || '');
        }
        setShowRematchModal(true);
      }, 2000);
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
    socketInstance.on("hint-revealed", (data: { playerIndex: number; charIndex: number; char: string; revealedHints: [number[], number[]]; points: [number, number] }) => {
      const currentPlayerIndex = useGameStore.getState().playerIndex;
      const currentRoom = useGameStore.getState().gameRoom;
      if (currentRoom) {
        // Update maskedImageNames locally for the player who bought the hint
        const updatedMasked = [...(currentRoom.maskedImageNames || ["", ""])] as [string, string];
        if (data.playerIndex === currentPlayerIndex) {
          // This hint was for us – update our masked name
          const chars = updatedMasked[data.playerIndex].split("");
          if (data.charIndex < chars.length) {
            chars[data.charIndex] = data.char;
            updatedMasked[data.playerIndex] = chars.join("");
          }
        }
        setGameRoom({
          ...currentRoom,
          revealedHints: data.revealedHints,
          maskedImageNames: updatedMasked,
          points: data.points,
        });
      }
      if (data.playerIndex === currentPlayerIndex) {
        showNotification(`Hint: letter "${data.char.toUpperCase()}" revealed!`);
      } else {
        showNotification("Opponent used a hint!");
      }
    });

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

    return () => {
      disconnectSocket();
      reset();
    };
  }, [roomId]); // Only re-run if roomId changes

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

    socket.emit("reveal-tile", { roomId, tileIndex }, (success: boolean, errorMsg?: string) => {
      if (!success) {
        showNotification(errorMsg || "Failed to reveal tile");
      }
    });
  };

  const handleUsePowerUp = (powerUpId: string, tileIndex?: number, lineType?: 'row' | 'col', lineIndex?: number) => {
    if (!socket) return;

    // 'cancel' is a client-only action to exit selection mode
    if (powerUpId === 'cancel') {
      setSelectedPowerUp(null);
      return;
    }

    // For power-ups that need tile selection, just enter selection mode
    if ((powerUpId === 'reveal2x2' || powerUpId === 'peek') && tileIndex === undefined) {
      setSelectedPowerUp(powerUpId);
      return;
    }

    socket.emit("use-power-up", { roomId, powerUpId, tileIndex, lineType, lineIndex }, (success: boolean, errorMsg?: string) => {
      if (!success) {
        showNotification(errorMsg || "Failed to use power-up");
      }
    });
  };

  const handleUseHint = () => {
    if (!socket) return;

    socket.emit("use-hint", { roomId }, (success: boolean, errorMsg?: string) => {
      if (!success) {
        showNotification(errorMsg || "Failed to use hint");
      }
    });
  };

  const handleSubmitGuess = (guess: string) => {
    if (!socket || playerIndex === null) return;

    socket.emit("submit-guess", { roomId, guess }, (success: boolean, correct?: boolean, errorMsg?: string) => {
      if (!success) {
        showNotification(errorMsg || "Failed to submit guess");
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
            Waiting for opponent to join...
          </p>
          <RoomCodeDisplay roomCode={roomId} />
        </div>
      </main>
    );
  }

  const isMyTurn = gameRoom.currentTurn === playerIndex;
  const myImageHash = gameRoom.imageHashes[playerIndex];
  const opponentImageHash = gameRoom.imageHashes[1 - playerIndex];
  const myRevealedTiles = gameRoom.revealedTiles[playerIndex];
  const opponentRevealedTiles = gameRoom.revealedTiles[1 - playerIndex];
  const myPoints = gameRoom.points[playerIndex];
  const opponentPoints = gameRoom.points[1 - playerIndex];
  const myName = gameRoom.players[playerIndex]?.name || 'You';
  const opponentName = gameRoom.players[1 - playerIndex]?.name || 'Opponent';

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            ← Leave Game
          </button>
          <div className="text-center">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              GridGuesser
            </h1>
            <RoomCodeDisplay roomCode={roomId} />
          </div>
          <div className="w-24"></div>
        </div>

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
            <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <span className="text-purple-600 dark:text-purple-400">{opponentName}&apos;s</span> Grid - Guess This!
              <Icon name="target" size={24} className="text-red-500" />
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
            />

            {/* Word Hint Display */}
            {gameRoom.gameState === 'playing' && gameRoom.maskedImageNames && playerIndex !== null && (
              <div className="mt-4 w-full max-w-[600px]">
                <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Opponent&apos;s Image</p>
                    <div className="font-mono text-2xl tracking-[0.3em] text-gray-800 dark:text-gray-100 overflow-x-auto whitespace-nowrap">
                      {gameRoom.maskedImageNames[playerIndex].split("").map((ch, i) => (
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
                    onClick={handleUseHint}
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
            <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <span className="text-blue-600 dark:text-blue-400">Your</span> Grid ({myName}) - They&apos;re Guessing This!
              <Icon name="image" size={24} className="text-purple-500" />
            </h3>
            <GameGrid
              key={`my-${myImageHash}-${gameResetKey}`}
              imageHash={myImageHash}
              revealedTiles={myRevealedTiles}
              isMyTurn={false}
              isOpponentGrid={false}
              disabled={true}
            />
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
              onUsePowerUp={(powerUpId, tileIndex, lineType, lineIndex) => {
                handleUsePowerUp(powerUpId, tileIndex, lineType, lineIndex);
              }}
              disabled={gameRoom.gameState !== 'playing'}
              isFrozen={isFrozen}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

