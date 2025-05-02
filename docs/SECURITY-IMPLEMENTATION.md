# UNM-Server API 安全实施指南

本文档为开发和运维人员提供了UNM-Server API安全功能的详细实施指南，包括鉴权机制的配置、部署和维护。

## 实施步骤

### 1. 创建鉴权中间件

首先，在项目中创建鉴权中间件文件：

```bash
mkdir -p src/middlewares
touch src/middlewares/auth.ts
```

将以下代码添加到`auth.ts`文件中：

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config/env';

// API密钥验证中间件
export async function apiKeyAuth(request: FastifyRequest, reply: FastifyReply) {
  // 如果API鉴权被禁用，直接通过
  if (!config.ENABLE_API_AUTH) {
    return;
  }

  // 获取Authorization头
  const authHeader = request.headers.authorization;
  
  // 如果未提供Authorization头，返回401
  if (!authHeader) {
    return reply.status(401).send({
      code: 401,
      message: '未提供API密钥',
    });
  }

  // 检查Authorization头格式
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return reply.status(401).send({
      code: 401,
      message: 'API密钥格式错误',
    });
  }

  // 验证API密钥
  const apiKeys = config.API_KEYS.split(',').map(key => key.trim()).filter(Boolean);
  if (apiKeys.length === 0 || !apiKeys.includes(token)) {
    return reply.status(401).send({
      code: 401,
      message: 'API密钥无效',
    });
  }
}

// IP白名单验证中间件
export async function ipWhitelistAuth(request: FastifyRequest, reply: FastifyReply) {
  // 如果IP白名单验证被禁用，直接通过
  if (!config.ENABLE_IP_WHITELIST) {
    return;
  }

  const clientIp = request.ip;
  const whitelist = config.IP_WHITELIST.split(',').map(ip => ip.trim()).filter(Boolean);
  
  // 如果白名单为空或包含*通配符，允许所有IP
  if (whitelist.length === 0 || whitelist.includes('*')) {
    return;
  }
  
  // 检查IP是否在白名单中
  const ipMatch = whitelist.some(allowedIp => {
    // 精确匹配
    if (allowedIp === clientIp) {
      return true;
    }
    
    // 简单的通配符匹配（如10.0.0.*）
    if (allowedIp.endsWith('*')) {
      const prefix = allowedIp.slice(0, -1);
      return clientIp.startsWith(prefix);
    }
    
    return false;
  });
  
  if (!ipMatch) {
    return reply.status(403).send({
      code: 403,
      message: '当前IP无访问权限',
    });
  }
}

// 请求记录中间件
export async function requestLogger(request: FastifyRequest, reply: FastifyReply) {
  // 记录请求开始时间
  const start = Date.now();
  
  // 完成后记录请求信息
  reply.addHook('onSend', (_, __, payload, done) => {
    const duration = Date.now() - start;
    const log = {
      method: request.method,
      url: request.url,
      ip: request.ip,
      statusCode: reply.statusCode,
      duration: `${duration}ms`,
      userAgent: request.headers['user-agent'] || 'unknown',
      contentLength: Buffer.byteLength(payload),
    };
    
    // 使用Fastify的日志器记录请求
    request.log.info(log, 'API Request');
    done(null, payload);
  });
}

// 组合认证中间件
export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  // 始终记录请求
  await requestLogger(request, reply);
  
  // 跳过对健康检查、状态检查和OPTIONS请求的验证
  if (
    request.url === '/health' || 
    request.url === '/v1/api/health' ||
    request.url === '/status' ||
    request.url === '/v1/api/status' ||
    request.method === 'OPTIONS'
  ) {
    return;
  }

  // 应用IP白名单验证
  await ipWhitelistAuth(request, reply);
  
  // 如果响应已发送（被拒绝），则返回
  if (reply.sent) return;
  
  // 应用API密钥验证
  await apiKeyAuth(request, reply);
}
```

### 2. 更新配置模块

更新`src/config/env.ts`文件，添加鉴权相关的配置选项：

```typescript
// 在EnvironmentConfig接口中添加
interface EnvironmentConfig {
  // ... 现有配置 ...
  
  // 新增鉴权配置
  ENABLE_API_AUTH: boolean;
  API_KEYS: string;
  ENABLE_IP_WHITELIST: boolean;
  IP_WHITELIST: string;
  
  // 请求频率限制配置
  ENABLE_RATE_LIMIT: boolean;
  RATE_LIMIT_MAX: number;
  RATE_LIMIT_WINDOW: number;
}

// 默认配置中添加
const defaultConfig: EnvironmentConfig = {
  // ... 现有默认配置 ...
  
  // 鉴权默认配置
  ENABLE_API_AUTH: false,        // 开发环境默认禁用
  API_KEYS: '',
  ENABLE_IP_WHITELIST: false,
  IP_WHITELIST: '*',
  
  // 请求频率限制默认配置
  ENABLE_RATE_LIMIT: true,
  RATE_LIMIT_MAX: 100,
  RATE_LIMIT_WINDOW: 60000,      // 60秒
};

