/// <reference types="jest" />
import { config } from '../../src/config';

describe('Configuration Module', () => {
    // 测试配置对象是否存在
    test('config object should be defined', () => {
        expect(config).toBeDefined();
    });

    // 测试配置包含必要的属性
    test('config should have essential properties', () => {
        expect(config).toHaveProperty('PORT');
        expect(config).toHaveProperty('NODE_ENV');
        expect(config).toHaveProperty('ALLOWED_DOMAIN');
        expect(config).toHaveProperty('DEFAULT_SOURCES');
    });

    // 测试默认端口配置
    test('default PORT should be a number', () => {
        expect(typeof config.PORT).toBe('number');
    });

    // 测试默认音源配置
    test('DEFAULT_SOURCES should be an array', () => {
        expect(Array.isArray(config.DEFAULT_SOURCES)).toBe(true);
    });
}); 