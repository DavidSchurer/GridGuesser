/**
 * Server-side achievement orchestration shared by the normal-mode and royale
 * game-end paths. Keeps the circular-import-prone evaluation/emit logic in one
 * place. The synthetic-player check is inlined here (rather than imported from
 * normalModeActions) to avoid an import cycle.
 */
import type { Server } from "socket.io";
import type { GameRoom, UserStats } from "../lib/types";
import { evaluateGameEndAchievements } from "../lib/achievementRules";
import { unlockAchievements } from "../lib/achievementService";
import { ACHIEVEMENTS_BY_ID } from "../lib/achievements";

function isSynthetic(room: GameRoom, playerIndex: number): boolean {
  const p = room.players[playerIndex];
  if (!p) return false;
  return !!p.isAi || p.id.startsWith("ai:");
}

/** User ids of the current top-N players (by win rate), for the apex achievement. */
export async function getTopUserIds(limit = 3): Promise<string[]> {
  try {
    const { getLeaderboard } = await import("../lib/userService");
    const entries = await getLeaderboard("winRate");
    return entries.slice(0, limit).map((e) => e.userId);
  } catch (err) {
    console.error("Failed to fetch leaderboard for achievements:", err);
    return [];
  }
}

/**
 * Evaluate and unlock game-end achievements for one player, emitting an
 * `achievement-unlocked` toast to their socket for each newly-unlocked one.
 * Safe to call for any player; AI/synthetic players are skipped.
 */
export async function awardGameEndAchievements(
  io: Server,
  room: GameRoom,
  playerIndex: number,
  opts: { won: boolean; stats: UserStats; leaderboardRank?: number }
): Promise<void> {
  const player = room.players[playerIndex];
  if (!player) return;
  if (isSynthetic(room, playerIndex)) return;

  const candidateIds = evaluateGameEndAchievements({
    stats: opts.stats,
    won: opts.won,
    mode: room.gameMode,
    vsAi: !!room.vsAi,
    aiDifficulty: room.aiDifficulty,
    maxPlayers: room.maxPlayers,
    usedPowerUp: !!room.powerUpUsedBy?.[playerIndex],
    wrongGuesses: room.wrongGuessesByPlayer?.[playerIndex] ?? 0,
    minTilesAtCorrectGuess: room.minTilesAtCorrectGuess?.[playerIndex],
    isRematch: !!room.isRematch,
    leaderboardRank: opts.leaderboardRank,
  });

  if (candidateIds.length === 0) return;

  try {
    const newlyUnlocked = await unlockAchievements(player.id, candidateIds);
    if (!player.socketId) return;
    for (const id of newlyUnlocked) {
      const def = ACHIEVEMENTS_BY_ID[id];
      if (def) {
        io.to(player.socketId).emit("achievement-unlocked", { id: def.id, name: def.name });
      }
    }
  } catch (err) {
    console.error("Failed to award game-end achievements:", err);
  }
}
