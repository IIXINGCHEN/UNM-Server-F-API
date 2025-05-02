import { createClient, RedisClientType } from 'redis';
import * as LRUCacheModule from 'lru-cache';
// 处理 ESM 和 CommonJS 导入兼容性
const LRUCache = LRUCacheModule.default || LRUCacheModule;
// 定义 LRUCache 类型
type LRUCacheType = InstanceType<typeof LRUCache>;

/**
 * 缓存级别枚举
 */
export enum CacheLevel {
  MEMORY = 'memory', // 仅内存缓存
  REDIS = 'redis',   // 内存+Redis缓存
}

/**
 * 缓存优先级枚举
 */
export enum CachePriority {
  LOW = 'low',         // 低优先级，短时间缓存
  NORMAL = 'normal',   // 普通优先级，标准缓存时间
  HIGH = 'high'        // 高优先级，长时间缓存
}

/**
 * 缓存选项接口
 */
interface CacheOptions {
  ttl: number;                      // 过期时间(秒)
  level: CacheLevel;                // 缓存级别
  priority?: CachePriority;         // 缓存优先级
}

/**
 * 缓存统计信息接口
 */
interface CacheStats {
  hits: number;                     // 缓存命中次数
  misses: number;                   // 缓存未命中次数
  size: number;                     // 缓存项数量
  memoryItems: number;              // 内存缓存项数量
  memorySizeBytes: number;          // 内存缓存大小(字节)
  hitRate: string;                  // 命中率(百分比)
}

/**
 * 统一缓存服务类
 * 提供内存缓存和Redis缓存的统一接口
 */
export class CacheService {
  // 内存缓存
  private memoryCache: LRUCacheType;

  // Redis客户端
  private redisClient: RedisClientType | null = null;
  private redisAvailable: boolean = false;

  // 缓存统计
  private stats = {
    hits: 0,
    misses: 0,
    memoryCacheSize: 0,
    redisCacheSize: 0,
  };

  // 默认缓存时间配置 (秒)
  private readonly TTL = {
    [CachePriority.LOW]: 15 * 60,      // 15分钟
    [CachePriority.NORMAL]: 60 * 60,   // 1小时
    [CachePriority.HIGH]: 6 * 60 * 60  // 6小时
  };

