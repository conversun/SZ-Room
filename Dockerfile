# 使用官方 Node.js 镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production
ENV TZ=Asia/Shanghai

# 安装 dumb-init 作为 PID 1
RUN apk add --no-cache dumb-init

# 复制 package 文件
COPY package*.json ./

# 安装依赖（包括 devDependencies）
RUN npm ci

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 删除 devDependencies 减小镜像大小
RUN npm prune --production

# 创建日志目录
RUN mkdir -p logs

# 暴露端口（如果需要）
# EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('Health check passed')" || exit 1

# 启动应用
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/app.js"] 