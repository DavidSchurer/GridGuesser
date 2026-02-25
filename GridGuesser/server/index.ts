// Load environment variables from .env.local
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, '../.env.local') });

import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";
import { GameRoom, Player, ImageMetadata, AuthenticatedPlayer } from "../lib/types";
import imagesData from "../lib/images.json";
import { verifyToken } from "../lib/jwt";
import { isDynamoDBConfigured } from "../lib/dynamodb";
import { 
  fetchTwoImagesForGame, 
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

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

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
  socket.on("create-room", async (data: { playerName: string; category?: string }, callback: (roomId: string) => void) => {
    const roomId = generateRoomId();
    const category = data.category || 'landmarks';
    const playerName = data.playerName || username || 'Player 1';
    
    // Store user's category preference if logged in
    if (userId) {
      await storeUserCategory(userId, category);
    }
    
    // Create room in DynamoDB
    const result = await createGameRoom(roomId, userId, playerName, category);
    
    if (!result.success || !result.room) {
      console.error(`Failed to create room: ${result.error}`);
      callback(""); // Empty string indicates failure
      return;
    }
    
    // Update socket ID in DynamoDB
    await updatePlayerSocketId(roomId, 0, socket.id);
    
    socket.join(roomId);
    
    console.log(`Room created in DynamoDB: ${roomId} by ${username || 'Guest'} (${socket.id}) with category: ${category}`);
    callback(roomId);
  });

  // Create a room with a specific ID
  socket.on("create-room-with-id", async (data: { roomId: string; playerName: string; category?: string; customQuery?: string }, callback: (success: boolean, error?: string) => void) => {
    const { roomId, playerName, category, customQuery } = data;
    
    // Check if room already exists in DynamoDB
    const existingRoom = await getGameRoom(roomId);
    if (existingRoom) {
      callback(false, "Room already exists");
      return;
    }

    const selectedCategory = category || 'landmarks';
    const finalPlayerName = playerName || username || 'Player 1';
    
    // Store user's category preference if logged in
    if (userId) {
      await storeUserCategory(userId, selectedCategory);
    }
    
    // Create room in DynamoDB
    const result = await createGameRoom(roomId, userId, finalPlayerName, selectedCategory, customQuery);
    
    if (!result.success) {
      callback(false, result.error || "Failed to create room");
      return;
    }
    
    // Update socket ID
    await updatePlayerSocketId(roomId, 0, socket.id);
    
    socket.join(roomId);
    
    const categoryInfo = customQuery ? `custom: "${customQuery}"` : selectedCategory;
    console.log(`Room created in DynamoDB with ID: ${roomId} by ${username || 'Guest'} (${socket.id}) with category: ${categoryInfo}`);
    callback(true);
  });

  // Join an existing room
  socket.on("join-room", async (data: { roomId: string; playerName: string }, callback: (success: boolean, playerIndex?: 0 | 1, error?: string) => void) => {
    const { roomId, playerName } = data;
    const room = await getGameRoom(roomId);

    if (!room) {
      callback(false, undefined, "Room not found");
      return;
    }

    if (room.players.length >= 2) {
      callback(false, undefined, "Room is full");
      return;
    }

    if (room.gameState !== "waiting") {
      callback(false, undefined, "Game already in progress");
      return;
    }

    const finalPlayerName = playerName || username || 'Player 2';
    
    // Add player to room in DynamoDB
    const addPlayerResult = await addPlayerToRoom(roomId, userId, finalPlayerName, socket.id);
    
    if (!addPlayerResult.success || !addPlayerResult.room) {
      callback(false, undefined, addPlayerResult.error || "Failed to join room");
      return;
    }

    socket.join(roomId);

    // Fetch images based on selected category
    const category = addPlayerResult.room.category || 'landmarks';
    const customQuery = addPlayerResult.room.customQuery;
    
    try {
      let image1, image2;
      let updateResult;
      let retryCount = 0;
      const maxRetries = 3;
      
      // Retry loop for fetching images (in case of 403 errors)
      while (retryCount < maxRetries) {
        // Use custom query if category is 'custom'
        if (category === 'custom' && customQuery) {
          const { fetchTwoImagesForCustomGame } = await import("../lib/googleImagesApi");
          [image1, image2] = await fetchTwoImagesForCustomGame(customQuery);
          console.log(`Attempt ${retryCount + 1}: Fetching images with custom query: "${customQuery}"`);
        } else {
          [image1, image2] = await fetchTwoImagesForGame(category as CategoryKey);
        }
      
      if (image1 && image2) {
          // Try to store images and generate tiles
          updateResult = await updateGameImages(roomId, [image1, image2]);
          
          if (updateResult.success) {
            // Success! Break out of retry loop
            const queryInfo = customQuery ? `custom query "${customQuery}"` : `category "${category}"`;
            console.log(`✅ Images successfully stored from ${queryInfo}: "${image1.title}" and "${image2.title}"`);
            break;
          } else {
            // Tile generation failed (likely 403 error), retry with different images
            console.log(`⚠️  Attempt ${retryCount + 1} failed: ${updateResult.error}. Retrying...`);
            retryCount++;
          }
        } else {
          console.log(`⚠️  Failed to fetch images on attempt ${retryCount + 1}`);
          retryCount++;
        }
      }
      
      // Check if we succeeded or need to use fallback
      if (updateResult && updateResult.success) {
        // Get updated room from DynamoDB
        const updatedRoom = await getGameRoom(roomId);
        if (updatedRoom && updatedRoom.gameState === "playing") {
          // Notify both players that the game is starting
          // DO NOT send full image URLs - only send imageHashes for tile access
          io.to(roomId).emit("game-start", {
            roomId,
            players: updatedRoom.players,
            currentTurn: updatedRoom.currentTurn,
            imageHashes: updatedRoom.imageHashes, // Only send hashes, not full URLs
            category: updatedRoom.category,
          });
          console.log(`✅ Game started for room ${roomId}`);
        }
      } else {
        // All retries failed - Fallback to static images
        console.log('⚠️  All retries failed. Using static images as fallback.');
        const [fallbackImage1, fallbackImage2] = getTwoRandomImages();
        
        addPlayerResult.room.images = [fallbackImage1.id, fallbackImage2.id];
        addPlayerResult.room.imageNames = [fallbackImage1.name, fallbackImage2.name];
        addPlayerResult.room.gameState = "playing";
        await updateGameRoom(addPlayerResult.room);
        
        io.to(roomId).emit("game-start", {
          roomId,
          players: addPlayerResult.room.players,
          currentTurn: addPlayerResult.room.currentTurn,
          images: addPlayerResult.room.images,
          category: addPlayerResult.room.category,
        });
        console.log(`✅ Game started with fallback images for room ${roomId}`);
      }

      console.log(`Player joined room ${roomId}: ${username || 'Guest'} (${socket.id})`);
      callback(true, 1);
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

    // Build masked image names – only show characters that have been hinted
    // maskedImageNames[p] = the name that player p is trying to guess, with unrevealed chars replaced by _
    const hints = room.revealedHints || [[], []];
    const maskedImageNames: [string, string] = ["", ""];
    for (let p = 0; p < 2; p++) {
      const opponentIdx = 1 - p;
      const name = room.imageNames[opponentIdx] || "";
      const revealed = new Set(hints[p]);
      maskedImageNames[p] = Array.from(name)
        .map((ch, i) => {
          if (/\s/.test(ch)) return " ";        // keep spaces visible
          if (!/[a-zA-Z0-9]/.test(ch)) return ch; // keep punctuation visible
          return revealed.has(i) ? ch : "_";
        })
        .join("");
    }

    // Create a safe version without full image URLs or raw image names
    const safeRoom = {
      ...room,
      images: undefined, // Never send full image URLs
      imageHashes: room.imageHashes, // Only send hashes
      imageMetadata: undefined, // Don't send full metadata
      imageNames: undefined, // Never send raw names (prevents cheating)
      maskedImageNames,     // Send masked version per player
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
      room.currentTurn = (1 - room.currentTurn) as 0 | 1;
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

  // Submit a guess
  socket.on("submit-guess", async (data: { roomId: string; guess: string }, callback: (success: boolean, correct?: boolean, error?: string) => void) => {
    const { roomId, guess } = data;
    const room = await getGameRoom(roomId);

    if (!room) {
      callback(false, false, "Room not found");
      return;
    }

    if (room.gameState !== "playing") {
      callback(false, false, "Game not in progress");
      return;
    }

    const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
    if (playerIndex === -1) {
      callback(false, false, "Player not in room");
      return;
    }

    // IMPORTANT: Check guess against OPPONENT's image, not player's own image
    // Player 0 tries to guess Player 1's image, and vice versa
    const opponentIndex = 1 - playerIndex;
    const correctAnswer = room.imageNames[opponentIndex];
    const playerOwnAnswer = room.imageNames[playerIndex];
    
    // ── Fuzzy matching helpers ──────────────────────────────────
    // Levenshtein distance
    function levenshtein(a: string, b: string): number {
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

    // Normalize: lowercase, strip non-alphanumeric, collapse spaces
    function norm(s: string): string {
      return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    }

    // Split into meaningful words (drop tiny filler words)
    function toWords(s: string): string[] {
      return norm(s).split(' ').filter(w => w.length > 1);
    }

    /**
     * Check if `guess` is a fuzzy match for `answer`.
     * Returns true if ANY of:
     *  1. Exact match after normalization
     *  2. One string contains the other
     *  3. Levenshtein distance ≤ 30% of answer length (min 2)
     *  4. Any word in the answer appears in the guess (or vice versa) with Lev ≤ 1
     *  5. ≥ 50% of answer words are matched by guess words (for multi-word answers)
     */
    function fuzzyMatch(guess: string, answer: string): boolean {
      const g = norm(guess);
      const a = norm(answer);

      // 1. Exact
      if (g === a) return true;

      // 2. Containment
      if (a.includes(g) || g.includes(a)) return true;

      // 3. Levenshtein on full strings
      const maxDist = Math.max(2, Math.floor(a.length * 0.3));
      if (levenshtein(g, a) <= maxDist) return true;

      // 4 & 5. Word-level matching
      const gWords = toWords(guess);
      const aWords = toWords(answer);

      // Any answer word closely matches any guess word
      let matchedAnswerWords = 0;
      for (const aw of aWords) {
        for (const gw of gWords) {
          // Allow Levenshtein ≤ 1 per word, or containment
          if (aw === gw || aw.includes(gw) || gw.includes(aw) || levenshtein(gw, aw) <= 1) {
            matchedAnswerWords++;
            break;
          }
        }
      }

      // If any keyword matched → correct (for 1-2 word answers this is very forgiving)
      if (aWords.length <= 2 && matchedAnswerWords >= 1) return true;

      // For longer answers, require ≥ 50% word overlap
      if (aWords.length > 2 && matchedAnswerWords >= Math.ceil(aWords.length * 0.5)) return true;

      return false;
    }
    // ─────────────────────────────────────────────────────────────

    const normalizedGuess = norm(guess);
    const normalizedAnswer = norm(correctAnswer);
    const normalizedOwnAnswer = norm(playerOwnAnswer);
    
    // Check if player accidentally guessed their own image (should not win)
    const guessedOwnImage = fuzzyMatch(normalizedGuess, normalizedOwnAnswer);
    
    if (guessedOwnImage && !fuzzyMatch(normalizedGuess, normalizedAnswer)) {
      console.log(`⚠️  Player ${playerIndex} guessed their own image: "${guess}" (own: "${playerOwnAnswer}")`);
      callback(false, false, "You guessed your own image! Try guessing your opponent's image.");
      return;
    }
    
    const isCorrect = fuzzyMatch(normalizedGuess, normalizedAnswer);
    console.log(`🎯 Guess check: "${guess}" vs answer "${correctAnswer}" → ${isCorrect ? 'CORRECT ✅' : 'WRONG ❌'}`);

    if (isCorrect) {
      room.gameState = "finished";
      room.winner = playerIndex as 0 | 1;
      
      // Update room in DynamoDB
      await updateGameRoom(room);

      // Update user stats for both players (if authenticated)
      const winnerPlayer = room.players[playerIndex];
      const loserPlayer = room.players[opponentIndex];

      // Update stats in DynamoDB
      const { updateUserStats, getUserById } = await import("../lib/userService");
      
      // Update winner stats (check if id is a real userId, not a guest UUID)
      const winnerUser = await getUserById(winnerPlayer.id);
      if (winnerUser) {
        console.log(`Updating winner stats for user: ${winnerUser.username}`);
        await updateUserStats(winnerPlayer.id, {
          won: true,
          points: room.points[playerIndex],
          tilesRevealed: room.revealedTiles[playerIndex].length,
          guessedCorrectly: true,
        }).catch(error => console.error("Error updating winner stats:", error));
      } else {
        console.log(`Guest player won - no stats to update`);
      }

      // Update loser stats (check if id is a real userId, not a guest UUID)
      const loserUser = await getUserById(loserPlayer.id);
      if (loserUser) {
        console.log(`Updating loser stats for user: ${loserUser.username}`);
        await updateUserStats(loserPlayer.id, {
          won: false,
          points: room.points[opponentIndex],
          tilesRevealed: room.revealedTiles[opponentIndex].length,
          guessedCorrectly: false,
        }).catch(error => console.error("Error updating loser stats:", error));
      } else {
        console.log(`Guest player lost - no stats to update`);
      }

      // Broadcast game end
      io.to(roomId).emit("game-end", {
        winner: playerIndex,
        winnerGuess: guess,
        correctAnswer: correctAnswer,
      });

      callback(true, true);
    } else {
      // Wrong guess, switch turn
      room.currentTurn = (1 - room.currentTurn) as 0 | 1;
      
      // Update room in DynamoDB
      await updateGameRoom(room);

      // Broadcast wrong guess
      io.to(roomId).emit("wrong-guess", {
        playerIndex,
        guess,
        currentTurn: room.currentTurn,
      });

      callback(true, false);
    }
  });

  // Use power-up
  socket.on("use-power-up", async (data: { roomId: string; powerUpId: string; tileIndex?: number; lineType?: 'row' | 'col'; lineIndex?: number }, callback: (success: boolean, error?: string) => void) => {
    const { roomId, powerUpId, tileIndex, lineType, lineIndex } = data;
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

    const opponentIndex = 1 - playerIndex;

    // Check if player is frozen (can't use power-ups this turn)
    if (room.freezeActive && room.freezeActive[playerIndex]) {
      callback(false, "You're frozen! Can't use power-ups this turn.");
      return;
    }

    // Define power-up costs
    const powerUpCosts: Record<string, number> = {
      skip: 5,
      reveal2x2: 8,
      nuke: 15,
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
        // Skip opponent's turn - allow current player to take an extra turn
        room.skipTurnActive = true;
        io.to(roomId).emit("power-up-used", {
          powerUpId,
          usedBy: playerIndex,
          points: room.points,
          message: `${room.players[playerIndex].name} used Skip Turn!`,
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

        room.currentTurn = (1 - room.currentTurn) as 0 | 1;

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

        room.currentTurn = (1 - room.currentTurn) as 0 | 1;

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

        room.currentTurn = (1 - room.currentTurn) as 0 | 1;

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
        room.currentTurn = (1 - room.currentTurn) as 0 | 1;

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

      // Initialize rematch requests if not exists
      if (!room.rematchRequests) {
        room.rematchRequests = [false, false];
      }

      // Mark this player as wanting a rematch
      room.rematchRequests[playerIndex] = true;

      // If the requester chose a category, store it on the room for the rematch
      if (newCategory) {
        room.rematchCategory = newCategory;
        room.rematchCustomQuery = newCategory === 'custom' ? (newCustomQuery || '') : undefined;
      }
      
      // Notify the room (include chosen category so the other player sees it)
      io.to(roomId).emit("rematch-requested", {
        playerIndex,
        category: room.rematchCategory || room.category,
        customQuery: room.rematchCustomQuery || room.customQuery,
      });

      // Check if both players want a rematch
      if (room.rematchRequests[0] && room.rematchRequests[1]) {
        // Both players agreed – use the rematch category if set, else keep the current one
        const category = room.rematchCategory || room.category;
        const customQuery = room.rematchCustomQuery ?? room.customQuery;

        // Persist the new category on the room itself
        room.category = category;
        room.customQuery = customQuery;

        // Reset game state
        room.gameState = 'waiting';
        room.revealedTiles = [[], []];
        room.revealedHints = [[], []];
        room.points = [0, 0];
        room.currentTurn = Math.random() < 0.5 ? 0 : 1;
        room.winner = undefined;
        room.skipTurnActive = false;
        room.freezeActive = [false, false];
        room.rematchRequests = [false, false];
        room.rematchCategory = undefined;
        room.rematchCustomQuery = undefined;

        // Save the reset state to DB BEFORE fetching new images
        // (updateGameImages fetches a fresh room from DB, so the reset
        // must be persisted first or the old revealedTiles will survive)
        await updateGameRoom(room);

        // Fetch new images
        let image1, image2;
        let updateResult;
        let retryCount = 0;
        const maxRetries = 3;
        
        // Retry loop for fetching images
        while (retryCount < maxRetries) {
          try {
            // Use custom query if category is 'custom'
            if (category === 'custom' && customQuery) {
              const { fetchTwoImagesForCustomGame } = await import("../lib/googleImagesApi");
              [image1, image2] = await fetchTwoImagesForCustomGame(customQuery);
              console.log(`Rematch attempt ${retryCount + 1}: Fetching images with custom query: "${customQuery}"`);
            } else {
              [image1, image2] = await fetchTwoImagesForGame(category as CategoryKey);
              console.log(`Rematch attempt ${retryCount + 1}: Fetching images for category: "${category}"`);
            }
            
            if (image1 && image2) {
              // Try to store images and generate tiles
              updateResult = await updateGameImages(roomId, [image1, image2]);
              
              if (updateResult.success) {
                const queryInfo = customQuery ? `custom query "${customQuery}"` : `category "${category}"`;
                console.log(`✅ Rematch images successfully stored from ${queryInfo}: "${image1.title}" and "${image2.title}"`);
                break;
              } else {
                console.log(`⚠️  Rematch attempt ${retryCount + 1} failed: ${updateResult.error}. Retrying...`);
                retryCount++;
              }
            } else {
              console.log(`⚠️  Failed to fetch rematch images on attempt ${retryCount + 1}`);
              retryCount++;
            }
          } catch (error) {
            console.error(`Rematch image fetch attempt ${retryCount + 1} failed:`, error);
            retryCount++;
          }
        }
        
        // Check if we succeeded or need to use fallback
        if (updateResult && updateResult.success) {
          // Get updated room from DynamoDB
          const updatedRoom = await getGameRoom(roomId);
          if (updatedRoom) {
            // Notify both players
            io.to(roomId).emit("rematch-start", { roomId });
            io.to(roomId).emit("game-start", {
              roomId,
              players: updatedRoom.players,
              currentTurn: updatedRoom.currentTurn,
              imageHashes: updatedRoom.imageHashes,
              category: updatedRoom.category,
            });
            console.log(`✅ Rematch started for room ${roomId} with category: ${category}`);
          }
        } else {
          // All retries failed - notify players
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

      // Reset rematch requests
      room.rematchRequests = [false, false];
      await updateGameRoom(room);

      // Notify the other player
      io.to(roomId).emit("rematch-declined");
    } catch (error) {
      console.error("Error handling decline rematch:", error);
    }
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
  socket.on("rejoin-room", async (data: { roomId: string; playerId: string }, callback: (success: boolean, playerIndex?: 0 | 1, error?: string) => void) => {
    try {
      const room = await getGameRoom(data.roomId);
      if (!room) { callback(false, undefined, "Room no longer exists"); return; }
      if (room.gameState === 'finished') { callback(false, undefined, "Game already finished"); return; }

      const playerIndex = room.players.findIndex((p: Player) => p.id === data.playerId);
      if (playerIndex === -1) { callback(false, undefined, "Player not found in room"); return; }

      // Update the player's socket ID to the new connection
      room.players[playerIndex].socketId = socket.id;
      await updateGameRoom(room);
      await updatePlayerSocketId(data.roomId, playerIndex as 0 | 1, socket.id);

      socket.join(data.roomId);

      // Notify the other player that opponent reconnected
      socket.to(data.roomId).emit("player-reconnected", {
        playerIndex,
        message: `${room.players[playerIndex].name} reconnected!`,
      });

      console.log(`🔄 Player "${room.players[playerIndex].name}" rejoined room ${data.roomId} as player ${playerIndex}`);
      callback(true, playerIndex as 0 | 1);
    } catch (error) {
      console.error("Error rejoining room:", error);
      callback(false, undefined, "Failed to rejoin");
    }
  });

  // ─── Disconnection ───────────────────────────────────────────────────

  socket.on("disconnect", async () => {
    console.log(`User disconnected: ${socket.id}`);

    const activeRooms = await getActiveGameRooms();
    
    for (const room of activeRooms) {
      const playerIndex = room.players.findIndex((p: Player) => p.socketId === socket.id);
      
      if (playerIndex !== -1) {
        io.to(room.roomId).emit("player-disconnected", {
          playerIndex,
          message: "Opponent disconnected — waiting for them to rejoin",
        });
      }
    }
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`[GridGuesser] Socket.io server running on port ${PORT}`);
});

