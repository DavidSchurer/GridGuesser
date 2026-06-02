import { UserStats, GameMode, AiDifficulty, PowerUpId } from "./types";
import {
  AchievementId,
  POWER_UP_ACHIEVEMENT_IDS,
  achievementIdForPowerUp,
} from "./achievements";

/**
 * Facts about a finished game for one player, used to decide which game-end
 * achievements they earned. `stats` is the player's aggregate stats AFTER the
 * game result has been recorded.
 */
export interface GameEndAchievementContext {
  stats: UserStats;
  /** True if this player won (normal: guessed first; royale: finished 1st). */
  won: boolean;
  mode: GameMode;
  vsAi: boolean;
  aiDifficulty?: AiDifficulty;
  maxPlayers: number;
  /** Whether the player used any power-up this game. */
  usedPowerUp: boolean;
  /** Wrong guesses the player made this game. */
  wrongGuesses: number;
  /** Fewest tiles revealed on the guessed image when guessing correctly (9999 if never). */
  minTilesAtCorrectGuess?: number;
  /** True if this game was a rematch. */
  isRematch: boolean;
  /** 1-based global leaderboard rank, if known. */
  leaderboardRank?: number;
}

/**
 * Returns the achievement ids whose unlock conditions are satisfied by this
 * game's outcome. Idempotency is handled downstream by the unlock service, so
 * this may return ids the user already owns.
 */
export function evaluateGameEndAchievements(
  ctx: GameEndAchievementContext
): AchievementId[] {
  const ids: AchievementId[] = [];
  const s = ctx.stats;

  // Milestones (cumulative)
  if (s.gamesPlayed >= 1) ids.push("first_game");
  if (s.gamesWon >= 1) ids.push("first_win");
  if (s.correctGuesses >= 1) ids.push("first_correct");
  if (s.gamesPlayed >= 25) ids.push("games_25");
  if (s.gamesWon >= 100) ids.push("wins_100");
  if (s.totalPoints >= 10000) ids.push("points_10k");
  if (s.bestStreak >= 3) ids.push("streak_3");
  if (s.bestStreak >= 10) ids.push("streak_10");

  // Mode / difficulty
  if (ctx.won && ctx.vsAi && ctx.aiDifficulty === "easy") ids.push("beat_ai_easy");
  if (ctx.won && ctx.vsAi && ctx.aiDifficulty === "hard") ids.push("beat_ai_hard");
  if (ctx.won && ctx.mode === "royale") ids.push("royale_win");
  if (ctx.won && ctx.mode === "royale" && ctx.maxPlayers >= 4) ids.push("royale_4p_win");
  if (ctx.won && ctx.isRematch) ids.push("rematch_win");

  // Skill
  if (ctx.won && !ctx.usedPowerUp) ids.push("purist_win");
  if (ctx.won && ctx.wrongGuesses === 0) ids.push("flawless");
  if (
    ctx.won &&
    ctx.minTilesAtCorrectGuess !== undefined &&
    ctx.minTilesAtCorrectGuess <= 1
  ) {
    ids.push("clairvoyant");
  }

  // Leaderboard standing
  if (ctx.leaderboardRank !== undefined && ctx.leaderboardRank <= 3) {
    ids.push("apex");
  }

  return ids;
}

/**
 * Given the player's currently-unlocked achievement ids plus the power-up they
 * just used, returns the achievement ids to attempt unlocking: the power-up's
 * own achievement, and `arsenal` if that completes all 7 power-up achievements.
 */
export function powerUpAndArsenalAchievements(
  currentUnlockedIds: Iterable<string>,
  powerUpId: PowerUpId
): AchievementId[] {
  const unlocked = new Set(currentUnlockedIds);
  const result: AchievementId[] = [];

  const powerUpAchievement = achievementIdForPowerUp(powerUpId);
  result.push(powerUpAchievement);
  unlocked.add(powerUpAchievement);

  const hasAllPowerUps = POWER_UP_ACHIEVEMENT_IDS.every((id) => unlocked.has(id));
  if (hasAllPowerUps) {
    result.push("arsenal");
  }

  return result;
}
