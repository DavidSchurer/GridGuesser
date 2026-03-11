"use client";

import React, { useState } from "react";
import { GameMode } from "@/lib/types";

interface GameModeSelectorProps {
  selectedMode: GameMode;
  onModeChange: (mode: GameMode) => void;
  maxPlayers: number;
  onMaxPlayersChange: (count: number) => void;
}

export default function GameModeSelector({
  selectedMode,
  onModeChange,
  maxPlayers,
  onMaxPlayersChange,
}: GameModeSelectorProps) {
  return (
    <div className="space-y-4">
      <button
        onClick={() => onModeChange("normal")}
        className={`
          w-full p-5 rounded-xl border-2 transition-all duration-200 text-left
          ${
            selectedMode === "normal"
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg"
              : "border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500"
          }
        `}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">&#9876;&#65039;</span>
          <div>
            <div className="font-bold text-lg text-gray-800 dark:text-gray-100">
              Normal
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Classic 1v1. Take turns revealing tiles and guess your opponent&apos;s
              image.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              2 players
            </p>
          </div>
        </div>
      </button>

      <button
        onClick={() => onModeChange("royale")}
        className={`
          w-full p-5 rounded-xl border-2 transition-all duration-200 text-left
          ${
            selectedMode === "royale"
              ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20 shadow-lg"
              : "border-gray-300 dark:border-gray-600 hover:border-orange-400 dark:hover:border-orange-500"
          }
        `}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">&#128081;</span>
          <div>
            <div className="font-bold text-lg text-gray-800 dark:text-gray-100">
              Grid Royale
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Free-for-all with 3-4 players. Timed rounds, guess any opponent&apos;s
              image, race to 1st place!
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              3-4 players &middot; 20s rounds
            </p>
          </div>
        </div>
      </button>

      {selectedMode === "royale" && (
        <div className="p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-xl animate-slide-up">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Number of Players
          </label>
          <div className="flex gap-3">
            {[3, 4].map((count) => (
              <button
                key={count}
                onClick={() => onMaxPlayersChange(count)}
                className={`
                  flex-1 py-3 px-4 rounded-lg font-semibold text-lg transition-all duration-200
                  ${
                    maxPlayers === count
                      ? "bg-orange-500 text-white shadow-md"
                      : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:border-orange-400"
                  }
                `}
              >
                {count} Players
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
