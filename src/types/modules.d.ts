/**
 * 自定义模块类型声明文件
 * 为项目中使用的模块提供基本类型支持
 */

// Redis客户端类型声明
declare module 'ioredis' {
  export default class Redis {
    constructor(url?: string, options?: any);
    on(event: string, listener: (...args: any[]) => void): this;
    connect(): Promise<void>;
    quit(): Promise<string>;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, mode?: string, duration?: number): Promise<string>;
    set(key: string, value: string, options?: { EX?: number }): Promise<string>;
    del(key: string | string[]): Promise<number>;
    keys(pattern: string): Promise<string[]>;
    ping(): Promise<string>;
  }
}

// LRU Cache类型声明
declare module 'lru-cache' {
  export default class LRUCache<K, V> {
    constructor(options?: {
      max?: number;
      ttl?: number;
      allowStale?: boolean;
      updateAgeOnGet?: boolean;
      dispose?: (value: V, key: K) => void;
    });
    set(key: K, value: V, options?: { ttl?: number }): void;
    get(key: K): V | undefined;
    delete(key: K): boolean;
    clear(): void;
    keys(): IterableIterator<K>;
    readonly size: number;
  }
}

// Redis模块类型声明 (for node-redis)
declare module 'redis' {
  export interface RedisClientType {
    connect(): Promise<void>;
    on(event: string, listener: (...args: any[]) => void): this;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, options?: { EX?: number }): Promise<string>;
    del(key: string | string[]): Promise<number>;
    keys(pattern: string): Promise<string[]>;
  }

  export function createClient(options?: { url?: string }): RedisClientType;
}

// 扩展process.env类型
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: string;
    PORT?: string;
    ALLOWED_DOMAIN?: string;
    ENABLE_PROXY?: string;
    PROXY_URL?: string;
    ENABLE_MUSIC_API?: string;
    MUSIC_API_URL?: string;
    ENABLE_FLAC?: string;
    SELECT_MAX_BR?: string;
    FOLLOW_SOURCE_ORDER?: string;
    REDIS_URL?: string;
    ENABLE_REDIS_CACHE?: string;
    NETEASE_COOKIE?: string;
    JOOX_COOKIE?: string;
    MIGU_COOKIE?: string;
    QQ_COOKIE?: string;
    YOUTUBE_KEY?: string;
    MEMORY_CACHE_SIZE?: string;
    MEMORY_CACHE_TTL?: string;
    REDIS_CACHE_TTL?: string;
    SONG_CACHE_TTL?: string;
    SOURCE_CACHE_TTL?: string;
  }
} 