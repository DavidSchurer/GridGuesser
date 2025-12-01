import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";
import { GameRoom, Player, ImageMetadata, AuthenticatedPlayer } from "../lib/types";
import imagesData from "../lib/images.json";
import { verifyToken, extractTokenFromHeader } from "../lib/jwt";
import { isDynamoDBConfigured } from "../lib/dynamodb";

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors({
  origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Check if AWS is configured and use appropriate auth routes
const useMockAuth = !isDynamoDBConfigured();

if (useMockAuth) {
  console.log("\n⚠️  ============================================");
  console.log("⚠️  AWS NOT CONFIGURED - USING MOCK AUTH");
  console.log("⚠️  Data will NOT persist between restarts!");
  console.log("⚠️  Set up .env.local for production use");
  console.log("⚠️  See AWS_SETUP_GUIDE.md for instructions");
  console.log("⚠️  ============================================\n");
  
  import("./mockAuth").then(module => {
    app.use("/api/auth", module.default);
  });
} else {
  console.log("✅ AWS DynamoDB configured - using persistent storage");
  import("./authRoutes").then(module => {
    app.use("/api/auth", module.default);
  });
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "GridGuesser API is running",
    authMode: useMockAuth ? "mock" : "dynamodb",
    awsConfigured: !useMockAuth
  });
});

const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// In-memory storage for game rooms
const gameRooms = new Map<string, GameRoom>();
const images: ImageMetadata[] = imagesData as ImageMetadata[];

// Helper function to get the two images (one for each player)
function getTwoRandomImages(): [ImageMetadata, ImageMetadata] {
  // Always return the same two images in order
  // Player 1 gets image-1, Player 2 gets image-2
  if (images.length >= 2) {
    return [images[0], images[1]];
  }
  // Fallback if not enough images
  return [images[0], images[0]];
}

// Helper function to generate room ID
function generateRoomId(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Clean up old rooms (older than 1 hour)
setInterval(() => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  Array.from(gameRooms.entries()).forEach(([roomId, room]) => {
    if (now - room.createdAt > oneHour) {
      gameRooms.delete(roomId);
      console.log(`Cleaned up old room: ${roomId}`);
    }
  });
}, 5 * 60 * 1000); // Run every 5 minutes

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      (socket as any).userId = payload.userId;
      (socket as any).username = payload.username;
    }
  }
  
  next();
});

