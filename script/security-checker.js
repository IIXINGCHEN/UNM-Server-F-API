#!/usr/bin/env node

/**
 * 安全配置检查脚本
 * 使用统一安全检查器执行全面的安全检查
 */

// 确保先加载环境变量
require('dotenv').config();

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

// 主函数
async function main() {
  log.title('UNM-Server 安全配置检查');
  
  try {
    // 动态导入编译后的安全检查器
    // 注意：需要先编译TypeScript代码
    const { securityChecker } = require('../dist/utils/security-checker');
    
    // 执行安全检查
    const securityResult = securityChecker.checkSecurity(true); // 强制执行生产环境检查
    
    // 执行文件权限检查
    const permissionsResult = securityChecker.checkFilePermissions();
    
    // 合并警告
    const allWarnings = [...securityResult.warnings, ...permissionsResult.warnings];
    
    // 输出结果
    log.title('安全检查结果');
    
    if (allWarnings.length > 0) {
      allWarnings.forEach(warning => {
        if (warning.includes('高风险')) {
          log.error(warning);
        } else if (warning.includes('中风险')) {
          log.warn(warning);
        } else {
          log.info(warning);
        }
      });
      
      // 输出修复建议
      if (securityResult.remediations.length > 0) {
        log.title('修复建议');
        securityResult.remediations.forEach((remediation, index) => {
          console.log(`${index + 1}. ${remediation}`);
        });
      }
    } else {
      log.success('所有安全检查通过！');
    }
    
    // 输出安全检查统计
    console.log(`\n通过检查: ${securityResult.passedChecks}/${securityResult.totalChecks}`);
    console.log(`高风险问题: ${securityResult.highSeverityIssues}`);
    console.log(`中风险问题: ${securityResult.mediumSeverityIssues}`);
    console.log(`低风险问题: ${securityResult.lowSeverityIssues}`);
    
    // 检查依赖项安全
    log.title('依赖项安全');
    log.info('建议定期运行依赖项安全审计:');
    console.log(`  ${colors.yellow}pnpm audit${colors.reset}`);
    
    // 安全最佳实践
    log.title('安全最佳实践');
    console.log('1. 定期更新依赖项，修复已知漏洞');
    console.log('2. 使用强密码和长度足够的API密钥');
    console.log('3. 在生产环境中使用HTTPS');
    console.log('4. 定期轮换API密钥');
    console.log('5. 监控异常访问和错误日志');
    console.log('6. 使用防火墙和网络隔离');
    console.log('7. 定期进行安全审计和渗透测试');
    
    // 设置退出代码
    process.exitCode = securityResult.highSeverityIssues > 0 ? 1 : 0;
    
  } catch (error) {
    log.error(`执行安全检查时出错: ${error.message}`);
    console.error(error);
    process.exitCode = 1;
  }
}

// 执行主函数
main();
