import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableOfflineQueue: true,
  retryStrategy: (times) => {
    const delay = Math.min(times * 200, 3000);
    return delay;
  },
});

let isConnected = false;

interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

const inMemoryCache = new Map<string, CacheItem<any>>();

redis.on('connect', () => {
  isConnected = true;
  console.log('[Redis] Connected to Redis server.');
});

redis.on('ready', () => {
  isConnected = true;
  console.log('[Redis] Redis client is ready.');
});

redis.on('error', (err) => {
  if (isConnected) {
    console.warn('[Redis] Connection error. Reconnecting...', err.message);
  }
  isConnected = false;
});

/**
 * Retrieve cached JSON value by key.
 */
export async function getCache<T = any>(key: string): Promise<{ data: T; source: 'redis' | 'memory' } | null> {
  try {
    if (redis.status === 'ready' || redis.status === 'connect') {
      const data = await redis.get(key);
      if (data) {
        return { data: JSON.parse(data) as T, source: 'redis' };
      }
    }
  } catch (err) {
    // Fall back to in-memory map
  }

  const item = inMemoryCache.get(key);
  if (item && item.expiresAt > Date.now()) {
    return { data: item.value as T, source: 'memory' };
  }
  if (item) inMemoryCache.delete(key);
  return null;
}

/**
 * Set JSON value in cache with TTL in seconds.
 */
export async function setCache<T = any>(key: string, value: T, ttlSeconds = 60): Promise<void> {
  try {
    if (redis.status === 'ready' || redis.status === 'connect') {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    }
  } catch (err) {
    // Fall back to in-memory map
  }

  inMemoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Invalidate all public study group cache keys.
 */
export async function invalidatePublicGroupsCache(): Promise<void> {
  try {
    if (redis.status === 'ready' || redis.status === 'connect') {
      const keys = await redis.keys('public_groups:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
  } catch (err) {
    // Ignore error
  }

  for (const k of inMemoryCache.keys()) {
    if (k.startsWith('public_groups:')) {
      inMemoryCache.delete(k);
    }
  }
}

/**
 * Invalidate study materials cache keys.
 */
export async function invalidateMaterialsCache(groupId?: string): Promise<void> {
  const groupPattern = groupId ? `materials:group:${groupId}:*` : 'materials:group:*';
  try {
    if (redis.status === 'ready' || redis.status === 'connect') {
      const groupKeys = await redis.keys(groupPattern);
      const userKeys = await redis.keys('materials:user:*');
      const allKeys = [...groupKeys, ...userKeys];
      if (allKeys.length > 0) {
        await redis.del(...allKeys);
      }
    }
  } catch (err) {
    // Ignore error
  }

  for (const k of inMemoryCache.keys()) {
    if (k.startsWith('materials:user:') || (groupId ? k.startsWith(`materials:group:${groupId}:`) : k.startsWith('materials:group:'))) {
      inMemoryCache.delete(k);
    }
  }
}

export default {
  redis,
  getCache,
  setCache,
  invalidatePublicGroupsCache,
  invalidateMaterialsCache,
};
