import { FastifyRequest, FastifyReply } from 'fastify';
// 修正导入，导入工厂函数
import {
    createApiKeyAuthMiddleware,
    createIpWhitelistAuthMiddleware
} from '../../../src/middlewares/auth';

// 本地定义模拟配置接口
interface MockConfig {
    ENABLE_API_AUTH: boolean;
    API_KEYS: string[]; // 与重构后的 auth.ts 保持一致，假设是数组
    ENABLE_IP_WHITELIST: boolean;
    IP_WHITELIST: string[]; // 与重构后的 auth.ts 保持一致，假设是数组
}

// 移除对 config 的模拟
/*
interface MockConfig {
  ENABLE_API_AUTH: boolean;
  API_KEYS: string[]; // 假设 API_KEYS 在 Config 类型中是数组
  ENABLE_IP_WHITELIST: boolean;
  IP_WHITELIST: string[]; // 假设 IP_WHITELIST 在 Config 类型中是数组
}

let mutableMockConfig: MockConfig = {
  ENABLE_API_AUTH: false,
  API_KEYS: [],
  ENABLE_IP_WHITELIST: false,
  IP_WHITELIST: [],
};

jest.doMock('../../../src/config', () => ({
  __esModule: true,
  config: mutableMockConfig,
}));
*/

// 移除不存在的类型导入
// import { Config } from '../../../src/types/config'; 


// --- 测试 apiKeyAuth ---
describe('apiKeyAuth Middleware', () => {
    let mockRequest: Partial<FastifyRequest>;
    let mockReply: Partial<FastifyReply>;
    let mockConfig: MockConfig; // 使用本地定义的 MockConfig

    beforeEach(() => {
        mockConfig = {
            ENABLE_API_AUTH: false,
            API_KEYS: [],
            ENABLE_IP_WHITELIST: false,
            IP_WHITELIST: [],
        };
        mockRequest = {
            headers: {},
            url: '/test/path',
        };
        mockReply = {
            code: jest.fn().mockReturnThis(),
            send: jest.fn(),
        };
    });

    describe('when API Auth is disabled', () => {
        beforeEach(() => {
            mockConfig.ENABLE_API_AUTH = false;
        });

        it('should do nothing and return', async () => {
            // 使用正确的工厂函数名称
            const middleware = createApiKeyAuthMiddleware(mockConfig);
            await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
            expect(mockReply.code).not.toHaveBeenCalled();
            expect(mockReply.send).not.toHaveBeenCalled();
        });
    });

    describe('when API Auth is enabled', () => {
        beforeEach(() => {
            mockConfig.ENABLE_API_AUTH = true;
            mockConfig.API_KEYS = ['key1', 'key2']; // 设置有效密钥
        });

        it('should skip auth for whitelisted paths', async () => {
            // 在测试用例内部创建具有特定 url 的 mockRequest
            const specificMockRequest: Partial<FastifyRequest> = {
                ...mockRequest, // 继承通用设置
                url: '/health', // 白名单路径
            };
            const middleware = createApiKeyAuthMiddleware(mockConfig);
            // 使用特定 mockRequest
            await middleware(specificMockRequest as FastifyRequest, mockReply as FastifyReply);
            expect(mockReply.code).not.toHaveBeenCalled();
            expect(mockReply.send).not.toHaveBeenCalled();
        });

        it('should return 401 if no api key header or authorization header is provided', async () => {
            mockRequest.headers = {}; // 无相关 header
            const middleware = createApiKeyAuthMiddleware(mockConfig);
            await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
            expect(mockReply.code).toHaveBeenCalledWith(401);
            expect(mockReply.send).toHaveBeenCalledWith({ error: 'Unauthorized: Invalid API key' });
        });

        it('should return 401 if authorization header is not Bearer type', async () => {
            mockRequest.headers = { authorization: 'Basic some-token' };
            const middleware = createApiKeyAuthMiddleware(mockConfig);
            await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
            expect(mockReply.code).toHaveBeenCalledWith(401);
            expect(mockReply.send).toHaveBeenCalledWith({ error: 'Unauthorized: Invalid API key' });
        });

        it('should return 401 if x-api-key is invalid', async () => {
            mockRequest.headers = { 'x-api-key': 'invalid-key' };
            const middleware = createApiKeyAuthMiddleware(mockConfig);
            await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
            expect(mockReply.code).toHaveBeenCalledWith(401);
            expect(mockReply.send).toHaveBeenCalledWith({ error: 'Unauthorized: Invalid API key' });
        });

        it('should return 401 if Bearer token is invalid', async () => {
            mockRequest.headers = { authorization: 'Bearer invalid-key' };
            const middleware = createApiKeyAuthMiddleware(mockConfig);
            await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
            expect(mockReply.code).toHaveBeenCalledWith(401);
            expect(mockReply.send).toHaveBeenCalledWith({ error: 'Unauthorized: Invalid API key' });
        });

        it('should pass if valid x-api-key is provided', async () => {
            mockRequest.headers = { 'x-api-key': 'key1' };
            const middleware = createApiKeyAuthMiddleware(mockConfig);
            await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
            expect(mockReply.code).not.toHaveBeenCalled();
            expect(mockReply.send).not.toHaveBeenCalled();
        });

        it('should pass if valid Bearer token is provided', async () => {
            mockRequest.headers = { authorization: 'Bearer key2' };
            const middleware = createApiKeyAuthMiddleware(mockConfig);
            await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
            expect(mockReply.code).not.toHaveBeenCalled();
            expect(mockReply.send).not.toHaveBeenCalled();
        });

        it('should handle empty API_KEYS config gracefully', async () => {
            mockConfig.API_KEYS = []; // 空数组
            mockRequest.headers = { 'x-api-key': 'key1' }; // 提供一个密钥
            const middleware = createApiKeyAuthMiddleware(mockConfig);
            await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
            expect(mockReply.code).toHaveBeenCalledWith(401); // 预期被拒绝
            expect(mockReply.send).toHaveBeenCalledWith({ error: 'Unauthorized: Invalid API key' });
        });
    });

    // ... 其他 apiKeyAuth 测试 ...
});

