# UNM-Server 安全最佳实践指南

本文档提供了UNM-Server API服务的安全最佳实践指南，帮助您安全地部署和维护服务。

## 目录

- [基本安全配置](#基本安全配置)
- [API密钥管理](#api密钥管理)
- [环境隔离](#环境隔离)
- [依赖项安全](#依赖项安全)
- [日志和监控](#日志和监控)
- [服务器安全](#服务器安全)
- [安全检查清单](#安全检查清单)

## 基本安全配置

### 1. 启用API认证

在生产环境中，**必须**启用API认证：

```
ENABLE_API_AUTH=true
```

### 2. 配置强密钥

使用项目提供的工具生成安全的随机API密钥：

```bash
npm run generate-api-key
# 或
node script/generate-api-key.js
```

确保API密钥长度至少为32个字符，并定期轮换。

### 3. 启用请求频率限制

启用请求频率限制，防止API滥用：

```
ENABLE_RATE_LIMIT=true
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
```

### 4. 限制CORS访问

在生产环境中，限制CORS访问域名，避免使用通配符：

```
CORS_ORIGIN=your-domain.com,another-domain.com
```

### 5. 禁用API文档

在生产环境中，建议禁用API文档：

```
ENABLE_DOCS=false
```

### 6. 配置适当的日志级别

在生产环境中，使用更高的日志级别，减少敏感信息泄露：

```
LOG_LEVEL=warn
```

## API密钥管理

### 1. 密钥生成

使用项目提供的工具生成安全的随机API密钥：

```bash
npm run generate-api-key client1 48
```

这将生成一个48字符长的API密钥，并可选择将其添加到.env文件中。

### 2. 密钥分发

- 通过安全渠道分发API密钥
- 为不同的客户端或服务分配不同的密钥
- 记录密钥的分配情况和用途

### 3. 密钥轮换

定期轮换API密钥，特别是在以下情况：

- 怀疑密钥泄露
- 员工离职
- 合作关系变更
- 定期安全审计后

轮换步骤：

1. 生成新密钥
2. 更新配置，同时保留旧密钥和新密钥
3. 通知客户端更新密钥
4. 给予足够的过渡期（如2周）
5. 移除旧密钥

### 4. 密钥撤销

如需立即撤销密钥访问权限：

1. 从配置中移除该密钥
2. 重启服务或重新加载配置
3. 记录撤销操作

## 环境隔离

### 1. 开发环境

开发环境可以禁用部分安全措施以便于测试：

```
NODE_ENV=development
ENABLE_API_AUTH=false
ENABLE_RATE_LIMIT=false
ENABLE_DOCS=true
LOG_LEVEL=debug
```

### 2. 测试环境

测试环境应模拟生产环境的安全配置：

```
NODE_ENV=test
ENABLE_API_AUTH=true
API_KEYS=test-api-key-1,test-api-key-2
ENABLE_RATE_LIMIT=true
ENABLE_DOCS=true
LOG_LEVEL=info
```

### 3. 生产环境

生产环境必须启用全部安全措施：

```
NODE_ENV=production
ENABLE_API_AUTH=true
API_KEYS=<secure-api-keys>
ENABLE_RATE_LIMIT=true
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
ENABLE_DOCS=false
LOG_LEVEL=warn
CORS_ORIGIN=your-domain.com
```

## 依赖项安全

### 1. 定期更新依赖

使用项目提供的安全审计工具检查依赖项：

```bash
npm run security-audit
```

根据审计结果更新有安全漏洞的依赖：

```bash
npm run security-fix
```

### 2. 锁定依赖版本

使用`package-lock.json`或`pnpm-lock.yaml`锁定依赖版本，确保部署一致性。

### 3. 使用可信来源

仅使用官方npm仓库或可信的私有仓库。

## 日志和监控

### 1. 日志配置

在生产环境中，配置适当的日志级别和日志轮转：

```
LOG_LEVEL=warn
LOG_TO_FILE=true
LOG_DIR=logs
```

### 2. 监控异常

监控以下异常情况：

- 401/403错误激增（可能是未授权访问尝试）
- 429错误（请求频率限制触发）
- 500错误（服务器内部错误）
- 异常的请求模式或流量突增

### 3. 审计日志

定期审查日志，寻找可疑活动：

- 来自异常地理位置的请求
- 在非常规时间的访问
- 针对特定端点的高频请求

## 服务器安全

### 1. HTTPS配置

在生产环境中，**必须**使用HTTPS：

- 使用有效的SSL证书
- 配置适当的SSL/TLS设置
- 启用HSTS头

### 2. 防火墙配置

限制服务器端口访问：

- 只开放必要的端口（如80、443）
- 限制SSH访问
- 使用IP白名单

### 3. 系统更新

定期更新服务器操作系统和软件：

- 安装安全补丁
- 更新Web服务器和其他组件
- 移除不必要的软件和服务

## 安全检查清单

使用项目提供的安全检查工具：

```bash
npm run security-check
```

定期检查以下项目：

- [x] API认证已启用
- [x] API密钥长度足够且安全
- [x] 请求频率限制已配置
- [x] CORS设置已限制
- [x] 生产环境中API文档已禁用
- [x] 日志级别设置适当
- [x] 依赖项已更新到最新安全版本
- [x] 使用HTTPS
- [x] 服务器防火墙已配置
- [x] 系统已更新

## 安全事件响应

如发现安全漏洞或遭遇安全事件：

1. 立即撤销受影响的API密钥
2. 记录事件详情和影响范围
3. 分析根本原因
4. 实施修复措施
5. 通知受影响的用户或客户端
6. 更新安全策略和程序

---

通过遵循这些安全最佳实践，您可以显著提高UNM-Server API服务的安全性，保护您的数据和用户。
