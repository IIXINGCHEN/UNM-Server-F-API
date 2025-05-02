import Fastify, { FastifyInstance } from 'fastify';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import fastifyCsrf from '@fastify/csrf-protection';
import { config, isDev } from './config/env';
import registerRoutes from './routes';
import setupSwagger from './plugins/swagger';
import { registerMiddlewares } from './middlewares';
import { prometheusService } from './services/monitoring/PrometheusService';
import { globalErrorHandler, setupUncaughtExceptionHandler } from './utils/error-handler';

// 声明__dirname的类型（在ESM模式下会丢失）
declare const __dirname: string;

/**
 * 创建并配置Fastify实例
 */
export async function createApp(): Promise<FastifyInstance> {
  // 检查是否在 Vercel 环境中运行
  const isVercel = process.env.VERCEL === '1';

  // 创建Fastify实例
  const app = Fastify({
    logger: {
      transport: isDev && !isVercel
        ? {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
        : undefined,
      level: isDev ? 'info' : 'warn',
    },
    trustProxy: true,
    // 在 Vercel 环境中禁用文件日志
    disableRequestLogging: isVercel
  });

  // 配置安全头 - Helmet (增强版)
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        connectSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", "data:"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        frameAncestors: ["'none'"], // 防止网站被嵌入iframe
        formAction: ["'self'"], // 限制表单提交目标
        baseUri: ["'self'"], // 限制base URI
        objectSrc: ["'none'"], // 禁止所有对象
        upgradeInsecureRequests: [], // 升级不安全请求
        blockAllMixedContent: [] // 阻止混合内容
      }
    },
    // 启用XSS保护
    xssFilter: true,
    // 启用DNS预取控制
    dnsPrefetchControl: {
      allow: false
    },
    // 防止嗅探MIME类型
    noSniff: true,
    // 强制安全连接
    hsts: {
      maxAge: 15552000, // 180天
      includeSubDomains: true,
      preload: true
    },
    // 引用策略
    referrerPolicy: {
      policy: 'no-referrer-when-downgrade'
    }
    // 注意：permissionsPolicy 在当前版本的 fastify-helmet 中不支持
    // 如需使用，请升级依赖或使用自定义中间件实现
  });

  // 配置CORS - 增强安全性
  await app.register(fastifyCors, {
    origin: (origin, cb) => {
      // 如果允许所有域
      if (config.ALLOWED_DOMAIN === '*') {
        cb(null, true);
        return;
      }

      // 如果未提供origin（如服务器到服务器的请求）
      if (!origin) {
        cb(null, true);
        return;
      }

      // 检查origin是否在允许列表中
      const allowedDomains = (config.ALLOWED_DOMAIN || '').split(',').map(domain => domain.trim());
      const allowed = allowedDomains.some(domain => {
        // 精确匹配
        if (domain === origin) {
          return true;
        }

        // 子域匹配（如 *.example.com）
        if (domain.startsWith('*.')) {
          const domainSuffix = domain.substring(1); // 从 *.example.com 得到 .example.com
          return origin.endsWith(domainSuffix);
        }

        return false;
      });

      if (allowed) {
        cb(null, true);
      } else {
        cb(new Error(`Origin ${origin} not allowed`), false);
      }
    },
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    exposedHeaders: ['Content-Length', 'Date'],
    credentials: false, // 默认不允许凭证
    maxAge: 86400, // 预检请求缓存1天
    preflightContinue: false
  });

  // 配置请求频率限制
  await app.register(fastifyRateLimit, {
    max: config.RATE_LIMIT_MAX || 100, // 使用配置的值，默认每IP最多100个请求/分钟
    timeWindow: `${config.RATE_LIMIT_WINDOW / 1000 || 60} seconds`, // 转换为秒
    allowList: [], // 白名单IP列表
    skipOnError: false, // 错误时不跳过限流
    cache: 10000, // 缓存10000个IP
    nameSpace: 'unm-ratelimit:', // Redis命名空间
    keyGenerator: (request) => {
      // 使用IP或API密钥作为限流键
      const apiKey = request.headers['x-api-key'] || request.headers['authorization']?.split('Bearer ')[1];

      // 对于认证失败的请求，使用更严格的限制键（IP + auth-fail）
      // 这样可以对认证失败的请求应用更严格的限制，防止暴力破解
      if (request.url.includes('/v1/api/') && !apiKey) {
        return `auth-fail:${request.ip}`;
      }

      return apiKey ? `key:${apiKey}` : `ip:${request.ip}`;
    },
    errorResponseBuilder: () => ({
      code: 429,
      message: '请求过于频繁，请稍后再试',
      error: 'Too Many Requests'
    }),
  });

  // 创建认证失败计数器
  const authFailCounter = new Map<string, {
    count: number;
    timestamps: number[];
    blocked: boolean;
    blockUntil: number;
  }>();

  // 定期清理过期的计数器（每小时）
  const authFailCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, data] of authFailCounter.entries()) {
      // 清理超过1小时的计数器
      if (data.timestamps.length === 0 ||
        (data.timestamps[data.timestamps.length - 1] < now - 60 * 60 * 1000 &&
          (!data.blocked || data.blockUntil < now))) {
        authFailCounter.delete(key);
      }
    }
  }, 60 * 60 * 1000); // 每小时清理一次

  // 确保服务器关闭时清理定时器
  app.addHook('onClose', (_instance, done) => {
    clearInterval(authFailCleanupInterval);
    done();
  });

  // 为认证失败的请求配置更严格的频率限制 - 使用路由级别的频率限制
  app.addHook('onRequest', async (request, reply) => {
    // 仅对API路由应用
    if (request.url.includes('/v1/api/')) {
      const apiKey = request.headers['x-api-key'] || request.headers['authorization']?.split('Bearer ')[1];

      // 仅对没有API密钥的请求应用更严格的限制
      if (!apiKey) {
        // 使用内存中的计数器跟踪认证失败请求
        const authFailKey = `auth-fail:${request.ip}`;
        const now = Date.now();
        const windowMs = 60 * 1000; // 1分钟窗口
        const maxFailedAttempts = 20; // 最多20次失败尝试

        // 获取当前IP的失败计数
        let counterData = authFailCounter.get(authFailKey) || {
          count: 0,
          timestamps: [],
          blocked: false,
          blockUntil: 0
        };

        // 检查是否被阻止
        if (counterData.blocked && now < counterData.blockUntil) {
          return reply.status(429).send({
            code: 429,
            message: '认证失败次数过多，请稍后再试',
            error: 'Too Many Authentication Failures',
            retryAfter: Math.ceil((counterData.blockUntil - now) / 1000)
          });
        }

        // 更新时间戳列表，只保留窗口内的
        counterData.timestamps = [
          ...counterData.timestamps.filter((time: number) => time > now - windowMs),
          now
        ];

        // 更新计数
        counterData.count = counterData.timestamps.length;

        // 检查是否超过限制
        if (counterData.count > maxFailedAttempts) {
          // 阻止10分钟
          counterData.blocked = true;
          counterData.blockUntil = now + 10 * 60 * 1000;

          // 记录安全事件
          const securityLogger = require('./utils/security-logger').securityLogger;
          securityLogger.logRateLimit(`IP ${request.ip} 因认证失败次数过多被临时阻止`, {
            source_ip: request.ip,
            request_path: request.url,
            failed_attempts: counterData.count,
            block_duration: '10分钟'
          });

          // 保存更新后的计数器
          authFailCounter.set(authFailKey, counterData);

          return reply.status(429).send({
            code: 429,
            message: '认证失败次数过多，请稍后再试',
            error: 'Too Many Authentication Failures',
            retryAfter: 600 // 10分钟
          });
        }

        // 保存更新后的计数器
        authFailCounter.set(authFailKey, counterData);
      }
    }
  });

  // 注册 Cookie 支持
  await app.register(fastifyCookie);

  // 注册会话支持
  await app.register(fastifySession, {
    cookieName: 'sessionId',
    secret: config.SESSION_SECRET || 'a7648eeaf6a8997bc4cbc5dcd0b2e56990d02f2b8da35b11934737f4df4d6ae6',
    cookie: {
      secure: process.env.NODE_ENV === 'production', // 在生产环境中使用 HTTPS
      httpOnly: true,
      sameSite: 'strict', // 防止 CSRF 攻击
      maxAge: 30 * 60 * 1000 // 30分钟
    }
    // Redis会话存储在需要时单独配置
  });

  // 注册 CSRF 保护
  await app.register(fastifyCsrf, {
    sessionPlugin: '@fastify/session',
    cookieOpts: {
      signed: true,
      httpOnly: true,
      sameSite: 'strict'
    },
    getToken: (request) => {
      // 从请求头、请求体或查询参数中获取 CSRF 令牌
      return (
        request.headers['csrf-token'] ||
        request.headers['x-csrf-token'] ||
        request.headers['x-xsrf-token'] ||
        (request.body && (request.body as any)._csrf) ||
        (request.query as any)._csrf
      ) as string;
    }
  });

  // 注册所有中间件
  registerMiddlewares(app);

  // 注册所有路由
  await registerRoutes(app);

  // 注册 Prometheus 指标路由
  prometheusService.registerMetricsRoute(app);

  // 注册Swagger API文档
  await setupSwagger(app);

  // 设置全局错误处理器
  app.setErrorHandler(globalErrorHandler);

  // 设置未捕获异常处理器
  setupUncaughtExceptionHandler();

  return app;
}