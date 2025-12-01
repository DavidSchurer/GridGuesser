// TEMPORARY MOCK AUTHENTICATION - FOR TESTING ONLY
// Replace with real AWS DynamoDB after setup

import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { generateToken } from "../lib/jwt";
import { authenticateToken } from "../lib/authMiddleware";
import { User, UserStats } from "../lib/types";

const router = Router();

// In-memory storage (TEMPORARY - will reset on server restart)
const mockUsers = new Map<string, User>();

function createDefaultStats(): UserStats {
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    gamesLost: 0,
    totalPoints: 0,
    currentStreak: 0,
    bestStreak: 0,
    averagePointsPerGame: 0,
    totalTilesRevealed: 0,
    correctGuesses: 0,
    incorrectGuesses: 0,
  };
}

// Signup endpoint
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    console.log("📝 Signup attempt:", { username, email });

    // Validation
    if (!username || !email || !password) {
      console.log("❌ Validation failed: Missing fields");
      res.status(400).json({
        success: false,
        message: "Username, email, and password are required",
      });
      return;
    }

    // Check if email exists
    const existingEmail = Array.from(mockUsers.values()).find(u => u.email === email);
    if (existingEmail) {
      console.log("❌ Email already exists");
      res.status(400).json({
        success: false,
        message: "Email already exists",
      });
      return;
    }

    // Check if username exists
    const existingUsername = Array.from(mockUsers.values()).find(u => u.username === username);
    if (existingUsername) {
      console.log("❌ Username already taken");
      res.status(400).json({
        success: false,
        message: "Username already taken",
      });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `user_${Date.now()}`;

    // Create user
    const user: User = {
      userId,
      username,
      email,
      passwordHash,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stats: createDefaultStats(),
      settings: {
        theme: "auto",
        notifications: true,
        soundEnabled: true,
      },
    };

    mockUsers.set(userId, user);
    console.log("✅ User created:", { userId, username, email });

    // Generate token
    const token = generateToken({ userId, email, username });

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: {
        userId,
        username,
        email,
        stats: user.stats,
      },
      token,
    });
  } catch (error) {
    console.error("❌ Signup error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Login endpoint
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    console.log("🔑 Login attempt:", { email });

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
      return;
    }

    // Find user
    const user = Array.from(mockUsers.values()).find(u => u.email === email);
    if (!user) {
      console.log("❌ User not found");
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      console.log("❌ Invalid password");
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    console.log("✅ Login successful:", { userId: user.userId, username: user.username });

    // Generate token
    const token = generateToken({
      userId: user.userId,
      email: user.email,
      username: user.username,
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        userId: user.userId,
        username: user.username,
        email: user.email,
        stats: user.stats,
      },
      token,
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get profile
router.get("/profile", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const user = mockUsers.get(req.user.userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      user: {
        userId: user.userId,
        username: user.username,
        email: user.email,
        stats: user.stats,
        settings: user.settings,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("❌ Profile error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Verify token
router.get("/verify", authenticateToken, (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});

console.log("⚠️  MOCK AUTH ENABLED - Data will not persist!");
console.log("⚠️  Set up AWS DynamoDB for production use");

export default router;
export { mockUsers };

