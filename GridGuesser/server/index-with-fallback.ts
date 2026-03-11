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

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors({
  origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Check if AWS is configured
const useRealDB = isDynamoDBConfigured();

if (!useRealDB) {
  console.log("\n⚠️  ============================================");
  console.log("⚠️  AWS NOT CONFIGURED - USING IN-MEMORY MODE");
  console.log("⚠️  Data will NOT persist between restarts!");
  console.log("⚠️  This is for TESTING ONLY");
  console.log("⚠️");
  console.log("⚠️  To use real AWS DynamoDB:");
  console.log("⚠️  1. Add AWS credentials to .env.local");
  console.log("⚠️  2. Run: npm run setup-db");
  console.log("⚠️  3. Restart server");
  console.log("⚠️  See SETUP_NOW.md for instructions");
  console.log("⚠️  ============================================\n");
  
  // Use mock auth for testing
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
    authMode: useRealDB ? "dynamodb" : "in-memory",
    awsConfigured: useRealDB,
    googleApiConfigured: isGoogleApiConfigured()
  });
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
    origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const images: ImageMetadata[] = imagesData as ImageMetadata[];

// In-memory storage (fallback when DynamoDB not configured)
const gameRooms = new Map<string, GameRoom>();

function getTwoRandomImages(): [ImageMetadata, ImageMetadata] {
  if (images.length >= 2) {
    return [images[0], images[1]];
  }
  return [images[0], images[0]];
}

function generateRoomId(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Clean up old rooms
setInterval(() => {
  if (useRealDB) {
    import("../lib/gameRoomService").then(({ cleanupOldGameRooms }) => {
      cleanupOldGameRooms(60 * 60 * 1000).then(count => {
        if (count > 0) console.log(`🗑️  Cleaned up ${count} old rooms from DynamoDB`);
      });
    });
  } else {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    gameRooms.forEach((room, roomId) => {
      if (now - room.createdAt > oneHour) {
        gameRooms.delete(roomId);
        console.log(`🗑️  Cleaned up old room: ${roomId}`);
      }
    });
  }
}, 5 * 60 * 1000);

// Socket.IO authentication
io.use((socket, next) => {
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
    }
  }
  
  next();
});

io.on("connection", (socket: Socket) => {
  const userId = (socket as any).userId;
  const username = (socket as any).username;
  
  console.log(`User connected: ${socket.id}${userId ? ` (User: ${username})` : " (Guest)"}`);

  // Create room
  socket.on("create-room", async (data: { playerName: string; category?: string }, callback: (roomId: string) => void) => {
    const roomId = generateRoomId();
    const category = data.category || 'landmarks';
    const playerName = data.playerName || username || 'Player 1';
    
    if (useRealDB) {
      // Use DynamoDB
      const { createGameRoom, updatePlayerSocketId } = await import("../lib/gameRoomService");
      const result = await createGameRoom(roomId, userId, playerName, category);
      
      if (result.success) {
        await updatePlayerSocketId(roomId, 0, socket.id);
        socket.join(roomId);
        console.log(`✅ Room created in DynamoDB: ${roomId}`);
        callback(roomId);
      } else {
        callback("");
      }
    } else {
      // Use in-memory
      const room: GameRoom = {
        roomId,
        players: [{
          id: socket.id,
          socketId: socket.id,
          playerIndex: 0,
          name: playerName,
        }],
        currentTurn: 0,
        gameState: "waiting",
        revealedTiles: [[], []],
        images: ["", ""],
        imageHashes: ["", ""],
        imageNames: ["", ""],
        points: [0, 0],
        createdAt: Date.now(),
        category,
        imageMetadata: [null, null],
        gameMode: "normal",
        maxPlayers: 2,
      };
      
      gameRooms.set(roomId, room);
      socket.join(roomId);
      console.log(`✅ Room created (in-memory): ${roomId}`);
      callback(roomId);
    }
  });

  // ... rest of the socket handlers with similar pattern ...
  
  socket.on("get-game-state", async (roomId: string, callback: (room: GameRoom | null) => void) => {
    if (useRealDB) {
      const { getGameRoom } = await import("../lib/gameRoomService");
      const room = await getGameRoom(roomId);
      callback(room);
    } else {
      callback(gameRooms.get(roomId) || null);
    }
  });

  // Additional handlers would follow the same pattern...
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`[GridGuesser] Socket.io server running on port ${PORT}`);
  if (!useRealDB) {
    console.log("⚠️  Using in-memory storage - data will NOT persist!");
  }
});

