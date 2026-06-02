"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ACHIEVEMENTS, TOTAL_ACHIEVEMENTS } from "../lib/achievements";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NEXT_PUBLIC_SOCKET_URL
    ? `${process.env.NEXT_PUBLIC_SOCKET_URL}/api`
    : "http://localhost:3001/api");

type UnlockedMap = Record<string, { unlockedAt: number }>;

// Inline SVGs keyed by AchievementDef.iconKey (the power-up id).
const ACHIEVEMENT_ICONS: Record<string, React.ReactNode> = {
  peek: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden="true">
      <path d="M12 5c-5 0-9.27 3.11-11 7.5C2.73 16.89 7 20 12 20s9.27-3.11 11-7.5C21.27 8.11 17 5 12 5Zm0 12.5A5 5 0 1 1 12 7.5a5 5 0 0 1 0 10Zm0-8A3 3 0 1 0 12 15.5 3 3 0 0 0 12 9.5Z" />
    </svg>
  ),
  skip: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden="true">
      <path d="M5 5a1 1 0 0 1 1.55-.83l9 6a1 1 0 0 1 0 1.66l-9 6A1 1 0 0 1 5 17V5Zm13 0a1 1 0 0 1 2 0v14a1 1 0 0 1-2 0V5Z" />
    </svg>
  ),
  revealLine: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden="true">
      <rect x="3" y="3" width="5.5" height="5.5" rx="1" />
      <rect x="9.75" y="3" width="5.5" height="5.5" rx="1" />
      <rect x="16.5" y="3" width="5.5" height="5.5" rx="1" />
      <rect x="3" y="9.75" width="5.5" height="5.5" rx="1" />
      <rect x="3" y="16.5" width="5.5" height="5.5" rx="1" />
    </svg>
  ),
  freeze: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden="true">
      <path d="M12 2a1 1 0 0 1 1 1v3.59l2.3-2.3a1 1 0 0 1 1.4 1.42L13 9.4v2.18l1.89-1.09 1.36-3.7a1 1 0 0 1 1.88.7l-.82 2.22 2.04-1.18a1 1 0 1 1 1 1.73l-2.04 1.18 2.22.82a1 1 0 0 1-.69 1.88l-3.7-1.36L13.41 12 16 13.59l3.7-1.36a1 1 0 0 1 .69 1.88l-2.22.82 2.04 1.18a1 1 0 1 1-1 1.73l-2.04-1.18.82 2.22a1 1 0 0 1-1.88.69l-1.36-3.7L13 14.6v2.18l3.7 3.7a1 1 0 0 1-1.4 1.42L13 19.6V23a1 1 0 0 1-2 0v-3.4l-2.3 2.3a1 1 0 1 1-1.4-1.42l3.7-3.7v-2.18l-1.89 1.09-1.36 3.7a1 1 0 1 1-1.88-.69l.82-2.22-2.04 1.18a1 1 0 0 1-1-1.73l2.04-1.18-2.22-.82a1 1 0 0 1 .69-1.88l3.7 1.36L10.59 12 8 10.41l-3.7 1.36a1 1 0 1 1-.69-1.88l2.22-.82-2.04-1.18a1 1 0 1 1 1-1.73l2.04 1.18-.82-2.22a1 1 0 0 1 1.88-.7l1.36 3.7L11 9.4V7.22l-3.7-3.7a1 1 0 0 1 1.4-1.42L11 6.6V3a1 1 0 0 1 1-1Z" />
    </svg>
  ),
  fog: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden="true">
      <path d="M6 11a5 5 0 0 1 9.58-2A4 4 0 0 1 18 16H7a4 4 0 0 1-1-7.87V11Zm-3 6h12a1 1 0 0 1 0 2H3a1 1 0 0 1 0-2Zm4 3h13a1 1 0 0 1 0 2H7a1 1 0 0 1 0-2Z" />
    </svg>
  ),
  reveal2x2: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden="true">
      <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" />
    </svg>
  ),
  nuke: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden="true">
      <path d="M8.5 6 8.5 3.5 6.5 4.3 9 1.8 12 3 15 1.8 17.5 4.3 15.5 3.5 15.5 6 Z" />
      <path d="M12 21c-2.5 0-4-2.2-4-5V10c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5v6c0 2.8-1.5 5-4 5Z" />
    </svg>
  ),
};

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
    <path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5Zm3 8H9V6a3 3 0 0 1 6 0v3Z" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
    <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z" />
  </svg>
);

