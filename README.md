<!-- Thanks to https://zhconvert.org's Chinese (China) converter ! -->

<img src="./public/favicon.png" alt="logo" width="140" height="140" align="right">

# UNM-Server (纯API版本)

匹配网易云无法播放歌曲

## 特性

- 支持多个音源，替换变灰歌曲链接
- 使用TypeScript开发，提高代码质量和可维护性
- 基于Fastify框架，提供更快的响应速度
- 支持Redis缓存，大幅提升并发处理能力
- PM2集群模式支持，充分利用多核性能
- 多种部署方式：传统服务器、Docker、Vercel Serverless
- 完善的错误处理和请求验证机制
- 支持多种API格式，兼容旧版调用方式
- Swagger API文档，提供交互式接口测试
- 完整的单元测试和集成测试支持
- 纯API服务，仅返回JSON数据，更适合集成
- 增强的安全保护：API密钥认证、敏感信息掩码、安全的错误处理

## 运行

```bash
# 安装依赖
pnpm install

# 开发环境运行
pnpm run dev

# 构建
pnpm run build

# 生产环境运行
pnpm start

# 使用PM2集群模式运行
pnpm run prd

# 运行测试
pnpm test
```

## 项目结构

```
UNM-Server/
├── dist/               # 构建输出目录（不包含在代码仓库中）
├── docs/               # 文档
├── public/             # 公共资源目录（仅用于favicon等基本资源）
├── script/             # 部署和管理脚本
├── src/                # 源代码
│   ├── config/         # 配置文件
│   ├── middlewares/    # 中间件
│   ├── plugins/        # Fastify插件（包括Swagger）
│   ├── routes/         # API路由
│   ├── services/       # 业务逻辑
│   ├── types/          # 类型定义
│   ├── utils/          # 工具函数
│   ├── app.ts          # 应用配置
│   ├── config.ts       # 环境变量处理
│   └── main.ts         # 入口文件
└── test/               # 测试
    ├── unit/           # 单元测试
    └── integration/    # 集成测试
```

## API文档

系统提供自动生成的Swagger API文档，可通过以下方式访问：

- 开发环境：自动启用，访问 http://localhost:5678/docs
- 生产环境：默认关闭，可通过.env文件中的ENABLE_DOCS=true开启

API文档提供完整的接口说明、参数说明和在线测试功能，方便开发和调试。

## 部署方式

### 传统服务器部署

使用提供的部署脚本快速完成服务器部署：

```bash
# 下载部署脚本
wget https://raw.githubusercontent.com/imsyy/UNM-Server/main/deploy.sh

# 添加执行权限
chmod +x deploy.sh

# 执行部署
sudo ./deploy.sh
```

### Docker部署

```bash
# 构建Docker镜像
docker build -t unm-server .

# 运行容器
docker run -d -p 5678:5678 --name unm-server unm-server

# 使用环境变量
docker run -d -p 5678:5678 \
  -e NODE_ENV=production \
  -e ALLOWED_DOMAIN=* \
  --name unm-server unm-server
```

### Vercel部署

Vercel提供免费的Serverless部署，特别适合个人项目：

