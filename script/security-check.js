#!/usr/bin/env node

/**
 * 安全配置检查脚本
 * 用于检查项目的安全配置是否符合最佳实践
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

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

// 获取项目根目录
const rootDir = path.resolve(__dirname, '..');

// 检查环境变量文件
function checkEnvFile() {
  log.title('检查环境变量配置');
  
  const envPath = path.join(rootDir, '.env');
  const envExamplePath = path.join(rootDir, '.env.example');
  
  // 检查.env文件是否存在
  if (!fs.existsSync(envPath)) {
    log.error('.env文件不存在，请从.env.example创建');
    return false;
  }
  
  // 加载环境变量
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  
  // 安全检查项
  const securityChecks = [
    {
      name: 'API认证',
      check: () => envConfig.ENABLE_API_AUTH === 'true',
      message: '未启用API认证 (ENABLE_API_AUTH=true)',
      severity: 'high'
    },
    {
      name: 'API密钥',
      check: () => envConfig.API_KEYS && envConfig.API_KEYS.length > 0,
      message: '未配置API密钥 (API_KEYS)',
      severity: 'high'
    },
    {
      name: 'API密钥强度',
      check: () => {
        if (!envConfig.API_KEYS) return false;
        const keys = envConfig.API_KEYS.split(',');
        return keys.every(key => key.trim().length >= 16);
      },
      message: 'API密钥长度不足16个字符，安全性较低',
      severity: 'medium'
    },
    {
      name: '请求频率限制',
      check: () => envConfig.ENABLE_RATE_LIMIT === 'true',
      message: '未启用请求频率限制 (ENABLE_RATE_LIMIT=true)',
      severity: 'medium'
    },
    {
      name: 'CORS配置',
      check: () => envConfig.CORS_ORIGIN && envConfig.CORS_ORIGIN !== '*',
      message: 'CORS配置允许所有域访问 (CORS_ORIGIN=*)',
      severity: 'medium'
    },
    {
      name: '文档访问',
      check: () => envConfig.NODE_ENV === 'production' ? envConfig.ENABLE_DOCS !== 'true' : true,
      message: '生产环境中启用了API文档 (ENABLE_DOCS=true)',
      severity: 'low'
    },
    {
      name: '日志级别',
      check: () => envConfig.NODE_ENV === 'production' ? 
        (envConfig.LOG_LEVEL === 'warn' || envConfig.LOG_LEVEL === 'error') : true,
      message: '生产环境中日志级别过低，可能记录敏感信息',
      severity: 'low'
    }
  ];
  
  // 执行检查
  let passedChecks = 0;
  let highSeverityIssues = 0;
  let mediumSeverityIssues = 0;
  let lowSeverityIssues = 0;
  
  securityChecks.forEach(check => {
    const passed = check.check();
    
    if (passed) {
      passedChecks++;
      log.success(`✓ ${check.name}: 通过`);
    } else {
      if (check.severity === 'high') {
        log.error(`✗ ${check.name}: ${check.message} [高风险]`);
        highSeverityIssues++;
      } else if (check.severity === 'medium') {
        log.warn(`✗ ${check.name}: ${check.message} [中风险]`);
        mediumSeverityIssues++;
      } else {
        log.info(`✗ ${check.name}: ${check.message} [低风险]`);
        lowSeverityIssues++;
      }
    }
  });
  
  // 显示结果摘要
  log.title('安全检查结果');
  console.log(`通过检查: ${passedChecks}/${securityChecks.length}`);
  console.log(`高风险问题: ${highSeverityIssues}`);
  console.log(`中风险问题: ${mediumSeverityIssues}`);
  console.log(`低风险问题: ${lowSeverityIssues}`);
  
  // 提供修复建议
  if (highSeverityIssues > 0 || mediumSeverityIssues > 0) {
    log.title('修复建议');
    
    if (!envConfig.ENABLE_API_AUTH || envConfig.ENABLE_API_AUTH !== 'true') {
      console.log(`1. 启用API认证: ${colors.yellow}ENABLE_API_AUTH=true${colors.reset}`);
    }
    
    if (!envConfig.API_KEYS || envConfig.API_KEYS.length === 0) {
      console.log(`2. 生成并配置API密钥: ${colors.yellow}node script/generate-api-key.js${colors.reset}`);
    }
    
    if (!envConfig.ENABLE_RATE_LIMIT || envConfig.ENABLE_RATE_LIMIT !== 'true') {
      console.log(`3. 启用请求频率限制: ${colors.yellow}ENABLE_RATE_LIMIT=true${colors.reset}`);
    }
    
    if (!envConfig.CORS_ORIGIN || envConfig.CORS_ORIGIN === '*') {
      console.log(`4. 限制CORS访问域名: ${colors.yellow}CORS_ORIGIN=your-domain.com${colors.reset}`);
    }
    
    if (envConfig.NODE_ENV === 'production' && envConfig.ENABLE_DOCS === 'true') {
      console.log(`5. 在生产环境中禁用API文档: ${colors.yellow}ENABLE_DOCS=false${colors.reset}`);
    }
  }
  
  return highSeverityIssues === 0;
}

// 检查依赖项安全
function checkDependencies() {
  log.title('检查依赖项安全');
  
  const packageJsonPath = path.join(rootDir, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    log.error('package.json文件不存在');
    return false;
  }
  
  log.info('建议定期运行依赖项安全审计:');
  console.log(`  ${colors.yellow}npm run security-audit${colors.reset}`);
  
  return true;
}

// 检查文件权限
function checkFilePermissions() {
  log.title('检查文件权限');
  
  // 在Windows环境中，文件权限检查不太相关
  if (process.platform === 'win32') {
    log.info('在Windows环境中跳过文件权限检查');
    return true;
  }
  
  const envPath = path.join(rootDir, '.env');
  
  if (fs.existsSync(envPath)) {
    try {
      const stats = fs.statSync(envPath);
      const mode = stats.mode.toString(8);
      const permissions = mode.substring(mode.length - 3);
      
      if (permissions !== '600' && permissions !== '400') {
        log.warn(`.env文件权限过于宽松: ${permissions}`);
        log.info('建议设置更严格的权限: chmod 600 .env');
      } else {
        log.success('.env文件权限设置正确');
      }
    } catch (err) {
      log.error('检查.env文件权限时出错:', err.message);
    }
  }
  
  return true;
}

// 主函数
function main() {
  log.title('UNM-Server 安全配置检查');
  
  // 执行各项检查
  const envCheck = checkEnvFile();
  const dependenciesCheck = checkDependencies();
  const permissionsCheck = checkFilePermissions();
  
  // 总结
  log.title('安全检查总结');
  
  if (envCheck && dependenciesCheck && permissionsCheck) {
    log.success('基本安全检查通过，但仍建议定期进行全面的安全审计');
  } else {
    log.warn('安全检查发现问题，请根据上述建议进行修复');
  }
  
  console.log('\n安全最佳实践:');
  console.log('1. 定期更新依赖项，修复已知漏洞');
  console.log('2. 使用强密码和长度足够的API密钥');
  console.log('3. 在生产环境中使用HTTPS');
  console.log('4. 定期轮换API密钥');
  console.log('5. 监控异常访问和错误日志');
}

// 执行主函数
main();
