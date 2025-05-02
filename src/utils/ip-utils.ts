/**
 * IP 地址工具函数
 */

/**
 * 检查 IP 地址是否有效
 * @param ip IP 地址
 * @returns 是否有效
 */
export function isValidIp(ip: string): boolean {
  // IPv4 正则表达式
  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  // IPv6 正则表达式 (简化版)
  const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::$|^::1$|^([0-9a-fA-F]{1,4}:){1,7}:|^:([0-9a-fA-F]{1,4}:){1,7}$|^fe80:/i;

  // 检查 IPv4
  if (ipv4Pattern.test(ip)) {
    const parts = ip.split('.').map(part => parseInt(part, 10));
    return parts.every(part => part >= 0 && part <= 255);
  }

  // 检查 IPv6
  return ipv6Pattern.test(ip);
}

/**
 * 检查 IP 是否匹配通配符模式
 * @param ip 要检查的 IP
 * @param pattern 通配符模式 (如 192.168.1.*)
 * @returns 是否匹配
 */
export function ipMatchesWildcard(ip: string, pattern: string): boolean {
  if (!pattern.includes('*')) {
    return ip === pattern;
  }

  // 只处理 IPv4 通配符
  if (!ip.includes('.')) {
    return false; // IPv6 不支持简单通配符匹配
  }

  const ipParts = ip.split('.');
  const patternParts = pattern.split('.');

  // 确保部分数量相同
  if (ipParts.length !== 4 || patternParts.length !== 4) {
    return false;
  }

  // 逐部分比较
  for (let i = 0; i < 4; i++) {
    if (patternParts[i] === '*') {
      continue; // 通配符匹配任何值
    }
    if (ipParts[i] !== patternParts[i]) {
      return false;
    }
  }

  return true;
}

/**
 * 检查 IP 是否在 CIDR 范围内
 * @param ip 要检查的 IP
 * @param cidr CIDR 表示法 (如 192.168.1.0/24)
 * @returns 是否在范围内
 */
export function ipInCidrRange(ip: string, cidr: string): boolean {
  // 只处理 IPv4 CIDR
  if (!ip.includes('.') || !cidr.includes('/')) {
    return false;
  }

  try {
    const [range, bits = '32'] = cidr.split('/');
    const mask = parseInt(bits, 10);
    
    if (isNaN(mask) || mask < 0 || mask > 32) {
      return false;
    }

    // 将 IP 转换为数字
    const ipNum = ipToLong(ip);
    const rangeNum = ipToLong(range);
    
    // 创建掩码
    const maskBits = 0xffffffff << (32 - mask);
    
    // 比较网络地址
    return (ipNum & maskBits) === (rangeNum & maskBits);
  } catch (e) {
    return false;
  }
}

/**
 * 将 IPv4 地址转换为长整数
 * @param ip IPv4 地址
 * @returns 长整数表示
 */
function ipToLong(ip: string): number {
  const parts = ip.split('.');
  return ((parseInt(parts[0], 10) << 24) |
          (parseInt(parts[1], 10) << 16) |
          (parseInt(parts[2], 10) << 8) |
          parseInt(parts[3], 10)) >>> 0;
}

/**
 * 获取请求的真实 IP 地址
 * @param request 请求对象
 * @returns 真实 IP 地址
 */
export function getRealIp(request: any): string {
  // 尝试从各种头部获取 IP
  const forwardedFor = request.headers['x-forwarded-for'];
  if (forwardedFor) {
    // 取第一个 IP (最初的客户端)
    const ips = forwardedFor.split(',').map((ip: string) => ip.trim());
    return ips[0];
  }

  // 尝试其他常见头部
  const realIp = request.headers['x-real-ip'];
  if (realIp) {
    return realIp;
  }

  // 回退到请求的直接 IP
  return request.ip || '0.0.0.0';
}

export default {
  isValidIp,
  ipMatchesWildcard,
  ipInCidrRange,
  getRealIp
};
