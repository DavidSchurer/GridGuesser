"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import UserProfile from "../components/UserProfile";
import CategorySelector from "../components/CategorySelector";
import { useAuth } from "../lib/authContext";

export default function Home() {
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [showCategorySelection, setShowCategorySelection] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("landmarks");
  const [customQuery, setCustomQuery] = useState("");
  const [action, setAction] = useState<'create' | 'join' | null>(null);
  const router = useRouter();
  const { user } = useAuth();

  const handleCreateClick = () => {
    setAction('create');
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

      let url = `/game/${code}?name=${encodeURIComponent(finalName)}&category=${encodeURIComponent(selectedCategory)}`;
      if (selectedCategory === 'custom' && customQuery.trim()) {
        url += `&customQuery=${encodeURIComponent(customQuery.trim())}`;
      }

      router.push(url);
    } else if (action === 'join') {
      router.push(`/game/${roomCode}?name=${encodeURIComponent(finalName)}`);
    }
  };

  const handleBackToMain = () => {
    setShowNameInput(false);
    setShowCategorySelection(false);
    setAction(null);
    setPlayerName("");
  };

  const handleBackFromName = () => {
    setShowNameInput(false);
    if (action === 'create') {
      setShowCategorySelection(true);
    } else {
      handleBackToMain();
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
          {showCategorySelection ? (
            /* Category Selection Screen */
            <div className="space-y-6 animate-slide-up">
              <button
                onClick={handleBackToMain}
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
      </div>
    </main>
  );
}
