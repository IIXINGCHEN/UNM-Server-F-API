/**
 * 统一服务器入口文件
 * 支持本地开发和 Vercel 无服务器环境
 */

import { createApp } from './app';
import { performSecurityCheck } from './utils/security-checker';
import { config } from './config/env';
import logger, { initLogger, LogLevel } from './utils/logger';
import * as net from 'net';

// 初始化日志记录器
initLogger({
  minLevel: config.LOG_LEVEL.toLowerCase() as LogLevel,
  logToFile: config.LOG_TO_FILE,
  logDir: config.LOG_DIR
});

// 执行安全配置检查
performSecurityCheck();

// 应用实例缓存（用于 Vercel 无服务器环境）
let serverlessApp: any = null;

/**
 * 检测端口是否被占用
 * @param port 要检测的端口
 * @returns 端口是否可用
 */
const checkPort = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    let timeoutId: NodeJS.Timeout | null = null;
    let server: net.Server | null = null;

    try {
      server = net
        .createServer()
        .once('error', (err: NodeJS.ErrnoException) => {
          if (timeoutId) clearTimeout(timeoutId);
          if (err.code === 'EADDRINUSE') {
            logger.warn(`端口 ${port} 已被占用, 正在尝试其他端口...`);
            try {
              if (server) server.close();
            } catch (closeErr) { }
            resolve(false);
          } else {
            logger.error(`检查端口 ${port} 时发生错误: ${err.message}`);
            try {
              if (server) server.close();
            } catch (closeErr) { }
            resolve(false);
          }
        })
        .once('listening', () => {
          if (timeoutId) clearTimeout(timeoutId);
          try {
            if (server) server.close();
          } catch (closeErr) { }
          resolve(true);
        });

      server.listen(port, '0.0.0.0');

      // 设置超时，防止端口检查卡住
      timeoutId = setTimeout(() => {
        try {
          if (server) server.close();
          logger.warn(`检查端口 ${port} 超时，不可用`);
          resolve(false);
        } catch (e) { }
      }, 5000); // 5秒超时
    } catch (e) {
      logger.error(`端口检查过程发生异常: ${String(e)}`);
      if (timeoutId) clearTimeout(timeoutId);
      if (server) {
        try {
          server.close();
        } catch (closeErr) { }
      }
      resolve(false);
    }
  });
};

/**
 * 初始化 Vercel 无服务器应用实例
 * @returns Fastify 应用实例
 */
const initServerlessApp = async () => {
  if (!serverlessApp) {
    try {
      logger.info('初始化 Vercel 无服务器应用实例');
      serverlessApp = await createApp();
      logger.info('Vercel 无服务器应用实例初始化成功');
    } catch (error) {
      logger.error('初始化 Vercel 无服务器应用实例失败:', { error: String(error) });
      throw error;
    }
  }
  return serverlessApp;
};

/**
 * Vercel 无服务器环境处理函数
 * @param req 请求对象
 * @param res 响应对象
 */
export default async (req: any, res: any) => {
  // 确保应用已初始化
  const fastify = await initServerlessApp();

  // 处理请求
  await fastify.ready();
  fastify.server.emit('request', req, res);
};

/**
 * 启动本地服务器
 * @param port 端口号
 * @param maxTries 最大尝试次数
 * @returns Fastify 应用实例
 */
export const startLocalServer = async (port: number = config.PORT || 5678, maxTries: number = 5) => {
  // 检查是否在 Vercel 环境中运行
  if (process.env.VERCEL === '1') {
    logger.info('在 Vercel 环境中运行，不启动本地服务器');
    return null;
  }

  let currentPort = port;
  let tries = 0;

  try {
    // 先检查指定端口是否可用
    let isPortAvailable = await checkPort(port);

    // 如果指定端口不可用，尝试其他端口
    while (!isPortAvailable && tries < maxTries) {
      currentPort++;
      tries++;
      logger.info(`尝试端口 ${currentPort} (${tries}/${maxTries})...`);
      isPortAvailable = await checkPort(currentPort);
    }

    if (!isPortAvailable) {
      logger.warn(`在 ${maxTries} 次尝试后未找到可用端口，使用随机端口`);
      currentPort = 0; // 使用随机可用端口
    }

    // 创建应用
    const app = await createApp();

    // 启动服务器
    await app.listen({ port: currentPort, host: '0.0.0.0' });

    const actualPort = app.server.address() && typeof app.server.address() === 'object'
      ? (app.server.address() as net.AddressInfo).port
      : currentPort;

    logger.info(`服务已在端口 ${actualPort} 上启动 - 环境: ${config.NODE_ENV}`);

    // 启动后验证端口
    setTimeout(() => {
      try {
        // 使用TCP客户端测试连接
        const client = net.createConnection({ port: actualPort, timeout: 2000 }, () => {
          client.end();
          logger.info(`端口 ${actualPort} 确认可用，服务已正常启动`);
        });

        client.on('error', (err) => {
          logger.warn(`服务似乎已启动但端口 ${actualPort} 无法连接: ${err.message}`);
        });

        client.on('timeout', () => {
          logger.warn(`连接端口 ${actualPort} 超时`);
          client.destroy();
        });
      } catch (e) {
        logger.warn(`服务启动后端口 ${actualPort} 测试失败: ${String(e)}`);
      }
    }, 1000);

    // 优雅关闭
    const gracefulShutdown = async (signal: string) => {
      logger.info(`收到 ${signal} 信号，正在优雅关闭...`);

      // 设置超时，防止关闭过程卡住
      const forceExit = setTimeout(() => {
        logger.error("无法在规定时间内完成关闭，强制退出");
        process.exit(1);
      }, 10000); // 10秒后强制退出

      try {
        await app.close();
        logger.info('应用程序正在退出，已清理资源');
        clearTimeout(forceExit);
        process.exit(0);
      } catch (error) {
        logger.error(`关闭应用程序时发生错误: ${String(error)}`);
        clearTimeout(forceExit);
        process.exit(1);
      }
    };

    // 监听进程信号
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    // 捕获未处理的异常
    process.on('uncaughtException', (error) => {
      logger.error('未捕获的异常:', error);
      process.exit(1);
    });

    // 捕获未处理的 Promise 拒绝
    process.on('unhandledRejection', (reason, _promise) => {
      logger.error('未处理的 Promise 拒绝:', { reason: String(reason) });
    });

    return app;
  } catch (error) {
    logger.error('应用启动失败:', { error: String(error) });
    process.exit(1);
  }
};

// 如果直接运行此文件，启动本地服务器
if (require.main === module) {
  startLocalServer().catch((error) => {
    logger.error('启动本地服务器失败:', error);
    process.exit(1);
  });
}
