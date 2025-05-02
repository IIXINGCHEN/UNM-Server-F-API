# UNM-Server (纯API版本) 安装说明

## 环境要求

- Node.js 18.x 或更高版本
- pnpm 8.x 或更高版本
- 可选: Redis 服务器 (用于高并发场景)

## 安装步骤

### 本地开发

1. 克隆仓库
```bash
git clone https://github.com/imsyy/UNM-Server.git
cd UNM-Server
```

2. 安装依赖
```bash
pnpm install
```

3. 配置环境变量
```bash
# 复制示例配置文件
cp .env.example .env.development
# 根据需要编辑配置
nano .env.development
```

4. 开发环境运行
```bash
pnpm run dev
```

### 生产环境部署

1. 克隆仓库
```bash
git clone https://github.com/imsyy/UNM-Server.git
cd UNM-Server
```

2. 安装依赖并构建
```bash
pnpm install
pnpm run build
```

3. 配置环境变量
```bash
# 复制示例配置文件
cp .env.example .env
# 编辑生产环境配置
nano .env
```

4. 启动服务
```bash
# 直接启动
pnpm start

# 或使用PM2集群模式启动
pnpm run prd
```

### 自动部署脚本

对于Debian/Ubuntu/CentOS等Linux发行版，可以使用提供的部署脚本快速完成安装：

1. 下载部署脚本
```bash
wget https://raw.githubusercontent.com/imsyy/UNM-Server/main/deploy.sh
```

2. 添加执行权限
```bash
chmod +x deploy.sh
```

3. 执行部署
```bash
sudo ./deploy.sh
```

部署脚本将自动安装依赖、配置环境、设置系统服务和防火墙规则。

## Docker部署

### 方法1：使用Dockerfile构建镜像

1. 构建镜像
```bash
docker build -t unm-server .
```

2. 运行容器
```bash
docker run -d \
  -p 5678:5678 \
  -e NODE_ENV=production \
  -e ALLOWED_DOMAIN=your-domain.com \
  --name unm-server \
  unm-server
```

### 方法2：使用环境变量文件运行

1. 复制并编辑环境变量文件
```bash
cp .env.example .env.docker
nano .env.docker
```

2. 使用环境变量文件运行容器
```bash
docker run -d \
  -p 5678:5678 \
  --env-file .env.docker \
  --name unm-server \
  unm-server
```

### 方法3：使用Docker Compose

1. 创建docker-compose.yml文件
```yaml
version: '3'
services:
  unm-server:
    build: .
    ports:
      - "5678:5678"
    environment:
      - NODE_ENV=production
      - ALLOWED_DOMAIN=*
    restart: always
```

2. 启动服务
```bash
docker-compose up -d
```

## Vercel部署

Vercel提供免费的Serverless部署，特别适合个人API项目和低流量场景。

### 准备工作

1. 在[Vercel](https://vercel.com)上注册账号（可使用GitHub账号直接登录）
2. Fork或克隆本项目到你的GitHub仓库
3. 确保项目根目录包含`vercel.json`和`.vercelignore`文件（已包含在项目中）

### 部署步骤

#### 方法1：使用Vercel控制台部署

1. 登录[Vercel控制台](https://vercel.com/dashboard)
2. 点击"Add New..."，然后选择"Project"
3. 导入你的GitHub仓库
4. 配置项目:
   - 框架预设：选择`Other`
   - 构建命令：使用vercel.json中的设置
   - 输出目录：使用vercel.json中的设置
   - 环境变量：添加必要的环境变量
5. 点击"Deploy"按钮

#### 方法2：使用Vercel CLI部署

1. 安装Vercel CLI
```bash
npm install -g vercel
```

2. 登录Vercel
```bash
vercel login
```

3. 在项目目录中部署
```bash
vercel
```

4. 按照提示完成配置

5. 生产环境部署
```bash
vercel --prod
```

### 注意事项

1. Vercel部署的应用是无状态的，每次函数调用都是独立的
2. 免费计划有执行时间限制（10秒）和内存限制（1GB）
3. 某些音源需要的系统依赖（如`yt-dlp`）在Vercel环境中可能无法使用

更多详情请参考项目中的[Vercel部署指南](./vercel-deploy-guide.md)

## API集成说明

作为纯API服务，您可以通过以下方式集成到您的应用中：

1. **直接API调用**：使用HTTP请求直接调用API端点
   ```javascript
   // 示例：使用fetch获取音乐数据
   fetch('http://your-api-url/match?id=12345&server=kuwo,kugou')
     .then(response => response.json())
     .then(data => console.log(data));
   ```

2. **API客户端库**：使用项目提供的客户端库（如果有）
   ```javascript
   // 示例：使用API客户端库
   import { UNMClient } from 'unm-client';
   
   const client = new UNMClient('http://your-api-url');
   client.match('12345', ['kuwo', 'kugou'])
     .then(result => console.log(result));
   ```

3. **服务器端集成**：在您的后端服务中集成
   ```javascript
   // 示例：Node.js后端集成
   const axios = require('axios');
   
   async function getMusicUrl(songId) {
     const response = await axios.get(`http://your-api-url/match?id=${songId}&server=kuwo,kugou`);
     return response.data;
   }
   ```

## 常见问题

1. **跨域问题**
   - 确保在.env文件中正确设置ALLOWED_DOMAIN
   - '*'表示允许所有域名访问

2. **部分音源需要Cookie**
   - 请参阅README.md中的音源清单，了解哪些音源需要设置Cookie

3. **环境变量未生效**
   - 确保修改.env文件后重启服务
   - 在Docker环境中需要重新创建容器

4. **API返回404或500错误**
   - 检查日志获取详细错误信息
   - 确认API路径和参数格式正确
   - 验证必要的环境变量已正确配置

5. **请求超时**
   - 可能是音源响应慢或不可用
   - 尝试使用其他音源服务器
   - 考虑增加超时配置值

## 系统维护

项目提供了几个实用的维护脚本：

1. **备份脚本** (backup.sh)
   - 定期备份配置和数据
   - 可通过crontab设置定期执行

2. **监控脚本** (monitor.sh)
   - 监控服务状态和健康情况
   - 可自动重启异常服务

3. **Git管理脚本** (git-manager.sh)
   - 简化版本控制操作
   - 支持配置同步和环境管理

```bash
# 使用Git管理脚本
./git-manager.sh status    # 查看状态
./git-manager.sh commit    # 提交更改
./git-manager.sh sync-env  # 同步环境配置
```

## 更多信息

- 查看README.md获取API使用信息
- 参考项目源码中的注释了解更多配置选项
- 访问API路径`/docs`获取完整的API文档 