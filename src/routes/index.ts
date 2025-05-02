import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import musicRoutes from './music';
import { cacheService } from '../services/cache/CacheService';
// 导入 package.json
// @ts-ignore - 使用 resolveJsonModule 配置允许导入 JSON 文件
import packageJson from '../../package.json';
const version = packageJson.version;
import { getSourceDescriptions } from '../config/music-sources';
import { createApiKeyAuthMiddleware } from '../middlewares/auth';
import { config } from '../config';
// 导入服务实例
import { musicService } from '../services/music';

// API版本常量
export const API_VERSION = 'v1';

// API前缀
const API_PREFIX = `/v${API_VERSION.substring(1)}/api`;

// 服务器启动时间
const SERVER_START_TIME = new Date();

/**
 * 注册所有路由
 */
export default async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  // 根路由 - 始终返回 API 信息 JSON
  fastify.get(
    '/',
    async (_request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
      // 获取系统基本信息
      const uptime = process.uptime();
      const formatUptime = () => {
        const seconds = Math.floor(uptime % 60);
        const minutes = Math.floor(uptime / 60) % 60;
        const hours = Math.floor(uptime / 3600);
        return `${hours}h ${minutes}m ${seconds}s`;
      };

      // 始终返回JSON数据
      const apiData = {
        // 基本信息部分
        code: 200,
        message: 'UNM-Server API',
        version: version,
        description: '网易云音乐解锁服务API',

        // 服务器信息
        server_info: {
          time: new Date().toLocaleString(),
          uptime: formatUptime(),
          started: SERVER_START_TIME.toLocaleString(),
          memory_usage: `${Math.round(process.memoryUsage().rss / 1024 / 1024 * 100) / 100} MB`,
          cache_size: `${cacheService.getStats().size} 项`
        },

        // API使用格式说明
        api_formats: {
          recommended: '使用 /v1/api/* 格式，例如：/v1/api/match?id=123456',
          legacy: '支持省略前缀版本，例如：/match?id=123456'
        },

        // API端点分组
        api_endpoints: {
          // 核心功能
          core: [
            {
              path: "/match",
              method: "GET",
              description: "匹配指定音乐ID的其他平台资源",
              params: {
                id: "网易云歌曲ID",
                source: "(可选) 指定音源，默认为kugou"
              },
              examples: {
                recommended: "/v1/api/match?id=1859245776",
                legacy: "/match?id=1859245776"
              }
            },
            {
              path: "/song",
              method: "GET",
              description: "获取指定ID的音乐播放链接",
              params: {
                id: "网易云歌曲ID",
                source: "(可选) 指定音源，默认自动选择"
              },
              examples: {
                recommended: "/v1/api/song?id=1859245776",
                legacy: "/song?id=1859245776"
              }
            }
          ],

          // 替代功能
          alternate: [
            {
              path: "/redirect",
              method: "GET",
              description: "重定向到指定ID的音乐播放链接",
              params: {
                id: "网易云歌曲ID",
                source: "(可选) 指定音源，默认自动选择"
              },
              examples: {
                recommended: "/v1/api/redirect?id=1859245776",
                legacy: "/redirect?id=1859245776"
              }
            }
          ],

          // 附加功能
          additional: [
            {
              path: "/check",
              method: "GET",
              description: "检查指定ID的歌曲是否可用",
              params: {
                id: "网易云歌曲ID"
              },
              examples: {
                recommended: "/v1/api/check?id=1859245776",
                legacy: "/check?id=1859245776"
              }
            },
            {
              path: "/sources",
              method: "GET",
              description: "获取可用音源列表",
              examples: {
                recommended: "/v1/api/sources",
                legacy: "/sources"
              }
            }
          ],

          // 系统功能
          system: [
            {
              path: "/info",
              method: "GET",
              description: "获取服务基本信息",
              examples: {
                recommended: "/v1/api/info",
                legacy: "/info"
              }
            },
            {
              path: "/health",
              method: "GET",
              description: "服务健康状态检查",
              examples: {
                recommended: "/v1/api/health",
                legacy: "/health"
              }
            }
          ]
        },

        // 可用音源
        available_sources: getSourceDescriptions(),

        // 错误码说明
        error_codes: {
          400: "请求参数错误，请检查参数格式",
          403: "拒绝访问，请检查请求来源",
          404: "端点不存在或未找到资源",
          429: "请求过于频繁，请稍后再试",
          500: "服务器内部错误",
          504: "请求超时"
        }
      };

      // 返回JSON
      return reply.headers({
        'Content-Type': 'application/json; charset=utf-8'
      }).send(apiData);
    }
  );

  // 注册带版本前缀的API路由
  await fastify.register(async (instance) => {
    // 使用工厂函数创建并注册 apiKeyAuth 中间件
    instance.addHook('onRequest', createApiKeyAuthMiddleware(config));
    // 注册 musicRoutes 并传入服务实例
    await instance.register(musicRoutes, { musicService, cacheService });
  }, { prefix: API_PREFIX });

  // 为了后向兼容，保留旧路由（可选，视需求而定）
  //await fastify.register(musicRoutes);

  // 添加重定向中间件，将旧路径请求重定向到新路径
  fastify.addHook('onRequest', async (request, reply) => {
    const oldRoutePatterns = [
      '/match', '/ncmget', '/url', '/otherget', '/lyric', '/pic', '/info', '/health'
    ];

    // 检查当前路径是否匹配旧API路径模式
    const path = request.url.split('?')[0];
    if (oldRoutePatterns.includes(path)) {
      // 获取查询参数
      const queryString = request.url.includes('?') ? request.url.substring(request.url.indexOf('?')) : '';
      // 构建新的URL路径
      const newUrl = `${API_PREFIX}${path}${queryString}`;

      // 执行301永久重定向
      reply.status(301).redirect(newUrl);
      return reply;
    }
  });

  // 404 路由 - 仅返回JSON
  fastify.setNotFoundHandler(async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
    const notFoundData = {
      code: 404,
      message: 'Endpoint not found',
      path: request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
      available_endpoints: {
        documentation: "/",
        api_endpoints: "/v1/api 或直接访问对应路径"
      }
    };

    // 始终返回JSON格式的404信息
    return reply.status(404)
      .headers({
        'Content-Type': 'application/json; charset=utf-8'
      })
      .send(notFoundData);
  });
}