1. Fork本仓库到你的GitHub账号
2. 在[Vercel](https://vercel.com)中导入项目
3. 配置环境变量 (尤其重要: `API_KEYS`, 以及根据需要配置的`REDIS_URL` 和 各平台 `COOKIE`)
   *   **API 密钥 (`API_KEYS`)**: 这是**必须**的环境变量。运行 `node script/generate-api-key.js` 生成一个密钥，然后将其值设置到 Vercel 的环境变量 `API_KEYS` 中。多个密钥用逗号分隔。
   *   **其他配置**: 根据 `.env.example` 的说明，按需配置 Redis, 音乐平台 Cookie 等。
4. 点击部署

详细说明请参考[Vercel部署指南](./docs/vercel-deploy-guide.md)

## 反向代理

> 如需使用该功能，需要自行部署 [siteproxy](https://github.com/netptop/siteproxy)

如使用此API服务时，可能会有部分音源的 `url` 不支持 `https`，此时可以使用反向代理来解决（请在 `.env` 文件中填入部署后的接口地址）

## 使用

**重要**: 如果启用了API认证 (`ENABLE_API_AUTH=true`)，您需要在请求头中提供有效的API密钥。

```http
GET https://example.com/match?id=1962165898&server=kuwo,kugou,bilibili
Authorization: Bearer YOUR_API_KEY
```

其中 `YOUR_API_KEY` 是您通过环境变量 `API_KEYS` 配置的密钥之一。

为了向后兼容，服务会自动将部分旧的无前缀 API 路径（例如 `/match`, `/url` 等）重定向到新的版本化路径（例如 `/v1/api/match`）。推荐在新集成或调用中使用带 `/v1/api` 前缀的路径以获得最佳实践和未来兼容性。

### 参数

| 参数   | 默认           |
| ------ | -------------- |
| id     | /              |
| server | 见下方音源清单 |

### 音源清单

| 名称                        | 代号         | 默认启用 | 注意事项                                                    |
| --------------------------- | ------------ | -------- | ----------------------------------------------------------- |
| QQ 音乐                     | `qq`         |          | 需要在环境变量中准备自己的 `QQ_COOKIE`                                  |
| 酷狗音乐                    | `kugou`      | ✅       |                                                             |
| 酷我音乐                    | `kuwo`       | ✅       |                                                             |
| 咪咕音乐                    | `migu`       | ✅       | 需要在环境变量中准备自己的 `MIGU_COOKIE`                                |
| JOOX                        | `joox`       |          | 需要在环境变量中准备自己的 `JOOX_COOKIE`，似乎有严格地区限制。          |
| YouTube（纯 JS 解析方式）   | `youtube`    |          | 需要 Google 认定的**非中国大陆区域** IP 地址。              |
| yt-download                 | `ytdownload` |          | **似乎不能使用**。                                          |
| YouTube（通过 `youtube-dl`) | `youtubedl`  |          | 需要自行安装 `youtube-dl`。                                 |
| YouTube（通过 `yt-dlp`)     | `ytdlp`      | ✅       | 需要自行安装 `yt-dlp`（`youtube-dl` 仍在活跃维护的 fork）。 |
| B 站音乐                    | `bilibili`   | ✅       |                                                             |
| 第三方网易云 API            | `pyncmd`     |          |                                                             |

## 项目管理

项目提供Git管理脚本，方便版本控制和部署：

```bash
# 查看状态
./script/git-manager.sh status

# 提交更改
./script/git-manager.sh commit

# 同步环境配置
./script/git-manager.sh sync-env

# 显示帮助
./script/git-manager.sh help
```

## 测试

项目使用Jest进行测试，支持单元测试和集成测试：

```bash
# 运行所有测试
pnpm test

# 运行特定测试文件
pnpm test -- test/unit/config.test.ts

# 生成测试覆盖率报告
pnpm test -- --coverage
```

## 开发建议

- 使用pnpm作为包管理器，避免使用npm生成package-lock.json
- 确保dist目录不包含在版本控制中
- 不要在仓库中包含`.env`文件，只保留.env.example作为模板
- **关键**: 敏感信息（如 `API_KEYS`, `REDIS_URL`, 各平台 `COOKIE`）**必须**通过环境变量进行配置，切勿硬编码或提交到版本库。
- 使用shx等跨平台工具代替特定操作系统的命令
- 使用统一的配置导入方式：`import { config } from '../config'`
- 添加单元测试和集成测试，确保代码质量

## 现代化版本更新内容

- TypeScript重构，提高代码质量
- 使用Fastify替代Koa，提升性能
- Redis缓存支持，优化高并发场景
- PM2集群模式，充分利用多核性能
- 更完善的错误处理和请求验证
- 优化的Docker构建配置
- 新增Vercel无服务器部署支持
- 添加Swagger API文档
- 完整的测试框架支持
- 移除前端渲染，改为纯API服务，更易于集成

## 计划中的功能 (Todo)

- 缓存优化
- 音源质量智能选择
- TypeScript类型定义完善
- 国际化支持
- 第三方调用示例