/**
 * 监控中间件
 * 用于收集请求指标
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { prometheusService } from '../services/monitoring/PrometheusService';

/**
 * 创建监控中间件
 * 记录HTTP请求指标
 */
export const createMonitoringMiddleware = () => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // 记录请求开始时间
    const startTime = process.hrtime();

    // 在请求完成后记录指标
    request.raw.on('end', () => {
      // 计算请求持续时间
      const hrTime = process.hrtime(startTime);
      const durationMs = hrTime[0] * 1000 + hrTime[1] / 1000000;

      // 获取路由路径（如果可用）
      const routePath = request.routeOptions?.url || request.url;

      // 记录HTTP请求指标
      prometheusService.recordHttpRequest(
        request.method,
        routePath,
        reply.statusCode,
        durationMs
      );

      // 如果是错误响应，记录API错误
      if (reply.statusCode >= 400) {
        const errorType = reply.statusCode >= 500 ? 'server_error' : 'client_error';
        prometheusService.recordApiError(errorType, reply.statusCode);
      }
    });
  };
};
