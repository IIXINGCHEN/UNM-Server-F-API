import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { cacheService } from '../services/cache/CacheService';
import { songCacheService } from '../services/cache/SongCacheService';

interface CacheStats {
  memorySize: number;
  memoryItems: number;
  redisSize?: number;
  redisItems?: number;
  hits: number;
  misses: number;
  hitRate: string;
}

// Use FastifyPluginAsync type for better type checking
const cacheStatsPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // 注册缓存统计路由
  fastify.get('/api/cache/stats', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                memorySize: { type: 'number' },
                memoryItems: { type: 'number' },
                hits: { type: 'number' },
                misses: { type: 'number' },
                hitRate: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const stats = songCacheService.getStats();

    return {
      success: true,
      data: stats
    };
  });

  // 注册清除缓存路由
  fastify.delete('/api/cache/clear', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          prefix: { type: 'string' },
          songId: { type: 'string' },
          source: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { prefix, songId, source } = request.query as {
      prefix?: string,
      songId?: string,
      source?: string
    };

    if (prefix) {
      await cacheService.deleteByPrefix(prefix);
      return { success: true, message: `已清除前缀为 ${prefix} 的缓存` };
    }
    else if (songId) {
      await songCacheService.clearSongCache(songId);
      return { success: true, message: `已清除歌曲 ${songId} 的缓存` };
    }
    else if (source) {
      await songCacheService.clearSourceCache(source);
      return { success: true, message: `已清除音源 ${source} 的缓存` };
    }
    else {
      // 全部清除的逻辑
      await cacheService.deleteByPrefix('song:');
      await cacheService.deleteByPrefix('source:');
      cacheService.resetStats();
      return { success: true, message: '已清除所有缓存' };
    }
  });

  // 注册缓存监控中间件 - 可选，如果需要记录所有API请求的缓存命中情况
  fastify.addHook('onRequest', async (request, reply) => {
    // 记录请求开始时间，用于统计响应时间
    // Type is now defined in src/types/fastify.d.ts
    request.requestTime = Date.now();
  });

  fastify.addHook('onResponse', async (request, reply) => {
    // 计算响应时间
    // Use optional chaining and nullish coalescing for safety
    const responseTime = Date.now() - (request.requestTime ?? Date.now());

    // 记录到日志或监控系统
    if (responseTime > 500) {
      fastify.log.warn({
        msg: '请求响应时间过长',
        url: request.url,
        method: request.method,
        responseTime
      });
    }
  });
};

export default cacheStatsPlugin; 