import { Router, Request, Response } from "express";
import {
  createUser,
  getUserById,
  verifyPassword,
  updateUserProfile,
} from "../lib/userService";
import { generateToken } from "../lib/jwt";
import { authenticateToken } from "../lib/authMiddleware";
import { AuthResponse, SignupRequest, LoginRequest } from "../lib/types";

const router = Router();

// Signup endpoint
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const { username, email, password }: SignupRequest = req.body;

    // Validation
    if (!username || !email || !password) {
      res.status(400).json({
        success: false,
        message: "Username, email, and password are required",
      } as AuthResponse);
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        message: "Invalid email format",
      } as AuthResponse);
      return;
    }

    // Validate password length
    if (password.length < 6) {
      res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      } as AuthResponse);
      return;
    }

    // Validate username length
    if (username.length < 3) {
      res.status(400).json({
        success: false,
        message: "Username must be at least 3 characters long",
      } as AuthResponse);
      return;
    }

    // Create user
    const result = await createUser(username, email, password);

    if (!result.success || !result.user) {
      res.status(400).json({
        success: false,
        message: result.error || "Failed to create user",
      } as AuthResponse);
      return;
    }

    // Generate JWT token
    const token = generateToken({
      userId: result.user.userId,
      email: result.user.email,
      username: result.user.username,
    });

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: {
        userId: result.user.userId,
        username: result.user.username,
        email: result.user.email,
        stats: result.user.stats,
      },
      token,
    } as AuthResponse);
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    } as AuthResponse);
  }
});

// Login endpoint
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password }: LoginRequest = req.body;

    // Validation
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Email and password are required",
      } as AuthResponse);
      return;
    }

    // Verify credentials
    const result = await verifyPassword(email, password);

    if (!result.success || !result.user) {
      res.status(401).json({
        success: false,
        message: result.error || "Invalid credentials",
      } as AuthResponse);
      return;
    }

    // Generate JWT token
    const token = generateToken({
      userId: result.user.userId,
      email: result.user.email,
      username: result.user.username,
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        userId: result.user.userId,
        username: result.user.username,
        email: result.user.email,
        stats: result.user.stats,
      },
      token,
    } as AuthResponse);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    } as AuthResponse);
  }
});

// Get current user profile (protected route)
router.get("/profile", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const user = await getUserById(req.user.userId);

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
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Update user profile (protected route)
router.patch("/profile", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const { username, avatarUrl, settings } = req.body;

    const result = await updateUserProfile(req.user.userId, {
      username,
      avatarUrl,
      settings,
    });

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: result.error || "Failed to update profile",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Verify token endpoint (useful for checking if user is still logged in)
router.get("/verify", authenticateToken, (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});

export default router;