// --- 测试 ipWhitelistAuth ---
describe('ipWhitelistAuth Middleware', () => {
    let mockRequest: Partial<FastifyRequest>;
    let mockReply: Partial<FastifyReply>;
    let mockConfig: MockConfig; // 使用本地定义的 MockConfig

    beforeEach(() => {
        mockConfig = {
            ENABLE_API_AUTH: false,
            API_KEYS: [],
            ENABLE_IP_WHITELIST: false,
            IP_WHITELIST: [],
        };
        mockRequest = {
            headers: {},
            ip: '127.0.0.1',
        };
        mockReply = {
            code: jest.fn().mockReturnThis(),
            send: jest.fn(),
        };
    });

    describe('when IP Whitelist is disabled', () => {
        beforeEach(() => {
            mockConfig.ENABLE_IP_WHITELIST = false;
        });

        it('should do nothing and return', async () => {
            // 使用正确的工厂函数名称
            const middleware = createIpWhitelistAuthMiddleware(mockConfig);
            await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
            expect(mockReply.code).not.toHaveBeenCalled();
            expect(mockReply.send).not.toHaveBeenCalled();
        });
    });

    describe('when IP Whitelist is enabled', () => {
        beforeEach(() => {
            mockConfig.ENABLE_IP_WHITELIST = true;
            mockConfig.IP_WHITELIST = ['192.168.1.100', '10.0.0.1']; // 设置白名单
        });

        it('should pass if whitelist contains \'*\'', async () => {
            mockConfig.IP_WHITELIST = ['*']; // 允许所有
            // 创建特定 IP 的请求
            const specificMockRequest = { ...mockRequest, ip: '8.8.8.8' };
            const middleware = createIpWhitelistAuthMiddleware(mockConfig);
            await middleware(specificMockRequest as FastifyRequest, mockReply as FastifyReply);
            expect(mockReply.code).not.toHaveBeenCalled();
            expect(mockReply.send).not.toHaveBeenCalled();
        });

        it('should pass if request IP is in the whitelist (exact match)', async () => {
            // 创建特定 IP 的请求
            const specificMockRequest = { ...mockRequest, ip: '10.0.0.1' }; // 在白名单中的 IP
            const middleware = createIpWhitelistAuthMiddleware(mockConfig);
            await middleware(specificMockRequest as FastifyRequest, mockReply as FastifyReply);
            expect(mockReply.code).not.toHaveBeenCalled();
            expect(mockReply.send).not.toHaveBeenCalled();
        });

        it('should return 403 if request IP is not in the whitelist', async () => {
            // 创建特定 IP 的请求
            const specificMockRequest = { ...mockRequest, ip: '1.2.3.4' }; // 不在白名单中的 IP
            const middleware = createIpWhitelistAuthMiddleware(mockConfig);
            await middleware(specificMockRequest as FastifyRequest, mockReply as FastifyReply);
            expect(mockReply.code).toHaveBeenCalledWith(403);
            expect(mockReply.send).toHaveBeenCalledWith({ error: 'Forbidden: Your IP is not allowed' });
        });

        it('should handle empty whitelist gracefully (allow nothing unless \'*\' is present)', async () => {
            mockConfig.IP_WHITELIST = []; // 空白名单
            // 创建特定 IP 的请求 (虽然在此例中 IP 不重要，但保持一致性)
            const specificMockRequest = { ...mockRequest, ip: '127.0.0.1' };
            const middleware = createIpWhitelistAuthMiddleware(mockConfig);
            await middleware(specificMockRequest as FastifyRequest, mockReply as FastifyReply);
            expect(mockReply.code).toHaveBeenCalledWith(403);
            expect(mockReply.send).toHaveBeenCalledWith({ error: 'Forbidden: Your IP is not allowed' });
        });
    });
});
