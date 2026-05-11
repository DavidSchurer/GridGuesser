import { Router, Request, Response } from "express";
import { getLeaderboard, LeaderboardFilter } from "../lib/userService";

const router = Router();

const ALLOWED_FILTERS: LeaderboardFilter[] = [
  "gamesPlayed",
  "winRate",
  "bestStreak",
  "currentStreak",
];

router.get("/", async (req: Request, res: Response) => {
  try {
    const rawFilter = (req.query.filter as string) || "winRate";

    if (!ALLOWED_FILTERS.includes(rawFilter as LeaderboardFilter)) {
      res.status(400).json({
        success: false,
        message: `Invalid filter. Allowed: ${ALLOWED_FILTERS.join(", ")}`,
      });
      return;
    }

    const entries = await getLeaderboard(rawFilter as LeaderboardFilter);

    res.status(200).json({
      success: true,
      filter: rawFilter,
      entries,
    });
  } catch (error) {
    console.error("Leaderboard fetch error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;
