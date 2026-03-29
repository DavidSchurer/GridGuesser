/**
 * Unit Tests for lib/gameRoomService.ts
 *
 * WHAT THIS FILE TESTS:
 * gameRoomService.ts is the core "backend brain" of GridGuesser. It manages
 * game rooms — creating them, adding players, updating state, cleaning up, etc.
 * Every function in this file talks to external infrastructure:
 *   - DynamoDB (Amazon's cloud database) for persistent storage
 *   - Redis (in-memory cache) for fast lookups
 *
 * WHY WE MOCK EVERYTHING:
 * We can't (and shouldn't) hit real AWS or Redis servers during tests because:
 *   1. Tests would be SLOW (network round trips)
 *   2. Tests would be FLAKY (what if the internet is down?)
 *   3. Tests would be EXPENSIVE (AWS charges per request)
 *   4. Tests would have SIDE EFFECTS (creating real database rows)
 *
 * Instead, we replace every external dependency with a "mock" — a fake version
 * that we control. We tell the mock exactly what to return, and then we verify
 * that our code called it correctly.
 *
 * MOCKING STRATEGY:
 * We mock 3 key modules: dynamodb (database), redisClient (cache), and crypto
 * (for predictable UUIDs). After mocking, we import the mocked modules and
 * use vi.mocked() to access mock-specific methods like mockResolvedValue.
 *
 * KEY VITEST MOCK CONCEPTS:
 *   - vi.mock("module", () => ({...}))
 *       Replaces the entire module with a fake. The factory function returns
 *       the fake exports. This runs BEFORE any imports.
 *
 *   - vi.fn()
 *       Creates a "spy" function that records every call made to it.
 *       You can check: was it called? How many times? With what arguments?
 *
 *   - vi.fn().mockResolvedValue(value)
 *       Makes the spy return a resolved Promise with `value` when called.
 *       Perfect for faking async functions like database calls.
 *
 *   - vi.fn().mockRejectedValueOnce(error)
 *       Makes the spy return a rejected Promise for ONE call (simulates error).
 *
 *   - vi.mocked(fn)
 *       Wraps a function with TypeScript mock types so you get autocomplete
 *       for .mockResolvedValue, .mock.calls, etc.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// STEP 1: Declare all mocks BEFORE importing the module under test.
// vi.mock() calls are "hoisted" by Vitest — they run before any import
// statements, regardless of where you write them in the file.
// ---------------------------------------------------------------------------

// Mock DynamoDB: fake the database client so no real AWS calls happen.
// Arrow functions CANNOT be used with `new` in JavaScript. The source code
// does `new PutCommand(...)`, so the mock must be a regular function.
// A bare vi.fn() works because Vitest spies support `new` natively.
vi.mock('../dynamodb', () => ({
  docClient: { send: vi.fn().mockResolvedValue({}) },
  TABLES: { USERS: 'GridGuesser-Users', GAME_ROOMS: 'GridGuesser-GameRooms' },
  PutCommand: vi.fn(),
  GetCommand: vi.fn(),
  UpdateCommand: vi.fn(),
  QueryCommand: vi.fn(),
  ScanCommand: vi.fn(),
}));

// Mock Redis: fake the cache functions so no real Redis server is needed.
vi.mock('../redisClient', () => ({
  getCachedGameRoom: vi.fn().mockResolvedValue(null),
  cacheGameRoom: vi.fn().mockResolvedValue(undefined),
  deleteCachedGameRoom: vi.fn().mockResolvedValue(undefined),
  initRedis: vi.fn().mockResolvedValue(undefined),
}));

// Mock crypto: make randomUUID() return a predictable value so we can
// assert on player IDs without dealing with actual random strings.
vi.mock('crypto', () => ({
  randomUUID: vi.fn().mockReturnValue('mock-uuid-1234'),
}));

// Mock dotenv: harmless but prevents file-system reads during tests.
vi.mock('dotenv', () => ({
  default: { config: vi.fn() },
  config: vi.fn(),
}));

// Mock tileGenerator: used by updateGameImages to split images into tiles.
vi.mock('../tileGenerator', () => ({
  generateTiles: vi.fn().mockResolvedValue({ success: true, imageHash: 'hash-abc' }),
}));

// Mock userService: used by getUserCategory to look up a user's preference.
vi.mock('../userService', () => ({
  getUserById: vi.fn().mockResolvedValue({ lastSelectedCategory: 'landmarks' }),
}));

// Mock @aws-sdk/lib-dynamodb: for the dynamic import() inside deleteGameRoom.
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DeleteCommand: vi.fn(),
}));

// ---------------------------------------------------------------------------
// STEP 2: Import the mocked modules so we can control their behavior.
// These imports get the MOCKED versions (because vi.mock ran first).
// ---------------------------------------------------------------------------
import { docClient } from '../dynamodb';
import { getCachedGameRoom, cacheGameRoom, deleteCachedGameRoom } from '../redisClient';

// ---------------------------------------------------------------------------
// STEP 3: Import the functions we want to test.
// ---------------------------------------------------------------------------
import {
  createGameRoom,
  getGameRoom,
  updateGameRoom,
  updatePlayerSocketId,
  addPlayerToRoom,
  updateGameImages,
  deleteGameRoom,
  getActiveGameRooms,
  cleanupOldGameRooms,
  storeUserCategory,
  getUserCategory,
} from '../gameRoomService';

import type { GameRoom } from '../types';

// ---------------------------------------------------------------------------
// Helper: builds a minimal valid GameRoom object for use in tests.
// This avoids repeating the same long object literal in every test.
// ---------------------------------------------------------------------------
function makeFakeRoom(overrides: Partial<GameRoom> = {}): GameRoom {
  return {
    roomId: 'room-abc',
    players: [{
      id: 'player-1',
      socketId: 'socket-1',
      playerIndex: 0,
      name: 'Alice',
    }],
    currentTurn: 0,
    gameState: 'waiting',
    revealedTiles: [[], []],
    images: ['', ''],
    imageHashes: ['', ''],
    imageNames: ['', ''],
    points: [0, 0],
    createdAt: Date.now(),
    category: 'landmarks',
    imageMetadata: [null, null],
    revealedHints: [[], []],
    skipTurnActive: false,
    gameMode: 'normal',
    maxPlayers: 2,
    ...overrides,
  };
}

// Typed references to the mock functions — saves typing vi.mocked() everywhere.
//
// mockSend needs to return different shapes per DynamoDB op: { Item }, { Items }, or {}.
// vi.mocked() gives us Mock types; we use a loose cast so we can call mockResolvedValueOnce etc.
const mockSend = vi.mocked(docClient.send) as ReturnType<typeof vi.fn> & {
  mockResolvedValue: (value: unknown) => void;
  mockResolvedValueOnce: (value: unknown) => void;
  mockRejectedValueOnce: (reason: unknown) => void;
};
const mockGetCache = vi.mocked(getCachedGameRoom);
const mockSetCache = vi.mocked(cacheGameRoom);
const mockDeleteCache = vi.mocked(deleteCachedGameRoom);

// ---------------------------------------------------------------------------
// STEP 4: Reset mocks before every test.
//
// IMPORTANT LESSON: vi.clearAllMocks() only clears CALL HISTORY
// (mock.calls, mock.results), NOT implementations. But some tests override
// return values with mockResolvedValueOnce — those "once" overrides are
// consumed and don't need resetting. The default implementations from
// vi.mock() persist across tests automatically.
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  // Re-establish defaults in case a test used mockResolvedValue (permanent override)
  mockSend.mockResolvedValue({} as any);
  mockGetCache.mockResolvedValue(null);
  mockSetCache.mockResolvedValue(undefined);
  mockDeleteCache.mockResolvedValue(undefined);
});

// ============================================================================
//  createGameRoom — creates a new room in DynamoDB
// ============================================================================
describe('createGameRoom', () => {
  it('should return success: true and the created room object', async () => {
    // Arrange — mockSend already resolves to {} (simulating successful DynamoDB write)

    // Act
    const result = await createGameRoom('room-1', 'user-1', 'Alice', 'landmarks');

    // Assert
    expect(result.success).toBe(true);
    expect(result.room).toBeDefined();
    expect(result.room?.roomId).toBe('room-1');
  });

  it('should initialize the room with correct default state', async () => {
    const result = await createGameRoom('room-1', 'user-1', 'Alice', 'landmarks');
    const room = result.room!;

    // A new room should be in "waiting" state — nobody is playing yet
    expect(room.gameState).toBe('waiting');
    expect(room.currentTurn).toBe(0);
    expect(room.revealedTiles).toEqual([[], []]);
    expect(room.points).toEqual([0, 0]);
    expect(room.images).toEqual(['', '']);
  });

  it('should set the creator as player 0 with the provided name', async () => {
    const result = await createGameRoom('room-1', 'user-1', 'Alice', 'landmarks');
    const player = result.room!.players[0];

    expect(player.name).toBe('Alice');
    expect(player.playerIndex).toBe(0);
    expect(player.id).toBe('user-1');
  });

  it('should use randomUUID when no creatorUserId is provided', async () => {
    // When creatorUserId is undefined, the code uses randomUUID() as a fallback
    const result = await createGameRoom('room-1', undefined, 'Guest', 'landmarks');

    expect(result.success).toBe(true);
    // Our crypto mock makes randomUUID always return 'mock-uuid-1234'
    expect(result.room!.players[0].id).toBe('mock-uuid-1234');
  });

  it('should store the customQuery when provided', async () => {
    const result = await createGameRoom('room-1', 'user-1', 'Alice', 'custom', 'famous bridges');

    expect(result.success).toBe(true);
    expect(result.room!.category).toBe('custom');
    expect(result.room!.customQuery).toBe('famous bridges');
  });

  it('should send a PutCommand to DynamoDB', async () => {
    await createGameRoom('room-1', 'user-1', 'Alice', 'landmarks');

    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should pre-populate the Redis cache after creating the room', async () => {
    const result = await createGameRoom('room-1', 'user-1', 'Alice', 'landmarks');

    expect(mockSetCache).toHaveBeenCalledWith('room-1', result.room);
  });

  it('should return success: false when DynamoDB throws an error', async () => {
    // Arrange — simulate a database failure
    mockSend.mockRejectedValueOnce(new Error('DynamoDB is down'));

    // Act
    const result = await createGameRoom('room-1', 'user-1', 'Alice', 'landmarks');

    // Assert — the function catches the error and returns a clean failure
    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to create game room');
  });
});

// ============================================================================
//  getGameRoom — fetches a room, checking Redis cache first, then DynamoDB
// ============================================================================
describe('getGameRoom', () => {
  it('should return the room from Redis cache when available', async () => {
    // Arrange — Redis has the room cached
    const cachedRoom = makeFakeRoom();
    mockGetCache.mockResolvedValueOnce(cachedRoom);

    // Act
    const result = await getGameRoom('room-abc');

    // Assert — got the cached room, DynamoDB was NOT called (that's the whole point of caching)
    expect(result).toEqual(cachedRoom);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should fall back to DynamoDB when Redis returns null (cache miss)', async () => {
    // Arrange — Redis miss, DynamoDB has the room
    const dbRoom = makeFakeRoom();
    mockSend.mockResolvedValueOnce({ Item: dbRoom });

    // Act
    const result = await getGameRoom('room-abc');

    // Assert
    expect(result).toEqual(dbRoom);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should cache the DynamoDB result in Redis after a cache miss', async () => {
    // Arrange
    const dbRoom = makeFakeRoom();
    mockSend.mockResolvedValueOnce({ Item: dbRoom });

    // Act
    await getGameRoom('room-abc');

    // Assert — after fetching from DynamoDB, the room should be cached for next time
    expect(mockSetCache).toHaveBeenCalledWith('room-abc', dbRoom);
  });

  it('should return null when room is not in Redis or DynamoDB', async () => {
    // Arrange — both are empty
    mockSend.mockResolvedValueOnce({ Item: undefined });

    // Act
    const result = await getGameRoom('nonexistent');

    // Assert
    expect(result).toBeNull();
    // Should NOT cache a null result — that would be a "negative cache" bug
    expect(mockSetCache).not.toHaveBeenCalled();
  });

  it('should return null when DynamoDB throws an error', async () => {
    // Arrange — simulate DynamoDB failure
    mockSend.mockRejectedValueOnce(new Error('Connection timeout'));

    // Act
    const result = await getGameRoom('room-abc');

    // Assert — the error is caught internally, not thrown to the caller
    expect(result).toBeNull();
  });
});

// ============================================================================
//  updateGameRoom — writes updated room to DynamoDB and refreshes Redis
// ============================================================================
describe('updateGameRoom', () => {
  it('should send a PutCommand to DynamoDB with the room data', async () => {
    const room = makeFakeRoom();

    const result = await updateGameRoom(room);

    expect(result.success).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should update the Redis cache after writing to DynamoDB', async () => {
    const room = makeFakeRoom({ roomId: 'room-xyz' });

    await updateGameRoom(room);

    expect(mockSetCache).toHaveBeenCalledWith('room-xyz', room);
  });

  it('should return success: false when DynamoDB throws', async () => {
    mockSend.mockRejectedValueOnce(new Error('Write failed'));

    const result = await updateGameRoom(makeFakeRoom());

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to update game room');
  });
});

// ============================================================================
//  updatePlayerSocketId — updates a player's WebSocket connection ID
// ============================================================================
describe('updatePlayerSocketId', () => {
  it('should update the socket ID for the specified player', async () => {
    // Arrange — getGameRoom needs to find the room.
    // It checks Redis first (returns null by default), then DynamoDB.
    const room = makeFakeRoom();
    mockSend.mockResolvedValueOnce({ Item: room }); // for getGameRoom's DynamoDB call
    mockSend.mockResolvedValueOnce({}); // for updateGameRoom's DynamoDB call

    // Act
    const result = await updatePlayerSocketId('room-abc', 0, 'new-socket-id');

    // Assert
    expect(result.success).toBe(true);
  });

  it('should return error when the room does not exist', async () => {
    // Arrange — room not found anywhere
    mockSend.mockResolvedValueOnce({ Item: undefined });

    // Act
    const result = await updatePlayerSocketId('nonexistent', 0, 'socket-1');

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe('Room not found');
  });
});

// ============================================================================
//  addPlayerToRoom — lets a second player join an existing room
// ============================================================================
describe('addPlayerToRoom', () => {
  it('should add a second player and return the updated room', async () => {
    // Arrange — room with 1 player exists in DynamoDB
    const room = makeFakeRoom();
    mockSend.mockResolvedValueOnce({ Item: room }); // getGameRoom
    mockSend.mockResolvedValueOnce({}); // updateGameRoom

    // Act
    const result = await addPlayerToRoom('room-abc', 'user-2', 'Bob', 'socket-2');

    // Assert
    expect(result.success).toBe(true);
    expect(result.room).toBeDefined();
    expect(result.room!.players).toHaveLength(2);
    expect(result.room!.players[1].name).toBe('Bob');
  });

  it('should assign playerIndex 1 to the joining player', async () => {
    const room = makeFakeRoom();
    mockSend.mockResolvedValueOnce({ Item: room });
    mockSend.mockResolvedValueOnce({});

    const result = await addPlayerToRoom('room-abc', 'user-2', 'Bob', 'socket-2');

    // The second player should always be index 1
    expect(result.room!.players[1].playerIndex).toBe(1);
  });

  it('should use randomUUID when no userId is provided', async () => {
    const room = makeFakeRoom();
    mockSend.mockResolvedValueOnce({ Item: room });
    mockSend.mockResolvedValueOnce({});

    const result = await addPlayerToRoom('room-abc', undefined, 'Guest', 'socket-2');

    expect(result.room!.players[1].id).toBe('mock-uuid-1234');
  });

  it('should return "Room not found" when the room does not exist', async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });

    const result = await addPlayerToRoom('nonexistent', 'user-2', 'Bob', 'socket-2');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Room not found');
  });

  it('should return "Room is full" when room already has 2 players', async () => {
    // Arrange — room with 2 players
    const fullRoom = makeFakeRoom({
      players: [
        { id: 'p1', socketId: 's1', playerIndex: 0, name: 'Alice' },
        { id: 'p2', socketId: 's2', playerIndex: 1, name: 'Bob' },
      ],
    });
    mockSend.mockResolvedValueOnce({ Item: fullRoom });

    const result = await addPlayerToRoom('room-abc', 'user-3', 'Charlie', 'socket-3');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Room is full');
  });

  it('should return "Game already in progress" when gameState is not "waiting"', async () => {
    const playingRoom = makeFakeRoom({ gameState: 'playing' });
    mockSend.mockResolvedValueOnce({ Item: playingRoom });

    const result = await addPlayerToRoom('room-abc', 'user-2', 'Bob', 'socket-2');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Game already in progress');
  });
});

// ============================================================================
//  updateGameImages — generates tiles for both images and starts the game
// ============================================================================
describe('updateGameImages', () => {
  const sampleMeta: [any, any] = [
    { url: 'https://img1.jpg', thumbnailUrl: '', title: 'Eiffel Tower', searchTerm: '', category: 'landmarks' },
    { url: 'https://img2.jpg', thumbnailUrl: '', title: 'Big Ben', searchTerm: '', category: 'landmarks' },
  ];

  it('should update the room and return success when tiles generate correctly', async () => {
    // Arrange — room exists
    const room = makeFakeRoom();
    mockSend.mockResolvedValueOnce({ Item: room }); // getGameRoom
    mockSend.mockResolvedValueOnce({}); // updateGameRoom

    // Act
    const result = await updateGameImages('room-abc', sampleMeta);

    // Assert
    expect(result.success).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(2); // get + update
  });

  it('should return error when the room does not exist', async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });

    const result = await updateGameImages('nonexistent', sampleMeta);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Room not found');
  });

  it('should return error when one tile generation fails', async () => {
    const room = makeFakeRoom();
    mockSend.mockResolvedValueOnce({ Item: room });

    // Override tileGenerator mock to make second image fail
    const { generateTiles } = await import('../tileGenerator');
    vi.mocked(generateTiles)
      .mockResolvedValueOnce({ success: true, imageHash: 'hash-1' })
      .mockResolvedValueOnce({ success: false, imageHash: '', error: 'Download failed' });

    const result = await updateGameImages('room-abc', sampleMeta);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to generate image tiles');
  });
});

// ============================================================================
//  deleteGameRoom — removes a room from DynamoDB and Redis
// ============================================================================
describe('deleteGameRoom', () => {
  it('should return success: true when deletion works', async () => {
    const result = await deleteGameRoom('room-abc');

    expect(result.success).toBe(true);
  });

  it('should call docClient.send to delete from DynamoDB', async () => {
    await deleteGameRoom('room-abc');

    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should also clear the Redis cache for that room', async () => {
    await deleteGameRoom('room-abc');

    expect(mockDeleteCache).toHaveBeenCalledWith('room-abc');
  });

  it('should return success: false when DynamoDB throws', async () => {
    mockSend.mockRejectedValueOnce(new Error('Delete failed'));

    const result = await deleteGameRoom('room-abc');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to delete room');
  });
});

// ============================================================================
//  getActiveGameRooms — scans DynamoDB for all rooms (used for cleanup)
// ============================================================================
describe('getActiveGameRooms', () => {
  it('should return all rooms from a DynamoDB scan', async () => {
    const rooms = [makeFakeRoom({ roomId: 'r1' }), makeFakeRoom({ roomId: 'r2' })];
    mockSend.mockResolvedValueOnce({ Items: rooms });

    const result = await getActiveGameRooms();

    expect(result).toHaveLength(2);
    expect(result[0].roomId).toBe('r1');
    expect(result[1].roomId).toBe('r2');
  });

  it('should return an empty array when DynamoDB returns no items', async () => {
    mockSend.mockResolvedValueOnce({ Items: undefined });

    const result = await getActiveGameRooms();

    expect(result).toEqual([]);
  });

  it('should return an empty array when DynamoDB throws an error', async () => {
    mockSend.mockRejectedValueOnce(new Error('Scan failed'));

    const result = await getActiveGameRooms();

    expect(result).toEqual([]);
  });
});

// ============================================================================
//  cleanupOldGameRooms — deletes rooms older than maxAge
// ============================================================================
describe('cleanupOldGameRooms', () => {
  it('should delete rooms older than maxAge and return the count', async () => {
    // Arrange — one old room (2 hours ago) and one recent room (1 second ago)
    const oldRoom = makeFakeRoom({ roomId: 'old-room', createdAt: Date.now() - 7200000 });
    const newRoom = makeFakeRoom({ roomId: 'new-room', createdAt: Date.now() - 1000 });

    mockSend.mockResolvedValueOnce({ Items: [oldRoom, newRoom] }); // getActiveGameRooms scan
    mockSend.mockResolvedValueOnce({}); // deleteGameRoom for oldRoom

    // Act — default maxAge is 3,600,000ms (1 hour)
    const deletedCount = await cleanupOldGameRooms();

    // Assert — only the 2-hour-old room should be deleted
    expect(deletedCount).toBe(1);
  });

  it('should skip rooms newer than maxAge', async () => {
    const recentRoom = makeFakeRoom({ roomId: 'recent', createdAt: Date.now() - 10000 });
    mockSend.mockResolvedValueOnce({ Items: [recentRoom] });

    const deletedCount = await cleanupOldGameRooms();

    expect(deletedCount).toBe(0);
  });

  it('should return 0 when an exception is thrown', async () => {
    mockSend.mockRejectedValueOnce(new Error('Scan failed'));

    const deletedCount = await cleanupOldGameRooms();

    expect(deletedCount).toBe(0);
  });

  it('should accept a custom maxAge parameter', async () => {
    // Room is 30 minutes old, maxAge is 15 minutes → should be deleted
    const room = makeFakeRoom({ roomId: 'medium-age', createdAt: Date.now() - 1800000 });
    mockSend.mockResolvedValueOnce({ Items: [room] });
    mockSend.mockResolvedValueOnce({}); // deleteGameRoom

    const deletedCount = await cleanupOldGameRooms(900000);

    expect(deletedCount).toBe(1);
  });
});

// ============================================================================
//  storeUserCategory — saves a user's preferred category to DynamoDB
// ============================================================================
describe('storeUserCategory', () => {
  it('should send an UpdateCommand to DynamoDB and return success', async () => {
    const result = await storeUserCategory('user-1', 'animals');

    expect(result.success).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should return success: false when DynamoDB throws', async () => {
    mockSend.mockRejectedValueOnce(new Error('Update failed'));

    const result = await storeUserCategory('user-1', 'animals');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to store category');
  });
});

// ============================================================================
//  getUserCategory — retrieves a user's preferred category
// ============================================================================
describe('getUserCategory', () => {
  it('should return the category from the user record', async () => {
    // The userService mock returns { lastSelectedCategory: 'landmarks' }
    const result = await getUserCategory('user-1');

    expect(result).toBe('landmarks');
  });

  it('should return null when the user has no saved category', async () => {
    const { getUserById } = await import('../userService');
    vi.mocked(getUserById).mockResolvedValueOnce({} as any);

    const result = await getUserCategory('user-1');

    expect(result).toBeNull();
  });

  it('should return null when an exception is thrown', async () => {
    const { getUserById } = await import('../userService');
    vi.mocked(getUserById).mockRejectedValueOnce(new Error('DB error'));

    const result = await getUserCategory('user-1');

    expect(result).toBeNull();
  });
});
