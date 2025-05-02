/**
 * 统一错误处理模块
 * 提供全面的错误处理和格式化功能
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { ApiError, ErrorType, getFastifyErrorString } from './errors';
import logger from './logger';
import { prometheusService } from '../services/monitoring/PrometheusService';
import { config } from '../config/env';

/**
 * 错误响应接口
 */
export interface ErrorResponse {
  /**
   * 状态码
   */
  statusCode: number;
  
  /**
   * 错误类型
   */
  error: string;
  
  /**
   * 错误消息
   */
  message: string;
  
  /**
   * 详细信息（仅在非生产环境中）
   */
  details?: any;
  
  /**
   * 请求路径（仅在非生产环境中）
   */
  path?: string;
  
  /**
   * 请求方法（仅在非生产环境中）
   */
  method?: string;
  
  /**
   * 请求ID（仅在非生产环境中）
   */
  requestId?: string;
}

/**
 * 全局错误处理器
 * @param error 错误对象
 * @param request 请求对象
 * @param reply 响应对象
 */
export function globalErrorHandler(error: Error, request: FastifyRequest, reply: FastifyReply): void {
  // 在生产环境中隐藏详细错误信息
  const isProduction = config.NODE_ENV === 'production';
  
  // 记录错误指标
  const errorType = error instanceof ApiError ? error.type : ErrorType.UNKNOWN;
  const statusCode = error instanceof ApiError ? error.statusCode : 500;
  prometheusService.recordApiError(errorType, statusCode);
  
  if (error instanceof ApiError) {
    // 处理已知的 API 错误
    logger.warn(`API Error (${error.statusCode}): ${error.message}`, {
      reqId: request.id,
      type: error.type,
      data: error.data,
      url: request.url,
      method: request.method,
      ip: request.ip
    });
    
    reply.status(error.statusCode).send({
      statusCode: error.statusCode,
      error: error.type,
      message: error.message,
    });
  } else if (error && (error as any).validation) {
    // 处理 Fastify 的验证错误
    logger.warn('Validation Error:', {
      reqId: request.id,
      error: error,
      url: request.url,
      method: request.method
    });
    
    reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: '请求参数验证失败',
    });
  } else {
    // 处理未知的内部错误
    logger.error('Internal Server Error:', {
      reqId: request.id,
      err: error,
      stack: error.stack,
      url: request.url,
      method: request.method,
      ip: request.ip
    });
    
    // 在生产环境中隐藏详细错误信息
    const errorResponse: ErrorResponse = {
      statusCode: 500,
      error: 'Internal Server Error',
      message: '服务器内部错误'
    };
    
    // 在非生产环境中添加详细错误信息，帮助调试
    if (!isProduction) {
      errorResponse.details = error.message;
      errorResponse.path = request.url;
      errorResponse.method = request.method;
      errorResponse.requestId = request.id;
    }
    
    reply.status(500).send(errorResponse);
  }
}

/**
 * 创建自定义错误响应
 * @param statusCode HTTP状态码
 * @param message 错误消息
 * @param errorType 错误类型
 * @param data 附加数据
 * @returns 格式化的错误响应
 */
export function createErrorResponse(
  statusCode: number,
  message: string,
  errorType: string = getFastifyErrorString(statusCode),
  data?: any
): ErrorResponse {
  const response: ErrorResponse = {
    statusCode,
    error: errorType,
    message
  };
  
  // 在非生产环境中添加详细信息
  if (config.NODE_ENV !== 'production' && data) {
    response.details = data;
  }
  
  return response;
}

/**
 * 处理未捕获的异常
 */
export function setupUncaughtExceptionHandler(): void {
  process.on('uncaughtException', (error) => {
    logger.error('未捕获的异常:', {
      error: error.message,
      stack: error.stack
    });
    
    // 在生产环境中，可以选择退出进程，让进程管理器重启应用
    if (config.NODE_ENV === 'production') {
      logger.error('由于未捕获的异常，应用将在5秒后退出');
      setTimeout(() => {
        process.exit(1);
      }, 5000);
    }
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('未处理的Promise拒绝:', {
      reason,
      promise
    });
  });
}

export default {
  globalErrorHandler,
  createErrorResponse,
  setupUncaughtExceptionHandler
};
