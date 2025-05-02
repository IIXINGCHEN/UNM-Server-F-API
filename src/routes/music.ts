import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { musicService } from '../services/music';
import { SourceType, DEFAULT_SOURCES, TEST_SONG_ID } from '../config/sources';
import { isDev, config } from '../config/env';
import { cacheService } from '../services/cache/CacheService';
import * as os from 'os';
import { ApiError, ErrorType, getFastifyErrorString } from '../utils/errors';
import { getSourceDescriptions } from '../config/music-sources';

interface MatchParams {
  id: string;
  source?: string;
}

interface DirectLinkParams {
  id: string;
  br?: string;
  source?: string;
}

interface SearchParams {
  name: string;
  source?: string;
  count?: string;
  pages?: string;
}

interface LyricParams {
  id: string;
  source?: string;
}

interface PicParams {
  id: string;
  source?: string;
  size?: string;
}

// 自定义请求类型
interface FastifyRequestWithQuerystring<T> extends FastifyRequest {
  query: T;
}

// 定义服务接口 (可选，但推荐)
interface MusicRouteServices {
  musicService: typeof musicService;
  cacheService: typeof cacheService;
}

/**
 * 音乐相关路由注册函数
 * @param fastify Fastify 实例
 * @param services 包含 musicService 和 cacheService 的对象
 */
