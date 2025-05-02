#!/usr/bin/env node

/**
 * API密钥生成工具
 *
 * 用法:
 * node script/generate-api-key.js [密钥名称] [密钥长度]
 *
 * 示例:
 * node script/generate-api-key.js client1 48
 *
 * 此脚本生成一个安全的随机API密钥并打印到控制台。
 * 可以选择将其自动添加到.env文件中。
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

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

/**
 * 生成安全的随机API密钥
 * @param {number} length 密钥长度
 * @returns {string} 随机生成的API密钥
 */
function generateApiKey(length = 32) {
    // 确保长度至少为32
    length = Math.max(32, length);

    // 使用加密安全的随机数生成器
    const buffer = crypto.randomBytes(Math.ceil(length * 0.75));

    // 转换为base64并移除非字母数字字符
    return buffer.toString('base64')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, length);
}

/**
 * 将API密钥添加到.env文件
 * @param {string} apiKey API密钥
 * @param {string} keyName 密钥名称（仅用于日志）
 */
function addKeyToEnvFile(apiKey, keyName) {
    // 记录密钥名称
    log.info(`正在添加密钥: ${keyName}`);
    const rootDir = path.resolve(__dirname, '..');
    const envPath = path.join(rootDir, '.env');
    const envExamplePath = path.join(rootDir, '.env.example');

    // 检查.env文件是否存在
    if (!fs.existsSync(envPath)) {
        if (fs.existsSync(envExamplePath)) {
            log.info('未找到.env文件，正在从.env.example创建');
            fs.copyFileSync(envExamplePath, envPath);
        } else {
            log.warn('未找到.env或.env.example文件，将创建新的.env文件');
            fs.writeFileSync(envPath, '# UNM-Server 环境变量配置\n\n');
        }
    }

    // 读取.env文件内容
    let envContent = fs.readFileSync(envPath, 'utf8');

    // 检查是否已有API_KEYS配置
    const apiKeysRegex = /^API_KEYS\s*=\s*(.*)$/m;
    const match = envContent.match(apiKeysRegex);

    if (match) {
        // 已有API_KEYS配置，添加新密钥
        const currentKeys = match[1].trim();
        const keyList = currentKeys ? currentKeys.split(',') : [];

        // 检查是否已存在相同密钥
        if (keyList.includes(apiKey)) {
            log.warn('该API密钥已存在于配置中');
            return;
        }

        // 添加新密钥
        keyList.push(apiKey);
        const newKeys = keyList.join(',');

        // 更新.env文件
        envContent = envContent.replace(apiKeysRegex, `API_KEYS=${newKeys}`);
        fs.writeFileSync(envPath, envContent);

        log.success(`已将新API密钥添加到.env文件`);
    } else {
        // 没有API_KEYS配置，添加新配置
        envContent += `\n# API密钥配置\nAPI_KEYS=${apiKey}\n`;
        fs.writeFileSync(envPath, envContent);

        log.success(`已将API_KEYS配置添加到.env文件`);
    }

    // 确保API认证已启用
    const authEnabledRegex = /^ENABLE_API_AUTH\s*=\s*(.*)$/m;
    const authMatch = envContent.match(authEnabledRegex);

    if (!authMatch) {
        // 添加ENABLE_API_AUTH配置
        envContent += `ENABLE_API_AUTH=true\n`;
        fs.writeFileSync(envPath, envContent);
        log.info('已添加ENABLE_API_AUTH=true配置');
    } else if (authMatch[1].trim() !== 'true') {
        // 更新ENABLE_API_AUTH配置
        envContent = envContent.replace(authEnabledRegex, 'ENABLE_API_AUTH=true');
        fs.writeFileSync(envPath, envContent);
        log.info('已将ENABLE_API_AUTH更新为true');
    }
}

// 主函数
function main() {
    log.title('UNM-Server API密钥生成器');

    // 获取命令行参数
    const args = process.argv.slice(2);
    const keyName = args[0] || 'default';
    const keyLength = parseInt(args[1], 10) || 32;

    if (keyLength < 32) {
        log.warn('安全警告: API密钥长度应至少为32个字符');
        log.warn('自动调整为最小安全长度: 32');
    }

    // 生成API密钥
    const apiKey = generateApiKey(keyLength);

    log.success(`已生成API密钥 (${keyLength}字符):`);
    console.log(`\n${colors.green}${apiKey}${colors.reset}\n`);

    // 询问是否添加到.env文件
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question(`是否将此密钥添加到.env文件? (y/n): `, (answer) => {
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
            addKeyToEnvFile(apiKey, keyName);
        }

        log.info('使用说明:');
        console.log(`1. 在API请求中使用 ${colors.cyan}Authorization: Bearer ${apiKey}${colors.reset}`);
        console.log(`2. 或使用请求头 ${colors.cyan}X-API-Key: ${apiKey}${colors.reset}`);
        console.log(`3. 确保在配置中启用API认证: ${colors.yellow}ENABLE_API_AUTH=true${colors.reset}`);

        rl.close();
    });
}

// 执行主函数
main();