import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;
let connectionPromise: Promise<RedisClientType | null> | null = null;

/**
 * Redis Client for caching active game rooms.
 * Uses a shared promise so concurrent callers wait for the same connection
 * attempt instead of silently falling back to DynamoDB.
 */
export async function getRedisClient(): Promise<RedisClientType | null> {
  const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;

  if (!redisUrl) {
    return null;
  }

  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  // If a connection attempt is already in flight, wait for it instead of
  // returning null (which would bypass the cache entirely).
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      console.log('🔴 Connecting to Redis...');

      redisClient = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 3) {
              console.error('❌ Redis reconnection failed after 3 attempts');
              return new Error('Redis reconnection failed');
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      redisClient.on('error', (err) => {
        console.error('❌ Redis Client Error:', err);
      });

      redisClient.on('connect', () => {
        console.log('🔴 Redis connected!');
      });

      redisClient.on('reconnecting', () => {
        console.log('🔄 Redis reconnecting...');
      });

      await redisClient.connect();
      return redisClient;
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
      redisClient = null;
      return null;
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
}

/**
 * Eagerly connect to Redis at startup so the first request doesn't pay
 * the connection latency. Safe to call multiple times; no-ops if already connected.
 */
export async function initRedis(): Promise<void> {
  const client = await getRedisClient();
  if (client) {
    console.log('✅ Redis ready at startup');
  } else {
    console.log('⚠️  Redis not configured — using DynamoDB only');
  }
}

/**
 * Cache a game room in Redis with 1 hour TTL
 */
export async function cacheGameRoom(roomId: string, room: any): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;

  try {
    const key = `room:${roomId}`;
    await client.setEx(key, 3600, JSON.stringify(room));
  } catch (error) {
    console.error('❌ Redis cache write error:', error);
  }
}

/**
 * Get a game room from Redis cache
 */
export async function getCachedGameRoom(roomId: string): Promise<any | null> {
  const client = await getRedisClient();
  if (!client) return null;

  try {
    const key = `room:${roomId}`;
    const data = await client.get(key);
    
    if (data) {
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('❌ Redis cache read error:', error);
    return null;
  }
}

/**
 * Delete a game room from Redis cache
 */
export async function deleteCachedGameRoom(roomId: string): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;

  try {
    const key = `room:${roomId}`;
    await client.del(key);
  } catch (error) {
    console.error('❌ Redis cache delete error:', error);
  }
}

/**
 * Get all active room IDs from Redis using SCAN (non-blocking, unlike KEYS).
 */
export async function getActiveRoomIds(): Promise<string[]> {
  const client = await getRedisClient();
  if (!client) return [];

  try {
    const ids: string[] = [];
    for await (const chunk of client.scanIterator({ MATCH: 'room:*', COUNT: 100 })) {
      // node-redis scanIterator yields string | string[] depending on version
      const keys = Array.isArray(chunk) ? chunk : [chunk];
      for (const key of keys) {
        ids.push(key.replace('room:', ''));
      }
    }
    return ids;
  } catch (error) {
    console.error('❌ Redis scan error:', error);
    return [];
  }
}

/**
 * Invalidate (delete) cache for a room
 */
export async function invalidateRoomCache(roomId: string): Promise<void> {
  await deleteCachedGameRoom(roomId);
}

/**
 * Close Redis connection gracefully
 */
export async function closeRedis(): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    console.log('🔴 Redis connection closed');
  }
}
