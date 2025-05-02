/**
 * 安全配置检查工具
 * 用于在应用启动时验证安全配置，并在生产环境中提供警告
 */

import logger from './logger';
import { config } from '../config/env';

/**
 * 检查安全配置
 * @returns 安全检查结果，包含警告信息
 */
export function checkSecurityConfig(): { warnings: string[] } {
  const warnings: string[] = [];
  const isProd = config.NODE_ENV === 'production';

  // 仅在生产环境中进行严格检查
  if (isProd) {
    // 检查API认证
    if (!config.ENABLE_API_AUTH) {
      warnings.push('⚠️ 警告: 生产环境中API认证被禁用，这可能导致未授权访问');
    }

    // 检查API密钥
    if (config.ENABLE_API_AUTH && (!config.API_KEYS || config.API_KEYS.length === 0)) {
      warnings.push('⚠️ 警告: API认证已启用，但未配置API密钥');
    }

    // 检查CORS配置
    if (config.CORS_ORIGIN === '*') {
      warnings.push('⚠️ 警告: CORS配置允许所有域访问，建议限制为特定域名');
    }

    // 检查速率限制
    if (!config.ENABLE_RATE_LIMIT) {
      warnings.push('⚠️ 警告: 请求频率限制被禁用，这可能导致服务被滥用');
    }

    // 检查文档是否启用
    if (config.ENABLE_DOCS) {
      warnings.push('⚠️ 警告: API文档在生产环境中启用，建议在生产环境中禁用');
    }

    // 检查日志级别
    if (config.LOG_LEVEL === 'debug' || config.LOG_LEVEL === 'trace') {
      warnings.push(`⚠️ 警告: 日志级别设置为 ${config.LOG_LEVEL}，可能会记录敏感信息`);
    }
  }

  return { warnings };
}

/**
 * 执行安全配置检查并输出警告
 */
export function performSecurityCheck(): void {
  const { warnings } = checkSecurityConfig();

  if (warnings.length > 0) {
    logger.warn('检测到安全配置问题:');
    warnings.forEach(warning => {
      logger.warn(warning);
    });

    // 在生产环境中，如果有严重安全问题，可以考虑退出应用
    // if (config.NODE_ENV === 'production' && warnings.some(w => w.includes('严重'))) {
    //   logger.error('检测到严重安全问题，应用将退出');
    //   process.exit(1);
    // }
  } else {
    logger.info('安全配置检查通过');
  }
}

export default {
  checkSecurityConfig,
  performSecurityCheck
};
