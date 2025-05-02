#!/usr/bin/env node

/**
 * 智能启动脚本
 * 自动执行依赖安装、构建和启动流程
 *
 * 此脚本会自动检查是否需要安装依赖、清理 dist 目录、构建项目，然后启动服务器。
 * 支持两种启动模式：
 * 1. 使用编译后的 JavaScript 文件（生产模式，首选）
 * 2. 使用 tsx 直接运行 TypeScript 源代码（开发模式，备用）
 *
 * 注意：为了解决 TypeScript 编译问题，我们已经禁用了增量编译，
 * 并确保在每次构建前清除 dist 目录。
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 颜色配置
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// 日志函数
const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  title: (msg) => console.log(`\n${colors.cyan}=== ${msg} ===${colors.reset}\n`)
};

// 项目根目录
const rootDir = path.resolve(__dirname, '..');
// dist 目录
const distDir = path.join(rootDir, 'dist');
// package.json 路径
const packageJsonPath = path.join(rootDir, 'package.json');
// node_modules 目录
const nodeModulesDir = path.join(rootDir, 'node_modules');

/**
 * 执行命令并返回输出
 * @param {string} command 要执行的命令
 * @param {boolean} silent 是否静默执行
 * @returns {string} 命令输出
 */
function exec(command, silent = false) {
  try {
    if (!silent) {
      log.info(`执行命令: ${command}`);
    }
    return execSync(command, {
      cwd: rootDir,
      stdio: silent ? 'pipe' : 'inherit',
      encoding: 'utf8'
    });
  } catch (error) {
    log.error(`命令执行失败: ${command}`);
    log.error(error.message);
    process.exit(1);
  }
}

/**
 * 检查是否需要安装依赖
 * @returns {boolean} 是否需要安装依赖
 */
function checkDependencies() {
  log.title('检查依赖');

  // 检查 node_modules 目录是否存在
  if (!fs.existsSync(nodeModulesDir)) {
    log.warn('node_modules 目录不存在，需要安装依赖');
    return true;
  }

  // 检查 package.json 是否存在
  if (!fs.existsSync(packageJsonPath)) {
    log.error('package.json 文件不存在，无法检查依赖');
    process.exit(1);
  }

  try {
    // 使用 pnpm list 检查依赖状态
    const output = exec('pnpm list --json', true);
    const dependencies = JSON.parse(output);

    // 检查是否有缺失的依赖
    if (dependencies.missing && Object.keys(dependencies.missing).length > 0) {
      log.warn('检测到缺失的依赖，需要安装依赖');
      return true;
    }

    log.success('依赖检查通过，无需安装');
    return false;
  } catch (error) {
    log.warn('依赖检查失败，将执行安装以确保依赖完整');
    return true;
  }
}

/**
 * 安装依赖
 */
function installDependencies() {
  log.title('安装依赖');
  exec('pnpm install');
  log.success('依赖安装完成');
}

/**
 * 清空 dist 目录
 */
function cleanDist() {
  log.title('清理 dist 目录');

  if (fs.existsSync(distDir)) {
    try {
      // 删除 dist 目录中的所有文件
      fs.readdirSync(distDir).forEach(file => {
        const filePath = path.join(distDir, file);
        if (fs.lstatSync(filePath).isDirectory()) {
          // 递归删除子目录
          fs.rmSync(filePath, { recursive: true, force: true });
        } else {
          // 删除文件
          fs.unlinkSync(filePath);
        }
      });
      log.success('dist 目录已清空');
    } catch (error) {
      log.error(`清空 dist 目录失败: ${error.message}`);
      process.exit(1);
    }
  } else {
    log.info('dist 目录不存在，将在构建时创建');
  }
}

/**
 * 构建项目
 */
function buildProject() {
  log.title('构建项目');

  try {
    exec('pnpm run build');
    log.success('项目构建完成');
    return true;
  } catch (error) {
    log.error(`构建失败: ${error.message}`);
    log.warn('将使用 tsx 直接运行 TypeScript 源代码');
    return false;
  }
}

/**
 * 启动服务器
 * @param {boolean} useCompiled 是否使用编译后的 JavaScript 文件
 */
function startServer(useCompiled = false) {
  log.title('启动服务器');

  // 根据是否使用编译后的文件选择启动命令
  const startCommand = useCompiled ?
    ['node', 'dist/server.js'] :
    ['tsx', 'src/server.ts'];

  log.info(`启动模式: ${useCompiled ? '生产模式 (编译后的 JS)' : '开发模式 (直接运行 TS)'}`);

  // 使用 spawn 启动服务器，这样可以保持进程运行
  const server = spawn('pnpm', startCommand, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true
  });

  server.on('error', (error) => {
    log.error(`启动服务器失败: ${error.message}`);

    // 如果使用编译后的文件失败，尝试使用 tsx 直接运行
    if (useCompiled) {
      log.warn('尝试使用 tsx 直接运行 TypeScript 源代码...');
      startServer(false);
      return;
    }

    process.exit(1);
  });

  // 处理进程退出
  process.on('SIGINT', () => {
    log.info('接收到中断信号，正在关闭服务器...');
    server.kill('SIGINT');
  });

  process.on('SIGTERM', () => {
    log.info('接收到终止信号，正在关闭服务器...');
    server.kill('SIGTERM');
  });

  server.on('close', (code) => {
    // 如果是正常退出或者已经尝试过备用启动方式，则退出进程
    if (code === 0 || !useCompiled) {
      log.info(`服务器已关闭，退出码: ${code}`);
      process.exit(code);
    } else {
      // 如果使用编译后的文件失败，尝试使用 tsx 直接运行
      log.warn(`使用编译后的 JS 启动失败 (退出码: ${code})，尝试使用 tsx 直接运行...`);
      startServer(false);
    }
  });
}

/**
 * 主函数
 */
function main() {
  log.title('UNM-Server 智能启动');

  // 检查并安装依赖
  if (checkDependencies()) {
    installDependencies();
  }

  // 清空 dist 目录
  cleanDist();

  // 构建项目
  const buildSuccess = buildProject();

  // 启动服务器（根据构建结果决定使用编译后的 JS 还是直接运行 TS）
  startServer(buildSuccess);
}

// 执行主函数
main();
