"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../lib/authContext";

type LeaderboardFilter = "gamesPlayed" | "winRate" | "bestStreak" | "currentStreak";

interface LeaderboardEntry {
  userId: string;
  username: string;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  bestStreak: number;
  currentStreak: number;
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NEXT_PUBLIC_SOCKET_URL
    ? `${process.env.NEXT_PUBLIC_SOCKET_URL}/api`
    : "http://localhost:3001/api");

const FILTERS: { id: LeaderboardFilter; label: string }[] = [
  { id: "winRate", label: "Win Rate" },
  { id: "gamesPlayed", label: "Games Played" },
  { id: "bestStreak", label: "Best Streak" },
  { id: "currentStreak", label: "Current Streak" },
];

function formatStatValue(entry: LeaderboardEntry, filter: LeaderboardFilter): string {
  switch (filter) {
    case "winRate":
      return `${Math.round(entry.winRate)}% (${entry.gamesWon}/${entry.gamesPlayed})`;
    case "gamesPlayed":
      return `${entry.gamesPlayed}`;
    case "bestStreak":
      return `${entry.bestStreak}`;
    case "currentStreak":
      return `${entry.currentStreak}`;
  }
}

function rankBadgeClasses(rank: number): string {
  if (rank === 1) return "bg-gradient-to-br from-yellow-400 to-amber-500 text-gray-900";
  if (rank === 2) return "bg-gradient-to-br from-gray-300 to-gray-400 text-gray-900";
  if (rank === 3) return "bg-gradient-to-br from-amber-600 to-amber-800 text-white";
  return "bg-white/10 text-gray-300";
}

export default function Leaderboard() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<LeaderboardFilter>("winRate");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async (selected: LeaderboardFilter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/leaderboard?filter=${selected}`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.entries)) {
        setEntries(data.entries);
      } else {
        throw new Error(data.message || "Failed to load leaderboard");
      }
    } catch (e) {
      console.error("Leaderboard fetch error:", e);
      setError("Could not load leaderboard. Please try again.");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    fetchLeaderboard(filter);
  }, [isOpen, filter, fetchLeaderboard]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-3 px-4 py-2 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-lg hover:border-yellow-400 hover:bg-white/20 transition-all"
        aria-label="Open leaderboard"
      >
        <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-full flex items-center justify-center text-gray-900 font-bold text-lg shadow-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-6 h-6"
            aria-hidden="true"
          >
            <path d="M5 3h14a1 1 0 0 1 1 1v2a5 5 0 0 1-4 4.9V12a4 4 0 0 1-3 3.87V18h3a1 1 0 0 1 1 1v2H7v-2a1 1 0 0 1 1-1h3v-2.13A4 4 0 0 1 8 12v-1.1A5 5 0 0 1 4 6V4a1 1 0 0 1 1-1Zm-1 3a3 3 0 0 0 2 2.83V5H4v1Zm16 0V5h-2v3.83A3 3 0 0 0 20 6Z" />
          </svg>
        </div>
        <div className="text-left">
          <div className="text-sm font-bold text-white">Leaderboard</div>
          <div className="text-xs text-yellow-300 font-medium">Top 10 players</div>
        </div>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Leaderboard"
        >
          <div
            className="relative w-full max-w-lg bg-gray-900/95 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-white/10 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-white/10 bg-gradient-to-br from-yellow-500/20 to-amber-600/20 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Leaderboard</h2>
                <p className="text-sm text-gray-300">Top 10 players globally</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close leaderboard"
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-lg font-bold transition-colors"
              >
                &times;
              </button>
            </div>

            <div className="px-6 pt-4 pb-2 flex flex-wrap gap-2">
              {FILTERS.map((f) => {
                const active = filter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      active
                        ? "bg-emerald-600 text-white"
                        : "bg-white/10 text-gray-200 hover:bg-white/20"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            <div className="px-6 pb-6 pt-3 max-h-[60vh] overflow-y-auto">
              {loading ? (
                <ul className="space-y-2" aria-busy="true">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <li
                      key={i}
                      className="h-12 rounded-lg bg-white/5 animate-pulse"
                    />
                  ))}
                </ul>
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-sm text-red-300 mb-3">{error}</p>
                  <button
                    onClick={() => fetchLeaderboard(filter)}
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : entries.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-400">
                    No players have played any games yet. Be the first!
                  </p>
                </div>
              ) : (
                <ol className="space-y-2">
                  {entries.map((entry, idx) => {
                    const rank = idx + 1;
                    const isMe = user?.userId === entry.userId;
                    return (
                      <li
                        key={entry.userId}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                          isMe
                            ? "bg-blue-600/20 border-blue-500/50"
                            : "bg-white/5 border-white/5 hover:bg-white/10"
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${rankBadgeClasses(
                            rank
                          )}`}
                        >
                          {rank}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-white truncate">
                            {entry.username}
                            {isMe && (
                              <span className="ml-2 text-xs text-blue-300 font-medium">
                                (you)
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400">
                            {entry.gamesPlayed} games &middot; {entry.gamesWon} wins
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-base font-bold text-white">
                            {formatStatValue(entry, filter)}
                          </div>
                          <div className="text-[10px] uppercase tracking-wider text-gray-400">
                            {FILTERS.find((f) => f.id === filter)?.label}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
