import { FastifyRequest, FastifyReply } from 'fastify';
import logger from '../utils/logger';
import { ApiError, ErrorType } from '../utils/errors';
import { maskApiKey, secureCompare } from '../utils/data-protection';
import { isValidIp, ipMatchesWildcard, ipInCidrRange, getRealIp } from '../utils/ip-utils';
import { securityLogger } from '../utils/security-logger';

// API鉴权白名单路径 - 根路径和favicon不需要鉴权
const API_AUTH_WHITELIST = [
    '/',
    '/favicon.png',
    '/favicon.ico'
];

// 为API密钥提供带过期时间的内存缓存，避免频繁验证
const apiKeyCache = new Map<string, { valid: boolean, expires: number }>();

// 定期清理过期的缓存项
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of apiKeyCache.entries()) {
        if (data.expires < now) {
            apiKeyCache.delete(key);
        }
    }
}, 5 * 60 * 1000); // 每5分钟清理一次

/**
 * API密钥认证中间件工厂函数
 * @param config 配置对象
 * @returns Fastify 中间件函数
 */
export function createApiKeyAuthMiddleware(config: any) {
    // 预加载API密钥列表
    const validApiKeys = (String(config.API_KEYS || '')).split(',').filter(key => key.trim().length > 0);

    return async (request: FastifyRequest, reply: FastifyReply) => {
        if (!config.ENABLE_API_AUTH || !validApiKeys.length) {
            return;
        }

        // 检查请求路径是否在白名单中
        const requestPath = request.url?.split('?')[0] || '';

        // 添加调试日志
        logger.info(`检查路径: ${requestPath}, 白名单: ${JSON.stringify(API_AUTH_WHITELIST)}`);

        if (API_AUTH_WHITELIST.some(path => {
            const match = path.endsWith('/*')
                ? requestPath.startsWith(path.substring(0, path.length - 2))
                : requestPath === path;

            // 添加调试日志
            if (match) {
                logger.info(`路径 ${requestPath} 匹配白名单项 ${path}`);
            }

            return match;
        })) {
            logger.info(`路径 ${requestPath} 在白名单中，跳过认证`);
            return;
        }

        logger.info(`路径 ${requestPath} 不在白名单中，需要认证`);

        // 获取 API 密钥 - 支持安全的传递方式
        const apiKey =
            request.headers['x-api-key'] ||
            request.headers['authorization']?.split('Bearer ')[1] ||
            (process.env.NODE_ENV !== 'production' ? (request.query as Record<string, string>)['api_key'] : undefined); // 仅在非生产环境中支持URL参数传递API密钥

        // 没有提供密钥
        if (!apiKey) {
            logger.warn(`API请求无授权信息: ${requestPath} 来自 ${request.ip}`);

            // 记录安全事件
            securityLogger.logAuthFailure('API请求无授权信息', {
                source_ip: request.ip,
                request_path: requestPath,
                request_method: request.method,
                user_agent: request.headers['user-agent']
            });

            return reply.status(401).send({
                statusCode: 401,
                error: 'Unauthorized',
                message: '缺少API密钥'
            });
        }

        // 检查密钥是否有效（使用缓存）
        if (apiKeyCache.has(String(apiKey))) {
            const cacheItem = apiKeyCache.get(String(apiKey));
            // 检查缓存项是否有效且未过期
            if (cacheItem && cacheItem.expires > Date.now()) {
                if (!cacheItem.valid) {
                    logger.warn(`使用已知无效的API密钥: ${maskApiKey(String(apiKey))} 来自 ${request.ip}`);

                    // 记录安全事件
                    securityLogger.logAuthFailure('使用已知无效的API密钥', {
                        source_ip: request.ip,
                        request_path: requestPath,
                        request_method: request.method,
                        user_agent: request.headers['user-agent'],
                        key_fragment: maskApiKey(String(apiKey))
                    });

                    return reply.status(401).send({
                        statusCode: 401,
                        error: 'Unauthorized',
                        message: '无效的API密钥'
                    });
                }
                return; // 密钥有效
            }
        }

        // 密钥不在缓存中或已过期，使用安全比较方法进行验证
        const isValid = validApiKeys.some(validKey =>
            secureCompare(String(apiKey), validKey)
        );

        // 缓存结果，设置30分钟过期
        const cacheExpiry = Date.now() + 30 * 60 * 1000;
        apiKeyCache.set(String(apiKey), { valid: isValid, expires: cacheExpiry });

        if (!isValid) {
            logger.warn(`无效的API密钥: ${maskApiKey(String(apiKey))} 来自 ${request.ip}`);

            // 记录安全事件
            securityLogger.logAuthFailure('无效的API密钥', {
                source_ip: request.ip,
                request_path: requestPath,
                request_method: request.method,
                user_agent: request.headers['user-agent'],
                key_fragment: maskApiKey(String(apiKey))
            });

            // 添加随机延迟，防止时序攻击
            await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));

            return reply.status(401).send({
                statusCode: 401,
                error: 'Unauthorized',
                message: '无效的API密钥'
            });
        } else {
            // 记录成功认证
            securityLogger.logAuthSuccess('API密钥验证成功', {
                source_ip: request.ip,
                request_path: requestPath,
                request_method: request.method
            });
        }
    };
}

