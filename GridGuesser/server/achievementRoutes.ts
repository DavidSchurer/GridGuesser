import { Router, Request, Response } from "express";
import { verifyToken } from "../lib/jwt";
import { getUserAchievements } from "../lib/achievementService";

const router = Router();

const getTokenFromCookie = (req: Request): string | null => {
  return req.cookies?.auth_token || null;
};

// Get the current user's unlocked achievements.
// Guests (no/invalid token) get a 200 with loggedIn:false so the client can
// render a fully-locked modal with a "log in" prompt.
router.get("/", async (req: Request, res: Response) => {
  try {
    const token = getTokenFromCookie(req);
    const payload = token ? verifyToken(token) : null;

    if (!payload) {
      res.status(200).json({ success: true, loggedIn: false, unlocked: {} });
      return;
    }

    const unlocked = await getUserAchievements(payload.userId);
    res.status(200).json({ success: true, loggedIn: true, unlocked });
  } catch (error) {
    console.error("Achievements fetch error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;
