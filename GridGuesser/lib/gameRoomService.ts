// Load environment variables first
import dotenv from "dotenv";
import path from "path";
if (typeof __dirname !== 'undefined') {
  dotenv.config({ path: path.join(__dirname, '../.env.local') });
}

import { docClient, TABLES, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand } from "./dynamodb";
import { GameRoom, DynamicImageMetadata } from "./types";
import { randomUUID } from "crypto";

// DynamoDB table for game rooms
const GAME_ROOMS_TABLE = process.env.DYNAMODB_GAME_ROOMS_TABLE || "GridGuesser-GameRooms";

// Create a new game room in DynamoDB
export async function createGameRoom(
  roomId: string,
  creatorUserId: string | undefined,
  creatorName: string,
  category: string,
  customQuery?: string
): Promise<{ success: boolean; room?: GameRoom; error?: string }> {
  try {
    const now = Date.now();
    
    const room: GameRoom = {
      roomId,
      players: [{
        id: creatorUserId || randomUUID(),
        socketId: "", // Will be updated when socket connects
        playerIndex: 0,
        name: creatorName,
      }],
      currentTurn: 0,
      gameState: "waiting",
      revealedTiles: [[], []],
      images: ["", ""],
      imageHashes: ["", ""],
      imageNames: ["", ""],
      points: [0, 0],
      createdAt: now,
      category,
      customQuery, // Store custom query if provided
      imageMetadata: [null, null],
      skipTurnActive: false,
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

// Get game room from DynamoDB
export async function getGameRoom(roomId: string): Promise<GameRoom | null> {
  try {
    const command = new GetCommand({
      TableName: GAME_ROOMS_TABLE,
      Key: { roomId },
    });

    const response = await docClient.send(command);
    return (response.Item as GameRoom) || null;
  } catch (error) {
    console.error("Error getting game room:", error);
    return null;
  }
}

// Update game room in DynamoDB
export async function updateGameRoom(room: GameRoom): Promise<{ success: boolean; error?: string }> {
  try {
    const command = new PutCommand({
      TableName: GAME_ROOMS_TABLE,
      Item: room,
    });

    await docClient.send(command);
    return { success: true };
  } catch (error) {
    console.error("Error updating game room:", error);
    return { success: false, error: "Failed to update game room" };
  }
}

// Update socket IDs when players connect
export async function updatePlayerSocketId(
  roomId: string,
  playerIndex: 0 | 1,
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

// Add second player to room
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

    if (room.players.length >= 2) {
      return { success: false, error: "Room is full" };
    }

    if (room.gameState !== "waiting") {
      return { success: false, error: "Game already in progress" };
    }

    room.players.push({
      id: userId || randomUUID(),
      socketId,
      playerIndex: 1,
      name: playerName,
    });

    await updateGameRoom(room);
    return { success: true, room };
  } catch (error) {
    console.error("Error adding player to room:", error);
    return { success: false, error: "Failed to add player" };
  }
}

// Update game state and images (with retry logic for failed downloads)
export async function updateGameImages(
  roomId: string,
  imageMetadata: [DynamicImageMetadata | null, DynamicImageMetadata | null]
): Promise<{ success: boolean; error?: string }> {
  try {
    const room = await getGameRoom(roomId);
    if (!room) {
      return { success: false, error: "Room not found" };
    }

    // Generate tiles for both images
    const { generateTiles } = await import("./tileGenerator");
    
    const image1Url = imageMetadata[0]?.url || "";
    const image2Url = imageMetadata[1]?.url || "";

    console.log("Generating tiles for both images...");
    const [tiles1Result, tiles2Result] = await Promise.all([
      generateTiles(image1Url),
      generateTiles(image2Url),
    ]);

    if (!tiles1Result.success || !tiles2Result.success) {
      console.error("Failed to generate tiles - one or more images failed to download");
      console.error(`Image 1 (${imageMetadata[0]?.title}): ${tiles1Result.success ? 'SUCCESS' : 'FAILED'}`);
      console.error(`Image 2 (${imageMetadata[1]?.title}): ${tiles2Result.success ? 'SUCCESS' : 'FAILED'}`);
      return { success: false, error: "Failed to generate image tiles - images may be protected or unavailable" };
    }

    room.images = [image1Url, image2Url];
    room.imageHashes = [tiles1Result.imageHash, tiles2Result.imageHash];
    room.imageNames = [
      imageMetadata[0]?.title || "",
      imageMetadata[1]?.title || ""
    ];
    room.imageMetadata = imageMetadata;
    room.gameState = "playing";

    console.log(`✅ Tiles generated successfully: ${tiles1Result.imageHash}, ${tiles2Result.imageHash}`);
    console.log(`✅ Game ready with answers: "${room.imageNames[0]}" and "${room.imageNames[1]}"`);
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

