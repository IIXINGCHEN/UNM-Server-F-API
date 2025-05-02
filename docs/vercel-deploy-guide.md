# Vercel部署指南 (UNM-Server API版本)

## Vercel简介

[Vercel](https://vercel.com) 是一个针对前端和Serverless应用的云平台，提供全球CDN分发、自动HTTPS、持续部署等功能。Vercel特别适合部署API服务，因为：

- **免费计划**：对个人项目提供慷慨的免费额度
- **Serverless架构**：自动扩展，无需管理服务器
- **全球CDN**：接入点遍布全球，降低API延迟
- **自动CI/CD**：与GitHub、GitLab等版本控制系统无缝集成

本指南将详细介绍如何将UNM-Server API服务部署到Vercel平台。

## 部署前准备

1. **Vercel账号**：
   - 访问[Vercel官网](https://vercel.com)注册账号
   - 推荐使用GitHub账号登录，便于代码仓库集成
   
2. **代码准备**：
   - Fork或克隆[UNM-Server仓库](https://github.com/imsyy/UNM-Server)
   - 确保你的仓库中包含以下Vercel特定文件：
     - `vercel.json`：Vercel配置文件
     - `.vercelignore`：指定不需要部署的文件

3. **环境变量准备**：
   - 准备好需要配置的环境变量（见下文环境变量配置部分）

## 部署方法

### 方法1：使用Vercel控制台部署（推荐新手使用）

1. 登录[Vercel控制台](https://vercel.com/dashboard)
2. 点击"Add New..."，然后选择"Project"
3. 从列表中选择你的UNM-Server仓库
   - 如果没有看到仓库，点击"Configure GitHub App"授权Vercel访问
4. 配置项目：
   - 项目名称：自定义或使用默认名称
   - 框架预设：选择"Other"（或保持默认）
   - 根目录：保持默认（`/`）
   - 构建命令：保留vercel.json中的配置
   - 输出目录：保留vercel.json中的配置
5. 配置环境变量（见下文环境变量配置部分）
6. 点击"Deploy"开始部署

部署完成后，Vercel会提供一个默认域名（例如：`your-project.vercel.app`）。

### 方法2：使用Vercel CLI部署（推荐开发者使用）

1. 全局安装Vercel CLI：
```bash
npm install -g vercel
```

2. 登录Vercel CLI：
```bash
vercel login
```

3. 进入项目目录并部署：
```bash
cd UNM-Server
vercel
```

4. 按照CLI提示配置项目：
   - 是否链接到现有项目？选择"No"创建新项目
   - 项目名称：输入或使用默认
   - 构建命令和输出目录：使用默认值

5. 部署到生产环境：
```bash
vercel --prod
```

### 方法3：GitHub集成自动部署

1. 在Vercel控制台完成初次部署后，Vercel会自动为仓库设置webhook
2. 之后，每次向仓库推送更改时，Vercel会自动触发新的部署
3. 可以在Vercel控制台的"Git"选项卡中配置自动部署选项：
   - 生产分支（通常是`main`或`master`）
   - 预览分支（用于测试的其他分支）

## 环境变量配置

Vercel支持设置环境变量，可在部署时提供给应用。对于UNM-Server API服务，以下是建议配置的关键环境变量：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `NODE_ENV` | 运行环境 | `production` |
| `ALLOWED_DOMAIN` | 允许跨域的域名，多个用逗号分隔 | `*` 或 `your-domain.com,another-domain.com` |
| `API_KEYS` | API访问密钥列表，多个用逗号分隔 | `your-secret-key1,your-secret-key2` |
| `CACHE_TTL` | 缓存有效期（秒） | `7200` |
| `ENABLE_RATE_LIMIT` | 是否启用请求限制 | `true` |
| `MAX_REQUEST_PER_MINUTE` | 每分钟最大请求数（启用请求限制时有效） | `60` |
| `DEBUG` | 是否启用调试日志 | `false` |

环境变量可以在Vercel控制台项目设置中的"Environment Variables"部分添加，或在使用CLI部署时通过`.env`文件提供。

## 自定义域名设置

要使用自定义域名而非Vercel提供的默认域名：

1. 在Vercel控制台，进入项目设置
2. 选择"Domains"选项卡
3. 点击"Add"按钮
4. 输入你的域名（例如：`api.yourdomain.com`）
5. 按照Vercel提供的DNS配置说明进行设置：
   - 添加CNAME记录（推荐）
   - 或者添加A记录指向Vercel IP
6. 等待DNS传播和SSL证书生成（通常需要几分钟到几小时）

完成后，你可以通过自定义域名访问API服务。

## Vercel配置文件说明

UNM-Server项目包含的`vercel.json`文件指定了Vercel部署的配置：

```json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/index.js",
      "use": "@vercel/node",
      "config": {
        "includeFiles": ["dist/**"]
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "dist/index.js"
    }
  ]
}
```

此配置告诉Vercel：
- 使用Node.js运行时
- 入口文件是`dist/index.js`
- 包含`dist`目录下的所有文件
- 将所有请求路由到入口文件

### .vercelignore文件

`.vercelignore`文件指定了不需要上传到Vercel的文件和目录，类似于`.gitignore`：

```
node_modules
.git
.env
.env.*
*.log
```

这有助于减少部署大小和时间。

## 部署后验证

部署完成后，通过以下步骤验证API是否正常工作：

1. 访问API状态端点：
   ```
   https://your-project.vercel.app/status
   ```
   
2. 测试API匹配功能：
   ```
   https://your-project.vercel.app/match?id=1447910476
   ```

3. 检查缓存功能是否正常：
   - 对同一ID进行多次请求，观察响应时间是否减少
   
4. 验证跨域设置是否生效：
   - 从不同域名的前端应用发起请求
   - 查看响应头是否包含正确的CORS头部

## 限制与注意事项

Vercel免费计划有一些限制，在部署API服务时需要注意：

1. **执行时间限制**：
   - 函数执行时间上限为10秒
   - 某些音源可能响应慢，导致超时
   
2. **内存限制**：
   - 每个实例内存上限为1GB
   - 大量并发请求可能导致内存不足
   
3. **带宽限制**：
   - 免费计划有100GB/月的带宽限制
   - 高流量API需要考虑升级到付费计划
   
4. **冷启动延迟**：
   - Serverless函数有冷启动时间
   - 长时间未访问的API可能首次响应较慢
   
5. **环境限制**：
   - 某些系统依赖在Vercel环境中不可用
   - 依赖`yt-dlp`等外部工具的音源可能无法正常工作

## 常见问题排查

### 部署失败

1. **构建错误**：
   - 检查Vercel部署日志中的构建错误
   - 确保所有依赖都正确安装
   - 查看是否存在Node.js版本兼容性问题

2. **环境变量问题**：
   - 确认所有必要的环境变量已正确设置
   - 检查环境变量名称和值是否正确（区分大小写）

### API错误

1. **404错误**：
   - 确认API路径是否正确
   - 检查`vercel.json`中的路由配置

2. **500错误**：
   - 查看Vercel日志获取详细错误信息
   - 常见原因：API依赖项缺失、环境变量配置错误

3. **超时错误**：
   - 音源响应时间过长导致超过Vercel时间限制（10秒）
   - 考虑使用更快的音源或优化请求处理

### 跨域问题

1. **CORS错误**：
   - 确认`ALLOWED_DOMAIN`环境变量设置正确
   - 检查请求头是否包含正确的`Origin`

2. **Options请求失败**：
   - 确保API正确处理预检(OPTIONS)请求
   - 验证CORS头部是否完整

## 性能优化

为了获得最佳的API性能，可以考虑以下优化：

1. **使用CDN缓存**：
   - 设置合适的缓存头部
   - 考虑在Vercel前增加专用CDN

2. **优化代码**：
   - 减少不必要的依赖
   - 优化异步请求处理
   - 使用流处理大型响应

3. **监控工具**：
   - 使用Vercel Analytics监控API性能
   - 设置警报以便及时发现问题

## 更多资源

- [Vercel文档](https://vercel.com/docs)
- [Vercel Serverless函数](https://vercel.com/docs/serverless-functions/introduction)
- [Vercel环境变量](https://vercel.com/docs/environment-variables)
- [UNM-Server API文档](/docs)

## 版本历史

| 日期 | 版本 | 描述 |
|------|------|------|
| 2023-12-01 | 1.0 | 初始版本 |
| 2024-05-15 | 1.1 | 添加API特定配置和性能优化部分 |
| 2024-06-20 | 1.2 | 更新为纯API服务部署说明 | 