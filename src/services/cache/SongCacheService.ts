import { cacheService, CacheLevel, CachePriority } from './CacheService';
import { SongInfo } from '../../types';

/**
 * 歌曲缓存选项接口
 */
interface SongCacheOptions {
  duration: number;  // 缓存时长(秒)
  useRedis: boolean; // 是否使用Redis
  priority?: CachePriority; // 缓存优先级
}

/**
 * 歌曲缓存服务
 * 提供歌曲信息和音源匹配结果的缓存功能
 */
export class SongCacheService {
  // 缓存键前缀
  private static readonly SONG_PREFIX = 'song:';
  private static readonly SOURCE_PREFIX = 'source:';

  // 默认缓存选项
  private defaultOptions: SongCacheOptions = {
    duration: 86400, // 默认1天
    useRedis: true,
    priority: CachePriority.NORMAL
  };

  // 获取歌曲缓存键
  private getSongKey(id: string, source?: string): string {
    return source
      ? `${SongCacheService.SONG_PREFIX}${id}:${source}`
      : `${SongCacheService.SONG_PREFIX}${id}`;
  }

  // 获取音源缓存键
  private getSourceKey(id: string): string {
    return `${SongCacheService.SOURCE_PREFIX}${id}`;
  }

  /**
   * 缓存歌曲信息
   * @param id 歌曲ID
   * @param data 歌曲信息
   * @param options 缓存选项
   */
  async cacheSongInfo(id: string, data: SongInfo, options?: Partial<SongCacheOptions>): Promise<void> {
    const opts = { ...this.defaultOptions, ...options };

    await cacheService.set(
      this.getSongKey(id),
      data,
      {
        ttl: opts.duration,
        level: opts.useRedis ? CacheLevel.REDIS : CacheLevel.MEMORY,
        priority: opts.priority || CachePriority.NORMAL
      }
    );
  }

  /**
   * 缓存特定音源的歌曲信息
   * @param id 歌曲ID
   * @param source 音源
   * @param data 歌曲信息
   * @param options 缓存选项
   */
  async cacheSongSourceInfo(id: string, source: string, data: SongInfo, options?: Partial<SongCacheOptions>): Promise<void> {
    const opts = { ...this.defaultOptions, ...options };

    await cacheService.set(
      this.getSongKey(id, source),
      data,
      {
        ttl: opts.duration,
        level: opts.useRedis ? CacheLevel.REDIS : CacheLevel.MEMORY,
        priority: opts.priority || CachePriority.NORMAL
      }
    );
  }

  /**
   * 缓存音源匹配结果
   * @param id 歌曲ID
   * @param sources 匹配的音源列表
   * @param options 缓存选项
   */
  async cacheSourceMatchResult(id: string, sources: string[], options?: Partial<SongCacheOptions>): Promise<void> {
    const opts = { ...this.defaultOptions, ...options };

    // 音源匹配结果使用较短的缓存时间
    const sourceCacheTTL = Math.min(opts.duration, 3600); // 最长1小时

    await cacheService.set(
      this.getSourceKey(id),
      sources,
      {
        ttl: sourceCacheTTL,
        level: opts.useRedis ? CacheLevel.REDIS : CacheLevel.MEMORY,
        priority: CachePriority.LOW // 音源匹配结果优先级较低
      }
    );
  }

  /**
   * 获取歌曲信息
   * @param id 歌曲ID
   * @returns 歌曲信息或null
   */
  async getSongInfo(id: string): Promise<SongInfo | null> {
    return await cacheService.get(this.getSongKey(id));
  }

  /**
   * 获取特定音源的歌曲信息
   * @param id 歌曲ID
   * @param source 音源
   * @returns 歌曲信息或null
   */
  async getSongSourceInfo(id: string, source: string): Promise<SongInfo | null> {
    return await cacheService.get(this.getSongKey(id, source));
  }

  /**
   * 获取音源匹配结果
   * @param id 歌曲ID
   * @returns 匹配的音源列表或null
   */
  async getSourceMatchResult(id: string): Promise<string[] | null> {
    return await cacheService.get(this.getSourceKey(id));
  }

  /**
   * 检查歌曲是否已缓存
   * @param id 歌曲ID
   * @returns 是否已缓存
   */
  async hasSongInfo(id: string): Promise<boolean> {
    return await cacheService.has(this.getSongKey(id));
  }

  /**
   * 检查特定音源的歌曲是否已缓存
   * @param id 歌曲ID
   * @param source 音源
   * @returns 是否已缓存
   */
  async hasSongSourceInfo(id: string, source: string): Promise<boolean> {
    return await cacheService.has(this.getSongKey(id, source));
  }

  /**
   * 清除特定歌曲的所有缓存
   * @param id 歌曲ID
   */
  async clearSongCache(id: string): Promise<void> {
    await cacheService.deleteByPrefix(this.getSongKey(id));
    await cacheService.delete(this.getSourceKey(id));
  }

  /**
   * 根据音源清除缓存
   * @param source 音源
   */
  async clearSourceCache(source: string): Promise<void> {
    await cacheService.deleteByPrefix(`${SongCacheService.SONG_PREFIX}:${source}`);
  }

  /**
   * 获取缓存统计信息
   * @returns 缓存统计信息
   */
  getStats(): any {
    return cacheService.getStats();
  }
}

// 导出单例实例
export const songCacheService = new SongCacheService();