io.on("connection", (socket: Socket) => {
  const userId = (socket as any).userId;
  const username = (socket as any).username;
  
  console.log(`User connected: ${socket.id}${userId ? ` (User: ${username})` : " (Guest)"}`);

  // Create a new game room
  socket.on("create-room", (data: { playerName: string }, callback: (roomId: string) => void) => {
    const roomId = generateRoomId();
    
    const player: AuthenticatedPlayer = {
      id: socket.id,
      socketId: socket.id,
      playerIndex: 0,
      name: data.playerName || username || 'Player 1',
      userId: userId,
      isGuest: !userId,
    };

    const room: GameRoom = {
      roomId,
      players: [player],
      currentTurn: 0,
      gameState: "waiting",
      revealedTiles: [[], []],
      images: ["", ""],
      imageNames: ["", ""],
      points: [0, 0],
      createdAt: Date.now(),
    };

    gameRooms.set(roomId, room);
    socket.join(roomId);
    
    console.log(`Room created: ${roomId} by ${socket.id}`);
    callback(roomId);
  });

  // Create a room with a specific ID
  socket.on("create-room-with-id", (data: { roomId: string; playerName: string }, callback: (success: boolean, error?: string) => void) => {
    const { roomId, playerName } = data;
    
    // Check if room already exists
    const existingRoom = gameRooms.get(roomId);
    if (existingRoom) {
      callback(false, "Room already exists");
      return;
    }

    const player: AuthenticatedPlayer = {
      id: socket.id,
      socketId: socket.id,
      playerIndex: 0,
      name: playerName || username || 'Player 1',
      userId: userId,
      isGuest: !userId,
    };

    const room: GameRoom = {
      roomId,
      players: [player],
      currentTurn: 0,
      gameState: "waiting",
      revealedTiles: [[], []],
      images: ["", ""],
      imageNames: ["", ""],
      points: [0, 0],
      createdAt: Date.now(),
    };

    gameRooms.set(roomId, room);
    socket.join(roomId);
    
    console.log(`Room created with ID: ${roomId} by ${socket.id}`);
    callback(true);
  });

  // Join an existing room
  socket.on("join-room", (data: { roomId: string; playerName: string }, callback: (success: boolean, playerIndex?: 0 | 1, error?: string) => void) => {
    const { roomId, playerName } = data;
    const room = gameRooms.get(roomId);

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

    const player: AuthenticatedPlayer = {
      id: socket.id,
      socketId: socket.id,
      playerIndex: 1,
      name: playerName || username || 'Player 2',
      userId: userId,
      isGuest: !userId,
    };

    room.players.push(player);
    socket.join(roomId);

    // Assign images to both players
    const [image1, image2] = getTwoRandomImages();
    room.images = [image1.id, image2.id];
    room.imageNames = [image1.name, image2.name];
    room.gameState = "playing";

    gameRooms.set(roomId, room);

    console.log(`Player joined room ${roomId}: ${socket.id}`);
    
    // Notify both players that the game is starting
    io.to(roomId).emit("game-start", {
      roomId,
      players: room.players,
      currentTurn: room.currentTurn,
      images: room.images,
    });

    callback(true, 1);
  });

  // Get current game state
  socket.on("get-game-state", (roomId: string, callback: (room: GameRoom | null) => void) => {
    const room = gameRooms.get(roomId);
    callback(room || null);
  });

  // Reveal a tile
  socket.on("reveal-tile", (data: { roomId: string; tileIndex: number }, callback: (success: boolean, error?: string) => void) => {
    const { roomId, tileIndex } = data;
    const room = gameRooms.get(roomId);

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

    // Switch turn
    room.currentTurn = (1 - room.currentTurn) as 0 | 1;

    gameRooms.set(roomId, room);

    // Broadcast tile reveal to both players
    io.to(roomId).emit("tile-revealed", {
      tileIndex,
      playerIndex: opponentIndex,
      revealedBy: playerIndex,
      currentTurn: room.currentTurn,
      imageId: room.images[opponentIndex],
      points: room.points,
    });

    callback(true);
  });

  // Submit a guess
  socket.on("submit-guess", (data: { roomId: string; guess: string }, callback: (success: boolean, correct?: boolean, error?: string) => void) => {
    const { roomId, guess } = data;
    const room = gameRooms.get(roomId);

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

    // Check guess against opponent's image
    const opponentIndex = 1 - playerIndex;
    const correctAnswer = room.imageNames[opponentIndex];
    
    // Normalize and check guess
    const normalizedGuess = guess.toLowerCase().trim();
    const normalizedAnswer = correctAnswer.toLowerCase().trim();
    
    const isCorrect = normalizedGuess === normalizedAnswer || 
                     normalizedAnswer.includes(normalizedGuess) ||
                     normalizedGuess.includes(normalizedAnswer);

    if (isCorrect) {
      room.gameState = "finished";
      room.winner = playerIndex as 0 | 1;
      gameRooms.set(roomId, room);

      // Update user stats for both players (if authenticated and using DynamoDB)
      const winnerPlayer = room.players[playerIndex] as AuthenticatedPlayer;
      const loserPlayer = room.players[opponentIndex] as AuthenticatedPlayer;

      if (!useMockAuth) {
        // Only update stats if using DynamoDB
        import("../lib/userService").then(({ updateUserStats }) => {
          // Update winner stats
          if (winnerPlayer.userId) {
            updateUserStats(winnerPlayer.userId, {
              won: true,
              points: room.points[playerIndex],
              tilesRevealed: room.revealedTiles[playerIndex].length,
              guessedCorrectly: true,
            }).catch(error => console.error("Error updating winner stats:", error));
          }

          // Update loser stats
          if (loserPlayer.userId) {
            updateUserStats(loserPlayer.userId, {
              won: false,
              points: room.points[opponentIndex],
              tilesRevealed: room.revealedTiles[opponentIndex].length,
              guessedCorrectly: false,
            }).catch(error => console.error("Error updating loser stats:", error));
          }
        }).catch(error => console.error("Error loading userService:", error));
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
      gameRooms.set(roomId, room);

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
  socket.on("use-power-up", (data: { roomId: string; powerUpId: string; tileIndex?: number }, callback: (success: boolean, error?: string) => void) => {
    const { roomId, powerUpId, tileIndex } = data;
    const room = gameRooms.get(roomId);

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

    // Define power-up costs
    const powerUpCosts: Record<string, number> = {
      skip: 5,
      reveal2x2: 8,
      nuke: 15,
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
        // Skip opponent's turn (stay on current player's turn)
        // Don't change currentTurn
        io.to(roomId).emit("power-up-used", {
          powerUpId,
          usedBy: playerIndex,
          points: room.points,
          message: `${room.players[playerIndex].name} used Skip Turn!`,
        });
        break;

      case "reveal2x2":
        if (tileIndex === undefined) {
          callback(false, "Tile index required for reveal2x2");
          return;
        }

        // Reveal a 2x2 area starting from tileIndex (top-left)
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

        io.to(roomId).emit("power-up-used", {
          powerUpId,
          usedBy: playerIndex,
          targetPlayer: opponentIndex,
          revealedTiles: tilesToReveal,
          allRevealedTiles: room.revealedTiles,
          points: room.points,
          message: `${room.players[playerIndex].name} revealed a 2x2 area!`,
        });
        break;

      case "nuke":
        // Reveal all tiles of opponent's image
        const allTiles = Array.from({ length: 100 }, (_, i) => i);
        room.revealedTiles[opponentIndex] = allTiles;

        io.to(roomId).emit("power-up-used", {
          powerUpId,
          usedBy: playerIndex,
          targetPlayer: opponentIndex,
          revealedTiles: allTiles,
          allRevealedTiles: room.revealedTiles,
          points: room.points,
          message: `${room.players[playerIndex].name} nuked the image!`,
        });
        break;
    }

    gameRooms.set(roomId, room);
    callback(true);
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);

    // Find and clean up rooms where this player was
    Array.from(gameRooms.entries()).forEach(([roomId, room]) => {
      const playerIndex = room.players.findIndex((p: Player) => p.socketId === socket.id);
      
      if (playerIndex !== -1) {
        // Notify other player
        io.to(roomId).emit("player-disconnected", {
          playerIndex,
          message: "Opponent disconnected",
        });

        // Remove room after a delay to allow reconnection
        setTimeout(() => {
          gameRooms.delete(roomId);
          console.log(`Room ${roomId} deleted after player disconnect`);
        }, 30000); // 30 seconds grace period
      }
    });
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`[GridGuesser] Socket.io server running on port ${PORT}`);
});

