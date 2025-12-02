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
import Icon from "@/components/Icon";

export default function GameRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const { refreshProfile } = useAuth();

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

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    const socketInstance = connectSocket();
    setSocket(socketInstance);
    setRoomId(roomId);

    // Get player name and category from URL query params or use defaults
    const searchParams = new URLSearchParams(window.location.search);
    const playerName = searchParams.get('name') || 'Player';
    const selectedCategory = searchParams.get('category') || 'landmarks';

    // Try to create the room with the specific roomId
    // First check if room exists
    socketInstance.emit("get-game-state", roomId, (room: GameRoom | null) => {
      if (!room) {
        // Room doesn't exist, create it with this roomId
        socketInstance.emit("create-room-with-id", { roomId, playerName, category: selectedCategory }, (success: boolean, errorMsg?: string) => {
          if (success) {
            setPlayerIndex(0);
            console.log(`✅ Room created with category: ${selectedCategory}`);
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
        // Room exists with one player, join as second player
        console.log(`🎮 Joining room with category: ${room.category || 'unknown'}`);
        socketInstance.emit("join-room", { roomId, playerName }, (success: boolean, index?: 0 | 1, errorMsg?: string) => {
          if (success && index !== undefined) {
            setPlayerIndex(index);
            // Game will start automatically via game-start event
            // No need to fetch state here as it will be fetched in the game-start handler
          } else {
            setError(errorMsg || "Failed to join room");
          }
        });
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
      
      // Fetch updated game state
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

      // Show notification for opponent's move
      if (data.revealedBy !== playerIndex) {
        showNotification(`Opponent revealed a tile!`);
      }
    });

    // Listen for power-up usage
    socketInstance.on("power-up-used", (data: { powerUpId: string; usedBy: number; message: string; points: [number, number]; allRevealedTiles?: [number[], number[]]; currentTurn?: 0 | 1 }) => {
      showNotification(data.message);
      
      // Immediately update local game state with the revealed tiles
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
      }
      
      // Also fetch fresh game state to ensure synchronization
      setTimeout(() => {
        socketInstance.emit("get-game-state", roomId, (room: GameRoom | null) => {
          if (room) {
            setGameRoom(room);
          }
        });
      }, 100);
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
      showNotification(
        data.winner === playerIndex
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

    socket.emit("reveal-tile", { roomId, tileIndex }, (success: boolean, errorMsg?: string) => {
      if (!success) {
        showNotification(errorMsg || "Failed to reveal tile");
      }
    });
  };

  const handleUsePowerUp = (powerUpId: string, tileIndex?: number) => {
    if (!socket) return;

    socket.emit("use-power-up", { roomId, powerUpId, tileIndex }, (success: boolean, errorMsg?: string) => {
      if (!success) {
        showNotification(errorMsg || "Failed to use power-up");
      } else {
        showNotification("Power-up activated!");
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
            Room Code: <span className="font-mono font-bold text-2xl">{roomId}</span>
          </p>
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

        {/* Notification */}
        {notification && (
          <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg animate-slide-up">
            {notification}
          </div>
        )}

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
              <span className="text-purple-600 dark:text-purple-400">{opponentName}'s</span> Grid - Guess This!
              <Icon name="target" size={24} className="text-red-500" />
            </h3>
            <GameGrid
              imageHash={opponentImageHash}
              revealedTiles={opponentRevealedTiles}
              isMyTurn={isMyTurn}
              isOpponentGrid={true}
              onTileClick={handleTileClick}
              disabled={gameRoom.gameState !== 'playing'}
              reveal2x2Mode={selectedPowerUp === 'reveal2x2'}
            />
          </div>

          {/* My Grid */}
          <div className="flex flex-col items-center">
            <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <span className="text-blue-600 dark:text-blue-400">Your</span> Grid ({myName}) - They're Guessing This!
              <Icon name="image" size={24} className="text-purple-500" />
            </h3>
            <GameGrid
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

            {/* Game Over Actions */}
            {gameRoom.gameState === 'finished' && (
              <div className="max-w-md mx-auto mt-8 text-center">
                <button
                  onClick={() => router.push("/")}
                  className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-semibold text-lg transition-all duration-200 transform hover:scale-105"
                >
                  Play Again
                </button>
              </div>
            )}
          </div>

          {/* Right: PowerUps Sidebar */}
          <div className="xl:sticky xl:top-8 xl:self-start">
            <PowerUpsSidebar
              myPoints={myPoints}
              opponentPoints={opponentPoints}
              isMyTurn={isMyTurn}
              onUsePowerUp={(powerUpId, tileIndex) => {
                if (powerUpId === 'reveal2x2') {
                  setSelectedPowerUp(powerUpId);
                } else if (powerUpId === 'cancel') {
                  setSelectedPowerUp(null);
                } else {
                  handleUsePowerUp(powerUpId, tileIndex);
                }
              }}
              disabled={gameRoom.gameState !== 'playing'}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

