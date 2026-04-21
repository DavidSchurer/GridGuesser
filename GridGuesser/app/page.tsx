"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import UserProfile from "../components/UserProfile";
import CategorySelector from "../components/CategorySelector";
import GameModeSelector from "../components/GameModeSelector";
import { useAuth } from "../lib/authContext";
import { connectSocket, disconnectSocket } from "../lib/socket";
import { GameMode, AiDifficulty } from "../lib/types";

interface RejoinInfo {
  roomId: string;
  gameState: string;
  playerIndex: number;
  playerName: string;
  opponentName: string | null;
  category?: string;
}

export default function Home() {
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [showModeSelection, setShowModeSelection] = useState(false);
  const [showCategorySelection, setShowCategorySelection] = useState(false);
  const [selectedMode, setSelectedMode] = useState<GameMode>("normal");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [selectedCategory, setSelectedCategory] = useState("landmarks");
  const [customQuery, setCustomQuery] = useState("");
  const [vsAi, setVsAi] = useState(false);
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>("medium");
  const [action, setAction] = useState<'create' | 'join' | null>(null);
  const [rejoinInfo, setRejoinInfo] = useState<RejoinInfo | null>(null);
  const [spectateCode, setSpectateCode] = useState("");
  const [spectateError, setSpectateError] = useState<string | null>(null);
  const [isValidatingSpectate, setIsValidatingSpectate] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  // On mount, check localStorage for an active game and verify it with the server
  useEffect(() => {
    let savedGame: { roomId: string; playerIndex: number; playerId: string } | null = null;
    try {
      savedGame = JSON.parse(localStorage.getItem('gridguesser_active_game') || 'null');
    } catch {}

    if (!savedGame?.roomId || !savedGame?.playerId) return;

    const sock = connectSocket();

    sock.emit("check-rejoin", { roomId: savedGame.roomId, playerId: savedGame.playerId }, (canRejoin: boolean, info?: RejoinInfo) => {
      if (canRejoin && info) {
        setRejoinInfo(info);
      } else {
        localStorage.removeItem('gridguesser_active_game');
      }
      disconnectSocket();
    });

    return () => { disconnectSocket(); };
  }, []);

  const handleRejoin = () => {
    if (!rejoinInfo) return;
    router.push(`/game/${rejoinInfo.roomId}?rejoin=1`);
  };

  const handleDismissRejoin = () => {
    localStorage.removeItem('gridguesser_active_game');
    setRejoinInfo(null);
  };

  const handleSpectateClick = () => {
    const code = spectateCode.trim().toUpperCase();
    if (code.length < 4) {
      setSpectateError("Enter a valid spectator code");
      return;
    }
    setSpectateError(null);
    setIsValidatingSpectate(true);

    const sock = connectSocket();
    sock.emit(
      "validate-spectator-code",
      { code },
      (result: { valid: boolean; roomId?: string; error?: string }) => {
        setIsValidatingSpectate(false);
        disconnectSocket();
        if (result.valid) {
          router.push(`/spectate/${code}`);
        } else {
          setSpectateError(result.error || "Invalid spectator code");
        }
      }
    );
  };

  const handleCreateClick = () => {
    setVsAi(false);
    setAction('create');
    setShowModeSelection(true);
  };

  const handleVsAiClick = () => {
    setVsAi(true);
    setSelectedMode("normal");
    setAction('create');
    setShowCategorySelection(true);
  };

  const handleModeSelected = () => {
    setShowModeSelection(false);
    setShowCategorySelection(true);
  };

  const handleCategorySelected = () => {
    setShowCategorySelection(false);
    setShowNameInput(true);
  };

  const handleJoinClick = () => {
    if (roomCode.length === 6) {
      setAction('join');
      setShowNameInput(true);
    }
  };

  const handleNameSubmit = () => {
    const finalName = user ? user.username : (playerName.trim() || 'Guest');
    if (!user && playerName.trim().length === 0) return;

    if (action === 'create') {
      setIsCreating(true);
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      let url = `/game/${code}?name=${encodeURIComponent(finalName)}&category=${encodeURIComponent(selectedCategory)}&gameMode=${selectedMode}`;
      if (selectedMode === 'royale') {
        url += `&maxPlayers=${maxPlayers}`;
      }
      if (selectedCategory === 'custom' && customQuery.trim()) {
        url += `&customQuery=${encodeURIComponent(customQuery.trim())}`;
      }
      if (vsAi && selectedMode === 'normal') {
        url += `&vsAi=1&aiDifficulty=${encodeURIComponent(aiDifficulty)}`;
      }

      router.push(url);
    } else if (action === 'join') {
      router.push(`/game/${roomCode}?name=${encodeURIComponent(finalName)}`);
    }
  };

  const handleBackToMain = () => {
    setShowNameInput(false);
    setShowCategorySelection(false);
    setShowModeSelection(false);
    setAction(null);
    setPlayerName("");
    setVsAi(false);
  };

  const handleBackFromName = () => {
    setShowNameInput(false);
    if (action === 'create') {
      setShowCategorySelection(true);
    } else {
      handleBackToMain();
    }
  };

  const handleBackFromCategory = () => {
    setShowCategorySelection(false);
    if (vsAi) {
      setVsAi(false);
      setAction(null);
    } else {
      setShowModeSelection(true);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="absolute top-4 right-4">
        <UserProfile />
      </div>
      
      <div className="max-w-2xl w-full">
        <div className="text-center mb-12 animate-slide-up">
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            GridGuesser
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Reveal tiles, guess images, win the game!
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 space-y-6">
          {showModeSelection ? (
            /* Game Mode Selection Screen */
            <div className="space-y-6 animate-slide-up">
              <button
                onClick={handleBackToMain}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1"
              >
                ← Back
              </button>
              
              <div>
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
                  Choose Game Mode
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Select how you want to play
                </p>
                
                <GameModeSelector
                  selectedMode={selectedMode}
                  onModeChange={setSelectedMode}
                  maxPlayers={maxPlayers}
                  onMaxPlayersChange={setMaxPlayers}
                />
                
                <button
                  onClick={handleModeSelected}
                  className="w-full mt-6 py-4 px-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold text-lg transition-all duration-200 transform hover:scale-105"
                >
                  Continue
                </button>
              </div>
            </div>
          ) : showCategorySelection ? (
            /* Category Selection Screen */
            <div className="space-y-6 animate-slide-up">
              <button
                onClick={handleBackFromCategory}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1"
              >
                ← Back
              </button>
              
              <div>
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
                  Choose a Category
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Images will be fetched from this category for your game
                </p>
                
                <CategorySelector
                  selectedCategory={selectedCategory}
                  onCategoryChange={setSelectedCategory}
                  customQuery={customQuery}
                  onCustomQueryChange={setCustomQuery}
                />

                {vsAi && (
                  <div className="mt-6 space-y-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">AI difficulty</p>
                    <div className="flex flex-wrap gap-2">
                      {(['easy', 'medium', 'hard'] as const).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setAiDifficulty(d)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                            aiDifficulty === d
                              ? "bg-emerald-600 text-white"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <button
                  onClick={handleCategorySelected}
                  disabled={selectedCategory === 'custom' && customQuery.trim().length === 0}
                  className="w-full mt-6 py-4 px-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold text-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  Continue
                </button>
              </div>
            </div>
          ) : showNameInput ? (
            /* Name Input Screen */
            <div className="space-y-6 animate-slide-up">
              <button
                onClick={handleBackFromName}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1"
              >
                ← Back
              </button>
              
              <div>
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
                  {user ? `Ready to play, ${user.username}?` : "What's your name?"}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {user ? "Continue to start the game" : "Your opponent will see this during the game"}
                </p>
                
                {!user && (
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value.slice(0, 20))}
                    onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
                    placeholder="Enter your name"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-lg mb-4"
                    maxLength={20}
                    autoFocus
                  />
                )}
                
                <button
                  onClick={handleNameSubmit}
                  disabled={!user && playerName.trim().length === 0}
                  className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold text-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {action === 'create' ? 'Create Game' : 'Join Game'}
                </button>
              </div>
            </div>
          ) : (
            /* Main Menu Screen */
            <>
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
                  Start Playing
                </h2>
                
                <button
                  onClick={handleCreateClick}
                  disabled={isCreating}
                  className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold text-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isCreating ? "Creating Room..." : "Create New Game"}
                </button>

                <button
                  type="button"
                  onClick={handleVsAiClick}
                  disabled={isCreating}
                  className="w-full py-4 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-semibold text-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  Play vs AI
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white dark:bg-gray-800 text-gray-500">
                      OR
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Join with Room Code
                  </label>
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Enter 6-digit code"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-center text-2xl tracking-widest"
                    maxLength={6}
                  />
                  <button
                    onClick={handleJoinClick}
                    disabled={roomCode.length !== 6}
                    className="w-full py-4 px-6 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl font-semibold text-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    Join Game
                  </button>
                </div>

                <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <span aria-hidden>&#128065;</span> Spectate a Game
                  </label>
                  <input
                    type="text"
                    value={spectateCode}
                    onChange={(e) => {
                      setSpectateError(null);
                      setSpectateCode(e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase());
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleSpectateClick()}
                    placeholder="Enter spectator code"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-center text-2xl tracking-widest font-mono"
                    maxLength={6}
                  />
                  {spectateError && (
                    <p className="text-sm text-red-500 dark:text-red-400">{spectateError}</p>
                  )}
                  <button
                    onClick={handleSpectateClick}
                    disabled={spectateCode.length < 4 || isValidatingSpectate}
                    className="w-full py-4 px-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-semibold text-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isValidatingSpectate ? "Checking..." : "Spectate Game"}
                  </button>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">
                  How to Play:
                </h3>
                <ul className="space-y-2 text-gray-600 dark:text-gray-400 text-sm">
                  <li>• Create a game and share the invite link or room code</li>
                  <li>• Your friend can paste the link in their browser or enter the code here</li>
                  <li>• Each player gets a hidden 10x10 grid image</li>
                  <li>• Take turns revealing tiles from your opponent&apos;s grid</li>
                  <li>• First to correctly guess the opponent&apos;s image wins!</li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Rejoin Popup */}
        <AnimatePresence>
          {rejoinInfo && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="mt-6 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/20 border border-amber-300 dark:border-amber-700 rounded-2xl shadow-xl p-6"
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl shrink-0">&#9889;</div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                    Game in progress
                  </h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                    You have an active game in room <span className="font-mono font-bold">{rejoinInfo.roomId}</span>
                  </p>
                  {rejoinInfo.opponentName && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Playing against <span className="font-semibold">{rejoinInfo.opponentName}</span>
                      {rejoinInfo.category && <> &middot; {rejoinInfo.category}</>}
                    </p>
                  )}
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={handleRejoin}
                      className="flex-1 py-3 px-5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-semibold transition-all duration-200 transform hover:scale-105"
                    >
                      Rejoin Game
                    </button>
                    <button
                      onClick={handleDismissRejoin}
                      className="py-3 px-5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