/**
 * IP白名单认证中间件工厂函数
 * @param config 配置对象
 * @returns Fastify 中间件函数
 */
export function createIpWhitelistAuthMiddleware(config: {
    ENABLE_IP_WHITELIST?: boolean;
    IP_WHITELIST?: string | string[];
    TRUST_PROXY?: boolean;
}) {
    // 如果IP白名单功能未启用，返回空中间件
    if (!config.ENABLE_IP_WHITELIST) {
        return async () => { return; };
    }

    // 预处理IP白名单列表
    let allowedIps: string[] = [];

    // 处理配置中的IP白名单
    if (config.IP_WHITELIST) {
        // 处理字符串或数组格式
        const ipList = Array.isArray(config.IP_WHITELIST)
            ? config.IP_WHITELIST
            : config.IP_WHITELIST.split(',');

        allowedIps = ipList
            .map(ip => ip.trim())
            .filter(ip => ip.length > 0);
    }

    // 检查是否允许所有IP
    const allowAll = allowedIps.includes('*') || allowedIps.length === 0;

    // 如果允许所有IP或白名单为空，返回空中间件
    if (allowAll) {
        return async () => { return; };
    }

    // 将白名单分类为不同类型，提高匹配效率
    const exactIps: string[] = [];
    const wildcardIps: string[] = [];
    const cidrRanges: string[] = [];

    allowedIps.forEach(ip => {
        if (ip.includes('*')) {
            wildcardIps.push(ip);
        } else if (ip.includes('/')) {
            cidrRanges.push(ip);
        } else {
            exactIps.push(ip);
        }
    });

    // 返回实际的中间件函数
    return async (request: FastifyRequest, reply: FastifyReply) => {
        // 获取客户端真实IP
        const clientIp = config.TRUST_PROXY ? getRealIp(request) : request.ip;

        // 验证IP格式
        if (!isValidIp(clientIp)) {
            logger.warn(`无效的IP地址格式: ${clientIp}`);

            // 记录安全事件
            securityLogger.logSuspiciousActivity('无效的IP地址格式', {
                source_ip: clientIp,
                request_path: request.url,
                request_method: request.method,
                user_agent: request.headers['user-agent']
            });

            return reply.status(403).send({
                statusCode: 403,
                error: 'Forbidden',
                message: 'IP地址格式无效'
            });
        }

        // 检查IP是否在白名单中
        let isAllowed = false;

        // 1. 检查精确匹配
        if (exactIps.includes(clientIp)) {
            isAllowed = true;
        }

        // 2. 检查通配符匹配
        if (!isAllowed && wildcardIps.length > 0) {
            isAllowed = wildcardIps.some(pattern => ipMatchesWildcard(clientIp, pattern));
        }

        // 3. 检查CIDR范围匹配
        if (!isAllowed && cidrRanges.length > 0) {
            isAllowed = cidrRanges.some(cidr => ipInCidrRange(clientIp, cidr));
        }

        // 如果IP不在白名单中，拒绝访问
        if (!isAllowed) {
            logger.warn(`请求IP不在白名单内: ${clientIp}`);

            // 记录安全事件
            securityLogger.logIpBlocked('IP不在白名单内', {
                source_ip: clientIp,
                request_path: request.url,
                request_method: request.method,
                user_agent: request.headers['user-agent']
            });

            // 添加随机延迟，防止信息泄露
            await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));

            return reply.status(403).send({
                statusCode: 403,
                error: 'Forbidden',
                message: '您的IP未被授权访问'
            });
        }
    };
}

/**
 * 请求日志记录中间件
 * @param request FastifyRequest对象
 * @param reply FastifyReply对象
 */
export const requestLogger = async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();
    const requestId = request.id;
    const method = request.method;
    const url = request.url;
    const ip = request.ip;
    const userAgent = request.headers['user-agent'] || 'unknown';

    // 对于非开发环境，使用更简洁的日志格式
    if (process.env.NODE_ENV === 'production') {
        logger.info(`${method} ${url} - ${ip}`);
    } else {
        logger.info(`Request started: [${method}] ${url} - IP: ${ip} - UA: ${userAgent}`);
    }

    reply.raw.on('finish', () => {
        const responseTime = Date.now() - startTime;
        const statusCode = reply.statusCode;

        // 对4xx和5xx错误使用警告级别
        if (statusCode >= 400) {
            logger.warn(`${method} ${url} - ${statusCode} - ${responseTime}ms - ${ip}`);
        } else if (process.env.NODE_ENV !== 'production') {
            // 在非生产环境中记录更详细的日志
            logger.info(`Request completed: [${method}] ${url} - ${statusCode} (${responseTime}ms) - ReqID: ${requestId}`);
        }
    });
};

// 注意: maskApiKey 函数已移至 utils/data-protection.ts