// 全局类型声明文件
// 为项目中使用的全局类型提供声明
import '@jest/globals';

// 为Node.js环境扩展全局类型
declare global {
    // 可以在这里添加任何项目级别的全局类型声明

    // 添加额外的Node.js环境变量类型声明
    namespace NodeJS {
        interface ProcessEnv {
            NODE_ENV: 'development' | 'production' | 'test';
            PORT?: string;
            ALLOWED_DOMAIN?: string;
            ENABLE_PROXY?: string;
            PROXY_URL?: string;
            ENABLE_MUSIC_API?: string;
            MUSIC_API_URL?: string;
            ENABLE_FLAC?: string;
            SELECT_MAX_BR?: string;
            FOLLOW_SOURCE_ORDER?: string;
            REDIS_URL?: string;
            ENABLE_REDIS_CACHE?: string;
            NETEASE_COOKIE?: string;
            JOOX_COOKIE?: string;
            MIGU_COOKIE?: string;
            QQ_COOKIE?: string;
            YOUTUBE_KEY?: string;
            ENABLE_DOCS?: string;
            MEMORY_CACHE_SIZE?: string;
            MEMORY_CACHE_TTL?: string;
            REDIS_CACHE_TTL?: string;
            SONG_CACHE_TTL?: string;
            SOURCE_CACHE_TTL?: string;
        }
    }
} 