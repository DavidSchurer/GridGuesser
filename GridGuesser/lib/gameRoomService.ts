// Load environment variables first
import dotenv from "dotenv";
import path from "path";
if (typeof __dirname !== 'undefined') {
  dotenv.config({ path: path.join(__dirname, '../.env.local') });
}

import { docClient, TABLES, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand } from "./dynamodb";
import { GameRoom, GameMode, DynamicImageMetadata } from "./types";
import { randomUUID } from "crypto";
import { cacheGameRoom, getCachedGameRoom, deleteCachedGameRoom } from "./redisClient";

// DynamoDB table for game rooms
const GAME_ROOMS_TABLE = process.env.DYNAMODB_GAME_ROOMS_TABLE || "GridGuesser-GameRooms";

// Create a new game room in DynamoDB
export async function createGameRoom(
  roomId: string,
  creatorUserId: string | undefined,
  creatorName: string,
  category: string,
  customQuery?: string,
  gameMode: GameMode = 'normal',
  maxPlayers: number = 2
): Promise<{ success: boolean; room?: GameRoom; error?: string }> {
  try {
    const now = Date.now();
    const n = maxPlayers;
    
    const room: GameRoom = {
      roomId,
      players: [{
        id: creatorUserId || randomUUID(),
        socketId: "",
        playerIndex: 0,
        name: creatorName,
      }],
      currentTurn: 0,
      gameState: "waiting",
      revealedTiles: Array.from({ length: n }, () => []),
      images: Array(n).fill(""),
      imageHashes: Array(n).fill(""),
      imageNames: Array(n).fill(""),
      points: Array(n).fill(0),
      createdAt: now,
      category,
      customQuery,
      imageMetadata: Array(n).fill(null),
      revealedHints: Array.from({ length: n }, () => []),
      skipTurnActive: false,
      gameMode,
      maxPlayers: n,
      ...(gameMode === 'royale' ? {
        royalePhase: 'idle' as const,
        placements: [],
        activePlayers: [],
        skipNextReveal: Array(n).fill(false),
        revealedThisPhase: {},
        guessedThisPhase: {},
        phaseRound: 0,
      } : {}),
    };

    const command = new PutCommand({
      TableName: GAME_ROOMS_TABLE,
      Item: room,
    });

    await docClient.send(command);
    return { success: true, room };
  } catch (error) {
    console.error("Error creating game room:", error);
    return { success: false, error: "Failed to create game room" };
  }
}

// Get game room from Redis cache, then DynamoDB if cache miss
export async function getGameRoom(roomId: string): Promise<GameRoom | null> {
  try {
    // Try Redis cache first
    const cachedRoom = await getCachedGameRoom(roomId);
    if (cachedRoom) {
      return cachedRoom as GameRoom;
    }

    // Cache miss - fetch from DynamoDB
    const command = new GetCommand({
      TableName: GAME_ROOMS_TABLE,
      Key: { roomId },
    });

    const response = await docClient.send(command);
    const room = (response.Item as GameRoom) || null;

    // Cache the room if found
    if (room) {
      await cacheGameRoom(roomId, room);
    }

    return room;
  } catch (error) {
    console.error("Error getting game room:", error);
    return null;
  }
}

// Update game room in DynamoDB and Redis cache
export async function updateGameRoom(room: GameRoom): Promise<{ success: boolean; error?: string }> {
  try {
    const command = new PutCommand({
      TableName: GAME_ROOMS_TABLE,
      Item: room,
    });

    await docClient.send(command);
    
    // Update Redis cache
    await cacheGameRoom(room.roomId, room);
    
    return { success: true };
  } catch (error) {
    console.error("Error updating game room:", error);
    return { success: false, error: "Failed to update game room" };
  }
}

// Update socket IDs when players connect
export async function updatePlayerSocketId(
  roomId: string,
  playerIndex: number,
  socketId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const room = await getGameRoom(roomId);
    if (!room) {
      return { success: false, error: "Room not found" };
    }

    room.players[playerIndex].socketId = socketId;
    return await updateGameRoom(room);
  } catch (error) {
    console.error("Error updating socket ID:", error);
    return { success: false, error: "Failed to update socket ID" };
  }
}

