import { docClient, TABLES, PutCommand, GetCommand, UpdateCommand, QueryCommand } from "./dynamodb";
import { User, UserStats, UserSettings } from "./types";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

// Initialize default user stats
export function createDefaultStats(): UserStats {
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

// Initialize default user settings
export function createDefaultSettings(): UserSettings {
  return {
    theme: "auto",
    notifications: true,
    soundEnabled: true,
  };
}

// Create a new user
export async function createUser(
  username: string,
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    // Check if email already exists
    const existingEmail = await getUserByEmail(email);
    if (existingEmail) {
      return { success: false, error: "Email already exists" };
    }

    // Check if username already exists
    const existingUsername = await getUserByUsername(username);
    if (existingUsername) {
      return { success: false, error: "Username already taken" };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user object
    const userId = randomUUID();
    const now = Date.now();
    
    const user: User = {
      userId,
      username,
      email,
      passwordHash,
      createdAt: now,
      updatedAt: now,
      stats: createDefaultStats(),
      settings: createDefaultSettings(),
    };

    // Store in DynamoDB
    const command = new PutCommand({
      TableName: TABLES.USERS,
      Item: user,
    });

    await docClient.send(command);

    return { success: true, user };
  } catch (error) {
    console.error("Error creating user:", error);
    return { success: false, error: "Failed to create user" };
  }
}

// Get user by ID
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const command = new GetCommand({
      TableName: TABLES.USERS,
      Key: { userId },
    });

    const response = await docClient.send(command);
    return (response.Item as User) || null;
  } catch (error) {
    console.error("Error getting user by ID:", error);
    return null;
  }
}

// Get user by email
export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const command = new QueryCommand({
      TableName: TABLES.USERS,
      IndexName: "EmailIndex",
      KeyConditionExpression: "email = :email",
      ExpressionAttributeValues: {
        ":email": email,
      },
    });

    const response = await docClient.send(command);
    return (response.Items?.[0] as User) || null;
  } catch (error) {
    console.error("Error getting user by email:", error);
    return null;
  }
}

// Get user by username
export async function getUserByUsername(username: string): Promise<User | null> {
  try {
    const command = new QueryCommand({
      TableName: TABLES.USERS,
      IndexName: "UsernameIndex",
      KeyConditionExpression: "username = :username",
      ExpressionAttributeValues: {
        ":username": username,
      },
    });

    const response = await docClient.send(command);
    return (response.Items?.[0] as User) || null;
  } catch (error) {
    console.error("Error getting user by username:", error);
    return null;
  }
}

// Verify user password
export async function verifyPassword(
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const user = await getUserByEmail(email);
    
    if (!user) {
      return { success: false, error: "Invalid email or password" };
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValid) {
      return { success: false, error: "Invalid email or password" };
    }

    return { success: true, user };
  } catch (error) {
    console.error("Error verifying password:", error);
    return { success: false, error: "Authentication failed" };
  }
}

// Update user stats after a game
export async function updateUserStats(
  userId: string,
  gameResult: {
    won: boolean;
    points: number;
    tilesRevealed: number;
    guessedCorrectly: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getUserById(userId);
    if (!user) {
      return { success: false, error: "User not found" };
    }

    const stats = user.stats;
    const newGamesPlayed = stats.gamesPlayed + 1;
    const newGamesWon = stats.gamesWon + (gameResult.won ? 1 : 0);
    const newGamesLost = stats.gamesLost + (gameResult.won ? 0 : 1);
    const newTotalPoints = stats.totalPoints + gameResult.points;
    const newCurrentStreak = gameResult.won ? stats.currentStreak + 1 : 0;
    const newBestStreak = Math.max(stats.bestStreak, newCurrentStreak);
    const newTotalTilesRevealed = stats.totalTilesRevealed + gameResult.tilesRevealed;
    const newCorrectGuesses = stats.correctGuesses + (gameResult.guessedCorrectly ? 1 : 0);
    const newIncorrectGuesses = stats.incorrectGuesses + (gameResult.guessedCorrectly ? 0 : 1);

    const command = new UpdateCommand({
      TableName: TABLES.USERS,
      Key: { userId },
      UpdateExpression: `
        SET 
          stats.gamesPlayed = :gamesPlayed,
          stats.gamesWon = :gamesWon,
          stats.gamesLost = :gamesLost,
          stats.totalPoints = :totalPoints,
          stats.currentStreak = :currentStreak,
          stats.bestStreak = :bestStreak,
          stats.averagePointsPerGame = :avgPoints,
          stats.totalTilesRevealed = :tilesRevealed,
          stats.correctGuesses = :correctGuesses,
          stats.incorrectGuesses = :incorrectGuesses,
          updatedAt = :updatedAt
      `,
      ExpressionAttributeValues: {
        ":gamesPlayed": newGamesPlayed,
        ":gamesWon": newGamesWon,
        ":gamesLost": newGamesLost,
        ":totalPoints": newTotalPoints,
        ":currentStreak": newCurrentStreak,
        ":bestStreak": newBestStreak,
        ":avgPoints": newTotalPoints / newGamesPlayed,
        ":tilesRevealed": newTotalTilesRevealed,
        ":correctGuesses": newCorrectGuesses,
        ":incorrectGuesses": newIncorrectGuesses,
        ":updatedAt": Date.now(),
      },
    });

    await docClient.send(command);
    return { success: true };
  } catch (error) {
    console.error("Error updating user stats:", error);
    return { success: false, error: "Failed to update stats" };
  }
}

// Update user profile
export async function updateUserProfile(
  userId: string,
  updates: {
    username?: string;
    avatarUrl?: string;
    settings?: Partial<UserSettings>;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateExpressions: string[] = [];
    const expressionAttributeValues: Record<string, any> = {
      ":updatedAt": Date.now(),
    };

    if (updates.username) {
      // Check if username is already taken
      const existing = await getUserByUsername(updates.username);
      if (existing && existing.userId !== userId) {
        return { success: false, error: "Username already taken" };
      }
      updateExpressions.push("username = :username");
      expressionAttributeValues[":username"] = updates.username;
    }

    if (updates.avatarUrl !== undefined) {
      updateExpressions.push("avatarUrl = :avatarUrl");
      expressionAttributeValues[":avatarUrl"] = updates.avatarUrl;
    }

    if (updates.settings) {
      if (updates.settings.theme) {
        updateExpressions.push("settings.theme = :theme");
        expressionAttributeValues[":theme"] = updates.settings.theme;
      }
      if (updates.settings.notifications !== undefined) {
        updateExpressions.push("settings.notifications = :notifications");
        expressionAttributeValues[":notifications"] = updates.settings.notifications;
      }
      if (updates.settings.soundEnabled !== undefined) {
        updateExpressions.push("settings.soundEnabled = :soundEnabled");
        expressionAttributeValues[":soundEnabled"] = updates.settings.soundEnabled;
      }
    }

    if (updateExpressions.length === 0) {
      return { success: false, error: "No updates provided" };
    }

    updateExpressions.push("updatedAt = :updatedAt");

    const command = new UpdateCommand({
      TableName: TABLES.USERS,
      Key: { userId },
      UpdateExpression: `SET ${updateExpressions.join(", ")}`,
      ExpressionAttributeValues: expressionAttributeValues,
    });

    await docClient.send(command);
    return { success: true };
  } catch (error) {
    console.error("Error updating user profile:", error);
    return { success: false, error: "Failed to update profile" };
  }
}

