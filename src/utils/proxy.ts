import { config } from '../config/env';

/**
 * 生成代理URL的辅助函数
 * @param originalUrl 原始URL
 * @returns 代理URL或null
 */
export function generateProxyUrl(originalUrl: string): string | null {
  // 检查是否启用代理和代理URL是否存在
  if (!originalUrl || !config.ENABLE_PROXY || !config.PROXY_URL) return null;
  
  // 目前仅对酷我音乐链接进行代理
  if (originalUrl.includes("kuwo")) {
    return config.PROXY_URL + originalUrl.replace(/^http:\/\//, "http/");
  }
  
  return null;
} 