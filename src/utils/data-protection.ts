/**
 * 数据保护工具
 * 用于处理敏感数据的加密、掩码和安全存储
 */

import * as crypto from 'crypto';
import { config } from '../config';

/**
 * 对敏感字符串进行掩码处理
 * @param value 需要掩码的字符串
 * @param visibleStartChars 开头可见字符数
 * @param visibleEndChars 结尾可见字符数
 * @returns 掩码后的字符串
 */
export function maskSensitiveData(
  value: string,
  visibleStartChars: number = 4,
  visibleEndChars: number = 4
): string {
  if (!value) return '';

  // 短字符串特殊处理
  if (value.length <= visibleStartChars + visibleEndChars) {
    return '*'.repeat(value.length);
  }

  const start = value.substring(0, visibleStartChars);
  const end = value.substring(value.length - visibleEndChars);
  const masked = '*'.repeat(Math.min(10, value.length - (visibleStartChars + visibleEndChars)));

  return `${start}${masked}${end}`;
}

/**
 * 对API密钥进行掩码处理
 * @param apiKey API密钥
 * @returns 掩码后的API密钥
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey) return '';

  // 根据密钥长度决定掩码策略
  if (apiKey.length > 32) {
    // 长密钥: 显示前2和后2字符
    return maskSensitiveData(apiKey, 2, 2);
  } else if (apiKey.length >= 8) {
    // 中等长度密钥: 显示前3和后3字符
    return maskSensitiveData(apiKey, 3, 3);
  } else {
    // 短密钥: 全部掩码
    return '*'.repeat(apiKey.length);
  }
}

/**
 * 对URL进行掩码处理
 * @param url URL字符串
 * @returns 掩码后的URL
 */
export function maskUrl(url: string): string {
  if (!url) return '';

  try {
    const urlObj = new URL(url);

    // 掩码处理查询参数
    if (urlObj.search) {
      // 替换查询参数值为掩码
      const searchParams = new URLSearchParams(urlObj.search);
      for (const [key, value] of searchParams.entries()) {
        if (
          key.toLowerCase().includes('key') ||
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('auth')
        ) {
          searchParams.set(key, '********');
        }
      }
      urlObj.search = searchParams.toString();
    }

    // 掩码处理认证信息
    if (urlObj.username || urlObj.password) {
      urlObj.username = urlObj.username ? maskSensitiveData(urlObj.username, 1, 0) : '';
      urlObj.password = urlObj.password ? '********' : '';
    }

    return urlObj.toString();
  } catch (e) {
    // 如果URL解析失败，返回原始URL的掩码版本
    return maskSensitiveData(url, 10, 0);
  }
}

/**
 * 对敏感配置信息进行掩码处理
 * @param key 配置键名
 * @param value 配置值
 * @returns 掩码后的配置值
 */
export function maskConfigValue(key: string, value: any): string {
  if (value === undefined || value === null) return '';

  const strValue = String(value);

  // 敏感配置项列表
  const sensitiveKeys = [
    'api_key', 'apikey', 'secret', 'password', 'token', 'auth',
    'cookie', 'credential', 'redis_url', 'database', 'connection'
  ];

  // 检查键名是否包含敏感词
  const isSensitive = sensitiveKeys.some(k =>
    key.toLowerCase().includes(k.toLowerCase())
  );

  if (isSensitive) {
    if (strValue.startsWith('http')) {
      return maskUrl(strValue);
    } else {
      return maskSensitiveData(strValue);
    }
  }

  return strValue;
}

/**
 * 生成安全的随机API密钥
 * @param length 密钥长度，默认32
 * @returns 随机生成的API密钥
 */
export function generateSecureApiKey(length: number = 32): string {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

/**
 * 安全地比较两个字符串（防止时序攻击）
 * @param a 第一个字符串
 * @param b 第二个字符串
 * @returns 是否相等
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(a, 'utf8'),
    Buffer.from(b, 'utf8')
  );
}

export default {
  maskSensitiveData,
  maskApiKey,
  maskUrl,
  maskConfigValue,
  generateSecureApiKey,
  secureCompare
};