// 在config对象中添加环境变量读取
export const config: EnvironmentConfig = {
  // ... 现有配置 ...
  
  // 鉴权配置
  ENABLE_API_AUTH: process.env.ENABLE_API_AUTH === 'true',
  API_KEYS: process.env.API_KEYS || defaultConfig.API_KEYS,
  ENABLE_IP_WHITELIST: process.env.ENABLE_IP_WHITELIST === 'true',
  IP_WHITELIST: process.env.IP_WHITELIST || defaultConfig.IP_WHITELIST,
  
  // 请求频率限制配置
  ENABLE_RATE_LIMIT: process.env.ENABLE_RATE_LIMIT !== 'false',
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || String(defaultConfig.RATE_LIMIT_MAX), 10),
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || String(defaultConfig.RATE_LIMIT_WINDOW), 10),
};
```

### 3. 在应用中注册中间件

修改`src/app.ts`文件，导入并注册鉴权中间件：

```typescript
import { authMiddleware } from './middlewares/auth';

// ... 现有代码 ...

export async function createApp(): Promise<FastifyInstance> {
  // ... 现有代码 ...
  
  // 配置请求频率限制
  await app.register(fastifyRateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW,
    enabled: config.ENABLE_RATE_LIMIT,
    errorResponseBuilder: () => ({
      code: 429,
      message: '请求过于频繁，请稍后再试',
    }),
  });
  
  // ... 其他中间件 ...
  
  // 注册认证中间件
  app.addHook('onRequest', authMiddleware);
  
  // ... 路由注册 ...
  
  return app;
}
```

### 4. 更新环境变量文件

更新`.env.example`文件，添加鉴权相关的环境变量示例：

```
# 鉴权配置
ENABLE_API_AUTH=true             # 是否启用API密钥验证
API_KEYS=key1,key2,key3          # API密钥列表，多个密钥用逗号分隔
ENABLE_IP_WHITELIST=false        # 是否启用IP白名单
IP_WHITELIST=127.0.0.1,10.0.0.*  # IP白名单，支持通配符，多个IP用逗号分隔

# 请求频率限制配置
ENABLE_RATE_LIMIT=true           # 是否启用请求频率限制
RATE_LIMIT_MAX=100               # 时间窗口内最大请求数
RATE_LIMIT_WINDOW=60000          # 时间窗口（毫秒）
```

对各环境文件进行相应的设置：

- `.env.development`: 开发环境，可以禁用API鉴权以便测试
- `.env.production`: 生产环境，必须启用API鉴权和适当的频率限制

### 5. 生成和管理API密钥

创建一个安全的API密钥生成脚本：

```bash
# 创建脚本文件
touch script/generate-api-key.js
chmod +x script/generate-api-key.js
```

将以下内容添加到脚本中：

```javascript
#!/usr/bin/env node

