/**
 * 音源配置文件
 * 统一管理所有音源的信息，包括名称、代码、图标、描述等
 */

export interface MusicSource {
    code: string;       // 音源代码，用于API请求
    name: string;       // 音源名称
    description: string; // 音源描述
    icon: string;       // 图标类名（FontAwesome）
    color: string;      // 图标背景颜色
    needCookie?: boolean; // 是否需要Cookie
    needProxy?: boolean;  // 是否需要代理
    needInstall?: boolean; // 是否需要安装额外软件
}

/**
 * 音源列表配置
 */
export const MUSIC_SOURCES: Record<string, MusicSource> = {
    qq: {
        code: 'qq',
        name: 'QQ音乐',
        description: '需要QQ_COOKIE',
        icon: 'qq',
        color: 'red',
        needCookie: true
    },
    kugou: {
        code: 'kugou',
        name: '酷狗音乐',
        description: '酷狗音乐',
        icon: 'music',
        color: 'blue'
    },
    kuwo: {
        code: 'kuwo',
        name: '酷我音乐',
        description: '酷我音乐',
        icon: 'music',
        color: 'purple'
    },
    migu: {
        code: 'migu',
        name: '咪咕音乐',
        description: '需要MIGU_COOKIE',
        icon: 'mobile-alt',
        color: 'pink',
        needCookie: true
    },
    joox: {
        code: 'joox',
        name: 'JOOX',
        description: '需要JOOX_COOKIE',
        icon: 'play-circle',
        color: 'green',
        needCookie: true
    },
    youtube: {
        code: 'youtube',
        name: 'YouTube',
        description: '需要非中国大陆IP',
        icon: 'youtube',
        color: 'red',
        needProxy: true
    },
    ytdlp: {
        code: 'ytdlp',
        name: 'YouTube (yt-dlp)',
        description: '通过yt-dlp，需要安装',
        icon: 'youtube',
        color: 'red',
        needInstall: true
    },
    bilibili: {
        code: 'bilibili',
        name: 'B站音乐',
        description: 'B站音乐',
        icon: 'play',
        color: 'blue'
    }
};

/**
 * 获取所有音源列表数组
 */
export function getAllMusicSources(): MusicSource[] {
    return Object.values(MUSIC_SOURCES);
}

/**
 * 获取默认音源列表（顺序按照后端设置）
 */
export function getDefaultSources(): string[] {
    return ['kugou', 'kuwo', 'migu', 'ytdlp', 'bilibili', 'qq', 'youtube', 'joox'];
}

/**
 * 获取音源信息
 * @param code 音源代码
 */
export function getMusicSource(code: string): MusicSource | undefined {
    return MUSIC_SOURCES[code];
}

/**
 * 获取音源描述数组（用于API响应）
 */
export function getSourceDescriptions(): string[] {
    return Object.values(MUSIC_SOURCES).map(source =>
        `${source.code} - ${source.name}${source.needCookie ? '（需要' + source.code.toUpperCase() + '_COOKIE）' :
            source.needProxy ? '（需要非中国大陆IP）' :
                source.needInstall ? '（通过yt-dlp，需要安装）' : ''
        }`
    );
} 