/**
 * UNM-Server API 测试脚本
 * 使用方法: node test/api-test.js [baseUrl] [apiKey]
 */

const http = require('http');
const https = require('https');
const url = require('url');

// 测试配置
const config = {
    baseUrl: process.argv[2] || 'http://localhost:5678',
    apiKey: process.argv[3] || '',  // 可选的API密钥
    timeout: 10000,  // 请求超时时间(毫秒)
    endpoints: [
        { path: '/', method: 'GET', name: '根路径API信息' },
        { path: '/v1/api/health', method: 'GET', name: '健康检查' },
        { path: '/v1/api/info', method: 'GET', name: '服务信息' },
        { path: '/v1/api/sources', method: 'GET', name: '可用音源列表' },
        { path: '/v1/api/check?id=2010653', method: 'GET', name: '歌曲检查', needsAuth: true },
        { path: '/v1/api/match?id=2010653', method: 'GET', name: '音乐匹配', needsAuth: true }
    ]
};

// 解析基础URL
const baseUrlParsed = url.parse(config.baseUrl);
const httpModule = baseUrlParsed.protocol === 'https:' ? https : http;

// 计数器
let passed = 0;
let failed = 0;
let total = config.endpoints.length;

/**
 * 发送HTTP请求
 */
function sendRequest(endpoint) {
    return new Promise((resolve, reject) => {
        const requestUrl = `${config.baseUrl}${endpoint.path}`;
        console.log(`测试 [${endpoint.name}]: ${endpoint.method} ${requestUrl}`);

        const options = {
            method: endpoint.method,
            timeout: config.timeout,
            headers: {
                'User-Agent': 'UNM-Server-Tester/1.0',
            }
        };

        // 添加API密钥（如果需要且提供了）
        if (endpoint.needsAuth && config.apiKey) {
            options.headers['X-API-Key'] = config.apiKey;
        }

        const req = httpModule.request(requestUrl, options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    // 尝试解析JSON响应
                    let jsonData = null;
                    try {
                        jsonData = JSON.parse(data);
                    } catch (e) {
                        jsonData = { body: data.substring(0, 100) + (data.length > 100 ? '...' : '') };
                    }

                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: jsonData
                    });
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('请求超时'));
        });

        req.end();
    });
}

/**
 * 运行所有测试
 */
async function runTests() {
    console.log(`\n==== UNM-Server API 测试 ====`);
    console.log(`基础URL: ${config.baseUrl}`);
    console.log(`API密钥: ${config.apiKey ? '已提供' : '未提供'}`);
    console.log(`测试端点数: ${total}\n`);

    for (const endpoint of config.endpoints) {
        try {
            const result = await sendRequest(endpoint);

            // 检查状态码
            if (result.statusCode >= 200 && result.statusCode < 400) {
                console.log(`✅ [${endpoint.name}] 状态码: ${result.statusCode}`);
                passed++;
            } else if (endpoint.needsAuth && !config.apiKey && result.statusCode === 401) {
                // 需要认证但未提供API密钥，这是预期行为
                console.log(`⚠️ [${endpoint.name}] 状态码: ${result.statusCode} (需要API密钥)`);
                passed++;
            } else {
                console.log(`❌ [${endpoint.name}] 失败: 状态码 ${result.statusCode}`);
                console.log(`   响应: ${JSON.stringify(result.data, null, 2).substring(0, 200)}...`);
                failed++;
            }
        } catch (error) {
            console.log(`❌ [${endpoint.name}] 错误: ${error.message}`);
            failed++;
        }

        // 简单的请求间隔
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 输出测试结果摘要
    console.log(`\n==== 测试完成 ====`);
    console.log(`通过: ${passed}/${total}`);
    console.log(`失败: ${failed}/${total}`);
    console.log(`通过率: ${Math.round((passed / total) * 100)}%\n`);

    // 返回失败的测试数量作为退出码
    process.exit(failed);
}

// 启动测试
runTests(); 