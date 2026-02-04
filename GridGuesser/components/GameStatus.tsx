"use client";

import { motion } from "framer-motion";

interface GameStatusProps {
  isMyTurn: boolean;
  opponentConnected: boolean;
  gameState: 'waiting' | 'playing' | 'finished';
  winner?: 0 | 1;
  playerIndex: 0 | 1 | null;
  myName?: string;
  opponentName?: string;
}

export default function GameStatus({
  isMyTurn,
  opponentConnected,
  gameState,
  winner,
  playerIndex,
  myName = 'You',
  opponentName = 'Opponent',
}: GameStatusProps) {
  const getStatusMessage = () => {
    if (gameState === 'waiting') {
      return {
        text: 'Waiting for opponent to join...',
        color: 'text-yellow-600 dark:text-yellow-400',
      };
    }

    if (gameState === 'finished') {
      if (winner === playerIndex) {
        return {
          text: 'You Won!',
          color: 'text-green-600 dark:text-green-400',
        };
      } else {
        return {
          text: 'You Lost',
          color: 'text-red-600 dark:text-red-400',
        };
      }
    }

    if (!opponentConnected) {
      return {
        text: `${opponentName} disconnected`,
        color: 'text-red-600 dark:text-red-400',
      };
    }

    if (isMyTurn) {
      return {
        text: `${myName}'s Turn - Click a tile!`,
        color: 'text-blue-600 dark:text-blue-400 animate-pulse',
      };
    }

    return {
      text: `${opponentName}'s Turn`,
      color: 'text-gray-600 dark:text-gray-400',
    };
  };

  const status = getStatusMessage();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
      <div className="flex items-center justify-center">
        <motion.h2
          key={status.text}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={`text-2xl font-bold ${status.color}`}
        >
          {status.text}
        </motion.h2>
      </div>
    </div>
  );
}

