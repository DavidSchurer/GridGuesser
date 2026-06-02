import { PowerUpId } from "./types";

/**
 * Achievement ids. The first batch is one-per-power-up: unlocked the first
 * time a logged-in user successfully uses each distinct power-up.
 */
export type AchievementId = `powerup_${PowerUpId}`;

export type AchievementCategory = "powerups";

export interface AchievementDef {
  id: AchievementId;
  name: string;
  description: string;
  /** Maps to an inline SVG in the client (components/Achievements.tsx). */
  iconKey: string;
  category: AchievementCategory;
}

/**
 * Static achievement catalog. Shared by the client (rendering) and the
 * Express server (validating ids on unlock). Keep metadata only here — no
 * JSX — so it is safe to import in the Node backend.
 */
export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "powerup_peek",
    name: "Peekaboo",
    description: "Use the Peek power-up for the first time",
    iconKey: "peek",
    category: "powerups",
  },
  {
    id: "powerup_skip",
    name: "Not So Fast",
    description: "Use the Skip Turn power-up for the first time",
    iconKey: "skip",
    category: "powerups",
  },
  {
    id: "powerup_revealLine",
    name: "Line Breaker",
    description: "Use the Reveal Row/Col power-up for the first time",
    iconKey: "revealLine",
    category: "powerups",
  },
  {
    id: "powerup_freeze",
    name: "Cold Snap",
    description: "Use the Freeze power-up for the first time",
    iconKey: "freeze",
    category: "powerups",
  },
  {
    id: "powerup_fog",
    name: "Fog Roller",
    description: "Use the Fog of War power-up for the first time",
    iconKey: "fog",
    category: "powerups",
  },
  {
    id: "powerup_reveal2x2",
    name: "Quad Squad",
    description: "Use the Reveal 2x2 power-up for the first time",
    iconKey: "reveal2x2",
    category: "powerups",
  },
  {
    id: "powerup_nuke",
    name: "Total Annihilation",
    description: "Use the Nuke power-up for the first time",
    iconKey: "nuke",
    category: "powerups",
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

/** The achievement id awarded for using a given power-up. */
export function achievementIdForPowerUp(powerUpId: PowerUpId): AchievementId {
  return `powerup_${powerUpId}`;
}
