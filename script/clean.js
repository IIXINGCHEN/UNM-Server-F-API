#!/usr/bin/env node

/**
 * 清理脚本
 * 用于清空 dist 目录
 */

const fs = require('fs');
const path = require('path');

// 颜色配置
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
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
    log.info('dist 目录不存在，无需清理');
    
    // 创建 dist 目录
    try {
      fs.mkdirSync(distDir);
      log.success('已创建 dist 目录');
    } catch (error) {
      log.error(`创建 dist 目录失败: ${error.message}`);
      process.exit(1);
    }
  }
}

// 执行清理
cleanDist();
