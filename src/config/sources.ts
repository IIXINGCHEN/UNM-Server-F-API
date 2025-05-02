/**
 * 音源类型
 */
export type SourceType =
  | 'pyncmd'
  | 'kuwo'
  | 'bilibili'
  | 'migu'
  | 'kugou'
  | 'qq'
  | 'youtube'
  | 'ytdlp'
  | 'joox'
  | 'ytdownload'
  | 'youtubedl';

// 导入音源配置
import { getDefaultSources } from './music-sources';

/**
 * 默认音源列表 (可根据需要调整顺序或内容)
 */
export const DEFAULT_SOURCES: SourceType[] = getDefaultSources() as SourceType[];

/**
 * 测试用的样例歌曲ID
 */
export const TEST_SONG_ID = 1962165898; 