import { FastifyInstance } from 'fastify';
import { createApp } from '../../../src/app'; // 导入应用创建函数
import { ApiError, ErrorType } from '../../../src/utils/errors'; // 导入 ApiError 和 ErrorType
import { musicService } from '../../../src/services/music'; // 导入原始服务
import { cacheService } from '../../../src/services/cache'; // 导入原始服务
// 移除 API_PREFIX 导入，在下面定义
// import { API_PREFIX } from '../../../src/routes/index'; 

// --- Mock Services ---
// 仅声明 mock，不直接在工厂函数中赋值给外部变量
jest.mock('../../../src/services/music');
jest.mock('../../../src/services/cache');

// 在测试文件中定义 API 前缀 (基于 src/routes/index.ts)
const API_PREFIX = '/v1/api';

// 声明变量以持有 mock 函数引用，供测试用例内部使用
let mockMatchSong: jest.Mock;
let mockGetDirectLink: jest.Mock;
// 移除 mockGetRedirectUrl
// let mockGetRedirectUrl: jest.Mock;
// 移除 mockCheckSong (因为 /check 使用 getDirectLink)
// let mockCheckSong: jest.Mock;
let mockSearchAndGetMusic: jest.Mock;
let mockGetLyric: jest.Mock;
let mockGetAlbumPic: jest.Mock;
let mockCacheGet: jest.Mock;
let mockCacheSet: jest.Mock;
let mockCacheGetStats: jest.Mock;