// Add player to room (supports N players for royale)
export async function addPlayerToRoom(
  roomId: string,
  userId: string | undefined,
  playerName: string,
  socketId: string
): Promise<{ success: boolean; room?: GameRoom; error?: string }> {
  try {
    const room = await getGameRoom(roomId);
    
    if (!room) {
      return { success: false, error: "Room not found" };
    }

    if (room.players.length >= room.maxPlayers) {
      return { success: false, error: "Room is full" };
    }

    if (room.gameState !== "waiting") {
      return { success: false, error: "Game already in progress" };
    }

    const newIndex = room.players.length;
    room.players.push({
      id: userId || randomUUID(),
      socketId,
      playerIndex: newIndex,
      name: playerName,
    });

    await updateGameRoom(room);
    return { success: true, room };
  } catch (error) {
    console.error("Error adding player to room:", error);
    return { success: false, error: "Failed to add player" };
  }
}

// Update game state and images (supports N images for royale)
export async function updateGameImages(
  roomId: string,
  imageMetadata: (DynamicImageMetadata | null)[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const room = await getGameRoom(roomId);
    if (!room) {
      return { success: false, error: "Room not found" };
    }

    const { generateTiles } = await import("./tileGenerator");

    const imageUrls = imageMetadata.map(m => m?.url || "");

    console.log(`Generating tiles for ${imageMetadata.length} images...`);
    const tileResults = await Promise.all(
      imageUrls.map(url => generateTiles(url))
    );

    const allSucceeded = tileResults.every(r => r.success);
    if (!allSucceeded) {
      for (let i = 0; i < tileResults.length; i++) {
        console.error(`Image ${i} (${imageMetadata[i]?.title}): ${tileResults[i].success ? 'SUCCESS' : 'FAILED'}`);
      }
      return { success: false, error: "Failed to generate image tiles - images may be protected or unavailable" };
    }

    room.images = imageUrls;
    room.imageHashes = tileResults.map(r => r.imageHash);
    room.imageNames = imageMetadata.map(m => m?.title || "");
    room.imageMetadata = imageMetadata;
    room.gameState = "playing";

    if (room.gameMode === 'royale') {
      room.activePlayers = room.players.map(p => p.playerIndex);
    }

    const hashes = tileResults.map(r => r.imageHash).join(', ');
    const names = room.imageNames.map(n => `"${n}"`).join(' and ');
    console.log(`✅ Tiles generated successfully: ${hashes}`);
    console.log(`✅ Game ready with answers: ${names}`);
    return await updateGameRoom(room);
  } catch (error) {
    console.error("Error updating game images:", error);
    return { success: false, error: "Failed to update images" };
  }
}

// Delete game room (cleanup)
export async function deleteGameRoom(roomId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { DeleteCommand } = await import("@aws-sdk/lib-dynamodb");
    
    const command = new DeleteCommand({
      TableName: GAME_ROOMS_TABLE,
      Key: { roomId },
    });

    await docClient.send(command);
    
    // Also clear from Redis cache
    await deleteCachedGameRoom(roomId);
    
    return { success: true };
  } catch (error) {
    console.error("Error deleting game room:", error);
    return { success: false, error: "Failed to delete room" };
  }
}

// Get all active game rooms (for cleanup)
export async function getActiveGameRooms(): Promise<GameRoom[]> {
  try {
    const command = new ScanCommand({
      TableName: GAME_ROOMS_TABLE,
    });

    const response = await docClient.send(command);
    return (response.Items as GameRoom[]) || [];
  } catch (error) {
    console.error("Error getting active game rooms:", error);
    return [];
  }
}

// Cleanup old game rooms
export async function cleanupOldGameRooms(maxAge: number = 3600000): Promise<number> {
  try {
    const rooms = await getActiveGameRooms();
    const now = Date.now();
    let deletedCount = 0;

    for (const room of rooms) {
      if (now - room.createdAt > maxAge) {
        const result = await deleteGameRoom(room.roomId);
        if (result.success) {
          deletedCount++;
          console.log(`Cleaned up old game room: ${room.roomId}`);
        }
      }
    }

    return deletedCount;
  } catch (error) {
    console.error("Error cleaning up old game rooms:", error);
    return 0;
  }
}

// Store user's preferred category
export async function storeUserCategory(
  userId: string,
  category: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const command = new UpdateCommand({
      TableName: TABLES.USERS,
      Key: { userId },
      UpdateExpression: "SET lastSelectedCategory = :category, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":category": category,
        ":updatedAt": Date.now(),
      },
    });

    await docClient.send(command);
    return { success: true };
  } catch (error) {
    console.error("Error storing user category:", error);
    return { success: false, error: "Failed to store category" };
  }
}

// Get user's preferred category
export async function getUserCategory(userId: string): Promise<string | null> {
  try {
    const { getUserById } = await import("./userService");
    const user = await getUserById(userId);
    return (user as any)?.lastSelectedCategory || null;
  } catch (error) {
    console.error("Error getting user category:", error);
    return null;
  }
}

