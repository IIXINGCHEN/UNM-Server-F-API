import match from '@unblockneteasemusic/server';
import { SourceType, DEFAULT_SOURCES } from '../config/sources';
import { cacheService, CachePriority } from './cache/CacheService';
import { generateProxyUrl } from '../utils/proxy';
import { ApiError, ErrorType } from '../utils/errors';
import { config } from '../config/env';

/**
 * 音乐匹配服务
 *
 * 部分API功能由GD Studio's Online Music Platform提供
 * 免责声明：API仅用于学习目的，请勿用于商业用途
 * 若使用该API请注明出处"GD音乐台(music.gdstudio.xyz)"
 *
 * API功能包括：
 * 1. 搜索: types=search&source=[音乐源]&name=[关键词]&count=[每页数量]&pages=[页码]
 * 2. 获取歌曲: types=url&source=[音乐源]&id=[曲目ID]&br=[音质]
 * 3. 获取专辑图: types=pic&source=[音乐源]&id=[图片ID]&size=[尺寸]
 * 4. 获取歌词: types=lyric&source=[音乐源]&id=[歌词ID]
 *
 * 支持的音乐源: netease、tencent、tidal、spotify、ytmusic、qobuz、joox、deezer、migu、kugou、kuwo、ximalaya
 */
export class MusicService {
  /**
   * 匹配歌曲
   * @param id 歌曲ID
   * @param sources 音源列表
   * @returns 匹配结果
   */
  async matchSong(id: string | number, sources: SourceType[] = DEFAULT_SOURCES) {
    // 验证参数
    if (!id) {
      throw ApiError.validation('缺少必要参数 id');
    }

    // 增强ID验证：确保是数字或可转为数字的字符串
    const sanitizedId = String(id).trim();
    if (!/^\d+$/.test(sanitizedId)) {
      throw ApiError.validation('无效的ID参数，应为数字');
    }

    // 限制ID长度防止异常情况
    if (sanitizedId.length > 20) {
      throw ApiError.validation('ID参数长度超出限制');
    }

    // 验证音源列表
    if (sources && Array.isArray(sources)) {
      // 检查每个音源是否在允许的列表中
      const invalidSources = sources.filter(
        source => !Object.values(DEFAULT_SOURCES).includes(source)
      );
      if (invalidSources.length > 0) {
        throw ApiError.validation(`无效的音源: ${invalidSources.join(', ')}`);
      }
    } else if (sources && !Array.isArray(sources)) {
      throw ApiError.validation('音源参数格式不正确，应为数组');
    }

    // 过滤禁用的音源
    const enabledSources = sources.filter(source => {
      switch (source as string) {
        case 'netease': return config.ENABLE_NETEASE;
        case 'tencent': return config.ENABLE_TENCENT;
        case 'kugou': return config.ENABLE_KUGOU;
        case 'kuwo': return config.ENABLE_KUWO;
        case 'bilibili': return config.ENABLE_BILIBILI;
        default: return true;
      }
    });

    if (enabledSources.length === 0) {
      throw ApiError.validation('没有启用的有效音源');
    }

    // 构建缓存键
    const cacheKey = `match:${sanitizedId}:${enabledSources.join(',')}`;

    // 尝试从缓存获取
    const cachedResult = await cacheService.get(cacheKey);
    if (cachedResult) {
      console.log(`从缓存获取匹配结果: ${sanitizedId}`);
      return {
        data: cachedResult,
        cached: true
      };
    }

    console.log(`开始匹配: ${sanitizedId} - ${enabledSources}`);

    try {
      // 设置请求超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('匹配请求超时')), config.REQUEST_TIMEOUT || 15000);
      });

      // 请求匹配结果
      const matchPromise = match(sanitizedId, enabledSources);

      // 使用Promise.race进行超时控制
      const data = await Promise.race([
        matchPromise,
        timeoutPromise
      ]) as any;

      // 验证结果
      if (!data) {
        throw new Error('未获取到匹配结果');
      }

      // 将结果存入缓存
      await cacheService.set(cacheKey, data, {
        ttl: 3600, // 默认1小时
        priority: CachePriority.NORMAL
      });

      // 处理代理URL
      if (data.url) {
        // 验证URL格式
        try {
          new URL(data.url);
          const proxyUrl = generateProxyUrl(data.url);
          if (proxyUrl) {
            data.proxyUrl = proxyUrl;
          }
        } catch (urlError) {
          console.warn('无效的音乐URL:', data.url);
          // 不设置proxyUrl，但不抛出异常阻断整个流程
        }
      }

