// 通用响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// 歌曲信息类型
export interface SongInfo {
  id: string;
  name: string;
  artist: string;
  album?: string;
  cover?: string;
  url?: string;
  br?: number; // 比特率
  size?: number;
  md5?: string;
  format?: string;
  duration?: number;
  source?: string;
}

// 音源信息类型
export interface SourceInfo {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  requiresCookie: boolean;
}

// 错误类型
export enum ErrorCode {
  INVALID_PARAMS = 'INVALID_PARAMS',
  SOURCE_NOT_AVAILABLE = 'SOURCE_NOT_AVAILABLE',
  SONG_NOT_FOUND = 'SONG_NOT_FOUND',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// 音源结果类型
export interface SourceResult {
  source: string;
  available: boolean;
  data?: SongInfo;
  error?: string;
  responseTime?: number;
} 