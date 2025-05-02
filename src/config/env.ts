import * as path from 'path';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// 确定环境
const nodeEnv = process.env.NODE_ENV || 'development';

// 加载环境特定的.env文件
const envFile = nodeEnv === 'production' ? '.env.production' : '.env';
const envPath = path.resolve(process.cwd(), envFile);

// 首先尝试加载环境特定的文件，如果不存在则加载默认的.env
if (fs.existsSync(envPath)) {
  console.log(`加载环境配置文件: ${envFile}`);
  dotenv.config({ path: envPath });
} else {
  console.log('未找到环境特定的配置文件，尝试加载默认.env文件');
  dotenv.config();
}

/**
 * 缓存配置接口
 */
export interface CacheConfig {
  MEMORY_CACHE_SIZE: number;
  MEMORY_CACHE_TTL: number;
  REDIS_CACHE_TTL: number;
  SONG_CACHE_TTL: number;
  SOURCE_CACHE_TTL: number;
}

/**
 * 环境配置接口
 */
export interface EnvironmentConfig {
  // 基础设置
  PORT: number;
  HOST: string;
  BASE_URL: string;
  NODE_ENV: 'development' | 'production' | 'test';
  ALLOWED_DOMAIN?: string;

  // 代理设置
  ENABLE_PROXY: boolean;
  HTTP_PROXY?: string;
  HTTPS_PROXY?: string;
  PROXY_URL?: string;

  // 缓存设置
  CACHE: CacheConfig;
  CACHE_ENABLED: boolean;
  CACHE_TTL: number;
  CACHE_MAX_SIZE: number;
  CACHE_MAXAGE?: number;

  // 音乐服务设置
  ENABLE_MUSIC_API: boolean;
  MUSIC_API_URL?: string;
  ENABLE_FLAC: boolean;
  SELECT_MAX_BR: boolean;
  FOLLOW_SOURCE_ORDER: boolean;
  MAX_SONG_SEARCH_RESULTS: number;
  SOURCE_PRIORITY: string;

  // Redis设置
  REDIS_URL?: string;
  ENABLE_REDIS_CACHE: boolean;

  // 音乐源设置
  ENABLE_NETEASE: boolean;
  ENABLE_TENCENT: boolean;
  ENABLE_KUGOU: boolean;
  ENABLE_KUWO: boolean;
  ENABLE_BILIBILI: boolean;

  // Cookie设置
  NETEASE_COOKIE?: string;
  JOOX_COOKIE?: string;
  MIGU_COOKIE?: string;
  QQ_COOKIE?: string;
  YOUTUBE_KEY?: string;

  // 视频服务设置
  ENABLE_VIDEO_API: boolean;

  // 短信服务设置
  ENABLE_SMS_API: boolean;

  // 加密文件服务设置
  ENABLE_FILE_API: boolean;

  // 日志设置
  LOG_LEVEL: string;
  LOG_TO_FILE: boolean;
  LOG_DIR: string;

  // 安全设置
  ENABLE_API_AUTH: boolean;
  API_KEYS: string;
  ENABLE_IP_WHITELIST: boolean;
  IP_WHITELIST: string;
  TRUST_PROXY: boolean;

  // 请求设置
  REQUEST_TIMEOUT: number;
  SEARCH_TIMEOUT: number;

  // 文档设置
  ENABLE_DOCS: boolean;

  // CORS设置
  CORS_ORIGIN: string;

  // 会话设置
  SESSION_SECRET?: string;

  // 限流设置
  ENABLE_RATE_LIMIT: boolean;
  RATE_LIMIT_MAX: number;
  RATE_LIMIT_WINDOW: number;

  // 高级设置
  USER_AGENT: string;
  MAX_WORKERS: number;

  // 新添加的安全配置
  LOGGER: {
    LEVEL: string;
    FORMAT: string;
  };

  // 数据库配置
  DATABASE_URL?: string;
  DATABASE_POOL_SIZE: number;
  DATABASE_SSL: boolean;
}

