/**
 * 统一安全检查工具
 * 提供全面的安全配置检查和验证功能
 */

import fs from 'fs';
import path from 'path';
import { config } from '../config/env';
import logger from './logger';

/**
 * 安全检查项严重程度
 */
export enum SecuritySeverity {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

/**
 * 安全检查项接口
 */
export interface SecurityCheck {
  /**
   * 检查项名称
   */
  name: string;

  /**
   * 检查函数
   * @returns 是否通过检查
   */
  check: () => boolean;

  /**
   * 检查失败时的消息
   */
  message: string;

  /**
   * 严重程度
   */
  severity: SecuritySeverity;

  /**
   * 修复建议
   */
  remediation: string;
}

/**
 * 安全检查结果接口
 */
export interface SecurityCheckResult {
  /**
   * 通过的检查项数量
   */
  passedChecks: number;

  /**
   * 检查项总数
   */
  totalChecks: number;

  /**
   * 高风险问题数量
   */
  highSeverityIssues: number;

  /**
   * 中风险问题数量
   */
  mediumSeverityIssues: number;

  /**
   * 低风险问题数量
   */
  lowSeverityIssues: number;

  /**
   * 警告消息列表
   */
  warnings: string[];

  /**
   * 修复建议列表
   */
  remediations: string[];
}

/**
 * 安全检查器类
 */
export class SecurityChecker {
  /**
   * 安全检查项列表
   */
  private securityChecks: SecurityCheck[] = [
    {
      name: 'API认证',
      check: () => config.ENABLE_API_AUTH,
      message: '未启用API认证 (ENABLE_API_AUTH=true)',
      severity: SecuritySeverity.HIGH,
      remediation: '在配置中设置 ENABLE_API_AUTH=true'
    },
    {
      name: 'API密钥',
      check: () => Boolean(config.API_KEYS && config.API_KEYS.length > 0),
      message: '未配置API密钥 (API_KEYS)',
      severity: SecuritySeverity.HIGH,
      remediation: '生成并配置API密钥'
    },
    {
      name: 'API密钥强度',
      check: () => {
        if (!config.API_KEYS) return false;
        const keys = config.API_KEYS.split(',');
        return keys.every(key => key.trim().length >= 16);
      },
      message: 'API密钥长度不足16个字符，安全性较低',
      severity: SecuritySeverity.MEDIUM,
      remediation: '使用至少16个字符的随机API密钥'
    },
    {
      name: '请求频率限制',
      check: () => config.ENABLE_RATE_LIMIT,
      message: '未启用请求频率限制 (ENABLE_RATE_LIMIT=true)',
      severity: SecuritySeverity.MEDIUM,
      remediation: '在配置中设置 ENABLE_RATE_LIMIT=true'
    },
    {
      name: 'CORS配置',
      check: () => Boolean(config.CORS_ORIGIN && config.CORS_ORIGIN !== '*'),
      message: 'CORS配置允许所有域访问 (CORS_ORIGIN=*)',
      severity: SecuritySeverity.MEDIUM,
      remediation: '限制CORS访问域名，例如 CORS_ORIGIN=your-domain.com'
    },
    {
      name: '文档访问',
      check: () => config.NODE_ENV === 'production' ? !config.ENABLE_DOCS : true,
      message: '生产环境中启用了API文档 (ENABLE_DOCS=true)',
      severity: SecuritySeverity.LOW,
      remediation: '在生产环境中设置 ENABLE_DOCS=false'
    },
    {
      name: '日志级别',
      check: () => config.NODE_ENV === 'production' ?
        (config.LOG_LEVEL === 'warn' || config.LOG_LEVEL === 'error') : true,
      message: '生产环境中日志级别过低，可能记录敏感信息',
      severity: SecuritySeverity.LOW,
      remediation: '在生产环境中设置 LOG_LEVEL=warn 或 LOG_LEVEL=error'
    },
    {
      name: '会话密钥',
      check: () => {
        if (!config.SESSION_SECRET) return false;
        return config.SESSION_SECRET !== 'a-very-secure-secret-for-session-please-change-in-production';
      },
      message: '使用了默认的会话密钥，存在安全风险',
      severity: SecuritySeverity.HIGH,
      remediation: '生成并设置一个强随机会话密钥'
    },
    {
      name: 'Redis安全',
      check: () => {
        if (!config.ENABLE_REDIS_CACHE || !config.REDIS_URL) return true;
        // 检查Redis URL是否包含密码
        try {
          const url = new URL(config.REDIS_URL);
          return url.password.length > 0;
        } catch (error) {
          return false;
        }
      },
      message: 'Redis连接未使用密码保护',
      severity: SecuritySeverity.MEDIUM,
      remediation: '为Redis连接配置密码'
    }
  ];

