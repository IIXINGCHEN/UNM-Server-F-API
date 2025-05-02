import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 解析环境变量中的布尔值
const parseBool = (value?: string): boolean => {
  if (!value) return false;
  return ['true', '1', 'yes'].includes(value.toLowerCase());
};

// 解析环境变量中的数组
const parseArray = (value?: string, defaultValue: string[] = []): string[] => {
  if (!value) return defaultValue;
  return value.split(',').map(item => item.trim());
};

// 解析环境变量中的数字
const parseNumber = (value?: string, defaultValue: number = 0): number => {
  if (!value) return defaultValue;
  const num = parseInt(value, 10);
  return isNaN(num) ? defaultValue : num;
};

// 配置对象
export const config = {
  PORT: parseNumber(process.env.PORT, 5678),
  NODE_ENV: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
  ALLOWED_DOMAIN: process.env.ALLOWED_DOMAIN || '*',
  ENABLE_PROXY: parseBool(process.env.ENABLE_PROXY),
  PROXY_URL: process.env.PROXY_URL,
  ENABLE_MUSIC_API: parseBool(process.env.ENABLE_MUSIC_API),
  MUSIC_API_URL: process.env.MUSIC_API_URL,
  REDIS_URL: process.env.REDIS_URL,
  ENABLE_REDIS_CACHE: parseBool(process.env.ENABLE_REDIS_CACHE),
  ENABLE_FLAC: parseBool(process.env.ENABLE_FLAC),
  SELECT_MAX_BR: parseBool(process.env.SELECT_MAX_BR),
  FOLLOW_SOURCE_ORDER: parseBool(process.env.FOLLOW_SOURCE_ORDER),
  DEFAULT_SOURCES: parseArray(process.env.DEFAULT_SOURCES, ['kugou', 'kuwo', 'migu', 'ytdlp', 'bilibili']),
  COOKIES: {
    NETEASE_COOKIE: process.env.NETEASE_COOKIE,
    JOOX_COOKIE: process.env.JOOX_COOKIE,
    MIGU_COOKIE: process.env.MIGU_COOKIE,
    QQ_COOKIE: process.env.QQ_COOKIE,
  },
  YOUTUBE_KEY: process.env.YOUTUBE_KEY,
  // 缓存配置
  CACHE: {
    MEMORY_CACHE_SIZE: parseNumber(process.env.MEMORY_CACHE_SIZE, 1000),
    MEMORY_CACHE_TTL: parseNumber(process.env.MEMORY_CACHE_TTL, 300), // 默认5分钟
    REDIS_CACHE_TTL: parseNumber(process.env.REDIS_CACHE_TTL, 86400), // 默认1天
    SONG_CACHE_TTL: parseNumber(process.env.SONG_CACHE_TTL, 86400), // 默认1天
    SOURCE_CACHE_TTL: parseNumber(process.env.SOURCE_CACHE_TTL, 3600), // 默认1小时
  },
  // API 认证配置
  ENABLE_API_AUTH: parseBool(process.env.ENABLE_API_AUTH),
  // API 密钥从环境变量加载，逗号分隔
  API_KEYS: parseArray(process.env.API_KEYS, []),
  ENABLE_IP_WHITELIST: parseBool(process.env.ENABLE_IP_WHITELIST),
  IP_WHITELIST: parseArray(process.env.IP_WHITELIST, []),
  // 请求频率限制
  ENABLE_RATE_LIMIT: parseBool(process.env.ENABLE_RATE_LIMIT),
  RATE_LIMIT_MAX: parseNumber(process.env.RATE_LIMIT_MAX, 100),
  RATE_LIMIT_WINDOW: parseNumber(process.env.RATE_LIMIT_WINDOW, 60000), // 默认1分钟
};

// 导出默认配置
export default config;