/**
 * 安全监控中间件
 * 用于检测和记录可疑活动，提供安全告警
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import logger from '../utils/logger';
import { securityLogger } from '../utils/security-logger';

// 请求计数器
const requestCounters = new Map<string, { count: number, timestamps: number[] }>();

// 时间窗口（毫秒）
const TIME_WINDOW = 60 * 1000; // 1分钟

// 可疑阈值
const SUSPICIOUS_THRESHOLD = 50; // 1分钟内50次请求
const BLOCK_THRESHOLD = 100; // 1分钟内100次请求

/**
 * 检测异常访问
 * @param request 请求对象
 * @returns 是否为异常访问
 */
function detectSuspiciousAccess(request: FastifyRequest): boolean {
  const clientIp = request.ip;
  const requestPath = request.url;
  const now = Date.now();

  // 更新请求计数
  const key = `${clientIp}:${requestPath}`;
  const counterData = requestCounters.get(key) || { count: 0, timestamps: [] };
  counterData.timestamps.push(now);
  counterData.timestamps = counterData.timestamps.filter(time => time > now - TIME_WINDOW);
  counterData.count = counterData.timestamps.length;
  requestCounters.set(key, counterData);

  // 检测异常访问模式
  const isSuspicious = counterData.count > BLOCK_THRESHOLD;

  // 检测地理位置异常（基于IP地址前缀）
  const isGeoSuspicious = detectGeoAnomaly(clientIp);

  return isSuspicious || isGeoSuspicious;
}

/**
 * 检测地理位置异常
 * 注意：这是一个简化的实现，实际生产环境应使用专业的地理位置数据库
 * @param ip IP地址
 * @returns 是否为地理位置异常
 */
function detectGeoAnomaly(ip: string): boolean {
  // 存储已知的IP地址前缀及其地理位置
  // 这里使用一个简单的映射，实际生产环境应使用专业的地理位置数据库
  const knownIpPrefixes: Record<string, string> = {
    '127.0.0': 'localhost',
    '192.168': 'local',
    '10.0': 'local',
    '172.16': 'local',
  };

  // 检查IP地址前缀
  for (const [prefix, location] of Object.entries(knownIpPrefixes)) {
    if (ip.startsWith(prefix)) {
      // 如果是已知的本地IP地址前缀，不视为异常
      return false;
    }
  }

  // 这里可以添加更复杂的地理位置检测逻辑
  // 例如，检查IP地址是否来自高风险国家/地区
  // 或者检查IP地址是否与用户的常用地理位置不符

  // 简单起见，这里不做进一步检测，返回false
  return false;
}

/**
 * 创建安全监控中间件
 * @returns 安全监控中间件函数
 */
export const createSecurityMonitorMiddleware = () => {
  // 定期清理过期的请求计数
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, data] of requestCounters.entries()) {
      data.timestamps = data.timestamps.filter(time => time > now - TIME_WINDOW);
      data.count = data.timestamps.length;
      if (data.count === 0) {
        requestCounters.delete(key);
      } else {
        requestCounters.set(key, data);
      }
    }
  }, 5 * 60 * 1000); // 每5分钟清理一次

  // 确保在进程退出时清理定时器
  process.on('exit', () => {
    clearInterval(cleanupInterval);
  });

  return async (request: FastifyRequest, reply: FastifyReply) => {
    // 检测异常访问
    const isSuspicious = detectSuspiciousAccess(request);

    // 如果检测到异常访问，记录警告并可选择阻止请求
    if (isSuspicious) {
      // 记录到标准日志
      logger.warn(`检测到异常访问模式: ${request.ip} 在短时间内多次访问 ${request.url}`, {
        ip: request.ip,
        url: request.url,
        method: request.method,
        headers: request.headers,
        query: request.query
      });

      // 记录到安全日志
      securityLogger.logSuspiciousActivity(`检测到异常访问模式: ${request.ip} 在短时间内多次访问 ${request.url}`, {
        source_ip: request.ip,
        request_path: request.url,
        request_method: request.method,
        user_agent: request.headers['user-agent'],
        request_count: requestCounters.get(`${request.ip}:${request.url}`)?.count || 0,
        time_window: TIME_WINDOW / 1000 // 转换为秒
      });

      // 可选：阻止请求（取决于安全策略）
      // 默认不阻止，仅记录警告
      // return reply.status(429).send({
      //   statusCode: 429,
      //   error: 'Too Many Requests',
      //   message: '检测到异常访问模式，请求被拒绝'
      // });
    }

    // 检测地理位置异常
    const isGeoSuspicious = detectGeoAnomaly(request.ip);
    if (isGeoSuspicious) {
      // 记录到安全日志
      securityLogger.logSuspiciousActivity(`检测到地理位置异常: ${request.ip} 访问 ${request.url}`, {
        source_ip: request.ip,
        request_path: request.url,
        request_method: request.method,
        user_agent: request.headers['user-agent'],
        anomaly_type: 'geo_location'
      });
    }

    // 监控响应状态
    reply.raw.on('finish', () => {
      const statusCode = reply.statusCode;

      // 记录认证失败
      if (statusCode === 401) {
        logger.warn(`认证失败: ${request.ip} 访问 ${request.url}`, {
          ip: request.ip,
          url: request.url,
          method: request.method,
          user_agent: request.headers['user-agent']
        });
      }

      // 记录访问被拒绝
      if (statusCode === 403) {
        logger.warn(`访问被拒绝: ${request.ip} 访问 ${request.url}`, {
          ip: request.ip,
          url: request.url,
          method: request.method,
          user_agent: request.headers['user-agent']
        });
      }

      // 记录请求频率限制
      if (statusCode === 429) {
        logger.warn(`请求频率限制触发: ${request.ip} 访问 ${request.url}`, {
          ip: request.ip,
          url: request.url,
          method: request.method,
          user_agent: request.headers['user-agent']
        });
      }

      // 记录服务器错误
      if (statusCode >= 500) {
        logger.error(`服务器错误: ${statusCode} 在 ${request.url}`, {
          ip: request.ip,
          url: request.url,
          method: request.method,
          status_code: statusCode
        });
      }
    });
  };
};
