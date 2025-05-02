# 构建阶段
FROM node:20-alpine AS builder

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production

# 安装pnpm
RUN npm install -g pnpm

# 首先只复制package文件，利用Docker缓存机制
COPY package.json pnpm-lock.yaml ./
COPY tsconfig.json ./

# 安装所有依赖（包括开发依赖，用于构建）
RUN pnpm install

# 复制源代码
COPY . .

# 构建应用
RUN pnpm run build

# 运行阶段（使用更轻量的镜像）
FROM node:20-alpine AS runtime

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production
ENV TZ=Asia/Shanghai

# 创建应用用户，避免使用root用户
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# 安装pnpm和必要的工具
RUN apk --no-cache add pnpm curl tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone && \
    apk del tzdata

# 创建必要的目录结构
RUN mkdir -p public logs dist && \
    chown -R appuser:appgroup /app

# 只复制运行时必要的文件
COPY --from=builder --chown=appuser:appgroup /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/script ./script

# 仅安装生产依赖
RUN pnpm install --prod

# 设置用户
USER appuser

# 设置卷挂载点
VOLUME ["/app/logs"]

# 健康检查 - 使用curl代替wget
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5678/v1/api/health || exit 1

# 暴露端口
EXPOSE 5678

# 使用脚本启动应用，包含优雅关闭
CMD ["node", "dist/main.js"]
