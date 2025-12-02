"use client";

import { useState } from "react";

interface GuessInputProps {
  onSubmitGuess: (guess: string) => void;
  disabled?: boolean;
  gameState: 'waiting' | 'playing' | 'finished';
}

export default function GuessInput({
  onSubmitGuess,
  disabled = false,
  gameState,
}: GuessInputProps) {
  const [guess, setGuess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!guess.trim() || isSubmitting || gameState !== 'playing') {
      return;
    }

    setIsSubmitting(true);
    onSubmitGuess(guess.trim());
    
    // Clear input after a short delay
    setTimeout(() => {
      setGuess("");
      setIsSubmitting(false);
    }, 500);
  };

  if (gameState !== 'playing') {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mt-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="guess"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Think you know the image? Make your guess!
          </label>
          <div className="flex gap-3">
            <input
              id="guess"
              type="text"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder="Enter your guess..."
              disabled={disabled || isSubmitting}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!guess.trim() || disabled || isSubmitting}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isSubmitting ? 'Submitting...' : 'Guess'}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Tip: Be specific! Include key details of what you see.
        </p>
      </form>
    </div>
  );
}

