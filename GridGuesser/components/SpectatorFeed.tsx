"use client";

import { motion, AnimatePresence } from "framer-motion";

export type FeedEventType =
  | "tile"
  | "guessCorrect"
  | "guessWrong"
  | "hint"
  | "powerup"
  | "info";

export interface FeedEvent {
  id: string;
  type: FeedEventType;
  timestamp: number;
  playerIndex?: number;
  playerName?: string;
  message: string;
}

interface SpectatorFeedProps {
  events: FeedEvent[];
}

const PLAYER_COLORS = [
  "text-blue-600 dark:text-blue-400",
  "text-purple-600 dark:text-purple-400",
  "text-pink-600 dark:text-pink-400",
  "text-teal-600 dark:text-teal-400",
];

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function iconFor(type: FeedEventType): string {
  switch (type) {
    case "tile":
      return "\u25A0"; // ■
    case "guessCorrect":
      return "\u2713"; // ✓
    case "guessWrong":
      return "\u2717"; // ✗
    case "hint":
      return "\u270E"; // ✎
    case "powerup":
      return "\u26A1"; // ⚡
    case "info":
    default:
      return "\u2022"; // •
  }
}

function bgFor(type: FeedEventType): string {
  switch (type) {
    case "guessCorrect":
      return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
    case "guessWrong":
      return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
    case "hint":
      return "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";
    case "powerup":
      return "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800";
    case "tile":
      return "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800";
    case "info":
    default:
      return "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700";
  }
}

export default function SpectatorFeed({ events }: SpectatorFeedProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 h-full max-h-[70vh] flex flex-col">
      <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
        <span aria-hidden>&#128240;</span> Live Feed
      </h3>

      {events.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500 italic">
          Waiting for something to happen&hellip;
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          <AnimatePresence initial={false}>
            {events.map((ev) => {
              const colorClass =
                ev.playerIndex !== undefined
                  ? PLAYER_COLORS[ev.playerIndex % PLAYER_COLORS.length]
                  : "text-gray-700 dark:text-gray-300";

              return (
                <motion.div
                  key={ev.id}
                  layout
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className={`border rounded-lg px-3 py-2 text-sm ${bgFor(ev.type)}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg leading-none mt-0.5" aria-hidden>
                      {iconFor(ev.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      {ev.playerName && (
                        <span className={`font-semibold ${colorClass}`}>{ev.playerName} </span>
                      )}
                      <span className="text-gray-700 dark:text-gray-200">{ev.message}</span>
                    </div>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 font-mono">
                      {formatTime(ev.timestamp)}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