// --- Test Suite Setup ---
describe('Music Routes (Integration)', () => {
    let app: FastifyInstance;

    // 类型断言导入的服务为 Mocked 类型
    const mockedMusicService = musicService as jest.Mocked<typeof musicService>;
    const mockedCacheService = cacheService as jest.Mocked<typeof cacheService>;

    beforeAll(async () => {
        // 构建应用实例以进行测试
        app = await createApp();
        await app.ready(); // 等待所有插件加载完毕
    });

    afterAll(async () => {
        // 关闭应用实例
        await app.close();
    });

    beforeEach(() => {
        // 在每个测试前重置所有模拟函数的调用记录和实现
        // jest.clearAllMocks(); // 不再需要，因为下面会创建全新的 jest.fn()

        // 为 musicService 创建并分配新的 mock 函数
        mockMatchSong = jest.fn();
        mockGetDirectLink = jest.fn();
        // 移除 getRedirectUrl 和 checkSongAvailability 的 mock 设置
        // mockGetRedirectUrl = jest.fn();
        // mockCheckSong = jest.fn(); 
        mockSearchAndGetMusic = jest.fn();
        mockGetLyric = jest.fn();
        mockGetAlbumPic = jest.fn();

        mockedMusicService.matchSong = mockMatchSong;
        mockedMusicService.getDirectLink = mockGetDirectLink;
        // 移除对不存在方法的赋值
        // mockedMusicService.getRedirectUrl = mockGetRedirectUrl;
        // mockedMusicService.checkSongAvailability = mockCheckSong; 
        mockedMusicService.searchAndGetMusic = mockSearchAndGetMusic;
        mockedMusicService.getLyric = mockGetLyric;
        mockedMusicService.getAlbumPic = mockGetAlbumPic;

        // 为 cacheService 创建并分配新的 mock 函数
        mockCacheGet = jest.fn();
        mockCacheSet = jest.fn();
        mockCacheGetStats = jest.fn().mockReturnValue({ size: 0, hits: 0, misses: 0 }); // 提供默认返回值

        mockedCacheService.get = mockCacheGet;
        mockedCacheService.set = mockCacheSet;
        mockedCacheService.getStats = mockCacheGetStats;
    });

    // 测试用例将在此添加
    it('should setup the test environment', () => {
        expect(app).toBeDefined(); // 简单检查 app 是否已创建
    });

    // --- 定义测试 API Key ---
    const testApiKey = 'test-api-key';
    const authHeaders = { 'x-api-key': testApiKey };

    // --- 测试 /match 端点 ---
    describe(`GET ${API_PREFIX}/match`, () => { // 使用 API_PREFIX 变量
        const testId = '123456';
        // 调整 mock 结果以匹配服务可能返回的更完整结构 (如果需要)
        const mockMatchResult = { source: 'kuwo', song: { id: testId, name: 'Test Song', artist: 'Artist' }, url: 'http://example.com/song.mp3' };

        it('should return 200 and matched song on success', async () => {
            mockMatchSong.mockResolvedValue(mockMatchResult); // 使用 beforeEach 中创建的 mock

            const response = await app.inject({
                method: 'GET',
                url: `${API_PREFIX}/match?id=${testId}`,
                headers: authHeaders // 添加认证头
            });

            expect(response.statusCode).toBe(200);
            expect(JSON.parse(response.payload)).toEqual(mockMatchResult);
            expect(mockMatchSong).toHaveBeenCalledWith(testId, undefined); // 检查服务调用
        });

        it('should pass source parameter array to the service', async () => {
            mockMatchSong.mockResolvedValue(mockMatchResult);
            const source = 'kugou';

            await app.inject({
                method: 'GET',
                url: `${API_PREFIX}/match?id=${testId}&source=${source}`,
                headers: authHeaders // 添加认证头
            });
            // source 现在是数组
            expect(mockMatchSong).toHaveBeenCalledWith(testId, [source]);
        });

        it('should return 400 if id parameter is missing', async () => {
            const response = await app.inject({
                method: 'GET',
                url: `${API_PREFIX}/match`, // 缺少 id
                headers: authHeaders // 添加认证头 (即使预期失败也要加，确保是参数问题)
            });

            expect(response.statusCode).toBe(400);
            const payload = JSON.parse(response.payload);
            expect(payload).toHaveProperty('error', 'Bad Request');
            expect(payload).toHaveProperty('message', 'Missing required parameter: id');
            expect(mockMatchSong).not.toHaveBeenCalled();
        });

        it('should return 500 if musicService.matchSong throws an ApiError', async () => {
            const serviceError = new ApiError('Service Error', ErrorType.API, 500);
            mockMatchSong.mockRejectedValue(serviceError);

            const response = await app.inject({
                method: 'GET',
                url: `${API_PREFIX}/match?id=${testId}`,
                headers: authHeaders // 添加认证头
            });

            expect(response.statusCode).toBe(500);
            const payload = JSON.parse(response.payload);
            expect(payload).toHaveProperty('error', 'Internal Server Error'); // Fastify 默认错误
            expect(payload).toHaveProperty('message', 'Service Error'); // ApiError 消息应传递
            expect(mockMatchSong).toHaveBeenCalledWith(testId, undefined);
        });

        it('should return 500 if musicService.matchSong throws a generic Error', async () => {
            const errorMessage = 'Generic Service Error';
            mockMatchSong.mockRejectedValue(new Error(errorMessage));

            const response = await app.inject({
                method: 'GET',
                url: `${API_PREFIX}/match?id=${testId}`,
                headers: authHeaders // 添加认证头
            });

            expect(response.statusCode).toBe(500);
            const payload = JSON.parse(response.payload);
            expect(payload).toHaveProperty('error', 'Internal Server Error');
            // 路由中的 fallback 消息
            expect(payload).toHaveProperty('message', 'Failed to match song');
            expect(mockMatchSong).toHaveBeenCalledWith(testId, undefined);
        });
    });


    // --- 测试 /song 端点 ---
    describe(`GET ${API_PREFIX}/song`, () => { // 使用 API_PREFIX 变量
        const testId = 'song123';
        // 调整 mock 结果以匹配 getDirectLink 返回结构
        const mockSongResult = { data: { url: 'http://example.com/direct.mp3', size: 1024, br: 320000 }, cached: false };

        it('should return 200 and song data on success', async () => {
            mockGetDirectLink.mockResolvedValue(mockSongResult);

            const response = await app.inject({
                method: 'GET',
                url: `${API_PREFIX}/song?id=${testId}`,
                headers: authHeaders // 添加认证头
            });

            expect(response.statusCode).toBe(200);
            // /song 端点直接返回 data 部分
            expect(JSON.parse(response.payload)).toEqual(mockSongResult.data);
            expect(mockGetDirectLink).toHaveBeenCalledWith(testId, undefined, undefined);
        });

        it('should pass br and source parameters to the service', async () => {
            mockGetDirectLink.mockResolvedValue(mockSongResult);
            const br = '320';
            const source = 'qq';

            await app.inject({
                method: 'GET',
                url: `${API_PREFIX}/song?id=${testId}&br=${br}&source=${source}`,
                headers: authHeaders // 添加认证头
            });

            expect(mockGetDirectLink).toHaveBeenCalledWith(testId, br, source);
        });

        it('should return 400 if id parameter is missing', async () => {
            const response = await app.inject({
                method: 'GET',
                url: `${API_PREFIX}/song`, // 缺少 id
                headers: authHeaders // 添加认证头
            });

            expect(response.statusCode).toBe(400);
            const payload = JSON.parse(response.payload);
            expect(payload).toHaveProperty('message', 'Missing required parameter: id');
            expect(mockGetDirectLink).not.toHaveBeenCalled();
        });

        it('should return 404 if service throws ApiError with 404 status', async () => {
            const serviceError = new ApiError('Song not found', ErrorType.NOT_FOUND, 404);
            mockGetDirectLink.mockRejectedValue(serviceError);

            const response = await app.inject({
                method: 'GET',
                url: `${API_PREFIX}/song?id=${testId}`,
                headers: authHeaders // 添加认证头
            });

            expect(response.statusCode).toBe(404); // 路由错误处理器应捕获并使用 404
            const payload = JSON.parse(response.payload);
            expect(payload).toHaveProperty('error', 'Not Found'); // Fastify 错误
            expect(payload).toHaveProperty('message', 'Song not found'); // ApiError 消息
        });

        it('should return 503 if service throws other ApiError (e.g., 503)', async () => {
            const serviceError = new ApiError('Service unavailable', ErrorType.API, 503);
            mockGetDirectLink.mockRejectedValue(serviceError);

            const response = await app.inject({
                method: 'GET',
                url: `${API_PREFIX}/song?id=${testId}`,
                headers: authHeaders // 添加认证头
            });

            expect(response.statusCode).toBe(503); // 路由错误处理器应捕获并使用原始 status
            const payload = JSON.parse(response.payload);
            expect(payload).toHaveProperty('error', 'Service Unavailable'); // Fastify 错误
            expect(payload).toHaveProperty('message', 'Service unavailable'); // ApiError 消息
        });

        it('should return 500 if service throws generic Error', async () => {
            const errorMessage = 'Generic Service Error';
            mockGetDirectLink.mockRejectedValue(new Error(errorMessage));

            const response = await app.inject({
                method: 'GET',
                url: `${API_PREFIX}/song?id=${testId}`,
                headers: authHeaders // 添加认证头
            });

            expect(response.statusCode).toBe(500);
            const payload = JSON.parse(response.payload);
            expect(payload).toHaveProperty('error', 'Internal Server Error');
            // 路由中定义的 fallback 消息
            expect(payload).toHaveProperty('message', 'Failed to get song URL');
        });
    });

    // --- 测试 /redirect 端点 ---
    describe(`GET ${API_PREFIX}/redirect`, () => { // 使用 API_PREFIX 变量
        const testId = 'redirect123';
        const redirectUrl = 'http://redirect.example.com/song.mp3';
        const mockRedirectResult = { data: { url: redirectUrl }, cached: false };

        it('should return 302 redirect on success', async () => {
            mockGetDirectLink.mockResolvedValue(mockRedirectResult);

            const response = await app.inject({
                method: 'GET',
                url: `${API_PREFIX}/redirect?id=${testId}`,
                headers: authHeaders // 添加认证头
            });

            expect(response.statusCode).toBe(302);
            expect(response.headers.location).toBe(redirectUrl);
            expect(mockGetDirectLink).toHaveBeenCalledWith(testId, undefined, undefined);
        });

        it('should pass br and source parameters to the service', async () => {
            mockGetDirectLink.mockResolvedValue(mockRedirectResult);
            const br = '128';
            const source = 'migu';

            await app.inject({
                method: 'GET',
                url: `${API_PREFIX}/redirect?id=${testId}&br=${br}&source=${source}`,
                headers: authHeaders // 添加认证头
            });

            expect(mockGetDirectLink).toHaveBeenCalledWith(testId, br, source);
        });

        it('should return 400 if id parameter is missing', async () => {
            const response = await app.inject({
                method: 'GET',
                url: `${API_PREFIX}/redirect`, // 缺少 id
                headers: authHeaders // 添加认证头
            });

            expect(response.statusCode).toBe(400);
            const payload = JSON.parse(response.payload);
            expect(payload).toHaveProperty('message', 'Missing required parameter: id');
            expect(mockGetDirectLink).not.toHaveBeenCalled();
        });

        it('should return 404 if service returns data without url', async () => {
            // 模拟返回的数据没有 url 字段
            mockGetDirectLink.mockResolvedValue({ data: { size: 100 }, cached: false });

            const response = await app.inject({
                method: 'GET',
                url: `${API_PREFIX}/redirect?id=${testId}`,
                headers: authHeaders // 添加认证头
            });

            expect(response.statusCode).toBe(404); // 路由逻辑应抛出 404
            const payload = JSON.parse(response.payload);
            expect(payload).toHaveProperty('error', 'Not Found');
            // 路由中定义的错误
            expect(payload).toHaveProperty('message', 'No redirect URL found');
        });

        it('should return 404 if service throws ApiError with 404 status', async () => {
            const serviceError = new ApiError('Redirect target not found', ErrorType.NOT_FOUND, 404);
            mockGetDirectLink.mockRejectedValue(serviceError);

            const response = await app.inject({
                method: 'GET',
                url: `${API_PREFIX}/redirect?id=${testId}`,
                headers: authHeaders // 添加认证头
            });

            expect(response.statusCode).toBe(404); // 路由错误处理器使用 404
            const payload = JSON.parse(response.payload);
            expect(payload).toHaveProperty('error', 'Not Found');
            expect(payload).toHaveProperty('message', 'Redirect target not found');
        });

        it('should return 500 if service throws generic Error', async () => {
            mockGetDirectLink.mockRejectedValue(new Error('Generic failure'));

            const response = await app.inject({
                method: 'GET',
                url: `${API_PREFIX}/redirect?id=${testId}`,
                headers: authHeaders // 添加认证头
            });

            expect(response.statusCode).toBe(500);
            const payload = JSON.parse(response.payload);
            expect(payload).toHaveProperty('error', 'Internal Server Error');
            // 路由中定义的 fallback 消息
            expect(payload).toHaveProperty('message', 'Failed to get redirect URL');
        });
    });

    // --- 测试 /check 端点 ---
    describe(`GET ${API_PREFIX}/check`, () => { // 使用 API_PREFIX 变量
        const testId = 'check123';

        it('should return 200 with { available: true } on success', async () => {
            // /check 内部使用 getDirectLink 检查
            mockGetDirectLink.mockResolvedValue({ data: { url: 'any_url' } });

            const response = await app.inject({
                method: 'GET',
                url: `${API_PREFIX}/check?id=${testId}`,
                headers: authHeaders // 添加认证头
            });

            expect(response.statusCode).toBe(200);
            expect(JSON.parse(response.payload)).toEqual({ available: true });
            // check 只需 id，内部调用 getDirectLink
            expect(mockGetDirectLink).toHaveBeenCalledWith(testId, undefined, undefined);
        });

        it.only('should return 200 with { available: false } if service throws ApiError 404', async () => {
            const serviceError = new ApiError('Not Found Check', ErrorType.NOT_FOUND, 404);
            mockGetDirectLink.mockRejectedValue(serviceError); // 模拟 getDirectLink 失败

            const response = await app.inject({
                method: 'GET',
                url: `${API_PREFIX}/check?id=${testId}`,
                headers: authHeaders // 添加认证头
            });

            expect(response.statusCode).toBe(200); // 路由逻辑将 404 转为 200 + available: false
            expect(JSON.parse(response.payload)).toEqual({ available: false });
            expect(mockGetDirectLink).toHaveBeenCalledWith(testId, undefined, undefined);
        });

        it('should return 400 if id parameter is missing', async () => {
            const response = await app.inject({
                method: 'GET',
                url: `${API_PREFIX}/check`, // 缺少 id
                headers: authHeaders // 添加认证头
            });

            expect(response.statusCode).toBe(400);
            const payload = JSON.parse(response.payload);
            expect(payload).toHaveProperty('message', 'Missing required parameter: id');
            expect(mockGetDirectLink).not.toHaveBeenCalled();
        });

        it('should return 503 if service throws other ApiError (e.g., 503)', async () => {
            const serviceError = new ApiError('Server Down Check', ErrorType.API, 503);
            mockGetDirectLink.mockRejectedValue(serviceError);

            const response = await app.inject({
                method: 'GET',
                url: `${API_PREFIX}/check?id=${testId}`,
                headers: authHeaders // 添加认证头
            });

            expect(response.statusCode).toBe(503); // 路由错误处理器使用原始 status
            const payload = JSON.parse(response.payload);
            expect(payload).toHaveProperty('error', 'Service Unavailable');
            expect(payload).toHaveProperty('message', 'Server Down Check');
        });

        it('should return 500 if service throws generic Error', async () => {
            mockGetDirectLink.mockRejectedValue(new Error('Unknown error check'));

            const response = await app.inject({
                method: 'GET',
                url: `${API_PREFIX}/check?id=${testId}`,
                headers: authHeaders // 添加认证头
            });

            expect(response.statusCode).toBe(500);
            const payload = JSON.parse(response.payload);
            expect(payload).toHaveProperty('error', 'Internal Server Error');
            // 路由中定义的 fallback 消息
            expect(payload).toHaveProperty('message', 'Failed to check song availability');
        });
    });


    // --- 测试 /sources 端点 --- (不需要 mock, 也不需要认证)
    describe(`GET ${API_PREFIX}/sources`, () => { // 使用 API_PREFIX 变量
        it('should return 200 and a list of available sources', async () => {
            const response = await app.inject({
                method: 'GET',
                url: `${API_PREFIX}/sources`
                // 不需要 headers
            });

            expect(response.statusCode).toBe(200);
            const payload = JSON.parse(response.payload);
            // 检查基本结构和数据类型
            expect(payload).toHaveProperty('code', 200);
            expect(payload).toHaveProperty('data');
            expect(Array.isArray(payload.data)).toBe(true);
            // 简单检查是否包含已知音源 (具体内容可能变化)
            expect(payload.data.length).toBeGreaterThan(0);
            // 修正断言：检查是否有以 'netease' 开头的字符串
            expect(payload.data.some((s: any) => typeof s === 'string' && s.startsWith('netease'))).toBe(true);
        });
    });


    // --- 测试 /info 端点 --- (不需要 mock, 也不需要认证)
    describe(`GET ${API_PREFIX}/info`, () => { // 使用 API_PREFIX 变量
        it('should return 200 and service info', async () => {
            const response = await app.inject({
                method: 'GET',
                url: `${API_PREFIX}/info`
                // 不需要 headers
            });

            expect(response.statusCode).toBe(200);
            const payload = JSON.parse(response.payload);
            expect(payload).toHaveProperty('code', 200);
            expect(payload).toHaveProperty('version');
            expect(payload).toHaveProperty('enable_flac'); // 检查一些预期的字段
            expect(payload).toHaveProperty('proxy_enabled');
        });
    });

    // --- 测试 /health 端点 --- (不需要 mock cacheService 之外的服务, 也不需要认证)
    describe(`GET ${API_PREFIX}/health`, () => { // 使用 API_PREFIX 变量
        it('should return 200 and health status, calling cacheService.getStats', async () => {
            const mockStats = { size: 15, hits: 10, misses: 5, uptime: 'mock' };
            // 注意：这里直接 mock cacheService 实例上的方法
            mockCacheGetStats.mockReturnValue(mockStats);

            const response = await app.inject({
                method: 'GET',
                url: `${API_PREFIX}/health`
                // 不需要 headers
            });

            expect(response.statusCode).toBe(200);
            const payload = JSON.parse(response.payload);
            expect(payload).toHaveProperty('status', 'ok');
            expect(payload).toHaveProperty('uptime');
            expect(payload).toHaveProperty('memory');
            expect(payload).toHaveProperty('system');
            expect(payload).toHaveProperty('cache');
            // 验证 mock 的缓存状态是否被正确返回
            expect(payload.cache).toEqual(mockStats);
            // 确保 cacheService.getStats 被调用
            expect(mockCacheGetStats).toHaveBeenCalledTimes(1);
        });
    });

}); // 结束顶级 describe 