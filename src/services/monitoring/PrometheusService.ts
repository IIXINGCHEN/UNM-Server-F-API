/**
 * Prometheus 监控服务
 * 提供应用指标收集和导出功能
 */

import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import { FastifyInstance } from 'fastify';
import { config } from '../../config/env';
import logger from '../../utils/logger';

/**
 * Prometheus 监控服务类
 */
class PrometheusService {
  /**
   * Prometheus 注册表
   */
  private registry: Registry;
  
  /**
   * HTTP 请求计数器
   */
  private httpRequestsTotal: Counter;
  
  /**
   * HTTP 请求持续时间直方图
   */
  private httpRequestDurationSeconds: Histogram;
  
  /**
   * 缓存命中计数器
   */
  private cacheHitsTotal: Counter;
  
  /**
   * 缓存未命中计数器
   */
  private cacheMissesTotal: Counter;
  
  /**
   * 内存使用量仪表
   */
  private memoryUsageBytes: Gauge;
  
  /**
   * API 错误计数器
   */
  private apiErrorsTotal: Counter;
  
  /**
   * 构造函数
   */
  constructor() {
    // 创建注册表
    this.registry = new Registry();
    
    // 创建指标
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code']
    });
    
    this.httpRequestDurationSeconds = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
    });
    
    this.cacheHitsTotal = new Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_type']
    });
    
    this.cacheMissesTotal = new Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_type']
    });
    
    this.memoryUsageBytes = new Gauge({
      name: 'memory_usage_bytes',
      help: 'Memory usage in bytes',
      labelNames: ['type']
    });
    
    this.apiErrorsTotal = new Counter({
      name: 'api_errors_total',
      help: 'Total number of API errors',
      labelNames: ['error_type', 'status_code']
    });
    
    // 注册指标
    this.registry.registerMetric(this.httpRequestsTotal);
    this.registry.registerMetric(this.httpRequestDurationSeconds);
    this.registry.registerMetric(this.cacheHitsTotal);
    this.registry.registerMetric(this.cacheMissesTotal);
    this.registry.registerMetric(this.memoryUsageBytes);
    this.registry.registerMetric(this.apiErrorsTotal);
    
    // 收集默认指标
    collectDefaultMetrics({ register: this.registry });
    
    // 定期更新内存使用量
    setInterval(() => this.updateMemoryUsage(), 10000);
    
    logger.info('Prometheus 监控服务已初始化');
  }
  
  /**
   * 更新内存使用量
   */
  private updateMemoryUsage(): void {
    const memoryUsage = process.memoryUsage();
    
    this.memoryUsageBytes.set({ type: 'rss' }, memoryUsage.rss);
    this.memoryUsageBytes.set({ type: 'heapTotal' }, memoryUsage.heapTotal);
    this.memoryUsageBytes.set({ type: 'heapUsed' }, memoryUsage.heapUsed);
    this.memoryUsageBytes.set({ type: 'external' }, memoryUsage.external);
  }
  
  /**
   * 记录 HTTP 请求
   * @param method HTTP 方法
   * @param route 路由路径
   * @param statusCode 状态码
   * @param durationMs 请求持续时间（毫秒）
   */
  recordHttpRequest(method: string, route: string, statusCode: number, durationMs: number): void {
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode });
    this.httpRequestDurationSeconds.observe({ method, route }, durationMs / 1000);
  }
  
  /**
   * 记录缓存命中
   * @param cacheType 缓存类型
   */
  recordCacheHit(cacheType: string): void {
    this.cacheHitsTotal.inc({ cache_type: cacheType });
  }
  
  /**
   * 记录缓存未命中
   * @param cacheType 缓存类型
   */
  recordCacheMiss(cacheType: string): void {
    this.cacheMissesTotal.inc({ cache_type: cacheType });
  }
  
  /**
   * 记录 API 错误
   * @param errorType 错误类型
   * @param statusCode 状态码
   */
  recordApiError(errorType: string, statusCode: number): void {
    this.apiErrorsTotal.inc({ error_type: errorType, status_code: statusCode });
  }
  
  /**
   * 注册 Prometheus 指标路由
   * @param app Fastify 实例
   */
  registerMetricsRoute(app: FastifyInstance): void {
    app.get('/metrics', async (request, reply) => {
      // 检查是否需要认证
      if (config.ENABLE_API_AUTH) {
        const apiKey = request.headers['x-api-key'] || (request.query as any).apiKey;
        
        if (!apiKey) {
          return reply.code(401).send({ error: 'API key required' });
        }
        
        const validApiKeys = config.API_KEYS?.split(',').map(key => key.trim()) || [];
        if (!validApiKeys.includes(String(apiKey))) {
          return reply.code(401).send({ error: 'Invalid API key' });
        }
      }
      
      try {
        reply.header('Content-Type', this.registry.contentType);
        return await this.registry.metrics();
      } catch (error) {
        logger.error('获取指标失败', { error });
        return reply.code(500).send({ error: 'Failed to get metrics' });
      }
    });
    
    logger.info('Prometheus 指标路由已注册: /metrics');
  }
}

// 导出单例实例
export const prometheusService = new PrometheusService();