  /**
   * 构造函数
   * 初始化内存缓存和Redis客户端
   */
  constructor() {
    // 初始化内存缓存
    this.memoryCache = new LRUCache({
      max: 1000, // 默认最大缓存项数
      ttl: 300 * 1000, // 默认缓存时间5分钟（毫秒）
      allowStale: false,
      updateAgeOnGet: true, // 读取时更新年龄
      dispose: (_value, key) => {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`缓存项过期: ${key}`);
        }
      }
    });

    // 初始化Redis(如果配置了)
    this.initRedis();

    // 设置定时清理和统计
    this.setupPeriodicTasks();
  }

  /**
   * 初始化Redis客户端
   */
  private async initRedis() {
    // 检查是否在 Vercel 环境中运行
    const isVercel = process.env.VERCEL === '1';

    if (isVercel) {
      console.info('Vercel环境中不使用Redis缓存');
      this.redisAvailable = false;
      return;
    }

    // 从环境变量获取Redis配置
    const redisUrl = process.env.REDIS_URL;
    const enableRedisCache = process.env.ENABLE_REDIS_CACHE === 'true';

    if (redisUrl && enableRedisCache) {
      try {
        // 创建Redis客户端，使用增强配置
        this.redisClient = createClient({
          url: redisUrl
        });

        // 增强的错误处理和重连逻辑
        this.redisClient.on('error', (err) => {
          console.error('Redis连接错误:', err);
          this.redisAvailable = false;
        });

        this.redisClient.on('connect', () => {
          console.log('Redis连接成功');
          this.redisAvailable = true;
        });

        this.redisClient.on('reconnecting', () => {
          console.log('Redis正在重连...');
        });

        // 添加自动重连逻辑
        let reconnectAttempts = 0;
        const maxReconnectAttempts = 10;

        const reconnect = async () => {
          if (reconnectAttempts >= maxReconnectAttempts) {
            console.error(`Redis重连失败，已达到最大尝试次数 (${maxReconnectAttempts})`);
            return;
          }

          reconnectAttempts++;
          const delay = Math.min(Math.pow(2, reconnectAttempts) * 100, 30000); // 最大30秒

          console.log(`Redis重连尝试 #${reconnectAttempts}，延迟 ${delay}ms`);

          setTimeout(async () => {
            try {
              if (!this.redisAvailable && this.redisClient) {
                await this.redisClient.connect();
              }
            } catch (error) {
              console.error('Redis重连失败:', error);
              reconnect();
            }
          }, delay);
        };

        this.redisClient.on('end', () => {
          console.warn('Redis连接已关闭');
          this.redisAvailable = false;
          reconnect();
        });

        try {
          await this.redisClient.connect();
          reconnectAttempts = 0; // 连接成功后重置重连计数
        } catch (error) {
          console.error('Redis初始连接失败:', error);
          reconnect();
        }
      } catch (error) {
        console.error('Redis初始化失败:', error);
        this.redisAvailable = false;
      }
    } else if (redisUrl && !enableRedisCache) {
      console.log('Redis已配置但未启用 (ENABLE_REDIS_CACHE=false)');
    } else {
      console.info('使用内存缓存模式');
    }
  }

  /**
   * 设置定期任务
   */
  private setupPeriodicTasks() {
    // 定期清理过期项（每10分钟）
    const cleanupInterval = setInterval(() => this.cleanup(), 10 * 60 * 1000);

    // 定期记录统计信息（每小时）
    const statsInterval = setInterval(() => this.logStats(), 60 * 60 * 1000);

    // 确保进程退出时清理定时器
    process.on('exit', () => {
      clearInterval(cleanupInterval);
      clearInterval(statsInterval);
    });
  }

  /**
   * 清理过期缓存项
   */
  private cleanup(): void {
    // LRU-cache会自动处理过期项，这里主要是记录日志
    const size = this.memoryCache.size;
    console.log(`缓存清理: 当前缓存项数量 ${size}`);
  }

  /**
   * 获取缓存项
   * @param key 缓存键
   * @returns 缓存值或null（如果不存在）
   */
  async get(key: string): Promise<any | null> {
    // 先尝试从内存缓存获取
    const memoryResult = this.memoryCache.get(key);
    if (memoryResult !== undefined) {
      this.stats.hits++;
      return memoryResult;
    }

    // 如果内存中没有且Redis可用，尝试从Redis获取
    if (this.redisAvailable && this.redisClient) {
      try {
        const redisResult = await this.redisClient.get(key);
        if (redisResult) {
          try {
            // 反序列化数据
            const parsed = JSON.parse(redisResult as string);
            // 同时更新内存缓存
            this.memoryCache.set(key, parsed);
            this.stats.hits++;
            return parsed;
          } catch (parseError) {
            console.error(`Redis数据解析失败: ${key}`, parseError);
            // 删除损坏的数据
            await this.redisClient.del(key).catch(() => { });
          }
        }
      } catch (error) {
        console.error(`从Redis获取缓存失败: ${key}`, error);
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * 设置缓存项
   * @param key 缓存键
   * @param value 缓存值
   * @param options 缓存选项
   */
  async set(key: string, value: any, options?: Partial<CacheOptions>): Promise<void> {
    // 默认选项
    const defaultOptions: CacheOptions = {
      ttl: 300, // 默认5分钟
      level: CacheLevel.MEMORY,
      priority: CachePriority.NORMAL
    };

    const opts = { ...defaultOptions, ...options };

    // 根据优先级调整TTL（如果没有明确指定）
    if (!options?.ttl && opts.priority) {
      opts.ttl = this.TTL[opts.priority];
    }

    // 始终设置内存缓存
    this.memoryCache.set(key, value, { ttl: opts.ttl * 1000 });

    // 如果需要Redis级别缓存且Redis可用
    if (opts.level === CacheLevel.REDIS && this.redisAvailable && this.redisClient) {
      try {
        // 序列化数据
        const serialized = JSON.stringify(value);
        await this.redisClient.set(key, serialized, { EX: opts.ttl });
      } catch (error) {
        console.error(`设置Redis缓存失败: ${key}`, error);
      }
    }
  }

  /**
   * 检查键是否存在
   * @param key 缓存键
   * @returns 是否存在
   */
  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }

  /**
   * 删除缓存项
   * @param key 缓存键
   */
  async delete(key: string): Promise<void> {
    // 删除内存缓存
    this.memoryCache.delete(key);

    // 如果Redis可用，同时删除Redis缓存
    if (this.redisAvailable && this.redisClient) {
      try {
        await this.redisClient.del(key);
      } catch (error) {
        console.error(`删除Redis缓存失败: ${key}`, error);
      }
    }
  }

  /**
   * 按前缀删除多个缓存项
   * @param prefix 键前缀
   */
  async deleteByPrefix(prefix: string): Promise<void> {
    // 删除内存缓存
    for (const key of this.memoryCache.keys()) {
      if (typeof key === 'string' && key.startsWith(prefix)) {
        this.memoryCache.delete(key);
      }
    }

    // 如果Redis可用，同时删除Redis缓存
    if (this.redisAvailable && this.redisClient) {
      try {
        const keys = await this.redisClient.keys(`${prefix}*`);
        if (keys.length > 0) {
          await this.redisClient.del(keys);
        }
      } catch (error) {
        console.error(`删除Redis缓存前缀失败: ${prefix}`, error);
      }
    }
  }

  /**
   * 记录缓存统计信息
   */
  logStats(): void {
    const total = this.stats.hits + this.stats.misses;
    const hitRatio = total > 0 ? this.stats.hits / total : 0;

    console.log(`缓存统计: 总请求=${total}, 命中率=${(hitRatio * 100).toFixed(2)}%, 项数=${this.memoryCache.size}`);

    // 估算内存占用
    const heapUsed = process.memoryUsage().heapUsed;
    const mbSize = (heapUsed / (1024 * 1024)).toFixed(2);
    console.log(`内存使用: ${mbSize} MB`);

    // 重置命中/未命中计数
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * 获取缓存统计信息
   * @returns 缓存统计信息
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(2) + '%' : '0%';

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.memoryCache.size,
      memoryItems: this.memoryCache.size,
      memorySizeBytes: process.memoryUsage().heapUsed,
      hitRate
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      memoryCacheSize: 0,
      redisCacheSize: 0,
    };
  }
}

// 导出单例实例
export const cacheService = new CacheService();