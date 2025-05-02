#!/usr/bin/env node

/**
 * 依赖项安全审计脚本
 * 用于检查项目依赖中的安全漏洞
 */

const { execSync } = require('child_process');
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
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// 日志函数
const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  title: (msg) => console.log(`\n${colors.cyan}=== ${msg} ===${colors.reset}\n`)
};

// 获取项目根目录
const rootDir = path.resolve(__dirname, '..');

// 检查是否使用pnpm
const isPnpm = fs.existsSync(path.join(rootDir, 'pnpm-lock.yaml'));
const packageManager = isPnpm ? 'pnpm' : 'npm';

log.title('依赖项安全审计');
log.info(`使用包管理器: ${packageManager}`);

// 创建报告目录
const reportsDir = path.join(rootDir, 'security-reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
  log.info(`创建报告目录: ${reportsDir}`);
}

// 生成报告文件名
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const reportFile = path.join(reportsDir, `security-audit-${timestamp}.txt`);

try {
  // 运行审计命令
  log.info('正在检查依赖项安全漏洞...');
  
  let auditOutput;
  try {
    if (isPnpm) {
      auditOutput = execSync('pnpm audit --json', { encoding: 'utf8' });
    } else {
      auditOutput = execSync('npm audit --json', { encoding: 'utf8' });
    }
  } catch (e) {
    // npm/pnpm audit 在发现漏洞时会返回非零退出码，但我们仍需要处理输出
    auditOutput = e.stdout;
  }

  // 解析审计结果
  const auditResult = JSON.parse(auditOutput);
  
  // 提取漏洞信息
  const vulnerabilities = auditResult.vulnerabilities || {};
  const metadata = auditResult.metadata || {};
  const totalVulnerabilities = metadata.vulnerabilities?.total || 0;
  
  // 保存完整报告
  fs.writeFileSync(reportFile, auditOutput);
  log.info(`完整报告已保存至: ${reportFile}`);
  
  // 显示摘要
  log.title('安全审计摘要');
  
  if (totalVulnerabilities === 0) {
    log.success('未发现安全漏洞');
  } else {
    log.warn(`发现 ${totalVulnerabilities} 个安全漏洞`);
    
    // 按严重程度分类
    const severityCount = {
      critical: metadata.vulnerabilities?.critical || 0,
      high: metadata.vulnerabilities?.high || 0,
      moderate: metadata.vulnerabilities?.moderate || 0,
      low: metadata.vulnerabilities?.low || 0
    };
    
    console.log(`${colors.red}严重: ${severityCount.critical}${colors.reset}`);
    console.log(`${colors.magenta}高危: ${severityCount.high}${colors.reset}`);
    console.log(`${colors.yellow}中危: ${severityCount.moderate}${colors.reset}`);
    console.log(`${colors.blue}低危: ${severityCount.low}${colors.reset}`);
    
    // 显示关键漏洞详情
    if (severityCount.critical > 0 || severityCount.high > 0) {
      log.title('关键漏洞详情');
      
      Object.entries(vulnerabilities).forEach(([pkg, info]) => {
        if (info.severity === 'critical' || info.severity === 'high') {
          const color = info.severity === 'critical' ? colors.red : colors.magenta;
          console.log(`${color}${pkg}${colors.reset} (${info.severity})`);
          console.log(`  影响版本: ${info.range}`);
          console.log(`  依赖路径: ${info.via?.[0]?.source || 'unknown'}`);
          console.log(`  修复版本: ${info.fixAvailable ? info.fixAvailable : '无可用修复'}`);
          console.log();
        }
      });
    }
    
    // 提供修复建议
    log.title('修复建议');
    if (isPnpm) {
      console.log(`运行 ${colors.cyan}pnpm audit fix${colors.reset} 修复可自动修复的漏洞`);
      console.log(`运行 ${colors.cyan}pnpm audit fix --force${colors.reset} 强制修复（可能会更新主版本）`);
    } else {
      console.log(`运行 ${colors.cyan}npm audit fix${colors.reset} 修复可自动修复的漏洞`);
      console.log(`运行 ${colors.cyan}npm audit fix --force${colors.reset} 强制修复（可能会更新主版本）`);
    }
  }
  
  // 检查过期依赖
  log.title('检查过期依赖');
  let outdatedOutput;
  try {
    if (isPnpm) {
      outdatedOutput = execSync('pnpm outdated --format json', { encoding: 'utf8' });
    } else {
      outdatedOutput = execSync('npm outdated --json', { encoding: 'utf8' });
    }
    
    const outdatedPackages = JSON.parse(outdatedOutput);
    const outdatedCount = Object.keys(outdatedPackages).length;
    
    if (outdatedCount === 0) {
      log.success('所有依赖都是最新的');
    } else {
      log.warn(`发现 ${outdatedCount} 个过期依赖`);
      
      // 保存过期依赖报告
      const outdatedReportFile = path.join(reportsDir, `outdated-${timestamp}.txt`);
      fs.writeFileSync(outdatedReportFile, outdatedOutput);
      log.info(`过期依赖报告已保存至: ${outdatedReportFile}`);
      
      // 显示主要过期依赖
      console.log('\n主要过期依赖:');
      Object.entries(outdatedPackages).slice(0, 10).forEach(([pkg, info]) => {
        console.log(`${colors.yellow}${pkg}${colors.reset}: ${info.current || 'unknown'} -> ${info.latest || 'unknown'}`);
      });
      
      if (outdatedCount > 10) {
        console.log(`...以及其他 ${outdatedCount - 10} 个依赖`);
      }
      
      console.log(`\n运行 ${colors.cyan}${packageManager} update${colors.reset} 更新依赖`);
    }
  } catch (e) {
    log.error('检查过期依赖时出错');
    console.error(e.message);
  }
  
} catch (error) {
  log.error('执行安全审计时出错');
  console.error(error);
  process.exit(1);
}