  /**
   * 执行安全检查
   * @param isProd 是否在生产环境中执行严格检查
   * @returns 安全检查结果
   */
  public checkSecurity(isProd: boolean = config.NODE_ENV === 'production'): SecurityCheckResult {
    const result: SecurityCheckResult = {
      passedChecks: 0,
      totalChecks: this.securityChecks.length,
      highSeverityIssues: 0,
      mediumSeverityIssues: 0,
      lowSeverityIssues: 0,
      warnings: [],
      remediations: []
    };

    // 执行所有检查
    this.securityChecks.forEach(check => {
      // 在非生产环境中，只执行高风险检查
      if (!isProd && check.severity !== SecuritySeverity.HIGH) {
        result.passedChecks++;
        return;
      }

      const passed = check.check();

      if (passed) {
        result.passedChecks++;
      } else {
        // 根据严重程度记录问题
        switch (check.severity) {
          case SecuritySeverity.HIGH:
            result.highSeverityIssues++;
            result.warnings.push(`⚠️ 高风险: ${check.name} - ${check.message}`);
            break;
          case SecuritySeverity.MEDIUM:
            result.mediumSeverityIssues++;
            result.warnings.push(`⚠️ 中风险: ${check.name} - ${check.message}`);
            break;
          case SecuritySeverity.LOW:
            result.lowSeverityIssues++;
            result.warnings.push(`⚠️ 低风险: ${check.name} - ${check.message}`);
            break;
        }

        // 记录修复建议
        result.remediations.push(`${check.name}: ${check.remediation}`);
      }
    });

    return result;
  }

  /**
   * 检查文件权限
   * @returns 文件权限检查结果
   */
  public checkFilePermissions(): { warnings: string[] } {
    const warnings: string[] = [];

    // 在Windows环境中，文件权限检查不太相关
    if (process.platform === 'win32') {
      return { warnings };
    }

    // 检查.env文件权限
    const envPath = path.resolve(process.cwd(), '.env');

    if (fs.existsSync(envPath)) {
      try {
        const stats = fs.statSync(envPath);
        const mode = stats.mode.toString(8);
        const permissions = mode.substring(mode.length - 3);

        if (permissions !== '600' && permissions !== '400') {
          warnings.push(`⚠️ .env文件权限过于宽松: ${permissions}，建议设置更严格的权限: chmod 600 .env`);
        }
      } catch (error) {
        warnings.push(`⚠️ 检查.env文件权限时出错: ${(error as Error).message}`);
      }
    }

    return { warnings };
  }

  /**
   * 执行全面安全检查并输出结果
   * @param isProd 是否在生产环境中执行严格检查
   */
  public performSecurityCheck(isProd: boolean = config.NODE_ENV === 'production'): void {
    // 执行安全配置检查
    const securityResult = this.checkSecurity(isProd);

    // 执行文件权限检查
    const permissionsResult = this.checkFilePermissions();

    // 合并警告
    const allWarnings = [...securityResult.warnings, ...permissionsResult.warnings];

    // 输出结果
    if (allWarnings.length > 0) {
      logger.warn('检测到安全配置问题:');
      allWarnings.forEach(warning => {
        logger.warn(warning);
      });

      // 输出修复建议
      if (securityResult.remediations.length > 0) {
        logger.info('修复建议:');
        securityResult.remediations.forEach((remediation, index) => {
          logger.info(`${index + 1}. ${remediation}`);
        });
      }

      // 在生产环境中，如果有严重安全问题，可以考虑退出应用
      if (isProd && securityResult.highSeverityIssues > 0) {
        logger.error(`检测到 ${securityResult.highSeverityIssues} 个严重安全问题，请修复后再部署到生产环境`);
        // 如果需要强制退出，取消下面的注释
        // process.exit(1);
      }
    } else {
      logger.info('安全配置检查通过');
    }

    // 输出安全检查统计
    logger.info(`安全检查统计: 通过 ${securityResult.passedChecks}/${securityResult.totalChecks}, ` +
      `高风险 ${securityResult.highSeverityIssues}, ` +
      `中风险 ${securityResult.mediumSeverityIssues}, ` +
      `低风险 ${securityResult.lowSeverityIssues}`);
  }
}

// 导出单例实例
export const securityChecker = new SecurityChecker();

/**
 * 执行安全配置检查并输出警告
 * 兼容旧的API
 */
export function performSecurityCheck(): void {
  securityChecker.performSecurityCheck();
}

/**
 * 检查安全配置
 * 兼容旧的API
 * @returns 安全检查结果，包含警告信息
 */
export function checkSecurityConfig(): { warnings: string[] } {
  const result = securityChecker.checkSecurity();
  return { warnings: result.warnings };
}

export default {
  securityChecker,
  performSecurityCheck,
  checkSecurityConfig
};
