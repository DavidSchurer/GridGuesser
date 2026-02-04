import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;
let isConnecting = false;

/**
 * Redis Client for caching active game rooms
 * - Faster than DynamoDB for hot data
 * - Reduces database read costs
 * - Supports pub/sub for multi-server scaling
 */
export async function getRedisClient(): Promise<RedisClientType | null> {
  // Check if Redis is configured
  const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;
  
  if (!redisUrl) {
    console.log('⚠️  Redis not configured - using DynamoDB only');
    return null;
  }

  // Return existing client if already connected
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  // Prevent multiple connection attempts
  if (isConnecting) {
    console.log('⏳ Redis connection in progress...');
    return null;
  }

  try {
    isConnecting = true;
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
    isConnecting = false;

    return redisClient;
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error);
    isConnecting = false;
    redisClient = null;
    return null;
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
    await client.setEx(key, 3600, JSON.stringify(room)); // 1 hour TTL
    console.log(`✅ Cached room ${roomId} in Redis`);
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
      console.log(`✅ Cache HIT for room ${roomId}`);
      return JSON.parse(data);
    } else {
      console.log(`⚠️  Cache MISS for room ${roomId}`);
      return null;
    }
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
    console.log(`✅ Deleted room ${roomId} from Redis cache`);
  } catch (error) {
    console.error('❌ Redis cache delete error:', error);
  }
}

/**
 * Get all active room IDs from Redis
 */
export async function getActiveRoomIds(): Promise<string[]> {
  const client = await getRedisClient();
  if (!client) return [];

  try {
    const keys = await client.keys('room:*');
    return keys.map(key => key.replace('room:', ''));
  } catch (error) {
    console.error('❌ Redis keys error:', error);
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
