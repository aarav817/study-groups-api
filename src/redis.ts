import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

export const redis = new Redis(REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  retryStrategy: () => null, // Don't spam retries if Redis daemon isn't running
});

let isConnected = false;

interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

const inMemoryCache = new Map<string, CacheItem<any>>();

redis.on('connect', () => {
  isConnected = true;
  console.log('[Redis] Connected to Redis cache server.');
});

redis.on('error', () => {
  if (isConnected) {
    console.warn('[Redis] Connection lost. Falling back to in-memory cache.');
  }
  isConnected = false;
});

// Attempt initial connection asynchronously
redis.connect().catch(() => {
  console.log('[Redis] Redis daemon not active on ' + REDIS_URL + '. Operating with high-performance in-memory fallback cache.');
});

/**
 * Retrieve cached JSON value by key.
 */
export async function getCache<T = any>(key: string): Promise<{ data: T; source: 'redis' | 'memory' } | null> {
  try {
    if (isConnected) {
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
    if (isConnected) {
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
    if (isConnected) {
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
    if (isConnected) {
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
