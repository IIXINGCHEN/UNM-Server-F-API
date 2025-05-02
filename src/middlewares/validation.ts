/**
 * 请求参数验证中间件
 * 用于验证请求参数，防止注入攻击和不当输入
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { ApiError, ErrorType } from '../utils/errors';
import logger from '../utils/logger';

/**
 * 验证ID参数
 * @param id ID字符串
 * @returns 是否有效
 */
function isValidId(id: string): boolean {
  // ID应为字母数字，长度限制在1-64字符
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

/**
 * 验证URL参数
 * @param url URL字符串
 * @returns 是否有效
 */
function isValidUrl(url: string): boolean {
  if (typeof url !== 'string') return false;

  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 验证数字参数
 * @param value 数字字符串
 * @param min 最小值
 * @param max 最大值
 * @returns 是否有效
 */
function isValidNumber(value: string, min: number = 1, max: number = Number.MAX_SAFE_INTEGER): boolean {
  const num = parseInt(value, 10);
  return !isNaN(num) && num >= min && num <= max;
}

/**
 * 验证查询参数
 * @param query 查询参数对象
 * @returns 验证结果
 */
function validateQueryParams(query: Record<string, any>): { valid: boolean, error?: string } {
  // 验证ID参数
  if (query.id && !isValidId(query.id)) {
    return { valid: false, error: '无效的ID参数' };
  }

  // 验证URL参数
  if (query.url && !isValidUrl(query.url)) {
    return { valid: false, error: '无效的URL参数' };
  }

  // 验证源参数
  if (query.source && !isValidId(query.source)) {
    return { valid: false, error: '无效的源参数' };
  }

  // 验证比特率参数
  if (query.br && !isValidNumber(query.br, 1, 9999)) {
    return { valid: false, error: '无效的比特率参数' };
  }

  // 验证计数参数
  if (query.count && !isValidNumber(query.count, 1, 100)) {
    return { valid: false, error: '无效的计数参数，应为1-100之间的数字' };
  }

  // 验证页码参数
  if (query.pages && !isValidNumber(query.pages, 1, 100)) {
    return { valid: false, error: '无效的页码参数，应为1-100之间的数字' };
  }

  // 验证大小参数
  if (query.size && !isValidNumber(query.size, 1, 2000)) {
    return { valid: false, error: '无效的大小参数，应为1-2000之间的数字' };
  }

  return { valid: true };
}

/**
 * 创建参数验证中间件
 * @returns 参数验证中间件函数
 */
export const createValidationMiddleware = () => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // 验证查询参数
      const queryResult = validateQueryParams(request.query as Record<string, any>);
      if (!queryResult.valid) {
        throw ApiError.validation(queryResult.error || '无效的请求参数');
      }

      // 验证路径参数
      const params = request.params as Record<string, any>;
      for (const [key, value] of Object.entries(params)) {
        // 验证ID类型参数
        if (key.toLowerCase().includes('id') && !isValidId(String(value))) {
          throw ApiError.validation(`无效的路径参数: ${key}`);
        }
      }
    } catch (error) {
      if (error instanceof ApiError) {
        return reply.status(error.statusCode).send({
          statusCode: error.statusCode,
          error: error.type,
          message: error.message
        });
      }

      // 未知错误
      logger.error('参数验证中发生未知错误', { error });
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: '请求参数验证失败'
      });
    }
  };
};
