/**
 * Simple in-memory cache with TTL (Time To Live)
 * Used to reduce duplicate API calls and improve performance
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class Cache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private defaultTTL: number;

  constructor(defaultTTL: number = 5 * 60 * 1000) { // Default 5 minutes
    this.defaultTTL = defaultTTL;
  }

  /**
   * Get cached data if it exists and hasn't expired
   */
  get(key: string, customTTL?: number): T | null {
    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }

    const ttl = customTTL ?? this.defaultTTL;
    const isExpired = Date.now() - cached.timestamp > ttl;

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    console.log(`✅ Cache hit: ${key}`);
    return cached.data;
  }

  /**
   * Store data in cache with current timestamp
   */
  set(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
    console.log(`💾 Cached: ${key}`);
  }

  /**
   * Invalidate a specific cache entry or all entries
   */
  invalidate(key?: string): void {
    if (key) {
      this.cache.delete(key);
      console.log(`🗑️ Invalidated cache: ${key}`);
    } else {
      this.cache.clear();
      console.log('🗑️ Cleared all cache');
    }
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Check if a key exists in cache (regardless of expiry)
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Get or fetch pattern: Get from cache or call fetcher function
   */
  async getOrFetch(
    key: string,
    fetcher: () => Promise<T>,
    customTTL?: number
  ): Promise<T> {
    const cached = this.get(key, customTTL);
    if (cached !== null) {
      return cached;
    }

    console.log(`🔄 Cache miss, fetching: ${key}`);
    const data = await fetcher();
    this.set(key, data);
    return data;
  }
}

// Create singleton cache instances for different data types
export const locationCache = new Cache(5 * 60 * 1000); // 5 minutes
export const placeDetailsCache = new Cache(10 * 60 * 1000); // 10 minutes
export const michelinCache = new Cache(60 * 60 * 1000); // 1 hour
export const userCache = new Cache(2 * 60 * 1000); // 2 minutes

// Export a helper to clear all caches
export const clearAllCaches = () => {
  locationCache.invalidate();
  placeDetailsCache.invalidate();
  michelinCache.invalidate();
  userCache.invalidate();
  console.log('🗑️ All caches cleared');
};
