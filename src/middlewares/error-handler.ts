import { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ApiError, ErrorType } from '../utils/errors';
import logger from '../utils/logger';

/**
 * 全局错误处理函数 for Fastify
 */
export default function errorHandler(fastify: FastifyInstance) {
  fastify.setErrorHandler((error: FastifyError | Error | ApiError, request: FastifyRequest, reply: FastifyReply) => {
    // 将所有非ApiError类型的错误转换为ApiError实例
    let apiError: ApiError;

    if (error instanceof ApiError) {
      apiError = error;
    } else if (error instanceof Error) {
      // 检查是否是 Fastify 的 404 错误
      // Fastify 的 404 错误会有 statusCode 属性
      const fastifyError = error as FastifyError;
      if (fastifyError.statusCode === 404) {
        apiError = ApiError.notFound('路由未找到');
      } else {
        // 记录未知错误的详细信息
        logger.error('未捕获的错误', {
          error: error.message,
          stack: error.stack,
          url: request.raw.url,
          method: request.method,
          ip: request.ip
        });

        apiError = new ApiError(
          process.env.NODE_ENV === 'production'
            ? '服务器内部错误'
            : error.message,
          ErrorType.UNKNOWN,
          500
        );
      }
    } else {
      // 处理非 Error 类型的异常
      apiError = new ApiError('未知错误', ErrorType.UNKNOWN, 500);
      logger.error('未知类型错误', { error });
    }

    // 设置响应状态码和内容
    reply.status(apiError.statusCode).send(apiError.toResponse());

    // 如果是4xx错误，作为警告记录，否则作为错误记录
    const logMethod = apiError.statusCode >= 500 ? 'error' : 'warn';
    logger[logMethod]('请求处理错误', {
      error: apiError.message,
      type: apiError.type,
      url: request.raw.url,
      method: request.method,
      ip: request.ip,
      statusCode: apiError.statusCode
    });
  });

} 