export default async function musicRoutes(fastify: FastifyInstance, services: MusicRouteServices): Promise<void> {
  const { musicService, cacheService } = services; // 解构服务

  // 信息
  fastify.get('/info', async (_req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
    const pkg = require('../../package.json');
    return reply.send({
      code: 200,
      version: pkg.version,
      enable_flac: process.env.ENABLE_FLAC,
      proxy_enabled: config.ENABLE_PROXY,
      music_api_enabled: config.ENABLE_MUSIC_API,
      music_api_url: config.MUSIC_API_URL
    });
  });

  // 健康检查
  fastify.get('/health', async (req: FastifyRequest, reply: FastifyReply) => {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    const cacheStats = cacheService.getStats ? cacheService.getStats() : { size: '未知' };

    // 确定Redis连接状态
    let redisStatus = 'not_configured';
    if (config.REDIS_URL) {
      if (config.ENABLE_REDIS_CACHE) {
        // 尝试获取缓存项，检查Redis连接是否正常
        try {
          const probe = await cacheService.get('health_probe');
          redisStatus = 'connected';
        } catch (e) {
          redisStatus = 'error';
        }
      } else {
        redisStatus = 'disabled';
      }
    }

    // 检查外部依赖的API服务
    let apiServiceStatus = 'not_configured';
    if (config.MUSIC_API_URL) {
      if (config.ENABLE_MUSIC_API) {
        try {
          // 尝试对API服务进行简单的ping
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);

          try {
            const apiUrl = new URL(config.MUSIC_API_URL);
            const response = await fetch(apiUrl.toString(), {
              signal: controller.signal,
              headers: {
                'User-Agent': 'UNM-Server-HealthCheck/1.0'
              }
            });

            clearTimeout(timeoutId);
            apiServiceStatus = response.ok ? 'connected' : 'error';
          } catch (error) {
            clearTimeout(timeoutId);
            apiServiceStatus = 'error';
          }
        } catch (e) {
          apiServiceStatus = 'unreachable';
        }
      } else {
        apiServiceStatus = 'disabled';
      }
    }

    // 获取网络信息
    const networkInterfaces = os.networkInterfaces();
    const interfaces: { [key: string]: string[] } = {};

    // 只收集IPv4地址，一个接口可能有多个IP
    Object.keys(networkInterfaces).forEach(ifName => {
      const addresses = networkInterfaces[ifName];
      if (addresses) {
        const ipv4Addresses = addresses
          .filter(addr => addr.family === 'IPv4' || addr.family as any === 4)
          .map(addr => addr.address);

        if (ipv4Addresses.length > 0) {
          interfaces[ifName] = ipv4Addresses;
        }
      }
    });

    // 生成负载颜色指标
    const loadAvg = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    const loadPerCpu = loadAvg / cpuCount;
    let loadStatus = 'green';

    if (loadPerCpu > 0.7) {
      loadStatus = 'red';
    } else if (loadPerCpu > 0.5) {
      loadStatus = 'yellow';
    }

    // 基于请求IP确定客户端环境信息
    const clientIp = req.ip;
    const userAgent = req.headers['user-agent'] || 'unknown';

    // 简单的系统健康检查
    const healthData = {
      status: 'ok',
      version: require('../../package.json').version,
      env: process.env.NODE_ENV || 'development',
      uptime: {
        seconds: Math.floor(uptime),
        formatted: `${Math.floor(uptime / 3600)}时${Math.floor((uptime % 3600) / 60)}分${Math.floor(uptime % 60)}秒`
      },
      timestamp: new Date().toISOString(),
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
        usage_percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        node_version: process.version,
        cpus: {
          count: os.cpus().length,
          model: os.cpus()[0]?.model || 'unknown'
        },
        loadavg: os.loadavg(),
        load_status: loadStatus,
        freemem: `${Math.round(os.freemem() / 1024 / 1024)}MB`,
        totalmem: `${Math.round(os.totalmem() / 1024 / 1024)}MB`,
        memory_usage_percentage: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100)
      },
      network: {
        hostname: '******' // 隐藏主机名
      },
      services: {
        redis: {
          status: redisStatus,
          url: config.REDIS_URL ? '已配置(已脱敏)' : '未配置',
          enabled: config.ENABLE_REDIS_CACHE
        },
        music_api: {
          status: apiServiceStatus,
          url: config.MUSIC_API_URL ? '已配置(已脱敏)' : '未配置',
          enabled: config.ENABLE_MUSIC_API
        }
      },
      sources: {
        netease: config.ENABLE_NETEASE,
        tencent: config.ENABLE_TENCENT,
        kugou: config.ENABLE_KUGOU,
        kuwo: config.ENABLE_KUWO,
        bilibili: config.ENABLE_BILIBILI
      },
      cache: cacheStats,
      client: {
        ip: '******', // 隐藏IP地址
        user_agent: '******' // 隐藏用户代理
      }
    };

    return reply.send(healthData);
  });

  // ---- 添加 /sources 路由 ----
  fastify.get('/sources', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const sources = getSourceDescriptions();
      return reply.send({
        code: 200,
        message: '获取可用音源列表成功',
        data: sources
      });
    } catch (error: any) {
      throw new ApiError('Failed to get sources list', ErrorType.API, 500, error);
    }
  });
  // ---- 结束添加 /sources 路由 ----

  // 测试
  fastify.get('/test', async (_req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
    try {
      const result = await musicService.matchSong(TEST_SONG_ID, DEFAULT_SOURCES);
      return reply.send({
        code: 200,
        message: '获取成功',
        data: result.data
      });
    } catch (error: any) {
      return reply.status(500).send({
        code: 500,
        message: '测试失败',
        ...(isDev && { error: error.message })
      });
    }
  });

  // 匹配
  fastify.get<{
    Querystring: MatchParams
  }>('/match', async (request: FastifyRequestWithQuerystring<MatchParams>, reply: FastifyReply): Promise<FastifyReply> => {
    const { id, source } = request.query;
    if (!id) {
      throw new ApiError('Missing required parameter: id', ErrorType.VALIDATION, 400);
    }
    try {
      const result = await musicService.matchSong(id, source ? [source as SourceType] : undefined);
      return reply.send(result);
    } catch (error: any) {
      // 简化：依赖全局错误处理器
      if (error instanceof ApiError) {
        throw error;
      }
      // 将未知错误包装后抛出
      throw new ApiError(error.message || 'Failed to match song', ErrorType.API, 500, error);
    }
  });

  // 获取直链 (网易云)
  fastify.get<{
    Querystring: DirectLinkParams
  }>('/ncmget', async (request: FastifyRequestWithQuerystring<DirectLinkParams>, reply: FastifyReply): Promise<FastifyReply> => {
    try {
      const { id, br = '320', source } = request.query;

      if (!id) {
        return reply.status(400).send({ code: 400, message: '缺少必要参数 id' });
      }

      const result = await musicService.getDirectLink(id, br, source);

      return reply.send({
        code: 200,
        message: result.cached ? '请求成功 (缓存)' : '请求成功',
        data: result.data,
        ...(result.cached && { cached: true })
      });
    } catch (error: any) {
      console.error('获取直链失败:', error);

      const isTimeout = error.message.includes('超时');
      const statusCode = isTimeout ? 504 : 500;

      return reply.status(statusCode).send({
        code: statusCode,
        message: error.message,
        ...(isDev && { stack: error.stack })
      });
    }
  });

  // API路径别名：/url -> /ncmget
  fastify.get<{
    Querystring: DirectLinkParams
  }>('/url', async (request: FastifyRequestWithQuerystring<DirectLinkParams>, reply: FastifyReply): Promise<FastifyReply> => {
    // 复用ncmget的处理逻辑
    const res = await fastify.inject({
      method: 'GET',
      url: `/ncmget?${new URLSearchParams(request.query as any).toString()}`,
      headers: request.headers as any
    });

    return reply
      .code(res.statusCode)
      .headers(res.headers as any)
      .send(res.payload);
  });

  // 搜索并获取音乐
  fastify.get<{
    Querystring: SearchParams
  }>('/otherget', async (request: FastifyRequestWithQuerystring<SearchParams>, reply: FastifyReply): Promise<FastifyReply> => {
    try {
      const { name, source = 'kuwo', count = '1', pages = '1' } = request.query;

      if (!name) {
        return reply.status(400).send({ code: 400, message: '缺少必要参数 name' });
      }

      const result = await musicService.searchAndGetMusic(
        name,
        source,
        parseInt(count, 10),
        parseInt(pages, 10)
      );

      return reply.send({
        code: 200,
        message: result.cached ? '请求成功 (缓存)' : '请求成功',
        data: result.data,
        ...(result.cached && { cached: true })
      });
    } catch (error: any) {
      console.error('搜索音乐失败:', error);

      const isTimeout = error.message.includes('超时');
      const isNotFound = error.message.includes('未找到');
      const statusCode = isTimeout ? 504 : isNotFound ? 404 : 500;

      return reply.status(statusCode).send({
        code: statusCode,
        message: error.message,
        ...(isDev && { stack: error.stack })
      });
    }
  });

  // 获取歌词
  fastify.get<{
    Querystring: LyricParams
  }>('/lyric', async (request: FastifyRequestWithQuerystring<LyricParams>, reply: FastifyReply): Promise<FastifyReply> => {
    try {
      const { id, source = 'netease' } = request.query;

      if (!id) {
        return reply.status(400).send({ code: 400, message: '缺少必要参数 id' });
      }

      const result = await musicService.getLyric(id, source);

      return reply.send({
        code: 200,
        message: result.cached ? '请求成功 (缓存)' : '请求成功',
        data: result.data,
        ...(result.cached && { cached: true })
      });
    } catch (error: any) {
      console.error('获取歌词失败:', error);

      const isTimeout = error.message.includes('超时');
      const statusCode = isTimeout ? 504 : 500;

      return reply.status(statusCode).send({
        code: statusCode,
        message: error.message,
        ...(isDev && { stack: error.stack })
      });
    }
  });

  // 获取专辑图片
  fastify.get<{
    Querystring: PicParams
  }>('/pic', async (request: FastifyRequestWithQuerystring<PicParams>, reply: FastifyReply): Promise<FastifyReply> => {
    try {
      const { id, source = 'netease', size = '300' } = request.query;

      if (!id) {
        return reply.status(400).send({ code: 400, message: '缺少必要参数 id' });
      }

      const result = await musicService.getAlbumPic(
        id,
        source,
        parseInt(size, 10)
      );

      return reply.send({
        code: 200,
        message: result.cached ? '请求成功 (缓存)' : '请求成功',
        data: result.data,
        ...(result.cached && { cached: true })
      });
    } catch (error: any) {
      console.error('获取专辑图片失败:', error);

      const isTimeout = error.message.includes('超时');
      const statusCode = isTimeout ? 504 : 500;

      return reply.status(statusCode).send({
        code: statusCode,
        message: error.message,
        ...(isDev && { stack: error.stack })
      });
    }
  });

  // --- /song ---
  fastify.get(
    '/song',
    async (request: FastifyRequest<{ Querystring: { id?: string; source?: string; br?: string } }>, reply: FastifyReply) => {
      const { id, source, br } = request.query;
      if (!id) {
        throw ApiError.validation('Missing required parameter: id'); // 使用静态方法简化
      }
      try {
        const result = await musicService.getDirectLink(id, br, source);
        // /song 端点直接返回 data 部分
        return reply.send(result.data);
      } catch (error: any) {
        // 简化：依赖全局错误处理器
        if (error instanceof ApiError) {
          throw error;
        }
        // 将未知错误包装后抛出
        throw new ApiError(error.message || 'Failed to get song URL', ErrorType.API, 500, error);
      }
    }
  );

  // --- /redirect ---
  fastify.get(
    '/redirect',
    async (request: FastifyRequest<{ Querystring: { id?: string; source?: string; br?: string } }>, reply: FastifyReply) => {
      const { id, source, br } = request.query;
      if (!id) {
        // 使用符合测试断言的结构
        reply.code(400).send({ error: 'Bad Request', message: 'Missing required parameter: id' });
        return;
      }
      try {
        const result = await musicService.getDirectLink(id, br, source);
        if (result && result.data && (result.data as { url?: string }).url) {
          return reply.redirect(302, (result.data as { url: string }).url);
        }
        // 如果没有 url，直接响应符合测试断言的 404
        reply.code(404).send({ error: 'Not Found', message: 'No redirect URL found' });
        return;
      } catch (error: any) {
        // 在 catch 块中显式处理错误并发送符合测试断言的响应
        if (error instanceof ApiError) {
          // 根据 ApiError 的状态码发送响应
          const statusCode = error.statusCode;
          const message = error.message;
          const errorString = getFastifyErrorString(statusCode);
          reply.code(statusCode).send({ error: errorString, message: message });
        } else {
          // 对于未知错误，发送符合测试断言的 500 响应
          reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to get redirect URL' });
        }
        // 确保在 catch 后不再继续执行
        return;
      }
    }
  );

  // --- /check ---
  fastify.get(
    '/check',
    async (request: FastifyRequest<{ Querystring: { id?: string } }>, reply: FastifyReply) => {
      const { id } = request.query;
      if (!id) {
        // 使用符合测试断言的结构
        reply.code(400).send({ error: 'Bad Request', message: 'Missing required parameter: id' });
        return;
      }
      try {
        await musicService.getDirectLink(id);
        return reply.send({ available: true });
      } catch (error: any) {
        // 在 catch 块中显式处理错误并发送符合测试断言的响应
        if (error instanceof ApiError) {
          // 如果是 404，按预期返回 { available: false }
          if (error.statusCode === 404) {
            // 这个逻辑是正确的，应该符合测试断言
            reply.code(200).send({ available: false });
          } else {
            // 其他 ApiError，使用其状态码和消息构造响应
            const statusCode = error.statusCode;
            const message = error.message;
            const errorString = getFastifyErrorString(statusCode);
            reply.code(statusCode).send({ error: errorString, message: message });
          }
        } else {
          // 对于未知错误，发送符合测试断言的 500 响应
          reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to check song availability' });
        }
        // 确保在 catch 后不再继续执行
        return;
      }
    }
  );
}