function formatUnlockDate(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export default function Achievements() {
  const [isOpen, setIsOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [unlocked, setUnlocked] = useState<UnlockedMap>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAchievements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/achievements`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.success) {
        setLoggedIn(Boolean(data.loggedIn));
        setUnlocked(data.unlocked || {});
      } else {
        throw new Error(data.message || "Failed to load achievements");
      }
    } catch (e) {
      console.error("Achievements fetch error:", e);
      setError("Could not load achievements. Please try again.");
      setUnlocked({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    fetchAchievements();
  }, [isOpen, fetchAchievements]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const unlockedCount = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;
  const completionPct =
    TOTAL_ACHIEVEMENTS > 0 ? Math.round((unlockedCount / TOTAL_ACHIEVEMENTS) * 100) : 0;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        data-testid="achievements-button"
        className="flex items-center gap-3 px-4 py-2 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-lg hover:border-blue-500 hover:bg-white/20 transition-all"
        aria-label="Open achievements"
      >
        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-800 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-6 h-6"
            aria-hidden="true"
          >
            <path d="M9 3h6v1h4a1 1 0 0 1 1 1v1a5 5 0 0 1-4.1 4.92A6 6 0 0 1 13 13.91V16h2a1 1 0 0 1 1 1v1h1a1 1 0 0 1 0 2H6a1 1 0 0 1 0-2h1v-1a1 1 0 0 1 1-1h2v-2.09A6 6 0 0 1 7.1 10.92 5 5 0 0 1 3 6V5a1 1 0 0 1 1-1h4V3Zm0 3H5a3 3 0 0 0 2.45 2.92A6 6 0 0 1 9 7V6Zm6 0v1a6 6 0 0 1 1.55 1.92A3 3 0 0 0 19 6h-4Z" />
          </svg>
        </div>
        <div className="text-left">
          <div className="text-sm font-bold text-white">Achievements</div>
          <div className="text-xs text-blue-300 font-medium" data-testid="achievements-subtitle">
            {completionPct}% complete
          </div>
        </div>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Achievements"
          data-testid="achievements-modal"
        >
          <div
            className="relative w-full max-w-lg bg-gray-900/95 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-white/10 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-white/10 bg-gradient-to-br from-blue-600/25 to-indigo-800/25 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Achievements</h2>
                <p className="text-sm text-gray-300">
                  {unlockedCount} of {TOTAL_ACHIEVEMENTS} unlocked
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close achievements"
                data-testid="achievements-close"
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-lg font-bold transition-colors"
              >
                &times;
              </button>
            </div>

            <div className="px-6 pt-4 pb-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">
                  Completion
                </span>
                <span className="text-xs font-bold text-blue-300" data-testid="achievements-percent">
                  {completionPct}%
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>

            {!loading && !error && !loggedIn && (
              <div
                className="mx-6 mt-3 px-4 py-3 rounded-lg bg-blue-500/15 border border-blue-400/30 text-sm text-blue-200"
                data-testid="achievements-login-prompt"
              >
                Log in to track and unlock achievements.
              </div>
            )}

            <div className="px-6 pb-6 pt-3 max-h-[60vh] overflow-y-auto">
              {loading ? (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3" aria-busy="true">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <li key={i} className="h-20 rounded-lg bg-white/5 animate-pulse" />
                  ))}
                </ul>
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-sm text-red-300 mb-3">{error}</p>
                  <button
                    onClick={fetchAchievements}
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ACHIEVEMENTS.map((a) => {
                    const entry = unlocked[a.id];
                    const isUnlocked = Boolean(entry);
                    return (
                      <li
                        key={a.id}
                        data-testid={`achievement-${a.id}`}
                        data-unlocked={isUnlocked ? "true" : "false"}
                        className={`relative flex items-center gap-3 px-3 py-3 rounded-lg border transition-colors ${
                          isUnlocked
                            ? "bg-blue-600/15 border-blue-500/40"
                            : "bg-white/5 border-white/5"
                        }`}
                      >
                        <div
                          className={`relative w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                            isUnlocked
                              ? "bg-gradient-to-br from-blue-600 to-indigo-800 text-white shadow-lg"
                              : "bg-white/10 text-gray-500"
                          }`}
                        >
                          {ACHIEVEMENT_ICONS[a.iconKey] ?? null}
                          {isUnlocked ? (
                            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-gray-900">
                              <CheckIcon />
                            </span>
                          ) : (
                            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gray-700 text-gray-300 flex items-center justify-center border-2 border-gray-900">
                              <LockIcon />
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className={`text-sm font-bold truncate ${
                              isUnlocked ? "text-white" : "text-gray-400"
                            }`}
                          >
                            {a.name}
                          </div>
                          <div className="text-xs text-gray-400 leading-snug">
                            {a.description}
                          </div>
                          {isUnlocked && (
                            <div className="text-[10px] uppercase tracking-wider text-blue-300 mt-0.5">
                              Unlocked {formatUnlockDate(entry.unlockedAt)}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