      return { data, cached: false };
    } catch (error) {
      console.error('匹配出错:', error);

      // 细分错误类型
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('超时')) {
          throw ApiError.timeout('音乐匹配服务请求超时', {
            id: sanitizedId,
            sources: enabledSources
          });
        }
      }

      throw ApiError.api('音乐匹配服务暂时不可用', {
        originalError: error instanceof Error ? error.message : String(error),
        id: sanitizedId,
        sources: enabledSources
      });
    }
  }

  /**
   * 从第三方API获取直链
   * @param id 歌曲ID
   * @param br 比特率，支持128、192、320、740、999
   * @param source 音乐源，默认不指定(由API决定)
   * @returns 歌曲链接
   */
  async getDirectLink(id: string, br: string = '320', source?: string) {
    // 验证参数
    if (!id) {
      throw ApiError.validation('缺少必要参数 id');
    }

    // ID输入验证 - 确保是数字或可转为数字的字符串
    const sanitizedId = String(id).trim();
    if (!/^\d+$/.test(sanitizedId)) {
      throw ApiError.validation('无效的ID参数，应为数字');
    }

    // 限制ID长度防止异常情况
    if (sanitizedId.length > 20) {
      throw ApiError.validation('ID参数长度超出限制');
    }

    // 验证 br 参数有效性并净化
    const validBR = ["128", "192", "320", "740", "999"];
    const sanitizedBr = String(br).trim();
    if (!validBR.includes(sanitizedBr)) {
      throw ApiError.validation(`无效音质参数，支持的值: ${validBR.join(', ')}`);
    }

    // 净化音乐源参数
    let sourceParam = '';
    if (source) {
      sourceParam = String(source).trim().toLowerCase();
      // 验证音乐源是否合法
      const validSources = ['netease', 'tencent', 'tidal', 'spotify', 'ytmusic', 'qobuz', 'joox', 'deezer', 'migu', 'kugou', 'kuwo', 'ximalaya'];
      if (!validSources.includes(sourceParam)) {
        console.warn(`不支持的音乐源: ${sourceParam}，将使用默认音乐源`);
        sourceParam = '';
      }
    }

    // 构建缓存键
    const cacheKey = `ncmget:${sanitizedId}:${sanitizedBr}:${sourceParam}`;

    // 尝试从缓存获取
    const cachedResult = await cacheService.get(cacheKey);
    if (cachedResult) {
      console.log(`从缓存获取音乐链接: ${sanitizedId}`);
      return {
        data: cachedResult,
        cached: true
      };
    }

    // 检查音乐API是否启用
    if (!config.ENABLE_MUSIC_API || !config.MUSIC_API_URL) {
      throw ApiError.api('音乐API服务未启用', { service: 'MUSIC_API' });
    }

    try {
      // 设置请求超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.REQUEST_TIMEOUT || 15000);

      // 构造 API 请求
      const apiUrl = new URL(config.MUSIC_API_URL);
      apiUrl.searchParams.append("types", "url");
      apiUrl.searchParams.append("id", sanitizedId);
      apiUrl.searchParams.append("br", sanitizedBr);

      // 如果指定了音乐源，添加到请求参数
      if (sourceParam) {
        apiUrl.searchParams.append("source", sourceParam);
      }

      let response;
      try {
        response = await fetch(apiUrl.toString(), {
          signal: controller.signal,
          headers: {
            'User-Agent': config.USER_AGENT || 'UNM-Server/2.0.0',
            'Accept': 'application/json',
            'Referer': 'https://music.gdstudio.xyz/' // 添加引用来源
          }
        });

        // 清除超时定时器
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw ApiError.api(`API 响应状态: ${response.status}`, {
            statusCode: response.status,
            statusText: response.statusText
          });
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);

        // 处理fetch异常
        if (fetchError && typeof fetchError === 'object' && 'name' in fetchError && fetchError.name === 'AbortError') {
          throw ApiError.timeout('音乐API请求超时');
        }
        throw fetchError;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw ApiError.api('API返回的不是有效的JSON数据', {
          contentType: contentType
        });
      }

      const result = await response.json();

      // 验证返回的URL是否存在
      if (!result || !result.url) {
        throw ApiError.api('无法获取音乐链接', { response: result });
      }

      // 验证URL合法性
      let musicUrl;
      try {
        musicUrl = new URL(result.url);
      } catch (urlError) {
        throw ApiError.api('返回的音乐URL无效', { url: result.url });
      }

      // 构造返回数据
      const responseData = {
        id: sanitizedId,
        br: result.br || sanitizedBr,
        url: result.url,
        size: result.size || null,
        md5: result.md5 || null,
        type: result.type || null,
        level: result.level || null,
      };

      // 保存到缓存
      await cacheService.set(
        cacheKey,
        responseData,
        {
          ttl: 86400, // 默认1天
          priority: CachePriority.HIGH // 使用高优先级
        }
      );

      return { data: responseData, cached: false };
    } catch (error) {
      console.error('获取音乐链接出错:', error);

      if (error instanceof ApiError) {
        throw error; // 重新抛出已经格式化的API错误
      }

      throw ApiError.api('获取音乐链接失败', {
        originalError: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 通过歌曲名搜索获取音乐
   * @param name 歌曲名称
   * @param source 音乐源，默认为kuwo
   * @param count 每页数量，默认为1
   * @param page 页码，默认为1
   * @returns 歌曲链接
   */
  async searchAndGetMusic(name: string, source: string = 'kuwo', count: number = 1, page: number = 1) {
    // 参数验证
    if (!name) {
      throw ApiError.validation('缺少必要参数 name');
    }

    // 输入净化和限制长度
    const sanitizedName = String(name).slice(0, 100).trim();
    if (sanitizedName.length < 2) {
      throw ApiError.validation('搜索关键词太短，请输入至少2个字符');
    }

    // 进一步过滤特殊字符，防止注入
    if (/[<>{}[\]\\\/]/.test(sanitizedName)) {
      throw ApiError.validation('搜索关键词包含无效字符');
    }

    // 验证音乐源是否合法
    const sanitizedSource = String(source).trim().toLowerCase();
    const validSources = ['netease', 'tencent', 'tidal', 'spotify', 'ytmusic', 'qobuz', 'joox', 'deezer', 'migu', 'kugou', 'kuwo', 'ximalaya'];
    if (!validSources.includes(sanitizedSource)) {
      throw ApiError.validation(`不支持的音乐源: ${sanitizedSource}，支持的值: ${validSources.join(', ')}`);
    }

    // 验证count和page参数
    const sanitizedCount = Math.max(1, Math.min(50, Math.floor(Number(count) || 1)));
    const sanitizedPage = Math.max(1, Math.floor(Number(page) || 1));

    // 构建缓存键
    const cacheKey = `otherget:${sanitizedName}:${sanitizedSource}:${sanitizedCount}:${sanitizedPage}`;

    // 尝试从缓存获取
    const cachedResult = await cacheService.get(cacheKey);
    if (cachedResult) {
      console.log(`从缓存获取搜索结果: ${sanitizedName}`);
      return {
        data: cachedResult,
        cached: true
      };
    }

    // 检查音乐API是否启用
    if (!config.ENABLE_MUSIC_API || !config.MUSIC_API_URL) {
      throw ApiError.api('音乐API服务未启用', { service: 'MUSIC_API' });
    }

    try {
      // 设置请求超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时

      try {
        // 构造搜索 API 请求
        const apiUrl = new URL(config.MUSIC_API_URL);
        apiUrl.searchParams.append("types", "search");
        apiUrl.searchParams.append("source", sanitizedSource);
        apiUrl.searchParams.append("name", sanitizedName);
        apiUrl.searchParams.append("count", String(sanitizedCount));
        apiUrl.searchParams.append("pages", String(sanitizedPage));

        const response = await fetch(apiUrl.toString(), {
          signal: controller.signal,
          headers: {
            'User-Agent': 'UNM-Server/2.0.0',
            'Accept': 'application/json',
            'Referer': 'https://music.gdstudio.xyz/' // 添加引用来源
          }
        });

        if (!response.ok) {
          throw ApiError.api(`搜索API返回错误: ${response.status}`, {
            statusCode: response.status,
            statusText: response.statusText
          });
        }

        const searchResult = await response.json();

        // 验证搜索结果
        if (!searchResult || !searchResult.songs || !Array.isArray(searchResult.songs) || searchResult.songs.length === 0) {
          throw ApiError.api('未找到相关歌曲', { keyword: sanitizedName });
        }

        // 获取第一首歌曲的信息
        const firstSong = searchResult.songs[0];
        if (!firstSong || !firstSong.musicId) {
          throw ApiError.api('歌曲信息不完整', { firstSong });
        }

        // 获取音乐直链
        const musicId = firstSong.musicId;

        // 再次构造API请求（获取音乐链接）
        const musicApiUrl = new URL(config.MUSIC_API_URL);
        musicApiUrl.searchParams.append("types", "url");
        musicApiUrl.searchParams.append("id", musicId);
        musicApiUrl.searchParams.append("source", sanitizedSource);

        const musicResponse = await fetch(musicApiUrl.toString(), {
          signal: controller.signal,
          headers: {
            'User-Agent': 'UNM-Server/2.0.0',
            'Accept': 'application/json',
            'Referer': 'https://music.gdstudio.xyz/' // 添加引用来源
          }
        });

        if (!musicResponse.ok) {
          throw ApiError.api(`获取音乐URL失败: ${musicResponse.status}`, {
            statusCode: musicResponse.status,
            statusText: musicResponse.statusText
          });
        }

        const musicResult = await musicResponse.json();

        // 验证URL是否存在
        if (!musicResult || !musicResult.url) {
          throw ApiError.api('无法获取音乐链接', { response: musicResult });
        }

        // 构造返回数据
        const responseData = {
          name: sanitizedName,
          id: musicId,
          url: musicResult.url,
          br: musicResult.br,
          size: musicResult.size,
          source: sanitizedSource,
          proxyUrl: generateProxyUrl(musicResult.url),
          song: firstSong,
          allSongs: searchResult.songs
        };

        // 存储到缓存
        await cacheService.set(cacheKey, responseData, {
          ttl: 3600, // 默认1小时
          priority: CachePriority.NORMAL
        });

        return { data: responseData, cached: false };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error: any) {
      if (error instanceof ApiError) {
        throw error;
      }

      const isTimeout = error.name === 'AbortError';
      const errorMessage = isTimeout ? '搜索请求超时' : '搜索请求失败';

      console.error('搜索失败:', error);
      throw isTimeout ?
        ApiError.timeout(errorMessage) :
        ApiError.api(errorMessage, { originalError: error.message });
    }
  }

  /**
   * 获取歌词
   * @param id 歌词ID
   * @param source 音乐源，默认为netease
   * @returns 歌词内容
   */
  async getLyric(id: string, source: string = 'netease') {
    // 验证参数
    if (!id) {
      throw ApiError.validation('缺少必要参数 id');
    }

    // ID输入验证 - 确保是数字或可转为数字的字符串
    const sanitizedId = String(id).trim();
    if (!/^\d+$/.test(sanitizedId)) {
      throw ApiError.validation('无效的ID参数，应为数字');
    }

    // 验证音乐源是否合法
    const sanitizedSource = String(source).trim().toLowerCase();
    const validSources = ['netease', 'tencent', 'tidal', 'spotify', 'ytmusic', 'qobuz', 'joox', 'deezer', 'migu', 'kugou', 'kuwo', 'ximalaya'];
    if (!validSources.includes(sanitizedSource)) {
      throw ApiError.validation(`不支持的音乐源: ${sanitizedSource}，支持的值: ${validSources.join(', ')}`);
    }

    // 构建缓存键
    const cacheKey = `lyric:${sanitizedId}:${sanitizedSource}`;

    // 尝试从缓存获取
    const cachedResult = await cacheService.get(cacheKey);
    if (cachedResult) {
      console.log(`从缓存获取歌词: ${sanitizedId}`);
      return {
        data: cachedResult,
        cached: true
      };
    }

    // 检查音乐API是否启用
    if (!config.ENABLE_MUSIC_API || !config.MUSIC_API_URL) {
      throw ApiError.api('音乐API服务未启用', { service: 'MUSIC_API' });
    }

    try {
      // 设置请求超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时

      try {
        // 构造 API 请求
        const apiUrl = new URL(config.MUSIC_API_URL);
        apiUrl.searchParams.append("types", "lyric");
        apiUrl.searchParams.append("id", sanitizedId);
        apiUrl.searchParams.append("source", sanitizedSource);

        const response = await fetch(apiUrl.toString(), {
          signal: controller.signal,
          headers: {
            'User-Agent': 'UNM-Server/2.0.0',
            'Accept': 'application/json',
            'Referer': 'https://music.gdstudio.xyz/' // 添加引用来源
          }
        });

        if (!response.ok) {
          throw ApiError.api(`API 响应状态: ${response.status}`, {
            statusCode: response.status,
            statusText: response.statusText
          });
        }

        const result = await response.json();

        // 验证返回的歌词是否存在
        if (!result || (!result.lyric && !result.tlyric)) {
          throw ApiError.api('无法获取歌词', { response: result });
        }

        // 构造返回数据
        const responseData = {
          id: sanitizedId,
          source: sanitizedSource,
          lyric: result.lyric || '',
          tlyric: result.tlyric || ''
        };

        // 存储到缓存
        await cacheService.set(cacheKey, responseData, {
          priority: CachePriority.NORMAL
        });

        return { data: responseData, cached: false };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error: any) {
      // 判断是否为超时错误
      if (error instanceof ApiError) {
        throw error; // 直接传递ApiError实例
      }

      const isTimeout = error.name === 'AbortError';
      const errorMessage = isTimeout ? 'API请求超时' : '服务器处理请求失败';

      console.error('获取歌词失败:', error);
      throw isTimeout ?
        ApiError.timeout(errorMessage) :
        ApiError.api(errorMessage, { originalError: error.message });
    }
  }

  /**
   * 获取专辑图片
   * @param id 专辑图ID
   * @param source 音乐源，默认为netease
   * @param size 图片尺寸，300或500，默认为300
   * @returns 专辑图片URL
   */
  async getAlbumPic(id: string, source: string = 'netease', size: number = 300) {
    // 验证参数
    if (!id) {
      throw ApiError.validation('缺少必要参数 id');
    }

    // ID输入验证
    const sanitizedId = String(id).trim();

    // 验证音乐源是否合法
    const sanitizedSource = String(source).trim().toLowerCase();
    const validSources = ['netease', 'tencent', 'tidal', 'spotify', 'ytmusic', 'qobuz', 'joox', 'deezer', 'migu', 'kugou', 'kuwo', 'ximalaya'];
    if (!validSources.includes(sanitizedSource)) {
      throw ApiError.validation(`不支持的音乐源: ${sanitizedSource}，支持的值: ${validSources.join(', ')}`);
    }

    // 验证尺寸参数
    const sanitizedSize = size === 500 ? 500 : 300;

    // 构建缓存键
    const cacheKey = `pic:${sanitizedId}:${sanitizedSource}:${sanitizedSize}`;

    // 尝试从缓存获取
    const cachedResult = await cacheService.get(cacheKey);
    if (cachedResult) {
      console.log(`从缓存获取专辑图: ${sanitizedId}`);
      return {
        data: cachedResult,
        cached: true
      };
    }

    // 检查音乐API是否启用
    if (!config.ENABLE_MUSIC_API || !config.MUSIC_API_URL) {
      throw ApiError.api('音乐API服务未启用', { service: 'MUSIC_API' });
    }

    try {
      // 设置请求超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时

      try {
        // 构造 API 请求
        const apiUrl = new URL(config.MUSIC_API_URL);
        apiUrl.searchParams.append("types", "pic");
        apiUrl.searchParams.append("id", sanitizedId);
        apiUrl.searchParams.append("source", sanitizedSource);
        apiUrl.searchParams.append("size", String(sanitizedSize));

        const response = await fetch(apiUrl.toString(), {
          signal: controller.signal,
          headers: {
            'User-Agent': 'UNM-Server/2.0.0',
            'Accept': 'application/json',
            'Referer': 'https://music.gdstudio.xyz/' // 添加引用来源
          }
        });

        if (!response.ok) {
          throw ApiError.api(`API 响应状态: ${response.status}`, {
            statusCode: response.status,
            statusText: response.statusText
          });
        }

        const result = await response.json();

        // 验证返回的URL是否存在
        if (!result || !result.url) {
          throw ApiError.api('无法获取专辑图', { response: result });
        }

        // 验证URL合法性
        try {
          new URL(result.url);
        } catch (urlError) {
          throw ApiError.api('返回的URL无效', { url: result.url });
        }

        // 构造返回数据
        const responseData = {
          id: sanitizedId,
          source: sanitizedSource,
          size: sanitizedSize,
          url: result.url
        };

        // 存储到缓存
        await cacheService.set(cacheKey, responseData, {
          priority: CachePriority.NORMAL
        });

        return { data: responseData, cached: false };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error: any) {
      // 判断是否为超时错误
      if (error instanceof ApiError) {
        throw error; // 直接传递ApiError实例
      }

      const isTimeout = error.name === 'AbortError';
      const errorMessage = isTimeout ? 'API请求超时' : '服务器处理请求失败';

      console.error('获取专辑图失败:', error);
      throw isTimeout ?
        ApiError.timeout(errorMessage) :
        ApiError.api(errorMessage, { originalError: error.message });
    }
  }
}

// 导出单例
export const musicService = new MusicService();