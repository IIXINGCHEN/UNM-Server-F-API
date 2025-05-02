/**
 * 自定义错误类型
 */
export enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND_ERROR',
  API = 'API_ERROR',
  RATE_LIMIT = 'RATE_LIMIT_ERROR',
  TIMEOUT = 'TIMEOUT_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR'
}

/**
 * 自定义API错误类
 */
export class ApiError extends Error {
  public readonly type: ErrorType;
  public readonly statusCode: number;
  public readonly data?: any;

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    statusCode: number = 500,
    data?: any
  ) {
    super(message);
    this.name = 'ApiError';
    this.type = type;
    this.statusCode = statusCode;
    this.data = data;

    // 确保instanceof正常工作
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  /**
   * 创建验证错误
   */
  static validation(message: string, data?: any): ApiError {
    return new ApiError(message, ErrorType.VALIDATION, 400, data);
  }

  /**
   * 创建资源未找到错误
   */
  static notFound(message: string = '请求的资源不存在', data?: any): ApiError {
    return new ApiError(message, ErrorType.NOT_FOUND, 404, data);
  }

  /**
   * 创建API调用错误
   */
  static api(message: string, data?: any): ApiError {
    return new ApiError(message, ErrorType.API, 500, data);
  }

  /**
   * 创建请求超时错误
   */
  static timeout(message: string = '请求超时', data?: any): ApiError {
    return new ApiError(message, ErrorType.TIMEOUT, 504, data);
  }

  /**
   * 创建速率限制错误
   */
  static rateLimit(message: string = '请求过于频繁，请稍后再试', data?: any): ApiError {
    return new ApiError(message, ErrorType.RATE_LIMIT, 429, data);
  }

  /**
   * 格式化为API响应对象
   */
  toResponse() {
    const response: Record<string, any> = {
      code: this.statusCode,
      message: this.message,
      error: this.type
    };

    // 移除敏感信息，永远不要返回堆栈信息
    return response;
  }
}

/**
 * 根据 HTTP 状态码获取 Fastify 默认的错误描述字符串。
 * @param statusCode HTTP 状态码
 * @returns Fastify 默认的错误字符串，如果未匹配则返回 'Internal Server Error'
 */
export function getFastifyErrorString(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'Bad Request';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Not Found';
    case 409:
      return 'Conflict';
    case 429:
      return 'Too Many Requests';
    case 500:
      return 'Internal Server Error';
    case 502:
      return 'Bad Gateway';
    case 503:
      return 'Service Unavailable';
    case 504:
      return 'Gateway Timeout';
    default:
      // 对于其他 4xx 和 5xx 错误，Fastify 可能没有特定字符串，
      // 但返回 'Internal Server Error' 作为通用错误描述是安全的。
      return 'Internal Server Error';
  }
} 