// 默认配置
const defaultConfig = {
  PORT: 5678,
  NODE_ENV: 'development',
  ENABLE_PROXY: true,
  ENABLE_MUSIC_API: true,
  ENABLE_FLAC: true,
  SELECT_MAX_BR: true,
  FOLLOW_SOURCE_ORDER: true,
  ENABLE_REDIS_CACHE: false,
  ENABLE_DOCS: true,
  CACHE: {
    MEMORY_CACHE_SIZE: 1000,
    MEMORY_CACHE_TTL: 300,     // 5分钟
    REDIS_CACHE_TTL: 86400,    // 1天
    SONG_CACHE_TTL: 86400,     // 1天
    SOURCE_CACHE_TTL: 3600     // 1小时
  },
  HOST: '0.0.0.0',
  BASE_URL: 'http://localhost:5678',
  // 安全设置 - 开发环境默认值
  ENABLE_API_AUTH: process.env.NODE_ENV === 'production', // 生产环境默认启用API认证
  API_KEYS: '',
  ENABLE_IP_WHITELIST: false,
  IP_WHITELIST: '127.0.0.1', // 默认只允许本地访问，而不是通配符
  TRUST_PROXY: true, // 默认信任代理，获取真实客户端IP
  LOG_LEVEL: process.env.NODE_ENV === 'production' ? 'warn' : 'info', // 生产环境默认warn级别
  LOG_TO_FILE: process.env.NODE_ENV === 'production', // 生产环境默认记录到文件
  LOG_DIR: path.resolve(process.cwd(), 'logs'),
  CACHE_ENABLED: true,
  CACHE_TTL: 7200, // 缓存2小时
  CACHE_MAX_SIZE: 100, // 最多缓存100个项目
  MAX_SONG_SEARCH_RESULTS: 5,
  SEARCH_TIMEOUT: 10000, // 搜索超时10秒
  SOURCE_PRIORITY: 'netease,tencent,kugou,kuwo,migu,bilibili',
  ENABLE_NETEASE: true,
  ENABLE_TENCENT: true,
  ENABLE_KUGOU: true,
  ENABLE_KUWO: true,
  ENABLE_BILIBILI: true,
  REQUEST_TIMEOUT: 15000, // 15秒
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  CORS_ORIGIN: process.env.NODE_ENV === 'production' ? '' : '*', // 生产环境默认不允许所有域
  ENABLE_RATE_LIMIT: process.env.NODE_ENV === 'production', // 生产环境默认启用请求限制
  RATE_LIMIT_MAX: 100, // 100个请求
  RATE_LIMIT_WINDOW: 60 * 1000, // 1分钟窗口
  MAX_WORKERS: 4,
  LOGGER: {
    LEVEL: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    FORMAT: 'pretty'
  },
  SESSION_SECRET: 'a-very-secure-secret-for-session-please-change-in-production',
  // 数据库默认配置
  DATABASE_POOL_SIZE: 10,
  DATABASE_SSL: process.env.NODE_ENV === 'production',
};

// 环境判断
export const isDev = (process.env.NODE_ENV || 'development') !== 'production';

/**
 * 解析布尔值环境变量
 * @param value 环境变量值
 * @param defaultValue 默认值
 * @returns 解析后的布尔值
 */
const parseBool = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
};

/**
 * 解析数字环境变量
 * @param value 环境变量值
 * @param defaultValue 默认值
 * @returns 解析后的数字
 */
const parseNumber = (value: string | undefined, defaultValue: number): number => {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * 验证配置
 * @param config 配置对象
 */
const validateConfig = (config: EnvironmentConfig): void => {
  // 必需的配置项
  const requiredInProduction = [
    { key: 'SESSION_SECRET', value: config.SESSION_SECRET, defaultValue: defaultConfig.SESSION_SECRET },
    { key: 'API_KEYS', value: config.API_KEYS, defaultValue: defaultConfig.API_KEYS },
    { key: 'CORS_ORIGIN', value: config.CORS_ORIGIN, defaultValue: '*' }
  ];

  // 在生产环境中验证必需的配置项
  if (config.NODE_ENV === 'production') {
    for (const item of requiredInProduction) {
      if (!item.value || item.value === item.defaultValue) {
        console.warn(`警告: 生产环境中 ${item.key} 未设置或使用了默认值，这可能存在安全风险`);
      }
    }
  }

  // 验证端口范围
  if (config.PORT < 0 || config.PORT > 65535) {
    console.warn(`警告: 端口号 ${config.PORT} 超出有效范围 (0-65535)，将使用默认端口 ${defaultConfig.PORT}`);
    config.PORT = defaultConfig.PORT;
  }

  // 验证超时设置
  if (config.REQUEST_TIMEOUT < 1000) {
    console.warn(`警告: 请求超时时间 ${config.REQUEST_TIMEOUT}ms 过短，将使用最小值 1000ms`);
    config.REQUEST_TIMEOUT = 1000;
  }

  // 验证缓存设置
  if (config.CACHE.MEMORY_CACHE_SIZE < 10) {
    console.warn(`警告: 内存缓存大小 ${config.CACHE.MEMORY_CACHE_SIZE} 过小，将使用最小值 10`);
    config.CACHE.MEMORY_CACHE_SIZE = 10;
  }

  // 验证速率限制设置
  if (config.RATE_LIMIT_MAX < 10) {
    console.warn(`警告: 速率限制最大请求数 ${config.RATE_LIMIT_MAX} 过小，将使用最小值 10`);
    config.RATE_LIMIT_MAX = 10;
  }

  if (config.RATE_LIMIT_WINDOW < 1000) {
    console.warn(`警告: 速率限制时间窗口 ${config.RATE_LIMIT_WINDOW}ms 过短，将使用最小值 1000ms`);
    config.RATE_LIMIT_WINDOW = 1000;
  }

  // 验证日志级别
  const validLogLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLogLevels.includes(config.LOG_LEVEL.toLowerCase())) {
    console.warn(`警告: 日志级别 ${config.LOG_LEVEL} 无效，将使用默认值 ${defaultConfig.LOG_LEVEL}`);
    config.LOG_LEVEL = defaultConfig.LOG_LEVEL;
  }

  // 验证 Redis URL 格式（如果启用了 Redis）
  if (config.ENABLE_REDIS_CACHE && config.REDIS_URL) {
    try {
      // 简单验证 URL 格式
      new URL(config.REDIS_URL);
    } catch (error) {
      console.warn(`警告: Redis URL 格式无效: ${config.REDIS_URL}`);
    }
  }
};

