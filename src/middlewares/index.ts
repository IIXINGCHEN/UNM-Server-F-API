/**
 * 中间件统一注册模块
 * 集中管理所有中间件的注册
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config/env';
import { createSecurityMonitorMiddleware } from './security-monitor';
import { requestLogger } from './auth';
import { createValidationMiddleware } from './validation';
import { registerSecurityMiddlewares } from './security';
import { createMonitoringMiddleware } from './monitoring';

/**
 * JSON格式化中间件
 */
const jsonFormatter = (request: FastifyRequest, reply: FastifyReply, payload: any, done: Function) => {
  // 仅处理JSON响应
  const contentType = reply.getHeader('content-type');
  if (contentType && contentType.toString().includes('application/json') && typeof payload === 'string') {
    try {
      // 尝试解析JSON字符串
      const obj = JSON.parse(payload);

      // 判断是否为首页路由请求（"/"路径）
      const isHomePage = request.url === '/';

      // 首页使用更美观的格式，其他路由使用标准格式
      const formatted = isHomePage
        ? JSON.stringify(obj, null, 4) // 使用4空格缩进使首页更醒目
        : JSON.stringify(obj, null, 2); // 标准2空格缩进

      done(null, formatted);
    } catch (err) {
      // 如果不是有效的JSON，原样返回
      done(null, payload);
    }
  } else {
    done(null, payload);
  }
};

/**
 * 注册所有中间件
 * @param app Fastify实例
 */
export const registerMiddlewares = (app: FastifyInstance): void => {
  // 安全监控中间件 - 必须在其他中间件之前，以便监控所有请求
  app.addHook('onRequest', createSecurityMonitorMiddleware());

  // 监控中间件 - 收集请求指标
  app.addHook('onRequest', createMonitoringMiddleware());

  // 注册所有安全中间件
  registerSecurityMiddlewares(app);

  // 请求日志记录
  app.addHook('onRequest', requestLogger);

  // 参数验证中间件
  app.addHook('onRequest', createValidationMiddleware());

  // 注册处理JSON格式化的钩子
  app.addHook('onSend', jsonFormatter);
};
