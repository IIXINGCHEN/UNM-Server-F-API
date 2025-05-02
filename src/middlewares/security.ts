/**
 * 统一安全中间件
 * 集中管理所有安全相关的中间件
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config/env';
import { ApiError, ErrorType } from '../utils/errors';
import logger from '../utils/logger';

/**
 * API密钥验证中间件
 * @param request 请求对象
 * @param reply 响应对象
 */
export const apiKeyAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  // 如果未启用API认证，跳过验证
  if (!config.ENABLE_API_AUTH) {
    return;
  }

  // API鉴权白名单路径 - 根路径和favicon不需要鉴权
  const API_AUTH_WHITELIST = [
    '/',
    '/favicon.png',
    '/favicon.ico'
  ];

  // 检查请求路径是否在白名单中
  const requestPath = request.url?.split('?')[0] || '';

  // 添加调试日志
  logger.info(`[security] 检查路径: ${requestPath}, 白名单: ${JSON.stringify(API_AUTH_WHITELIST)}`);

  if (API_AUTH_WHITELIST.some(path => {
    const match = path.endsWith('/*')
      ? requestPath.startsWith(path.substring(0, path.length - 2))
      : requestPath === path;

    // 添加调试日志
    if (match) {
      logger.info(`[security] 路径 ${requestPath} 匹配白名单项 ${path}`);
    }

    return match;
  })) {
    logger.info(`[security] 路径 ${requestPath} 在白名单中，跳过认证`);
    return;
  }

  logger.info(`[security] 路径 ${requestPath} 不在白名单中，需要认证`);

  // 获取API密钥
  const apiKey = request.headers['x-api-key'] || (request.query as any).apiKey;

  // 如果未提供API密钥，返回401错误
  if (!apiKey) {
    throw new ApiError('未提供API密钥', ErrorType.API, 401);
  }

  // 验证API密钥
  const validApiKeys = config.API_KEYS?.split(',').map(key => key.trim()) || [];
  if (!validApiKeys.includes(String(apiKey))) {
    logger.warn(`无效的API密钥: ${apiKey}`, {
      ip: request.ip,
      url: request.url,
      method: request.method
    });
    throw new ApiError('无效的API密钥', ErrorType.API, 401);
  }
};

/**
 * IP白名单验证中间件
 * @param request 请求对象
 * @param reply 响应对象
 */
export const ipWhitelistAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  // 如果未启用IP白名单，跳过验证
  if (!config.ENABLE_IP_WHITELIST) {
    return;
  }

  // 获取客户端IP
  const clientIp = request.ip;

  // 验证IP白名单
  const whitelistedIps = config.IP_WHITELIST?.split(',').map(ip => ip.trim()) || [];
  if (!whitelistedIps.includes(clientIp)) {
    logger.warn(`IP不在白名单中: ${clientIp}`, {
      ip: clientIp,
      url: request.url,
      method: request.method
    });
    throw new ApiError('IP不在白名单中', ErrorType.API, 403);
  }
};

/**
 * 域名验证中间件
 * @param request 请求对象
 * @param reply 响应对象
 */
export const domainAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  // 如果允许所有域名，跳过验证
  if (config.ALLOWED_DOMAIN === '*') {
    return;
  }

  // 本地开发环境检查
  const isLocalhost = request.ip === '127.0.0.1' || request.ip === '::1' || request.ip === '::ffff:127.0.0.1';
  if (isLocalhost) {
    // 本地开发环境允许访问
    return;
  }

  const origin = request.headers.origin;
  const referer = request.headers.referer;
  const host = request.headers.host;
  const allowedDomains = config.ALLOWED_DOMAIN?.split(',').map(domain => domain.trim()) || [];

  // 检查主机名是否匹配允许的域名列表
  if (host && allowedDomains.some(domain => {
    // 精确匹配
    if (domain === host) {
      return true;
    }
    // 子域匹配
    if (domain.startsWith('*.') && host.endsWith(domain.substring(1))) {
      return true;
    }
    return false;
  })) {
    return;
  }

  // 检查来源是否匹配允许的域名列表
  if (origin && allowedDomains.some(domain => {
    // 精确匹配
    if (origin.includes(domain)) {
      return true;
    }
    // 子域匹配
    if (domain.startsWith('*.') && origin.includes(domain.substring(1))) {
      return true;
    }
    return false;
  })) {
    return;
  }

  // 检查引用来源是否匹配允许的域名列表
  if (referer && allowedDomains.some(domain => {
    // 精确匹配
    if (referer.includes(domain)) {
      return true;
    }
    // 子域匹配
    if (domain.startsWith('*.') && referer.includes(domain.substring(1))) {
      return true;
    }
    return false;
  })) {
    return;
  }

  // 如果不匹配，阻止请求
  logger.warn(`域名不允许访问: ${origin || referer || host}`, {
    ip: request.ip,
    url: request.url,
    method: request.method,
    origin,
    referer,
    host
  });
  throw new ApiError('请通过合法域名访问', ErrorType.API, 403);
};

/**
 * 请求体大小限制中间件
 * @param request 请求对象
 * @param reply 响应对象
 */
export const payloadSizeLimiter = async (request: FastifyRequest, reply: FastifyReply) => {
  // 检查Content-Length
  const contentLength = request.headers['content-length'];
  if (contentLength && parseInt(contentLength, 10) > 1024 * 1024) { // 1MB 限制
    throw new ApiError('请求体过大', ErrorType.API, 413);
  }
};

/**
 * 注册所有安全中间件
 * @param app Fastify实例
 */
export const registerSecurityMiddlewares = (app: FastifyInstance): void => {
  // 注册API密钥验证中间件
  if (config.ENABLE_API_AUTH) {
    app.addHook('onRequest', apiKeyAuth);
  }

  // 注册IP白名单验证中间件
  if (config.ENABLE_IP_WHITELIST) {
    app.addHook('onRequest', ipWhitelistAuth);
  }

  // 注册域名验证中间件
  if (config.ALLOWED_DOMAIN !== '*') {
    app.addHook('onRequest', domainAuth);
  }

  // 注册请求体大小限制中间件
  app.addHook('onRequest', payloadSizeLimiter);
};
