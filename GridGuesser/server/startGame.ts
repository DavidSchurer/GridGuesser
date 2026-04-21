/**
 * Shared image fetch + game-start emit for join-room and vs-AI create flow.
 */
import type { Server } from "socket.io";
import { getGameRoom, updateGameRoom, updateGameImages } from "../lib/gameRoomService";
import {
  fetchTwoImagesForGame,
  fetchImagesForRoyaleGame,
  fetchCustomImagesForRoyaleGame,
  isGoogleApiConfigured,
  CategoryKey,
} from "../lib/googleImagesApi";
import imagesData from "../lib/images.json";
import type { ImageMetadata } from "../lib/types";

const staticImages: ImageMetadata[] = imagesData as ImageMetadata[];

function getTwoRandomImages(): [ImageMetadata, ImageMetadata] {
  if (staticImages.length >= 2) {
    return [staticImages[0], staticImages[1]];
  }
  return [staticImages[0], staticImages[0]];
}

export type FetchImagesOptions = {
  /** Called after game-start for royale (e.g. start first phase). */
  onRoyaleGameStarted?: (roomId: string) => void;
};

/**
 * Fetches images for a full room and transitions to playing, emitting `game-start`.
 * Used by join-room (room just became full) and create-room-with-id (vs AI).
 */
export async function fetchImagesAndStartGame(
  roomId: string,
  io: Server,
  options?: FetchImagesOptions
): Promise<void> {
  const roomSnapshot = await getGameRoom(roomId);
  if (!roomSnapshot) return;

  const category = roomSnapshot.category || "landmarks";
  const customQuery = roomSnapshot.customQuery;
  const imageCount = roomSnapshot.maxPlayers;

  let updateResult: { success: boolean; error?: string } | undefined;
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    try {
      let fetchedImages: unknown[];

      if (category === "custom" && customQuery) {
        if (imageCount > 2) {
          fetchedImages = await fetchCustomImagesForRoyaleGame(customQuery, imageCount as 3 | 4);
        } else {
          const { fetchTwoImagesForCustomGame } = await import("../lib/googleImagesApi");
          fetchedImages = await fetchTwoImagesForCustomGame(customQuery);
        }
        console.log(
          `Attempt ${retryCount + 1}: Fetching ${imageCount} images with custom query: "${customQuery}"`
        );
      } else {
        if (imageCount > 2) {
          fetchedImages = await fetchImagesForRoyaleGame(category as CategoryKey, imageCount as 3 | 4);
        } else {
          fetchedImages = await fetchTwoImagesForGame(category as CategoryKey);
        }
      }

      if (fetchedImages.every((img: unknown) => img !== null)) {
        updateResult = await updateGameImages(roomId, fetchedImages as Parameters<typeof updateGameImages>[1]);

        if (updateResult.success) {
          const queryInfo = customQuery ? `custom query "${customQuery}"` : `category "${category}"`;
          const titles = (fetchedImages as { title?: string }[])
            .map((img) => `"${img.title}"`)
            .join(", ");
          console.log(`✅ Images successfully stored from ${queryInfo}: ${titles}`);
          break;
        }
        console.log(`⚠️  Attempt ${retryCount + 1} failed: ${updateResult.error}. Retrying...`);
        retryCount++;
      } else {
        console.log(`⚠️  Failed to fetch images on attempt ${retryCount + 1}`);
        retryCount++;
      }
    } catch (e) {
      console.error(`fetchImagesAndStartGame attempt ${retryCount + 1}:`, e);
      retryCount++;
    }
  }

  if (updateResult?.success) {
    const updatedRoom = await getGameRoom(roomId);
    if (updatedRoom && updatedRoom.gameState === "playing") {
      io.to(roomId).emit("game-start", {
        roomId,
        players: updatedRoom.players,
        currentTurn: updatedRoom.currentTurn,
        imageHashes: updatedRoom.imageHashes,
        category: updatedRoom.category,
        gameMode: updatedRoom.gameMode,
        maxPlayers: updatedRoom.maxPlayers,
        vsAi: updatedRoom.vsAi,
        aiDifficulty: updatedRoom.aiDifficulty,
      });
      console.log(
        `✅ Game started for room ${roomId} (mode: ${updatedRoom.gameMode}, players: ${updatedRoom.maxPlayers})`
      );

      if (updatedRoom.gameMode === "royale") {
        options?.onRoyaleGameStarted?.(roomId);
      }
    }
    return;
  }

  // Fallback static images (normal 2-player path only — royale needs API)
  if (imageCount <= 2) {
    console.log("⚠️  All retries failed. Using static images as fallback.");
    const room = await getGameRoom(roomId);
    if (!room) return;

    const fallbackImages = getTwoRandomImages();
    room.images = [fallbackImages[0].id, fallbackImages[1].id];
    room.imageNames = [fallbackImages[0].name, fallbackImages[1].name];
    room.gameState = "playing";
    await updateGameRoom(room);

    io.to(roomId).emit("game-start", {
      roomId,
      players: room.players,
      currentTurn: room.currentTurn,
      images: room.images,
      category: room.category,
      gameMode: room.gameMode,
      maxPlayers: room.maxPlayers,
      vsAi: room.vsAi,
      aiDifficulty: room.aiDifficulty,
    });
    console.log(`✅ Game started with fallback images for room ${roomId}`);
  } else {
    console.log("⚠️  Could not start royale game: image fetch failed.");
  }
}
