// Load environment variables from .env.local
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, '../.env.local') });

import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";
import { GameRoom, GameMode, Player, ImageMetadata, AuthenticatedPlayer, RoyalePlacement } from "../lib/types";
import imagesData from "../lib/images.json";
import { verifyToken } from "../lib/jwt";
import { isDynamoDBConfigured } from "../lib/dynamodb";
import { 
  fetchTwoImagesForGame, 
  fetchImagesForRoyaleGame,
  fetchCustomImagesForRoyaleGame,
  isGoogleApiConfigured, 
  CategoryKey,
  CATEGORIES
} from "../lib/googleImagesApi";
import {
  createGameRoom,
  getGameRoom,
  updateGameRoom,
  addPlayerToRoom,
  updateGameImages,
  updatePlayerSocketId,
  cleanupOldGameRooms,
  getActiveGameRooms,
  deleteGameRoom,
  storeUserCategory,
  getUserCategory,
} from "../lib/gameRoomService";

const app = express();
const httpServer = createServer(app);

// Strip trailing slash from origin to avoid CORS mismatch
const ALLOWED_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, '');

// Middleware
app.use(cors({
  origin: ALLOWED_ORIGIN,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Check if AWS is configured
if (!isDynamoDBConfigured()) {
  console.error("\n==============================================");
  console.error("ERROR: AWS DynamoDB is NOT configured!");
  console.error("");
  console.error("Your .env.local must contain:");
  console.error("  AWS_ACCESS_KEY_ID=your_key");
  console.error("  AWS_SECRET_ACCESS_KEY=your_secret");
  console.error("  AWS_REGION=us-east-1");
  console.error("");
  console.error("Current error: UnrecognizedClientException");
  console.error("This means your AWS credentials are INVALID");
  console.error("");
  console.error("To fix:");
  console.error("1. Go to AWS IAM Console");
  console.error("2. Create NEW access keys");
  console.error("3. Update .env.local (no spaces, no quotes)");
  console.error("4. Restart server");
  console.error("");
  console.error("See SETUP_NOW.md for step-by-step instructions");
  console.error("==============================================\n");
  process.exit(1);
}

console.log("AWS DynamoDB configured - using persistent storage");
console.log(`Google API configured: ${isGoogleApiConfigured()}`);
const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
console.log(`Gemini LLM configured: ${!!geminiKey} ${geminiKey ? '(key: ' + geminiKey.slice(0, 8) + '...)' : '⚠️  Set GEMINI_API_KEY for custom categories'}`);
import authRoutes from "./authRoutes";
app.use("/api/auth", authRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "GridGuesser API is running",
    authMode: "dynamodb",
    awsConfigured: true,
    googleApiConfigured: isGoogleApiConfigured()
  });
});

// Tile serving endpoint - only serves individual tiles
import { getTilePath } from "../lib/tileGenerator";
app.get("/api/tiles/:imageHash/:tileIndex", (req, res) => {
  const { imageHash, tileIndex } = req.params;
  const tileIndexNum = parseInt(tileIndex, 10);

  // Validate tile index
  if (isNaN(tileIndexNum) || tileIndexNum < 0 || tileIndexNum >= 100) {
    res.status(400).json({ error: "Invalid tile index" });
    return;
  }

  const tilePath = getTilePath(imageHash, tileIndexNum);
  
  if (!tilePath) {
    res.status(404).json({ error: "Tile not found" });
    return;
  }

  // Serve the tile image
  res.sendFile(tilePath);
});

// Get available categories
app.get("/api/categories", (req, res) => {
  const categories = Object.entries(CATEGORIES).map(([key, value]) => ({
    id: key,
    name: value.name,
    searchTermsCount: value.searchTerms.length
  }));
  res.json({ categories });
});

// ─── Royale Phase Management ─────────────────────────────────────────────
const ROYALE_PHASE_DURATION = 20_000; // 20 seconds per phase
const royaleTimers = new Map<string, NodeJS.Timeout>();

