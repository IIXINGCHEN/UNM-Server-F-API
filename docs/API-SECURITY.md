# UNM-Server API 安全设计方案

## 目录
- [概述](#概述)
- [安全挑战分析](#安全挑战分析)
- [鉴权方案设计](#鉴权方案设计)
  - [API密钥认证](#api密钥认证)
  - [JSON Web Token (JWT)](#json-web-token-jwt)
  - [IP白名单](#ip白名单)
  - [请求频率限制](#请求频率限制)
- [实现细节](#实现细节)
  - [鉴权中间件](#鉴权中间件)
  - [环境变量配置](#环境变量配置)
  - [代码修改](#代码修改)
- [部署建议](#部署建议)
- [安全最佳实践](#安全最佳实践)

## 概述

UNM-Server作为一个提供音乐解锁功能的API服务，需要一个安全可靠的鉴权机制来保护API免受滥用和恶意攻击。本文档详细说明了UNM-Server API的安全设计方案和实现细节。

## 安全挑战分析

当前UNM-Server API面临以下安全挑战：

1. **未授权访问**: 任何知道API地址的人都可以直接访问和使用API，缺乏身份验证机制。
2. **资源滥用**: 无限制访问可能导致服务器资源被耗尽，特别是在并发请求大量增加的情况下。
3. **服务质量降低**: 过多的请求会导致合法用户体验下降。
4. **潜在的DDoS风险**: 没有请求速率限制和其他保护措施，使服务容易受到DDoS攻击。
5. **服务成本增加**: 在云环境下，未授权使用可能导致带宽和计算成本显著增加。
6. **敏感信息泄露**: 日志和错误响应中可能包含敏感信息，如完整的API密钥、系统路径或堆栈跟踪。

## 鉴权方案设计

针对UNM-Server API的特点和安全需求，我们设计了多层次的鉴权方案：

### API密钥认证

API密钥认证是最基本也是最适合UNM-Server的鉴权方式，适用于服务器到服务器的API调用场景。

**实现方式**:

1. **密钥生成与分发**:
   - 系统管理员生成唯一的API密钥
   - 密钥分发给授权的第三方应用或服务
   - 支持多密钥管理，不同客户端使用不同密钥

2. **密钥验证**:
   - 客户端在每次请求中通过请求头传递API密钥: `Authorization: Bearer <api_key>`
   - 服务器验证API密钥的有效性
   - 对无效密钥的请求返回401 Unauthorized

3. **密钥权限**:
   - 基础版: 简单的有效/无效验证
   - 进阶版: 不同密钥可设置不同的访问权限和使用配额

4. **密钥安全处理**:
   - 实现API密钥掩码功能，日志中只显示密钥的部分字符
   - 长密钥(>32字符)只显示前2和后2字符
   - 中等长度密钥(8-32字符)只显示前3和后3字符
   - 短密钥(<8字符)不进行掩码处理(不推荐使用短密钥)

### JSON Web Token (JWT)

对于需要用户身份验证的场景（如管理接口），采用JWT鉴权方案。

**实现方式**:

1. **认证流程**:
   - 用户通过安全渠道提供凭证
   - 服务器验证凭证并生成JWT令牌
   - 令牌包含用户ID、权限等信息，并用密钥签名

2. **令牌验证**:
   - 客户端在请求头中携带JWT: `Authorization: Bearer <jwt_token>`
   - 服务器验证JWT签名和有效期
   - 提取令牌中的用户信息和权限

3. **令牌更新**:
   - 实现令牌刷新机制
   - 支持令牌撤销

### IP白名单

对于部署在私有或受控环境中的API服务，可以实施IP白名单限制。

**实现方式**:

1. **配置白名单**:
   - 在环境配置中设置允许访问的IP地址列表
   - 支持IP范围设置(CIDR表示法)

2. **请求验证**:
   - 检查请求的源IP是否在白名单中
   - 对非白名单IP的请求返回403 Forbidden

### 请求频率限制

为防止API滥用，实施请求频率限制是必要的。

**实现方式**:

1. **限制配置**:
   - 基于IP地址的请求限制
   - 基于API密钥的请求限制
   - 可为不同端点设置不同的限制

2. **限制策略**:
   - 固定窗口限制(如每分钟100个请求)
   - 滑动窗口限制(更精确的控制)
   - 令牌桶算法(允许短时间的突发流量)

3. **限制响应**:
   - 当请求超过限制时返回429 Too Many Requests
   - 在响应头中包含限制信息和重置时间

## 实现细节

### 鉴权中间件

在UNM-Server中实现一个统一的鉴权中间件，处理所有API的鉴权逻辑：

```typescript
// src/middlewares/auth.ts
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
  const apiKeys = config.API_KEYS.split(',');
  if (!apiKeys.includes(token)) {
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
  const whitelist = config.IP_WHITELIST.split(',');
  
  // 检查IP是否在白名单中
  if (!whitelist.includes(clientIp) && !whitelist.includes('*')) {
    return reply.status(403).send({
      code: 403,
      message: '当前IP无访问权限',
    });
  }
}

// 组合中间件
export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  // 跳过对健康检查和OPTIONS请求的验证
  if (
    request.url === '/health' || 
    request.url === '/v1/api/health' || 
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

### 环境变量配置

在环境配置中添加鉴权相关的变量：

```
# 鉴权配置
ENABLE_API_AUTH=true             # 是否启用API密钥验证
API_KEYS=key1,key2,key3          # API密钥列表，多个密钥用逗号分隔
ENABLE_IP_WHITELIST=false        # 是否启用IP白名单
IP_WHITELIST=192.168.1.1,10.0.0.* # IP白名单，支持通配符，多个IP用逗号分隔

# 请求频率限制配置
ENABLE_RATE_LIMIT=true           # 是否启用请求频率限制
RATE_LIMIT_MAX=100               # 时间窗口内最大请求数
RATE_LIMIT_WINDOW=60000          # 时间窗口（毫秒）
```

### 代码修改

1. **环境配置更新**:

修改`src/config/env.ts`，添加鉴权相关的配置项：

```typescript
// 在EnvironmentConfig接口中添加
interface EnvironmentConfig {
  // 现有配置...
  
  // 鉴权相关配置
  ENABLE_API_AUTH: boolean;
  API_KEYS: string;
  ENABLE_IP_WHITELIST: boolean;
  IP_WHITELIST: string;
  
  // 请求频率限制配置
  ENABLE_RATE_LIMIT: boolean;
  RATE_LIMIT_MAX: number;
  RATE_LIMIT_WINDOW: number;
}

// 在defaultConfig中添加默认值
const defaultConfig: EnvironmentConfig = {
  // 现有默认配置...
  
  // 鉴权默认配置
  ENABLE_API_AUTH: false,
  API_KEYS: '',
  ENABLE_IP_WHITELIST: false,
  IP_WHITELIST: '*',
  
  // 请求频率限制默认配置
  ENABLE_RATE_LIMIT: true,
  RATE_LIMIT_MAX: 100,
  RATE_LIMIT_WINDOW: 60000,
};

// 在config对象中添加对应的环境变量读取
export const config: EnvironmentConfig = {
  // 现有配置...
  
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

2. **应用中间件**:

在`src/app.ts`中注册认证中间件：

```typescript
import { authMiddleware } from './middlewares/auth';

// 在其他中间件之后，路由之前注册认证中间件
app.addHook('onRequest', authMiddleware);
```

3. **更新请求频率限制配置**:

修改现有的请求频率限制配置，使用环境变量中的设置：

```typescript
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
```

## 部署建议

1. **API密钥管理**:
   - 使用随机生成的强密钥（至少32字符长度）
   - 定期轮换API密钥
   - 避免在代码或公共环境中硬编码密钥
   - 为不同的客户端或服务分配不同的密钥

2. **环境隔离**:
   - 在开发环境中可以禁用鉴权以便于测试
   - 在生产环境中必须启用全部安全措施
   - 测试环境使用单独的API密钥

3. **密钥分发**:
   - 通过加密通道安全地分发API密钥
   - 在文档中明确说明API密钥的使用方法
   - 提供密钥撤销和更新的机制

4. **监控与审计**:
   - 记录所有API调用，包括调用方、时间、资源和结果
   - 设置异常检测机制，识别可疑的API使用模式
   - 定期审查API使用情况，及时发现滥用行为

5. **Docker配置**:
   - 在Dockerfile或docker-compose配置中使用环境变量文件
   - 使用Docker Secrets或Kubernetes Secrets存储API密钥

## 安全最佳实践

1. **HTTPS加密**:
   - 所有API通信必须使用HTTPS
   - 配置适当的SSL/TLS设置，禁用不安全的协议和密码套件
   - 定期更新SSL证书

2. **最小权限原则**:
   - API密钥应只具有完成特定任务所需的最小权限
   - 定期审查和更新权限设置

3. **输入验证**:
   - 对所有API输入进行严格验证
   - 使用适当的数据类型和格式检查
   - 防止SQL注入、命令注入等攻击

4. **错误处理**:
   - 生产环境中不暴露详细错误信息
   - 使用通用错误消息，避免泄露系统内部信息
   - 保持完整的错误日志用于调试

5. **依赖管理**:
   - 定期更新依赖包，修复已知安全漏洞
   - 使用自动化工具监控依赖的安全性

6. **敏感信息保护**:
   - 为防止API服务泄露敏感信息，实施以下保护措施：
     - 错误响应处理: 移除所有API错误响应中的堆栈跟踪
     - 在生产环境中使用通用错误消息替代详细错误描述
     - 实现错误类型分类，客户端只能看到必要的错误信息
   - 健康状态接口保护: 掩码处理网络接口信息
     - 隐藏服务器主机名
     - 脱敏客户端IP地址和用户代理信息
     - 服务配置信息(如Redis URL、API URL)只显示"已配置"而非实际URL
   - 日志安全: 敏感信息(如API密钥、个人身份信息)在日志中进行掩码处理
     - 开发环境和生产环境使用不同的日志详细级别
     - 使用结构化日志格式便于审计和分析
   - 异常处理: 未捕获异常处理机制，防止敏感信息泄露
     - 在生产环境中仅记录错误类型，不记录详细堆栈

通过实施这些安全措施，UNM-Server API将获得全面的保护，同时确保合法用户能够便捷地访问和使用服务。 