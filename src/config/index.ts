/**
 * 配置模块统一导出文件
 * 用于集中管理所有配置，提供一致的导入路径
 */

// 导出环境配置
export * from './env';

// 导出音源相关配置
export * from './sources';

// 导出音乐源描述
export * from './music-sources';

// 导出config对象作为默认导出
export { config as default } from './env'; 