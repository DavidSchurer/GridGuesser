import { PowerUpId } from "./types";

/**
 * Achievement ids. Includes one-per-power-up ids plus milestone, mode, and
 * skill achievements evaluated at game end.
 */
export type PowerUpAchievementId = `powerup_${PowerUpId}`;

export type AchievementId =
  | PowerUpAchievementId
  // Easy
  | "first_game"
  | "first_win"
  | "first_correct"
  | "first_hint"
  | "beat_ai_easy"
  // Medium
  | "streak_3"
  | "royale_win"
  | "purist_win"
  | "arsenal"
  | "games_25"
  | "rematch_win"
  // Hard
  | "streak_10"
  | "flawless"
  | "clairvoyant"
  | "royale_4p_win"
  | "beat_ai_hard"
  | "wins_100"
  | "points_10k"
  | "apex";

export type AchievementTier = "easy" | "medium" | "hard";

export type AchievementCategory = "powerups" | "milestones" | "modes" | "skill";

export interface AchievementDef {
  id: AchievementId;
  name: string;
  description: string;
  /** Maps to an inline SVG in the client (components/Achievements.tsx). */
  iconKey: string;
  tier: AchievementTier;
  category: AchievementCategory;
}

/**
 * Static achievement catalog. Shared by the client (rendering) and the
 * Express server (validating ids on unlock). Keep metadata only here — no
 * JSX — so it is safe to import in the Node backend.
 */
export const ACHIEVEMENTS: AchievementDef[] = [
  // ─── Power-ups (Easy) ───
  {
    id: "powerup_peek",
    name: "Peekaboo",
    description: "Use the Peek power-up for the first time",
    iconKey: "peek",
    tier: "easy",
    category: "powerups",
  },
  {
    id: "powerup_skip",
    name: "Not So Fast",
    description: "Use the Skip Turn power-up for the first time",
    iconKey: "skip",
    tier: "easy",
    category: "powerups",
  },
  {
    id: "powerup_revealLine",
    name: "Line Breaker",
    description: "Use the Reveal Row/Col power-up for the first time",
    iconKey: "revealLine",
    tier: "easy",
    category: "powerups",
  },
  {
    id: "powerup_freeze",
    name: "Cold Snap",
    description: "Use the Freeze power-up for the first time",
    iconKey: "freeze",
    tier: "easy",
    category: "powerups",
  },
  {
    id: "powerup_fog",
    name: "Fog Roller",
    description: "Use the Fog of War power-up for the first time",
    iconKey: "fog",
    tier: "easy",
    category: "powerups",
  },
  {
    id: "powerup_reveal2x2",
    name: "Quad Squad",
    description: "Use the Reveal 2x2 power-up for the first time",
    iconKey: "reveal2x2",
    tier: "easy",
    category: "powerups",
  },
  {
    id: "powerup_nuke",
    name: "Total Annihilation",
    description: "Use the Nuke power-up for the first time",
    iconKey: "nuke",
    tier: "easy",
    category: "powerups",
  },

  // ─── Milestones / modes (Easy) ───
  {
    id: "first_game",
    name: "Welcome to the Grid",
    description: "Play your first game",
    iconKey: "play",
    tier: "easy",
    category: "milestones",
  },
  {
    id: "first_win",
    name: "Beginner's Luck",
    description: "Win your first game",
    iconKey: "trophy",
    tier: "easy",
    category: "milestones",
  },
  {
    id: "first_correct",
    name: "Eagle Eye",
    description: "Make your first correct guess",
    iconKey: "target",
    tier: "easy",
    category: "milestones",
  },
  {
    id: "first_hint",
    name: "Need a Hint?",
    description: "Use a hint for the first time",
    iconKey: "bulb",
    tier: "easy",
    category: "milestones",
  },
  {
    id: "beat_ai_easy",
    name: "Bot Buster",
    description: "Beat the AI on Easy difficulty",
    iconKey: "robot",
    tier: "easy",
    category: "modes",
  },

  // ─── Medium ───
  {
    id: "streak_3",
    name: "Hot Streak",
    description: "Reach a 3-win streak",
    iconKey: "flame",
    tier: "medium",
    category: "milestones",
  },
  {
    id: "royale_win",
    name: "Last Pixel Standing",
    description: "Win a Royale match",
    iconKey: "crown",
    tier: "medium",
    category: "modes",
  },
  {
    id: "purist_win",
    name: "Purist",
    description: "Win a game without using any power-up",
    iconKey: "feather",
    tier: "medium",
    category: "skill",
  },
  {
    id: "arsenal",
    name: "Arsenal",
    description: "Unlock every power-up achievement",
    iconKey: "arsenal",
    tier: "medium",
    category: "powerups",
  },
  {
    id: "games_25",
    name: "Grinder",
    description: "Play 25 games",
    iconKey: "grind",
    tier: "medium",
    category: "milestones",
  },
  {
    id: "rematch_win",
    name: "Run It Back",
    description: "Win a rematch",
    iconKey: "rematch",
    tier: "medium",
    category: "modes",
  },

  // ─── Hard ───
  {
    id: "streak_10",
    name: "Unstoppable",
    description: "Reach a 10-win streak",
    iconKey: "lightning",
    tier: "hard",
    category: "milestones",
  },
  {
    id: "flawless",
    name: "Flawless",
    description: "Win a game with zero wrong guesses",
    iconKey: "diamond",
    tier: "hard",
    category: "skill",
  },
  {
    id: "clairvoyant",
    name: "Clairvoyant",
    description: "Win with one or fewer tiles revealed on the image",
    iconKey: "crystal",
    tier: "hard",
    category: "skill",
  },
  {
    id: "royale_4p_win",
    name: "King of the Grid",
    description: "Win a 4-player Royale",
    iconKey: "kingCrown",
    tier: "hard",
    category: "modes",
  },
  {
    id: "beat_ai_hard",
    name: "Terminator",
    description: "Beat the AI on Hard difficulty",
    iconKey: "robotHard",
    tier: "hard",
    category: "modes",
  },
  {
    id: "wins_100",
    name: "Centurion",
    description: "Win 100 games",
    iconKey: "shield",
    tier: "hard",
    category: "milestones",
  },
  {
    id: "points_10k",
    name: "Point Tycoon",
    description: "Earn 10,000 lifetime points",
    iconKey: "coins",
    tier: "hard",
    category: "milestones",
  },
  {
    id: "apex",
    name: "Apex Guesser",
    description: "Finish in the global leaderboard top 3",
    iconKey: "podium",
    tier: "hard",
    category: "milestones",
  },
];

export const ACHIEVEMENTS_BY_ID: Record<string, AchievementDef> = ACHIEVEMENTS.reduce(
  (acc, a) => {
    acc[a.id] = a;
    return acc;
  },
  {} as Record<string, AchievementDef>
);

export const TOTAL_ACHIEVEMENTS = ACHIEVEMENTS.length;

export const TIER_ORDER: AchievementTier[] = ["easy", "medium", "hard"];

export const TIER_LABELS: Record<AchievementTier, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

/** Ids of the per-power-up achievements (used for the Arsenal meta-achievement). */
export const POWER_UP_ACHIEVEMENT_IDS: AchievementId[] = ACHIEVEMENTS.filter(
  (a) => a.category === "powerups" && a.id !== "arsenal"
).map((a) => a.id);

/** The achievement id awarded for using a given power-up. */
export function achievementIdForPowerUp(powerUpId: PowerUpId): PowerUpAchievementId {
  return `powerup_${powerUpId}`;
}
