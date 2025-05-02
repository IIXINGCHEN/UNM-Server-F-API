/**
 * 安全日志记录器
 * 用于记录安全相关事件，如认证失败、可疑活动等
 */

import fs from 'fs';
import path from 'path';
import { config } from '../config/env';
import logger from './logger';

/**
 * 安全日志级别
 */
export enum SecurityLogLevel {
  INFO = 'info',
  WARN = 'warn',
  ALERT = 'alert',
  CRITICAL = 'critical'
}

/**
 * 安全事件类型
 */
export enum SecurityEventType {
  AUTH_SUCCESS = 'auth_success',
  AUTH_FAILURE = 'auth_failure',
  RATE_LIMIT = 'rate_limit',
  IP_BLOCKED = 'ip_blocked',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  CONFIG_CHANGE = 'config_change'
}

/**
 * 安全日志条目
 */
interface SecurityLogEntry {
  timestamp: string;
  level: SecurityLogLevel;
  event_type: SecurityEventType;
  message: string;
  source_ip?: string;
  request_id?: string;
  request_path?: string;
  request_method?: string;
  user_agent?: string;
  metadata?: any;
}

/**
 * 安全日志记录器
 */
class SecurityLogger {
  private logFile: string;
  private logDir: string;
  private maxLogSize: number = 10 * 1024 * 1024; // 10MB
  private maxLogFiles: number = 5;

  constructor() {
    this.logDir = config.LOG_DIR || path.resolve(process.cwd(), 'logs');
    this.logFile = path.join(this.logDir, 'security.log');

    // 检查是否在 Vercel 环境中运行
    const isVercel = process.env.VERCEL === '1';

    // 仅在非 Vercel 环境中创建日志目录
    if (!isVercel && !fs.existsSync(this.logDir)) {
      try {
        fs.mkdirSync(this.logDir, { recursive: true });
      } catch (error) {
        console.warn('无法创建日志目录:', error);
      }
    }
  }

  /**
   * 记录安全事件
   */
  public log(
    level: SecurityLogLevel,
    eventType: SecurityEventType,
    message: string,
    metadata?: any
  ): void {
    const entry: SecurityLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event_type: eventType,
      message,
      ...metadata
    };

    // 控制台输出
    this.logToConsole(entry);

    // 文件记录
    this.logToFile(entry);

    // 对于高级别事件，可以触发告警
    if (level === SecurityLogLevel.ALERT || level === SecurityLogLevel.CRITICAL) {
      this.triggerAlert(entry);
    }
  }

  /**
   * 控制台输出
   */
  private logToConsole(entry: SecurityLogEntry): void {
    const prefix = `[SECURITY:${entry.event_type}]`;
    const message = `${entry.timestamp} ${prefix} ${entry.message}`;

    switch (entry.level) {
      case SecurityLogLevel.CRITICAL:
      case SecurityLogLevel.ALERT:
        console.error(message);
        break;
      case SecurityLogLevel.WARN:
        console.warn(message);
        break;
      case SecurityLogLevel.INFO:
        console.info(message);
        break;
    }
  }

  /**
   * 文件记录
   */
  private logToFile(entry: SecurityLogEntry): void {
    // 检查是否在 Vercel 环境中运行
    const isVercel = process.env.VERCEL === '1';

    // 在 Vercel 环境中不写入文件
    if (isVercel) {
      return;
    }

    try {
      // 检查日志文件大小
      this.rotateLogIfNeeded();

      // 写入日志
      const logLine = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      console.error('写入安全日志失败:', error);
    }
  }

  /**
   * 日志轮转
   */
  private rotateLogIfNeeded(): void {
    // 检查是否在 Vercel 环境中运行
    const isVercel = process.env.VERCEL === '1';

    // 在 Vercel 环境中不执行日志轮转
    if (isVercel) {
      return;
    }

    try {
      if (fs.existsSync(this.logFile)) {
        const stats = fs.statSync(this.logFile);
        if (stats.size >= this.maxLogSize) {
          // 轮转日志文件
          for (let i = this.maxLogFiles - 1; i > 0; i--) {
            const oldFile = `${this.logFile}.${i}`;
            const newFile = `${this.logFile}.${i + 1}`;

            if (fs.existsSync(oldFile)) {
              fs.renameSync(oldFile, newFile);
            }
          }

          // 重命名当前日志文件
          fs.renameSync(this.logFile, `${this.logFile}.1`);

          // 创建新的日志文件
          fs.writeFileSync(this.logFile, '');
        }
      }
    } catch (error) {
      console.error('轮转安全日志失败:', error);
    }
  }

  /**
   * 触发告警
   */
  private triggerAlert(entry: SecurityLogEntry): void {
    // 记录到标准日志
    logger.error(`[安全告警] ${entry.level.toUpperCase()}: ${entry.message}`, {
      event_type: entry.event_type,
      source_ip: entry.source_ip,
      request_path: entry.request_path,
      metadata: entry.metadata
    });

    // 这里可以添加发送告警的代码
    // 例如: sendEmail, sendWebhook, sendSMS等
  }

  /**
   * 记录认证成功事件
   */
  public logAuthSuccess(message: string, metadata?: any): void {
    this.log(SecurityLogLevel.INFO, SecurityEventType.AUTH_SUCCESS, message, metadata);
  }

  /**
   * 记录认证失败事件
   */
  public logAuthFailure(message: string, metadata?: any): void {
    this.log(SecurityLogLevel.WARN, SecurityEventType.AUTH_FAILURE, message, metadata);
  }

  /**
   * 记录请求频率限制事件
   */
  public logRateLimit(message: string, metadata?: any): void {
    this.log(SecurityLogLevel.WARN, SecurityEventType.RATE_LIMIT, message, metadata);
  }

  /**
   * 记录IP阻止事件
   */
  public logIpBlocked(message: string, metadata?: any): void {
    this.log(SecurityLogLevel.WARN, SecurityEventType.IP_BLOCKED, message, metadata);
  }

  /**
   * 记录可疑活动事件
   */
  public logSuspiciousActivity(message: string, metadata?: any): void {
    this.log(SecurityLogLevel.ALERT, SecurityEventType.SUSPICIOUS_ACTIVITY, message, metadata);
  }

  /**
   * 记录配置变更事件
   */
  public logConfigChange(message: string, metadata?: any): void {
    this.log(SecurityLogLevel.INFO, SecurityEventType.CONFIG_CHANGE, message, metadata);
  }
}

// 导出单例
export const securityLogger = new SecurityLogger();