// Reusable fuzzy match logic extracted for royale use
function normStr(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function levenshteinDist(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function fuzzyMatchStrings(guess: string, answer: string): boolean {
  const g = normStr(guess);
  const a = normStr(answer);
  if (g === a) return true;
  if (a.includes(g) || g.includes(a)) return true;
  const maxDist = Math.max(2, Math.floor(a.length * 0.3));
  if (levenshteinDist(g, a) <= maxDist) return true;
  const gWords = g.split(' ').filter(w => w.length > 1);
  const aWords = a.split(' ').filter(w => w.length > 1);
  let matched = 0;
  for (const aw of aWords) {
    for (const gw of gWords) {
      if (aw === gw || aw.includes(gw) || gw.includes(aw) || levenshteinDist(gw, aw) <= 1) {
        matched++;
        break;
      }
    }
  }
  if (aWords.length <= 2 && matched >= 1) return true;
  if (aWords.length > 2 && matched >= Math.ceil(aWords.length * 0.5)) return true;
  return false;
}

async function startRoyalePhase(roomId: string, phase: 'reveal' | 'guess') {
  const room = await getGameRoom(roomId);
  if (!room || room.gameState !== 'playing' || room.gameMode !== 'royale') return;

  // Clear any existing timer
  const existingTimer = royaleTimers.get(roomId);
  if (existingTimer) clearTimeout(existingTimer);

  const now = Date.now();
  room.royalePhase = phase;
  room.phaseEndTime = now + ROYALE_PHASE_DURATION;
  room.revealedThisPhase = {};
  room.guessedThisPhase = {};
  if (phase === 'reveal') {
    room.phaseRound = (room.phaseRound || 0) + 1;
  }

  await updateGameRoom(room);

  io.to(roomId).emit("phase-change", {
    phase,
    phaseEndTime: room.phaseEndTime,
    round: room.phaseRound,
    activePlayers: room.activePlayers,
  });

  console.log(`⏱️  Royale ${phase} phase started for room ${roomId} (round ${room.phaseRound})`);

  // Set timer for phase expiration
  const timer = setTimeout(async () => {
    await onRoyalePhaseExpired(roomId, phase);
  }, ROYALE_PHASE_DURATION + 500); // small buffer

  royaleTimers.set(roomId, timer);
}

async function onRoyalePhaseExpired(roomId: string, expiredPhase: 'reveal' | 'guess') {
  const room = await getGameRoom(roomId);
  if (!room || room.gameState !== 'playing' || room.gameMode !== 'royale') return;
  if (room.royalePhase !== expiredPhase) return; // phase already advanced

  if (expiredPhase === 'reveal') {
    // Move to guess phase
    await startRoyalePhase(roomId, 'guess');
  } else {
    // Move to next reveal phase
    await startRoyalePhase(roomId, 'reveal');
  }
}

async function checkAllPlayersActed(roomId: string, phase: 'reveal' | 'guess') {
  const room = await getGameRoom(roomId);
  if (!room || room.gameState !== 'playing' || room.gameMode !== 'royale') return;

  const active = room.activePlayers || [];
  const acted = phase === 'reveal' ? room.revealedThisPhase : room.guessedThisPhase;

  // Check if all active players have acted (or are skipped for reveal)
  const allActed = active.every(pIdx => {
    if (phase === 'reveal' && room.skipNextReveal?.[pIdx]) return true;
    return acted?.[pIdx] === true;
  });

  if (allActed) {
    // Clear skip flags after reveal phase
    if (phase === 'reveal' && room.skipNextReveal) {
      for (const pIdx of active) {
        room.skipNextReveal[pIdx] = false;
      }
      await updateGameRoom(room);
    }

    // Clear existing timer and move to next phase
    const existingTimer = royaleTimers.get(roomId);
    if (existingTimer) clearTimeout(existingTimer);

    if (phase === 'reveal') {
      await startRoyalePhase(roomId, 'guess');
    } else {
      await startRoyalePhase(roomId, 'reveal');
    }
  }
}

async function handleRoyalePlacement(roomId: string, playerIndex: number, guess: string) {
  const room = await getGameRoom(roomId);
  if (!room || room.gameMode !== 'royale') return;

  if (!room.placements) room.placements = [];
  room.placements.push(playerIndex);
  const place = room.placements.length;

  // Remove from active players
  room.activePlayers = (room.activePlayers || []).filter(p => p !== playerIndex);

  const placement: RoyalePlacement = {
    playerIndex,
    place,
    name: room.players[playerIndex].name,
    points: room.points[playerIndex],
    guess,
  };

  await updateGameRoom(room);

  io.to(roomId).emit("royale-placement", placement);
  console.log(`🏆 Royale: ${room.players[playerIndex].name} got ${place}${place === 1 ? 'st' : place === 2 ? 'nd' : 'rd'} place!`);

  // Check if game should end (N-1 players placed means last player is auto-last)
  if (room.activePlayers.length <= 1) {
    // Auto-assign last place to remaining player
    if (room.activePlayers.length === 1) {
      const lastPlayer = room.activePlayers[0];
      room.placements.push(lastPlayer);
      room.activePlayers = [];

      const lastPlacement: RoyalePlacement = {
        playerIndex: lastPlayer,
        place: room.placements.length,
        name: room.players[lastPlayer].name,
        points: room.points[lastPlayer],
      };

      io.to(roomId).emit("royale-placement", lastPlacement);
      console.log(`🏆 Royale: ${room.players[lastPlayer].name} auto-assigned ${lastPlacement.place}th place`);
    }

    // Game over
    room.gameState = 'finished';
    room.winner = room.placements[0]; // 1st place is the winner

    // Clear timer
    const timer = royaleTimers.get(roomId);
    if (timer) clearTimeout(timer);
    royaleTimers.delete(roomId);

    await updateGameRoom(room);

    const leaderboard: RoyalePlacement[] = room.placements.map((pIdx, i) => ({
      playerIndex: pIdx,
      place: i + 1,
      name: room.players[pIdx].name,
      points: room.points[pIdx],
    }));

    io.to(roomId).emit("royale-game-end", {
      placements: leaderboard,
      imageNames: room.imageNames,
    });

    // Update user stats
    for (const entry of leaderboard) {
      const player = room.players[entry.playerIndex];
      const { updateUserStats, getUserById } = await import("../lib/userService");
      const user = await getUserById(player.id);
      if (user) {
        await updateUserStats(player.id, {
          won: entry.place === 1,
          points: room.points[entry.playerIndex],
          tilesRevealed: room.revealedTiles[entry.playerIndex]?.length || 0,
          guessedCorrectly: entry.place <= room.maxPlayers - 1,
        }).catch(err => console.error("Error updating royale stats:", err));
      }
    }

    console.log(`🏁 Royale game ended for room ${roomId}`);
  }
}

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// In-memory map: socketId → roomId.  Populated on create/join/rejoin so the
// disconnect handler can look up the room without scanning DynamoDB.
const socketRoomMap = new Map<string, string>();

const images: ImageMetadata[] = imagesData as ImageMetadata[];

// Helper function to get the two images (one for each player) - fallback only
function getTwoRandomImages(): [ImageMetadata, ImageMetadata] {
  if (images.length >= 2) {
    return [images[0], images[1]];
  }
  return [images[0], images[0]];
}

// Helper function to generate room ID
function generateRoomId(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Clean up old rooms in DynamoDB (older than 1 hour)
setInterval(async () => {
  try {
    const deletedCount = await cleanupOldGameRooms(60 * 60 * 1000); // 1 hour
    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} old game rooms from DynamoDB`);
    }
  } catch (error) {
    console.error("Error cleaning up game rooms:", error);
  }
}, 5 * 60 * 1000); // Run every 5 minutes

// Socket.IO authentication middleware - get token from cookie
io.use((socket, next) => {
  // Get token from cookie header
  const cookies = socket.handshake.headers.cookie;
  let token = null;
  
  if (cookies) {
    const cookieArray = cookies.split(';');
    for (const cookie of cookieArray) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'auth_token') {
        token = value;
        break;
      }
    }
  }
  
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      (socket as any).userId = payload.userId;
      (socket as any).username = payload.username;
      (socket as any).email = payload.email;
    }
  }
  
  next();
});

io.on("connection", (socket: Socket) => {
  const userId = (socket as any).userId;
  const username = (socket as any).username;
  
  console.log(`User connected: ${socket.id}${userId ? ` (User: ${username})` : " (Guest)"}`);

  // Create a new game room
  socket.on("create-room", async (data: { playerName: string; category?: string; gameMode?: GameMode; maxPlayers?: number }, callback: (roomId: string) => void) => {
    const roomId = generateRoomId();
    const category = data.category || 'landmarks';
    const playerName = data.playerName || username || 'Player 1';
    const gameMode = data.gameMode || 'normal';
    const maxPlayers = gameMode === 'royale' ? (data.maxPlayers || 4) : 2;
    
    if (userId) {
      await storeUserCategory(userId, category);
    }
    
    const result = await createGameRoom(roomId, userId, playerName, category, undefined, gameMode, maxPlayers);
    
    if (!result.success || !result.room) {
      console.error(`Failed to create room: ${result.error}`);
      callback("");
      return;
    }
    
    await updatePlayerSocketId(roomId, 0, socket.id);
    
    socket.join(roomId);
    socketRoomMap.set(socket.id, roomId);
    
    console.log(`Room created in DynamoDB: ${roomId} by ${username || 'Guest'} (${socket.id}) with category: ${category}, mode: ${gameMode}, maxPlayers: ${maxPlayers}`);
    callback(roomId);
  });

  // Create a room with a specific ID
  socket.on("create-room-with-id", async (data: { roomId: string; playerName: string; category?: string; customQuery?: string; gameMode?: GameMode; maxPlayers?: number }, callback: (success: boolean, error?: string) => void) => {
    const { roomId, playerName, category, customQuery } = data;
    const gameMode = data.gameMode || 'normal';
    const maxPlayers = gameMode === 'royale' ? (data.maxPlayers || 4) : 2;
    
    const existingRoom = await getGameRoom(roomId);
    if (existingRoom) {
      callback(false, "Room already exists");
      return;
    }

    const selectedCategory = category || 'landmarks';
    const finalPlayerName = playerName || username || 'Player 1';
    
    if (userId) {
      await storeUserCategory(userId, selectedCategory);
    }
    
    const result = await createGameRoom(roomId, userId, finalPlayerName, selectedCategory, customQuery, gameMode, maxPlayers);
    
    if (!result.success) {
      callback(false, result.error || "Failed to create room");
      return;
    }
    
    await updatePlayerSocketId(roomId, 0, socket.id);
    
    socket.join(roomId);
    socketRoomMap.set(socket.id, roomId);
    
    const categoryInfo = customQuery ? `custom: "${customQuery}"` : selectedCategory;
    console.log(`Room created in DynamoDB with ID: ${roomId} by ${username || 'Guest'} (${socket.id}) with category: ${categoryInfo}, mode: ${gameMode}, maxPlayers: ${maxPlayers}`);
    callback(true);
  });

  // Join an existing room
  socket.on("join-room", async (data: { roomId: string; playerName: string }, callback: (success: boolean, playerIndex?: number, error?: string) => void) => {
    const { roomId, playerName } = data;
    const room = await getGameRoom(roomId);

    if (!room) {
      callback(false, undefined, "Room not found");
      return;
    }

    if (room.players.length >= room.maxPlayers) {
      callback(false, undefined, "Room is full");
      return;
    }

    if (room.gameState !== "waiting") {
      callback(false, undefined, "Game already in progress");
      return;
    }

    const finalPlayerName = playerName || username || `Player ${room.players.length + 1}`;
    
    const addPlayerResult = await addPlayerToRoom(roomId, userId, finalPlayerName, socket.id);
    
    if (!addPlayerResult.success || !addPlayerResult.room) {
      callback(false, undefined, addPlayerResult.error || "Failed to join room");
      return;
    }

    const newPlayerIndex = addPlayerResult.room.players.length - 1;
    socket.join(roomId);
    socketRoomMap.set(socket.id, roomId);

    // Notify everyone of the new player joining
    io.to(roomId).emit("player-joined", {
      playerIndex: newPlayerIndex,
      playerName: finalPlayerName,
      playerCount: addPlayerResult.room.players.length,
      maxPlayers: addPlayerResult.room.maxPlayers,
    });

    // Only start game when room is full
    if (addPlayerResult.room.players.length < addPlayerResult.room.maxPlayers) {
      console.log(`Player joined room ${roomId}: ${finalPlayerName} (${newPlayerIndex + 1}/${addPlayerResult.room.maxPlayers})`);
      callback(true, newPlayerIndex as number);
      return;
    }

    // Room is full - fetch images and start game
    const category = addPlayerResult.room.category || 'landmarks';
    const customQuery = addPlayerResult.room.customQuery;
    const imageCount = addPlayerResult.room.maxPlayers;
    
    try {
      let fetchedImages: any[];
      let updateResult: any;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        if (category === 'custom' && customQuery) {
          if (imageCount > 2) {
            fetchedImages = await fetchCustomImagesForRoyaleGame(customQuery, imageCount as 3 | 4);
          } else {
            const { fetchTwoImagesForCustomGame } = await import("../lib/googleImagesApi");
            fetchedImages = await fetchTwoImagesForCustomGame(customQuery);
          }
          console.log(`Attempt ${retryCount + 1}: Fetching ${imageCount} images with custom query: "${customQuery}"`);
        } else {
          if (imageCount > 2) {
            fetchedImages = await fetchImagesForRoyaleGame(category as CategoryKey, imageCount as 3 | 4);
          } else {
            fetchedImages = await fetchTwoImagesForGame(category as CategoryKey);
          }
        }
      
        if (fetchedImages.every((img: any) => img !== null)) {
          updateResult = await updateGameImages(roomId, fetchedImages);
          
          if (updateResult.success) {
            const queryInfo = customQuery ? `custom query "${customQuery}"` : `category "${category}"`;
            const titles = fetchedImages.map((img: any) => `"${img.title}"`).join(', ');
            console.log(`✅ Images successfully stored from ${queryInfo}: ${titles}`);
            break;
          } else {
            console.log(`⚠️  Attempt ${retryCount + 1} failed: ${updateResult.error}. Retrying...`);
            retryCount++;
          }
        } else {
          console.log(`⚠️  Failed to fetch images on attempt ${retryCount + 1}`);
          retryCount++;
        }
      }
      
      if (updateResult && updateResult.success) {
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
          });
          console.log(`✅ Game started for room ${roomId} (mode: ${updatedRoom.gameMode}, players: ${updatedRoom.maxPlayers})`);

          // For royale, kick off the first reveal phase after a short delay
          if (updatedRoom.gameMode === 'royale') {
            setTimeout(() => startRoyalePhase(roomId, 'reveal'), 2000);
          }
        }
      } else {
        console.log('⚠️  All retries failed. Using static images as fallback.');
        const fallbackImages = getTwoRandomImages();
        
        addPlayerResult.room.images = [fallbackImages[0].id, fallbackImages[1].id];
        addPlayerResult.room.imageNames = [fallbackImages[0].name, fallbackImages[1].name];
        addPlayerResult.room.gameState = "playing";
        await updateGameRoom(addPlayerResult.room);
        
        io.to(roomId).emit("game-start", {
          roomId,
          players: addPlayerResult.room.players,
          currentTurn: addPlayerResult.room.currentTurn,
          images: addPlayerResult.room.images,
          category: addPlayerResult.room.category,
          gameMode: addPlayerResult.room.gameMode,
        });
        console.log(`✅ Game started with fallback images for room ${roomId}`);
      }

      console.log(`Player joined room ${roomId}: ${username || 'Guest'} (${socket.id})`);
      callback(true, newPlayerIndex as number);
    } catch (error) {
      console.error('Error in join-room:', error);
      callback(false, undefined, "Failed to start game");
    }
  });

  // Get current game state from DynamoDB
  // SECURITY: Filter out full image URLs before sending to client
  socket.on("get-game-state", async (roomId: string, callback: (room: any) => void) => {
    const room = await getGameRoom(roomId);
    if (!room) {
      callback(null);
      return;
    }

    const numPlayers = room.players.length;
    const hints = room.revealedHints || Array.from({ length: numPlayers }, () => []);

    // For normal mode: maskedImageNames[p] = opponent's image name masked
    // For royale mode: maskedImageNames[p] = all other players' image names masked (as JSON array)
    let maskedImageNames: string[];

    if (room.gameMode === 'royale') {
      // In royale, each player can see masked names for ALL other players' images
      // maskedImageNames[p] = JSON-encoded array of masked names for all players
      maskedImageNames = room.players.map((_, p) => {
        const maskedForPlayer: { playerIndex: number; masked: string }[] = [];
        for (let other = 0; other < numPlayers; other++) {
          if (other === p) continue;
          const name = room.imageNames[other] || "";
          const revealed = new Set(hints[p] || []);
          const masked = Array.from(name)
            .map((ch, i) => {
              if (/\s/.test(ch)) return " ";
              if (!/[a-zA-Z0-9]/.test(ch)) return ch;
              return revealed.has(i) ? ch : "_";
            })
            .join("");
          maskedForPlayer.push({ playerIndex: other, masked });
        }
        return JSON.stringify(maskedForPlayer);
      });
    } else {
      // Normal mode: 2-player masked names
      maskedImageNames = Array.from({ length: numPlayers }, (_, p) => {
        const opponentIdx = 1 - p;
        const name = room.imageNames[opponentIdx] || "";
        const revealed = new Set(hints[p] || []);
        return Array.from(name)
          .map((ch, i) => {
            if (/\s/.test(ch)) return " ";
            if (!/[a-zA-Z0-9]/.test(ch)) return ch;
            return revealed.has(i) ? ch : "_";
          })
          .join("");
      });
    }

    const safeRoom = {
      ...room,
      images: undefined,
      imageHashes: room.imageHashes,
      imageMetadata: undefined,
      imageNames: undefined,
      maskedImageNames,
    };

    callback(safeRoom);
  });

  // Reveal a tile
  socket.on("reveal-tile", async (data: { roomId: string; tileIndex: number }, callback: (success: boolean, error?: string) => void) => {
    const { roomId, tileIndex } = data;
    const room = await getGameRoom(roomId);

    if (!room) {
      callback(false, "Room not found");
      return;
    }

    if (room.gameState !== "playing") {
      callback(false, "Game not in progress");
      return;
    }

    // Find which player is making the request
    const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
    if (playerIndex === -1) {
      callback(false, "Player not in room");
      return;
    }

    // Check if it's the player's turn
    if (room.currentTurn !== playerIndex) {
      callback(false, "Not your turn");
      return;
    }

    // The player reveals a tile from the OPPONENT's grid
    const opponentIndex = 1 - playerIndex;

    // Check if tile is already revealed
    if (room.revealedTiles[opponentIndex].includes(tileIndex)) {
      callback(false, "Tile already revealed");
      return;
    }

    // Add tile to revealed tiles
    room.revealedTiles[opponentIndex].push(tileIndex);

    // Award 1 point to the player who revealed the tile
    room.points[playerIndex] += 1;

    // Clear freeze on the player who just took their turn (they survived the frozen turn)
    if (room.freezeActive && room.freezeActive[playerIndex]) {
      room.freezeActive[playerIndex] = false;
    }

    // Check if skip turn power-up is active
    if (room.skipTurnActive) {
      // Don't switch turn, but reset the flag for next time
      room.skipTurnActive = false;
      console.log(`Skip turn active - ${room.players[playerIndex].name} gets another turn`);
    } else {
      // Normal turn switch
      room.currentTurn = 1 - room.currentTurn;
    }

    // Update room in DynamoDB
    await updateGameRoom(room);

    // Broadcast tile reveal to both players
    // SECURITY: Only send imageHash, not full URL
    io.to(roomId).emit("tile-revealed", {
      tileIndex,
      playerIndex: opponentIndex,
      revealedBy: playerIndex,
      currentTurn: room.currentTurn,
      imageHash: room.imageHashes[opponentIndex], // Send hash instead of full URL
      points: room.points,
    });

    callback(true);
  });

  // Submit a guess (normal mode only)
  socket.on("submit-guess", async (data: { roomId: string; guess: string }, callback: (success: boolean, correct?: boolean, error?: string) => void) => {
    const { roomId, guess } = data;
    const room = await getGameRoom(roomId);

    if (!room) { callback(false, false, "Room not found"); return; }
    if (room.gameState !== "playing") { callback(false, false, "Game not in progress"); return; }

    const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
    if (playerIndex === -1) { callback(false, false, "Player not in room"); return; }

    const opponentIndex = 1 - playerIndex;
    const correctAnswer = room.imageNames[opponentIndex];
    const playerOwnAnswer = room.imageNames[playerIndex];

    const guessedOwnImage = fuzzyMatchStrings(guess, playerOwnAnswer);
    if (guessedOwnImage && !fuzzyMatchStrings(guess, correctAnswer)) {
      callback(false, false, "You guessed your own image! Try guessing your opponent's image.");
      return;
    }
    
    const isCorrect = fuzzyMatchStrings(guess, correctAnswer);
    console.log(`🎯 Guess check: "${guess}" vs answer "${correctAnswer}" → ${isCorrect ? 'CORRECT ✅' : 'WRONG ❌'}`);

    if (isCorrect) {
      room.gameState = "finished";
      room.winner = playerIndex;
      await updateGameRoom(room);

      const winnerPlayer = room.players[playerIndex];
      const loserPlayer = room.players[opponentIndex];
      const { updateUserStats, getUserById } = await import("../lib/userService");
      
      const winnerUser = await getUserById(winnerPlayer.id);
      if (winnerUser) {
        await updateUserStats(winnerPlayer.id, {
          won: true,
          points: room.points[playerIndex],
          tilesRevealed: room.revealedTiles[playerIndex].length,
          guessedCorrectly: true,
        }).catch(error => console.error("Error updating winner stats:", error));
      }

      const loserUser = await getUserById(loserPlayer.id);
      if (loserUser) {
        await updateUserStats(loserPlayer.id, {
          won: false,
          points: room.points[opponentIndex],
          tilesRevealed: room.revealedTiles[opponentIndex].length,
          guessedCorrectly: false,
        }).catch(error => console.error("Error updating loser stats:", error));
      }

      io.to(roomId).emit("game-end", {
        winner: playerIndex,
        winnerGuess: guess,
        correctAnswer: correctAnswer,
        imageNames: room.imageNames,
      });

      callback(true, true);
    } else {
      const usedNuke = room.nukeUsed && room.nukeUsed[playerIndex];
      if (!usedNuke) {
        room.points[playerIndex] += 1;
      }
      room.currentTurn = 1 - room.currentTurn;
      await updateGameRoom(room);

      io.to(roomId).emit("wrong-guess", {
        playerIndex,
        guess,
        currentTurn: room.currentTurn,
        points: room.points,
      });

      callback(true, false);
    }
  });

  // Use power-up (works for both normal and royale modes)
  socket.on("use-power-up", async (data: { roomId: string; powerUpId: string; tileIndex?: number; lineType?: 'row' | 'col'; lineIndex?: number; targetPlayerIndex?: number }, callback: (success: boolean, error?: string) => void) => {
    const { roomId, powerUpId, tileIndex, lineType, lineIndex, targetPlayerIndex: requestedTarget } = data;
    const room = await getGameRoom(roomId);

    if (!room) {
      callback(false, "Room not found");
      return;
    }

    if (room.gameState !== "playing") {
      callback(false, "Game not in progress");
      return;
    }

    const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
    if (playerIndex === -1) {
      callback(false, "Player not in room");
      return;
    }

    // For royale, the target can be specified; for normal, it's always the opponent
    const opponentIndex = room.gameMode === 'royale' && requestedTarget !== undefined
      ? requestedTarget
      : (1 - playerIndex);

    if (room.gameMode === 'royale' && opponentIndex === playerIndex) {
      callback(false, "Can't target yourself");
      return;
    }

    if (room.freezeActive && room.freezeActive[playerIndex]) {
      callback(false, "You're frozen! Can't use power-ups this turn.");
      return;
    }

    // Define power-up costs
    const powerUpCosts: Record<string, number> = {
      skip: 5,
      reveal2x2: 8,
      nuke: 30,
      fog: 8,
      revealLine: 6,
      freeze: 6,
      peek: 4,
    };

    const cost = powerUpCosts[powerUpId];
    if (!cost) {
      callback(false, "Invalid power-up");
      return;
    }

    // Check if player has enough points
    if (room.points[playerIndex] < cost) {
      callback(false, "Not enough points");
      return;
    }

    // Deduct points
    room.points[playerIndex] -= cost;

    // Execute power-up
    switch (powerUpId) {
      case "skip":
        if (room.gameMode === 'royale') {
          if (!room.skipNextReveal) room.skipNextReveal = Array(room.maxPlayers).fill(false);
          room.skipNextReveal[opponentIndex] = true;
        } else {
          room.skipTurnActive = true;
        }
        io.to(roomId).emit("power-up-used", {
          powerUpId,
          usedBy: playerIndex,
          targetPlayer: opponentIndex,
          points: room.points,
          message: `${room.players[playerIndex].name} used Skip Turn on ${room.players[opponentIndex]?.name}!`,
        });
        break;

      case "reveal2x2": {
        if (tileIndex === undefined) {
          callback(false, "Tile index required for reveal2x2");
          return;
        }

        const row = Math.floor(tileIndex / 10);
        const col = tileIndex % 10;
        const tilesToReveal: number[] = [];

        for (let r = row; r < Math.min(row + 2, 10); r++) {
          for (let c = col; c < Math.min(col + 2, 10); c++) {
            const tile = r * 10 + c;
            if (!room.revealedTiles[opponentIndex].includes(tile)) {
              room.revealedTiles[opponentIndex].push(tile);
              tilesToReveal.push(tile);
            }
          }
        }

        room.currentTurn = 1 - room.currentTurn;

        io.to(roomId).emit("power-up-used", {
          powerUpId,
          usedBy: playerIndex,
          targetPlayer: opponentIndex,
          revealedTiles: tilesToReveal,
          allRevealedTiles: room.revealedTiles,
          points: room.points,
          currentTurn: room.currentTurn,
          message: `${room.players[playerIndex].name} used Reveal 2x2!`,
        });
        break;
      }

      case "nuke": {
        const allTiles = Array.from({ length: 100 }, (_, i) => i);
        room.revealedTiles[opponentIndex] = allTiles;

        if (!room.nukeUsed) room.nukeUsed = [false, false];
        room.nukeUsed[playerIndex] = true;

        room.currentTurn = 1 - room.currentTurn;

        io.to(roomId).emit("power-up-used", {
          powerUpId,
          usedBy: playerIndex,
          targetPlayer: opponentIndex,
          revealedTiles: allTiles,
          allRevealedTiles: room.revealedTiles,
          points: room.points,
          currentTurn: room.currentTurn,
          message: `${room.players[playerIndex].name} used Nuke!`,
        });
        break;
      }

      case "fog": {
        // Re-hide 4 random revealed tiles on the player's OWN image (the one opponent is guessing)
        const opponentRevealed = room.revealedTiles[playerIndex]; // tiles opponent revealed on MY image
        if (opponentRevealed.length === 0) {
          // Refund points – nothing to fog
          room.points[playerIndex] += cost;
          callback(false, "No revealed tiles to hide");
          return;
        }

        // Pick up to 4 random tiles to re-hide
        const shuffled = [...opponentRevealed].sort(() => Math.random() - 0.5);
        const numToHide = Math.min(4, shuffled.length);
        const hiddenTiles = shuffled.slice(0, numToHide);
        room.revealedTiles[playerIndex] = opponentRevealed.filter(t => !hiddenTiles.includes(t));

        io.to(roomId).emit("power-up-used", {
          powerUpId,
          usedBy: playerIndex,
          targetPlayer: playerIndex, // affects own grid
          foggedTiles: hiddenTiles,
          allRevealedTiles: room.revealedTiles,
          points: room.points,
          message: `${room.players[playerIndex].name} used Fog of War! ${numToHide} tiles hidden!`,
        });
        console.log(`🌫️  Fog of War: Player ${playerIndex} re-hid ${numToHide} tiles on their own image`);
        break;
      }

      case "revealLine": {
        if (lineType === undefined || lineIndex === undefined || lineIndex < 0 || lineIndex > 9) {
          callback(false, "Row/column selection required");
          return;
        }

        const lineTiles: number[] = [];
        for (let i = 0; i < 10; i++) {
          const tile = lineType === 'row' ? lineIndex * 10 + i : i * 10 + lineIndex;
          if (!room.revealedTiles[opponentIndex].includes(tile)) {
            room.revealedTiles[opponentIndex].push(tile);
            lineTiles.push(tile);
          }
        }

        room.currentTurn = 1 - room.currentTurn;

        io.to(roomId).emit("power-up-used", {
          powerUpId,
          usedBy: playerIndex,
          targetPlayer: opponentIndex,
          revealedTiles: lineTiles,
          allRevealedTiles: room.revealedTiles,
          points: room.points,
          currentTurn: room.currentTurn,
          lineType,
          lineIndex,
          message: `${room.players[playerIndex].name} revealed ${lineType} ${lineIndex + 1}!`,
        });
        console.log(`📏 Reveal Line: Player ${playerIndex} revealed ${lineType} ${lineIndex} (${lineTiles.length} new tiles)`);
        break;
      }

      case "freeze": {
        // Freeze opponent – they can't use power-ups on their next turn
        if (!room.freezeActive) room.freezeActive = [false, false];
        room.freezeActive[opponentIndex] = true;

        io.to(roomId).emit("power-up-used", {
          powerUpId,
          usedBy: playerIndex,
          targetPlayer: opponentIndex,
          points: room.points,
          freezeActive: room.freezeActive,
          message: `${room.players[playerIndex].name} used Freeze!`,
        });
        console.log(`❄️  Freeze: Player ${playerIndex} froze Player ${opponentIndex}'s power-ups`);
        break;
      }

      case "peek": {
        if (tileIndex === undefined) {
          callback(false, "Tile position required for peek");
          return;
        }

        // Calculate 3x3 area centered on the selected tile
        const peekRow = Math.floor(tileIndex / 10);
        const peekCol = tileIndex % 10;
        const peekTiles: number[] = [];

        for (let r = peekRow - 1; r <= peekRow + 1; r++) {
          for (let c = peekCol - 1; c <= peekCol + 1; c++) {
            if (r >= 0 && r < 10 && c >= 0 && c < 10) {
              peekTiles.push(r * 10 + c);
            }
          }
        }

        // Don't modify revealedTiles – peek is temporary, handled client-side
        room.currentTurn = 1 - room.currentTurn;

        io.to(roomId).emit("power-up-used", {
          powerUpId,
          usedBy: playerIndex,
          targetPlayer: opponentIndex,
          peekTiles,          // tiles to temporarily show
          peekPlayerIndex: playerIndex, // only this player sees the peek
          points: room.points,
          currentTurn: room.currentTurn,
          message: `${room.players[playerIndex].name} used Peek!`,
        });
        console.log(`🔍 Peek: Player ${playerIndex} peeking at ${peekTiles.length} tiles for 5 seconds`);
        break;
      }
    }

    // Update room in DynamoDB
    await updateGameRoom(room);
    callback(true);
  });

  // Use a hint – reveal one letter of the opponent's image name
  const HINT_COST = 3;

  socket.on("use-hint", async (data: { roomId: string }, callback: (success: boolean, error?: string) => void) => {
    const { roomId } = data;
    const room = await getGameRoom(roomId);

    if (!room) { callback(false, "Room not found"); return; }
    if (room.gameState !== "playing") { callback(false, "Game not in progress"); return; }

    const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
    if (playerIndex === -1) { callback(false, "Player not in room"); return; }

    // Check points
    if (room.points[playerIndex] < HINT_COST) {
      callback(false, "Not enough points (need 3)");
      return;
    }

    const opponentIndex = 1 - playerIndex;
    const answer = room.imageNames[opponentIndex]; // the word this player is guessing

    if (!answer) { callback(false, "No image to hint"); return; }

    // Initialise if missing (legacy rooms)
    if (!room.revealedHints) room.revealedHints = [[], []];

    // Build list of revealable character indices (letters/numbers only, skip spaces & punctuation)
    const alreadyRevealed = new Set(room.revealedHints[playerIndex]);
    const revealable: number[] = [];
    for (let i = 0; i < answer.length; i++) {
      if (/[a-zA-Z0-9]/.test(answer[i]) && !alreadyRevealed.has(i)) {
        revealable.push(i);
      }
    }

    if (revealable.length === 0) {
      callback(false, "All letters already revealed");
      return;
    }

    // Pick a random unrevealed character
    const idx = revealable[Math.floor(Math.random() * revealable.length)];

    // Deduct points & record the hint
    room.points[playerIndex] -= HINT_COST;
    room.revealedHints[playerIndex].push(idx);

    await updateGameRoom(room);

    // Broadcast to both players so the UI updates
    io.to(roomId).emit("hint-revealed", {
      playerIndex,        // who bought the hint
      charIndex: idx,     // which character was revealed
      char: answer[idx],  // the actual character
      revealedHints: room.revealedHints,
      points: room.points,
    });

    console.log(`💡 Hint: Player ${playerIndex} revealed letter "${answer[idx]}" (index ${idx}) of "${answer}" for ${HINT_COST} pts`);
    callback(true);
  });

  // Handle rematch request (now accepts an optional category / customQuery)
  socket.on("request-rematch", async ({ roomId, category: newCategory, customQuery: newCustomQuery }, callback) => {
    try {
      const room = await getGameRoom(roomId);
      
      if (!room) {
        callback(false, "Room not found");
        return;
      }

      const playerIndex = room.players.findIndex((p: Player) => p.socketId === socket.id);
      
      if (playerIndex === -1) {
        callback(false, "You are not in this room");
        return;
      }

      const n = room.maxPlayers;

      if (!room.rematchRequests) {
        room.rematchRequests = Array(n).fill(false);
      }

      room.rematchRequests[playerIndex] = true;

      if (newCategory) {
        room.rematchCategory = newCategory;
        room.rematchCustomQuery = newCategory === 'custom' ? (newCustomQuery || '') : undefined;
      }
      
      io.to(roomId).emit("rematch-requested", {
        playerIndex,
        category: room.rematchCategory || room.category,
        customQuery: room.rematchCustomQuery || room.customQuery,
      });

      // Check if ALL players want a rematch
      const allAgreed = room.rematchRequests.every((r: boolean) => r);
      if (allAgreed) {
        const category = room.rematchCategory || room.category;
        const customQuery = room.rematchCustomQuery ?? room.customQuery;

        room.category = category;
        room.customQuery = customQuery;

        room.gameState = 'waiting';
        room.revealedTiles = Array.from({ length: n }, () => []);
        room.revealedHints = Array.from({ length: n }, () => []);
        room.points = Array(n).fill(0);
        room.currentTurn = Math.floor(Math.random() * n);
        room.winner = undefined;
        room.skipTurnActive = false;
        room.freezeActive = Array(n).fill(false);
        room.rematchRequests = Array(n).fill(false);
        room.rematchCategory = undefined;
        room.rematchCustomQuery = undefined;
        room.nukeUsed = Array(n).fill(false);

        // Reset royale-specific fields
        if (room.gameMode === 'royale') {
          room.royalePhase = 'idle';
          room.placements = [];
          room.activePlayers = [];
          room.skipNextReveal = Array(n).fill(false);
          room.revealedThisPhase = {};
          room.guessedThisPhase = {};
          room.phaseRound = 0;
        }

        // Save the reset state to DB BEFORE fetching new images
        // (updateGameImages fetches a fresh room from DB, so the reset
        // must be persisted first or the old revealedTiles will survive)
        await updateGameRoom(room);

        // Fetch new images (supports N images for royale)
        const imageCount = room.maxPlayers;
        let fetchedImages: any[];
        let updateResult: any;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            if (category === 'custom' && customQuery) {
              if (imageCount > 2) {
                fetchedImages = await fetchCustomImagesForRoyaleGame(customQuery, imageCount as 3 | 4);
              } else {
                const { fetchTwoImagesForCustomGame } = await import("../lib/googleImagesApi");
                fetchedImages = await fetchTwoImagesForCustomGame(customQuery);
              }
            } else {
              if (imageCount > 2) {
                fetchedImages = await fetchImagesForRoyaleGame(category as CategoryKey, imageCount as 3 | 4);
              } else {
                fetchedImages = await fetchTwoImagesForGame(category as CategoryKey);
              }
            }
            
            if (fetchedImages.every((img: any) => img !== null)) {
              updateResult = await updateGameImages(roomId, fetchedImages);
              
              if (updateResult.success) {
                console.log(`✅ Rematch images stored for ${imageCount} players`);
                break;
              } else {
                retryCount++;
              }
            } else {
              retryCount++;
            }
          } catch (error) {
            console.error(`Rematch image fetch attempt ${retryCount + 1} failed:`, error);
            retryCount++;
          }
        }
        
        if (updateResult && updateResult.success) {
          const updatedRoom = await getGameRoom(roomId);
          if (updatedRoom) {
            io.to(roomId).emit("rematch-start", { roomId });
            io.to(roomId).emit("game-start", {
              roomId,
              players: updatedRoom.players,
              currentTurn: updatedRoom.currentTurn,
              imageHashes: updatedRoom.imageHashes,
              category: updatedRoom.category,
              gameMode: updatedRoom.gameMode,
              maxPlayers: updatedRoom.maxPlayers,
            });
            console.log(`✅ Rematch started for room ${roomId} with category: ${category}`);

            if (updatedRoom.gameMode === 'royale') {
              setTimeout(() => startRoyalePhase(roomId, 'reveal'), 2000);
            }
          }
        } else {
          io.to(roomId).emit("rematch-declined");
          console.log('⚠️  All rematch retries failed.');
        }
      } else {
        await updateGameRoom(room);
      }

      callback(true);
    } catch (error) {
      console.error("Error handling rematch request:", error);
      callback(false, "Failed to process rematch request");
    }
  });

  // Handle decline rematch
  socket.on("decline-rematch", async ({ roomId }) => {
    try {
      const room = await getGameRoom(roomId);
      
      if (!room) return;

      const playerIndex = room.players.findIndex((p: Player) => p.socketId === socket.id);
      
      if (playerIndex === -1) return;

      room.rematchRequests = Array(room.maxPlayers).fill(false);
      await updateGameRoom(room);

      io.to(roomId).emit("rematch-declined");
    } catch (error) {
      console.error("Error handling decline rematch:", error);
    }
  });

  // ─── Grid Royale Events ─────────────────────────────────────────────────

  // Royale: Reveal a tile during reveal phase
  socket.on("royale-reveal-tile", async (data: { roomId: string; tileIndex: number; targetPlayerIndex: number }, callback: (success: boolean, error?: string) => void) => {
    const { roomId, tileIndex, targetPlayerIndex } = data;
    const room = await getGameRoom(roomId);

    if (!room) { callback(false, "Room not found"); return; }
    if (room.gameMode !== 'royale') { callback(false, "Not a royale game"); return; }
    if (room.gameState !== 'playing') { callback(false, "Game not in progress"); return; }
    if (room.royalePhase !== 'reveal') { callback(false, "Not in reveal phase"); return; }

    const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
    if (playerIndex === -1) { callback(false, "Player not in room"); return; }
    if (!(room.activePlayers || []).includes(playerIndex)) { callback(false, "You've already been placed"); return; }
    if (room.revealedThisPhase?.[playerIndex]) { callback(false, "Already revealed this phase"); return; }
    if (room.skipNextReveal?.[playerIndex]) { callback(false, "Your reveal was skipped this round"); return; }
    if (targetPlayerIndex === playerIndex) { callback(false, "Can't reveal your own grid"); return; }
    if (room.revealedTiles[targetPlayerIndex]?.includes(tileIndex)) { callback(false, "Tile already revealed"); return; }

    // Reveal the tile
    if (!room.revealedTiles[targetPlayerIndex]) room.revealedTiles[targetPlayerIndex] = [];
    room.revealedTiles[targetPlayerIndex].push(tileIndex);
    room.points[playerIndex] += 1;

    if (!room.revealedThisPhase) room.revealedThisPhase = {};
    room.revealedThisPhase[playerIndex] = true;

    await updateGameRoom(room);

    io.to(roomId).emit("royale-tile-revealed", {
      tileIndex,
      targetPlayerIndex,
      revealedBy: playerIndex,
      imageHash: room.imageHashes[targetPlayerIndex],
      revealedTiles: room.revealedTiles,
      points: room.points,
    });

    callback(true);

    // Check if all active players have revealed
    await checkAllPlayersActed(roomId, 'reveal');
  });

  // Royale: Submit a guess during guess phase
  socket.on("royale-submit-guess", async (data: { roomId: string; guess: string; targetPlayerIndex: number }, callback: (success: boolean, correct?: boolean, error?: string) => void) => {
    const { roomId, guess, targetPlayerIndex } = data;
    const room = await getGameRoom(roomId);

    if (!room) { callback(false, false, "Room not found"); return; }
    if (room.gameMode !== 'royale') { callback(false, false, "Not a royale game"); return; }
    if (room.gameState !== 'playing') { callback(false, false, "Game not in progress"); return; }
    if (room.royalePhase !== 'guess') { callback(false, false, "Not in guess phase"); return; }

    const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
    if (playerIndex === -1) { callback(false, false, "Player not in room"); return; }
    if (!(room.activePlayers || []).includes(playerIndex)) { callback(false, false, "You've already been placed"); return; }
    if (room.guessedThisPhase?.[playerIndex]) { callback(false, false, "Already guessed this phase"); return; }
    if (targetPlayerIndex === playerIndex) { callback(false, false, "Can't guess your own image"); return; }

    if (!room.guessedThisPhase) room.guessedThisPhase = {};
    room.guessedThisPhase[playerIndex] = true;

    const correctAnswer = room.imageNames[targetPlayerIndex];
    const isCorrect = fuzzyMatchStrings(guess, correctAnswer);

    console.log(`🎯 Royale guess: Player ${playerIndex} guessed "${guess}" for player ${targetPlayerIndex}'s image "${correctAnswer}" → ${isCorrect ? 'CORRECT ✅' : 'WRONG ❌'}`);

    if (isCorrect) {
      await updateGameRoom(room);

      io.to(roomId).emit("royale-correct-guess", {
        playerIndex,
        targetPlayerIndex,
        guess,
        correctAnswer,
      });

      callback(true, true);

      // Handle placement
      await handleRoyalePlacement(roomId, playerIndex, guess);
    } else {
      const usedNuke = room.nukeUsed && room.nukeUsed[playerIndex];
      if (!usedNuke) {
        room.points[playerIndex] += 1;
      }
      await updateGameRoom(room);

      io.to(roomId).emit("royale-wrong-guess", {
        playerIndex,
        targetPlayerIndex,
        guess,
        points: room.points,
      });

      callback(true, false);
    }

    // Check if all active players have guessed
    await checkAllPlayersActed(roomId, 'guess');
  });

  // Royale: Skip guess (player chooses not to guess this phase)
  socket.on("royale-skip-guess", async (data: { roomId: string }, callback: (success: boolean, error?: string) => void) => {
    const { roomId } = data;
    const room = await getGameRoom(roomId);

    if (!room || room.gameMode !== 'royale' || room.royalePhase !== 'guess') {
      callback(false, "Cannot skip");
      return;
    }

    const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
    if (playerIndex === -1 || !(room.activePlayers || []).includes(playerIndex)) {
      callback(false, "Not an active player");
      return;
    }

    if (!room.guessedThisPhase) room.guessedThisPhase = {};
    room.guessedThisPhase[playerIndex] = true;
    await updateGameRoom(room);

    callback(true);
    await checkAllPlayersActed(roomId, 'guess');
  });

  // ─── Rejoin Support ────────────────────────────────────────────────────

  // Check if a player can rejoin an active game
  socket.on("check-rejoin", async (data: { roomId: string; playerId: string }, callback: (canRejoin: boolean, room?: any) => void) => {
    try {
      const room = await getGameRoom(data.roomId);
      if (!room) { callback(false); return; }

      // Room must still be playing or waiting
      if (room.gameState === 'finished') { callback(false); return; }

      const playerIndex = room.players.findIndex((p: Player) => p.id === data.playerId);
      if (playerIndex === -1) { callback(false); return; }

      console.log(`🔍 Rejoin check: Player "${room.players[playerIndex].name}" can rejoin room ${data.roomId}`);
      callback(true, {
        roomId: room.roomId,
        gameState: room.gameState,
        playerIndex,
        playerName: room.players[playerIndex].name,
        opponentName: room.players[1 - playerIndex]?.name || null,
        category: room.category,
      });
    } catch (error) {
      console.error("Error checking rejoin:", error);
      callback(false);
    }
  });

  // Rejoin an active game room
  socket.on("rejoin-room", async (data: { roomId: string; playerId: string }, callback: (success: boolean, playerIndex?: number, error?: string) => void) => {
    try {
      const room = await getGameRoom(data.roomId);
      if (!room) { callback(false, undefined, "Room no longer exists"); return; }
      if (room.gameState === 'finished') { callback(false, undefined, "Game already finished"); return; }

      const playerIndex = room.players.findIndex((p: Player) => p.id === data.playerId);
      if (playerIndex === -1) { callback(false, undefined, "Player not found in room"); return; }

      room.players[playerIndex].socketId = socket.id;
      await updateGameRoom(room);

      socket.join(data.roomId);
      socketRoomMap.set(socket.id, data.roomId);

      socket.to(data.roomId).emit("player-reconnected", {
        playerIndex,
        message: `${room.players[playerIndex].name} reconnected!`,
      });

      console.log(`🔄 Player "${room.players[playerIndex].name}" rejoined room ${data.roomId} as player ${playerIndex}`);
      callback(true, playerIndex);
    } catch (error) {
      console.error("Error rejoining room:", error);
      callback(false, undefined, "Failed to rejoin");
    }
  });

  // ─── Disconnection ───────────────────────────────────────────────────

  socket.on("disconnect", async () => {
    console.log(`User disconnected: ${socket.id}`);

    const roomId = socketRoomMap.get(socket.id);
    socketRoomMap.delete(socket.id);

    if (roomId) {
      const room = await getGameRoom(roomId);
      if (room) {
        const playerIndex = room.players.findIndex((p: Player) => p.socketId === socket.id);
        if (playerIndex !== -1) {
          io.to(roomId).emit("player-disconnected", {
            playerIndex,
            message: "Opponent disconnected — waiting for them to rejoin",
          });
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;

// Connect to Redis eagerly so the first player action doesn't pay connection latency
import { initRedis } from "../lib/redisClient";

httpServer.listen(PORT, async () => {
  console.log(`[GridGuesser] Socket.io server running on port ${PORT}`);
  await initRedis();
});

