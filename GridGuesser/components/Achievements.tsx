"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  ACHIEVEMENTS,
  TOTAL_ACHIEVEMENTS,
  TIER_ORDER,
  TIER_LABELS,
  AchievementTier,
  AchievementDef,
} from "../lib/achievements";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NEXT_PUBLIC_SOCKET_URL
    ? `${process.env.NEXT_PUBLIC_SOCKET_URL}/api`
    : "http://localhost:3001/api");

type UnlockedMap = Record<string, { unlockedAt: number }>;

const TIER_BADGE_CLASSES: Record<AchievementTier, string> = {
  easy: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  medium: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  hard: "bg-rose-500/20 text-rose-300 border-rose-500/30",
};

// Inline SVGs keyed by AchievementDef.iconKey
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
  play: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden="true">
      <path d="M8 5v14l11-7L8 5Z" />
    </svg>
  ),
  trophy: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden="true">
      <path d="M5 3h14a1 1 0 0 1 1 1v2a5 5 0 0 1-4 4.9V12a4 4 0 0 1-3 3.87V18h3a1 1 0 0 1 1 1v2H7v-2a1 1 0 0 1 1-1h3v-2.13A4 4 0 0 1 8 12v-1.1A5 5 0 0 1 4 6V4a1 1 0 0 1 1-1Z" />
    </svg>
  ),
  target: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  ),
  bulb: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden="true">
      <path d="M9 21h6v-1H9v1Zm3-19a7 7 0 0 0-4 12.74V17h8v-2.26A7 7 0 0 0 12 2Z" />
    </svg>
  ),
  robot: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden="true">
      <path d="M12 2a2 2 0 0 1 2 2v1h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3V4a2 2 0 0 1 2-2Zm-4 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm8 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM9 18h6v2H9v-2Z" />
    </svg>
  ),
  flame: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden="true">
      <path d="M12 2c1 3 4 4.5 4 8a4 4 0 1 1-8 0c0-3.5 3-5 4-8Zm0 18a6 6 0 0 0 6-6c0-2.5-1.5-4.5-3-6-1 2.5-3 4-3 6a6 6 0 0 0 6 6Z" />
    </svg>
  ),
  crown: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden="true">
      <path d="M5 16 3 8l4 3 5-6 5 6 4-3-2 8H5Zm2 2h10v2H7v-2Z" />
    </svg>
  ),
  feather: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden="true">
      <path d="M20 4c-6 0-10 4-12 10l-2 6 6-2c6-2 10-6 10-12 0-1-.3-1.7-.6-2.4L20 4Z" />
    </svg>
  ),
  arsenal: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden="true">
      <path d="M4 4h4v4H4V4Zm6 0h4v4h-4V4Zm6 0h4v4h-4V4ZM4 10h4v4H4v-4Zm6 0h4v4h-4v-4Zm6 0h4v4h-4v-4ZM4 16h4v4H4v-4Zm6 0h4v4h-4v-4Zm6 0h4v4h-4v-4Z" />
    </svg>
  ),
  grind: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7" aria-hidden="true">
      <path d="M12 6v6l4 2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
  rematch: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7" aria-hidden="true">
      <path d="M4 12a8 8 0 0 1 13.5-5.5M20 12a8 8 0 0 1-13.5 5.5" strokeLinecap="round" />
      <path d="M20 4v5h-5M4 20v-5h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  lightning: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden="true">
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
    </svg>
  ),
  diamond: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden="true">
      <path d="M12 2 2 9l10 13L22 9 12 2Zm0 4.5 5.5 4.5L12 18 6.5 11 12 6.5Z" />
    </svg>
  ),
  crystal: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden="true">
      <path d="M12 2 4 9l8 13 8-13-8-7Zm0 5 4.5 4L12 17 7.5 11 12 7Z" />
    </svg>
  ),
  kingCrown: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden="true">
      <path d="M4 15 2 7l4 4 6-5 6 5 4-4-2 8H4Zm2 3h12v2H6v-2Z" />
      <circle cx="6" cy="6" r="1.5" />
      <circle cx="12" cy="4" r="1.5" />
      <circle cx="18" cy="6" r="1.5" />
    </svg>
  ),
  robotHard: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden="true">
      <path d="M12 2a2 2 0 0 1 2 2v1h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3V4a2 2 0 0 1 2-2Zm-4 8h1.5v3H8v-3Zm8 0H17v3h1.5v-3ZM9 18h6v2H9v-2Z" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden="true">
      <path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Z" />
    </svg>
  ),
  coins: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden="true">
      <ellipse cx="9" cy="8" rx="6" ry="3" />
      <path d="M3 8v6c0 1.7 2.7 3 6 3s6-1.3 6-3V8" />
      <ellipse cx="15" cy="14" rx="6" ry="3" />
      <path d="M9 14v6c0 1.7 2.7 3 6 3s6-1.3 6-3v-6" />
    </svg>
  ),
  podium: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden="true">
      <rect x="3" y="14" width="5" height="7" rx="1" />
      <rect x="9.5" y="10" width="5" height="11" rx="1" />
      <rect x="16" y="16" width="5" height="5" rx="1" />
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

function AchievementCard({
  achievement: a,
  entry,
}: {
  achievement: AchievementDef;
  entry?: { unlockedAt: number };
}) {
  const isUnlocked = Boolean(entry);

  return (
    <li
      data-testid={`achievement-${a.id}`}
      data-unlocked={isUnlocked ? "true" : "false"}
      data-tier={a.tier}
      className={`relative flex items-start gap-3 px-3 py-3 rounded-lg border transition-colors ${
        isUnlocked ? "bg-blue-600/15 border-blue-500/40" : "bg-white/5 border-white/5"
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
          className={`text-sm font-bold leading-snug break-words ${
            isUnlocked ? "text-white" : "text-gray-400"
          }`}
        >
          {a.name}
        </div>
        <span
          className={`inline-flex mt-1 mb-0.5 text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border ${TIER_BADGE_CLASSES[a.tier]}`}
        >
          {TIER_LABELS[a.tier]}
        </span>
        <div className="text-xs text-gray-400 leading-snug">{a.description}</div>
        {isUnlocked && entry && (
          <div className="text-[10px] uppercase tracking-wider text-blue-300 mt-0.5">
            Unlocked {formatUnlockDate(entry.unlockedAt)}
          </div>
        )}
      </div>
    </li>
  );
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

  const byTier = useMemo(() => {
    const map: Record<AchievementTier, AchievementDef[]> = {
      easy: [],
      medium: [],
      hard: [],
    };
    for (const a of ACHIEVEMENTS) {
      map[a.tier].push(a);
    }
    for (const tier of TIER_ORDER) {
      map[tier].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    }
    return map;
  }, []);

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
            className="relative w-full max-w-xl bg-gray-900/95 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-white/10 overflow-hidden"
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
                <div className="space-y-6">
                  {TIER_ORDER.map((tier) => {
                    const list = byTier[tier];
                    const tierUnlocked = list.filter((a) => unlocked[a.id]).length;
                    return (
                      <section key={tier} data-testid={`achievements-tier-${tier}`}>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                            {TIER_LABELS[tier]}
                          </h3>
                          <span className="text-xs text-gray-400 font-medium">
                            {tierUnlocked}/{list.length}
                          </span>
                        </div>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {list.map((a) => (
                            <AchievementCard key={a.id} achievement={a} entry={unlocked[a.id]} />
                          ))}
                        </ul>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
