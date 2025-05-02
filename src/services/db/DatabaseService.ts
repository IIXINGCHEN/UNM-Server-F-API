/**
 * 数据库服务
 * 提供数据库连接池和查询功能
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../../config/env';
import logger from '../../utils/logger';

/**
 * 数据库查询选项
 */
interface QueryOptions {
  /**
   * 是否使用事务
   */
  useTransaction?: boolean;

  /**
   * 查询超时时间（毫秒）
   */
  timeout?: number;
}

/**
 * 数据库服务类
 */
class DatabaseService {
  /**
   * 数据库连接池
   */
  private pool: Pool | null = null;

  /**
   * 是否已初始化
   */
  private initialized: boolean = false;

  /**
   * 构造函数
   */
  constructor() {
    // 如果配置了数据库URL，则初始化连接池
    if (config.DATABASE_URL) {
      this.initialize();
    }
  }

  /**
   * 初始化数据库连接池
   */
  private initialize(): void {
    if (this.initialized) {
      return;
    }

    try {
      this.pool = new Pool({
        connectionString: config.DATABASE_URL,
        max: config.DATABASE_POOL_SIZE || 10, // 最大连接数
        idleTimeoutMillis: 30000, // 空闲连接超时时间
        connectionTimeoutMillis: 5000, // 连接超时时间
        ssl: config.DATABASE_SSL ? {
          rejectUnauthorized: false // 生产环境应设置为true
        } : undefined
      });

      // 监听连接池事件
      this.pool.on('connect', () => {
        logger.debug('数据库连接已创建');
      });

      this.pool.on('error', (err) => {
        logger.error('数据库连接池错误', { error: err.message });
      });

      this.initialized = true;
      logger.info('数据库连接池已初始化', {
        poolSize: config.DATABASE_POOL_SIZE || 10
      });
    } catch (error) {
      logger.error('初始化数据库连接池失败', { error });
      throw error;
    }
  }

  /**
   * 获取数据库连接
   * @returns 数据库连接
   */
  private async getConnection(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('数据库连接池未初始化');
    }

    try {
      return await this.pool.connect();
    } catch (error) {
      logger.error('获取数据库连接失败', { error });
      throw error;
    }
  }

  /**
   * 执行查询
   * @param text SQL查询文本
   * @param params 查询参数
   * @param options 查询选项
   * @returns 查询结果
   */
  async query<T extends QueryResultRow = any>(text: string, params: any[] = [], options: QueryOptions = {}): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('数据库连接池未初始化');
    }

    const startTime = Date.now();
    let client: PoolClient | null = null;

    try {
      if (options.useTransaction) {
        // 使用事务
        client = await this.getConnection();
        await client.query('BEGIN');

        const result = await client.query<T>(text, params);

        await client.query('COMMIT');
        return result;
      } else {
        // 不使用事务，直接从连接池执行查询
        return await this.pool.query<T>(text, params);
      }
    } catch (error) {
      // 如果使用事务且发生错误，回滚事务
      if (client && options.useTransaction) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          logger.error('事务回滚失败', { error: rollbackError });
        }
      }

      logger.error('数据库查询失败', {
        query: text,
        params,
        error
      });

      throw error;
    } finally {
      // 释放客户端连接
      if (client) {
        client.release();
      }

      const duration = Date.now() - startTime;
      logger.debug('数据库查询完成', {
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: `${duration}ms`
      });
    }
  }

  /**
   * 执行事务
   * @param callback 事务回调函数
   * @returns 事务结果
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) {
      throw new Error('数据库连接池未初始化');
    }

    const client = await this.getConnection();

    try {
      await client.query('BEGIN');

      const result = await callback(client);

      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        logger.error('事务回滚失败', { error: rollbackError });
      }

      logger.error('事务执行失败', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 关闭数据库连接池
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.initialized = false;
      logger.info('数据库连接池已关闭');
    }
  }
}

// 导出单例实例
export const databaseService = new DatabaseService();