/**
 * API密钥生成脚本
 * 
 * 用法:
 * node script/generate-api-key.js [名称]
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 生成随机API密钥
function generateApiKey(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

// 生成一个新的API密钥
const keyName = process.argv[2] || 'api-key';
const apiKey = generateApiKey();

console.log('\n============ UNM-Server API密钥生成器 ============');
console.log(`\n生成的API密钥 (${keyName}):`);
console.log('\x1b[32m%s\x1b[0m', apiKey);

// 保存到密钥文件
try {
  const keysFile = path.join(__dirname, '..', 'api-keys.json');
  let keys = {};
  
  // 如果文件存在，读取现有密钥
  if (fs.existsSync(keysFile)) {
    const fileContent = fs.readFileSync(keysFile, 'utf8');
    keys = JSON.parse(fileContent);
  }
  
  // 添加新密钥
  keys[keyName] = {
    key: apiKey,
    created: new Date().toISOString()
  };
  
  // 写入文件
  fs.writeFileSync(keysFile, JSON.stringify(keys, null, 2));
  console.log(`\n密钥已保存到: ${keysFile}`);
  
  // 输出环境变量格式
  console.log('\n将以下内容添加到您的.env文件中:');
  console.log('\x1b[33m%s\x1b[0m', `API_KEYS=${Object.values(keys).map(k => k.key).join(',')}`);
  
} catch (error) {
  console.error('保存密钥时出错:', error);
}

console.log('\n使用方法:');
console.log('在API请求中添加以下头部:');
console.log('\x1b[36m%s\x1b[0m', `Authorization: Bearer ${apiKey}`);
console.log('\n==================================================\n');
```

执行脚本生成API密钥：

```bash
node script/generate-api-key.js client1
```

### 6. 更新API文档

更新或创建API文档，告知用户如何使用API密钥进行身份验证：

```markdown
# API认证

UNM-Server API采用Bearer Token认证机制。请求时需要在HTTP请求头中提供API密钥。

## 认证方法

在每个请求的HTTP头中添加以下内容：

```
Authorization: Bearer <your_api_key>
```

其中`<your_api_key>`需要替换为管理员提供的实际API密钥。

## 示例

```bash
# 使用curl
curl -H "Authorization: Bearer abcdef123456" https://your-api-url/v1/api/match?id=12345
```

```javascript
// 使用JavaScript
fetch('https://your-api-url/v1/api/match?id=12345', {
  headers: {
    'Authorization': 'Bearer abcdef123456'
  }
})
.then(response => response.json())
.then(data => console.log(data));
```
```

## 部署与运维

### 生产环境配置

在部署到生产环境之前，确保进行以下配置：

1. **启用API密钥验证**：
   ```
   ENABLE_API_AUTH=true
   ```

2. **设置强密钥**：
   - 使用上述脚本生成强密钥
   - 长度至少32个字符
   - 为不同客户端/服务生成不同的密钥

3. **配置请求频率限制**：
   ```
   ENABLE_RATE_LIMIT=true
   RATE_LIMIT_MAX=60             # 每分钟60个请求
   RATE_LIMIT_WINDOW=60000       # 时间窗口1分钟
   ```

4. **对于私有部署环境，考虑启用IP白名单**：
   ```
   ENABLE_IP_WHITELIST=true
   IP_WHITELIST=10.0.0.*,192.168.1.*
   ```

### Docker部署

在使用Docker部署时，通过环境变量或环境变量文件传入鉴权配置：

```bash
# 使用环境变量
docker run -d -p 5678:5678 \
  -e NODE_ENV=production \
  -e ENABLE_API_AUTH=true \
  -e API_KEYS=key1,key2 \
  --name unm-server \
  unm-server

# 使用环境变量文件
docker run -d -p 5678:5678 \
  --env-file .env.production \
  --name unm-server \
  unm-server
```

对于敏感信息如API密钥，在生产环境中应考虑使用Docker Secrets：

```yaml
# docker-compose.yml
version: '3.8'
services:
  unm-server:
    image: unm-server
    ports:
      - "5678:5678"
    environment:
      - NODE_ENV=production
      - ENABLE_API_AUTH=true
    secrets:
      - api_keys
    # ...

secrets:
  api_keys:
    file: ./secrets/api_keys.txt
```

### Vercel部署

在Vercel平台部署时，在环境变量设置中添加鉴权配置：

1. 在Vercel控制台中，进入项目设置
2. 选择"Environment Variables"选项卡
3. 添加以下环境变量：
   - `ENABLE_API_AUTH`: `true`
   - `API_KEYS`: `key1,key2,key3`（使用实际的API密钥）
   - `ENABLE_RATE_LIMIT`: `true`
   - `RATE_LIMIT_MAX`: `60`
   - `RATE_LIMIT_WINDOW`: `60000`

对于API密钥等敏感信息，在Vercel控制台添加时请勾选"Encrypt"选项进行加密保护。

## 密钥轮换和撤销

为了维护良好的安全性，应定期轮换API密钥。以下是建议的密钥轮换流程：

1. **生成新密钥**：
   ```bash
   node script/generate-api-key.js client1-new
   ```

2. **更新环境变量**：
   - 在环境变量中添加新密钥，同时保留旧密钥
   - `API_KEYS=old-key,new-key`

3. **通知客户端**：
   - 通知客户端更新到新密钥
   - 给予足够的过渡时间（如2周）

4. **删除旧密钥**：
   - 过渡期后，从环境变量中移除旧密钥
   - 仅保留新密钥：`API_KEYS=new-key`

5. **监控和验证**：
   - 监控API使用情况，确保客户端正常运行
   - 检查日志中是否有使用已撤销密钥的尝试

## 安全监控

为了确保API安全，建议实施以下监控措施：

1. **日志监控**：
   - 监控401/403错误，可能表示有人尝试未授权访问
   - 查找异常的请求模式或频率突增

2. **使用量分析**：
   - 按客户端/IP分析API使用模式
   - 设置使用量基准线和警报阈值

3. **自动化警报**：
   - 配置针对以下情况的警报：
     - 密集的401/403错误
     - 超过阈值的429错误
     - 来自非预期地理位置的请求

4. **定期安全审查**：
   - 定期审查API密钥列表和使用情况
   - 移除未使用或不再需要的密钥

## 结论

通过实施本文档中描述的安全措施，UNM-Server API将获得全面的保护，同时确保合法用户能够便捷地访问和使用服务。基于实际部署场景和安全需求，可以进一步调整和定制这些安全措施。 