// 从环境变量中读取配置
export const config: EnvironmentConfig = {
  PORT: parseNumber(process.env.PORT, defaultConfig.PORT),
  NODE_ENV: ((process.env.NODE_ENV || defaultConfig.NODE_ENV) as 'development' | 'production' | 'test'),
  ENABLE_PROXY: parseBool(process.env.ENABLE_PROXY, defaultConfig.ENABLE_PROXY),
  HTTP_PROXY: process.env.HTTP_PROXY,
  HTTPS_PROXY: process.env.HTTPS_PROXY,
  PROXY_URL: process.env.PROXY_URL,
  ENABLE_MUSIC_API: parseBool(process.env.ENABLE_MUSIC_API, true),
  MUSIC_API_URL: process.env.MUSIC_API_URL,
  ENABLE_FLAC: parseBool(process.env.ENABLE_FLAC, defaultConfig.ENABLE_FLAC),
  SELECT_MAX_BR: parseBool(process.env.SELECT_MAX_BR, defaultConfig.SELECT_MAX_BR),
  FOLLOW_SOURCE_ORDER: parseBool(process.env.FOLLOW_SOURCE_ORDER, defaultConfig.FOLLOW_SOURCE_ORDER),
  REDIS_URL: process.env.REDIS_URL,
  ENABLE_REDIS_CACHE: parseBool(process.env.ENABLE_REDIS_CACHE, defaultConfig.ENABLE_REDIS_CACHE),
  NETEASE_COOKIE: process.env.NETEASE_COOKIE,
  JOOX_COOKIE: process.env.JOOX_COOKIE,
  MIGU_COOKIE: process.env.MIGU_COOKIE,
  QQ_COOKIE: process.env.QQ_COOKIE,
  YOUTUBE_KEY: process.env.YOUTUBE_KEY,
  ENABLE_DOCS: parseBool(process.env.ENABLE_DOCS, isDev),
  CACHE: {
    MEMORY_CACHE_SIZE: parseNumber(process.env.MEMORY_CACHE_SIZE, defaultConfig.CACHE.MEMORY_CACHE_SIZE),
    MEMORY_CACHE_TTL: parseNumber(process.env.MEMORY_CACHE_TTL, defaultConfig.CACHE.MEMORY_CACHE_TTL),
    REDIS_CACHE_TTL: parseNumber(process.env.REDIS_CACHE_TTL, defaultConfig.CACHE.REDIS_CACHE_TTL),
    SONG_CACHE_TTL: parseNumber(process.env.SONG_CACHE_TTL, defaultConfig.CACHE.SONG_CACHE_TTL),
    SOURCE_CACHE_TTL: parseNumber(process.env.SOURCE_CACHE_TTL, defaultConfig.CACHE.SOURCE_CACHE_TTL)
  },
  HOST: process.env.HOST || defaultConfig.HOST,
  BASE_URL: process.env.BASE_URL || defaultConfig.BASE_URL,
  // 安全配置 - 根据环境变量或默认值设置
  ENABLE_API_AUTH: parseBool(process.env.ENABLE_API_AUTH, process.env.NODE_ENV === 'production'),
  API_KEYS: process.env.API_KEYS || defaultConfig.API_KEYS,
  ENABLE_IP_WHITELIST: parseBool(process.env.ENABLE_IP_WHITELIST, defaultConfig.ENABLE_IP_WHITELIST),
  IP_WHITELIST: process.env.IP_WHITELIST || defaultConfig.IP_WHITELIST,
  TRUST_PROXY: parseBool(process.env.TRUST_PROXY, defaultConfig.TRUST_PROXY),
  LOG_LEVEL: process.env.LOG_LEVEL || defaultConfig.LOG_LEVEL,
  LOG_TO_FILE: parseBool(process.env.LOG_TO_FILE, defaultConfig.LOG_TO_FILE),
  LOG_DIR: process.env.LOG_DIR || defaultConfig.LOG_DIR,
  CACHE_ENABLED: parseBool(process.env.CACHE_ENABLED, defaultConfig.CACHE_ENABLED),
  CACHE_TTL: parseNumber(process.env.CACHE_TTL, defaultConfig.CACHE_TTL),
  CACHE_MAX_SIZE: parseNumber(process.env.CACHE_MAX_SIZE, defaultConfig.CACHE_MAX_SIZE),
  MAX_SONG_SEARCH_RESULTS: parseNumber(process.env.MAX_SONG_SEARCH_RESULTS, defaultConfig.MAX_SONG_SEARCH_RESULTS),
  SEARCH_TIMEOUT: parseNumber(process.env.SEARCH_TIMEOUT, defaultConfig.SEARCH_TIMEOUT),
  SOURCE_PRIORITY: process.env.SOURCE_PRIORITY || defaultConfig.SOURCE_PRIORITY,
  ENABLE_NETEASE: parseBool(process.env.ENABLE_NETEASE, defaultConfig.ENABLE_NETEASE),
  ENABLE_TENCENT: parseBool(process.env.ENABLE_TENCENT, defaultConfig.ENABLE_TENCENT),
  ENABLE_KUGOU: parseBool(process.env.ENABLE_KUGOU, defaultConfig.ENABLE_KUGOU),
  ENABLE_KUWO: parseBool(process.env.ENABLE_KUWO, defaultConfig.ENABLE_KUWO),
  ENABLE_BILIBILI: parseBool(process.env.ENABLE_BILIBILI, defaultConfig.ENABLE_BILIBILI),
  REQUEST_TIMEOUT: parseNumber(process.env.REQUEST_TIMEOUT, defaultConfig.REQUEST_TIMEOUT),
  USER_AGENT: process.env.USER_AGENT || defaultConfig.USER_AGENT,
  CORS_ORIGIN: process.env.CORS_ORIGIN || defaultConfig.CORS_ORIGIN,
  // 速率限制配置 - 生产环境默认启用
  ENABLE_RATE_LIMIT: parseBool(process.env.ENABLE_RATE_LIMIT, process.env.NODE_ENV === 'production'),
  RATE_LIMIT_MAX: parseNumber(process.env.RATE_LIMIT_MAX, defaultConfig.RATE_LIMIT_MAX),
  RATE_LIMIT_WINDOW: parseNumber(process.env.RATE_LIMIT_WINDOW, defaultConfig.RATE_LIMIT_WINDOW),
  MAX_WORKERS: parseNumber(process.env.MAX_WORKERS, defaultConfig.MAX_WORKERS),
  ENABLE_VIDEO_API: parseBool(process.env.ENABLE_VIDEO_API, true),
  ENABLE_SMS_API: parseBool(process.env.ENABLE_SMS_API, true),
  ENABLE_FILE_API: parseBool(process.env.ENABLE_FILE_API, true),
  CACHE_MAXAGE: parseNumber(process.env.CACHE_MAXAGE, 3600),
  ALLOWED_DOMAIN: process.env.ALLOWED_DOMAIN || '*',
  LOGGER: {
    LEVEL: process.env.LOG_LEVEL || defaultConfig.LOGGER.LEVEL,
    FORMAT: process.env.LOG_FORMAT || defaultConfig.LOGGER.FORMAT
  },
  SESSION_SECRET: process.env.SESSION_SECRET || defaultConfig.SESSION_SECRET,
  // 数据库配置
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_POOL_SIZE: parseNumber(process.env.DATABASE_POOL_SIZE, defaultConfig.DATABASE_POOL_SIZE),
  DATABASE_SSL: parseBool(process.env.DATABASE_SSL, defaultConfig.DATABASE_SSL),
};

// 验证配置
validateConfig(config);

// 输出配置信息
if (isDev) {
  console.log(`环境: ${config.NODE_ENV}`);
  console.log(`端口: ${config.PORT}`);
  console.log(`Redis: ${config.ENABLE_REDIS_CACHE ? '启用' : '禁用'}`);
  console.log(`API认证: ${config.ENABLE_API_AUTH ? '启用' : '禁用'}`);
  console.log(`速率限制: ${config.ENABLE_RATE_LIMIT ? '启用' : '禁用'}`);
}