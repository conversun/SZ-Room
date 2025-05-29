# 深圳住建局通知公告抓取与飞书推送系统

## 项目简介

本项目是一个自动化的网页抓取系统，专门用于监控深圳市住房和建设局的通知公告页面，并将新发布的公告通过飞书机器人推送给用户。系统采用 Node.js + TypeScript 开发，支持定时任务和智能去重。

## 功能特点

- 🕷️ **智能网页抓取**: 支持多页面数据抓取，具备重试机制和反爬虫处理
- 🔍 **灵活数据过滤**: 支持时间范围、关键词包含/排除等多种过滤条件
- 🚀 **内存去重机制**: 避免重复推送，支持程序重启后的持久化去重
- 📨 **飞书推送集成**: 支持 Webhook 和 Bot API 两种推送方式，消息格式丰富
- ⏰ **定时任务调度**: 基于 cron 表达式的灵活定时执行
- 📊 **完善日志系统**: 分级日志记录，支持日志轮转和文件存储
- 🐳 **容器化部署**: 提供 Docker 和 docker-compose 配置
- 🔧 **生产就绪**: 支持 PM2 进程管理，具备健康检查和优雅关闭

## 技术栈

- **核心框架**: Node.js + TypeScript
- **HTTP 请求**: axios
- **HTML 解析**: cheerio
- **定时任务**: node-cron
- **日志系统**: winston + winston-daily-rotate-file
- **飞书集成**: @larksuiteoapi/node-sdk
- **环境配置**: dotenv
- **进程管理**: PM2
- **容器化**: Docker + Docker Compose

## 快速开始

### 1. 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0
- (可选) Docker & Docker Compose
- (可选) PM2

### 2. 安装依赖

```bash
# 克隆项目
git clone <repository-url>
cd sz-room-crawler

# 安装依赖
npm install
```

### 3. 环境配置

复制环境变量模板并配置：

```bash
cp env.example .env
```

编辑 `.env` 文件，配置必要参数：

```bash
# 应用配置
NODE_ENV=development
LOG_LEVEL=info

# 爬虫配置
CRAWLER_BASE_URL=https://zjj.sz.gov.cn/ztfw/zfbz/tzgg2017/index.html
FILTER_DAY_RANGE=7
FILTER_KEYWORDS=住房,建设,规划,土地,房屋

# 飞书配置 (二选一)
# 方式一：Webhook
FEISHU_WEBHOOK_URL=your_webhook_url_here
FEISHU_WEBHOOK_SECRET=your_webhook_secret_here

# 方式二：Bot API
FEISHU_APP_ID=your_app_id_here
FEISHU_APP_SECRET=your_app_secret_here
FEISHU_CHAT_ID=your_chat_id_here

# 定时任务配置
SCHEDULE_ENABLED=true
SCHEDULE_CRON=0 */1 * * *  # 每小时执行一次
```

### 4. 构建与运行

```bash
# 构建项目
npm run build

# 开发模式运行
npm run dev

# 生产模式运行
npm start

# 单次执行（不启动定时任务）
RUN_ONCE=true npm start
```

## 飞书配置

### 方式一：Webhook 机器人

1. 在飞书群组中添加自定义机器人
2. 获取 Webhook URL
3. (可选) 设置安全验证密钥
4. 在 `.env` 中配置 `FEISHU_WEBHOOK_URL` 和 `FEISHU_WEBHOOK_SECRET`

### 方式二：Bot API

1. 创建飞书应用
2. 获取 App ID 和 App Secret
3. 将机器人添加到目标群组
4. 获取 Chat ID
5. 在 `.env` 中配置对应参数

## 部署指南

### PM2 部署

```bash
# 安装 PM2
npm install -g pm2

# 启动应用
npm run start:pm2

# 查看状态
npm run logs:pm2

# 停止应用
npm run stop:pm2
```

### Docker 部署

```bash
# 构建镜像
docker build -t sz-room-crawler .

# 运行容器
docker run -d \
  --name sz-room-crawler \
  --env-file .env \
  -v $(pwd)/logs:/app/logs \
  sz-room-crawler
```

### Docker Compose 部署

```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

## 配置详解

### 爬虫配置

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `CRAWLER_BASE_URL` | 目标网站URL | 深圳住建局通知公告页面 |
| `CRAWLER_USER_AGENT` | 浏览器标识 | Chrome 120 |
| `CRAWLER_TIMEOUT` | 请求超时时间(ms) | 10000 |
| `CRAWLER_RETRY_TIMES` | 重试次数 | 3 |

### 过滤配置

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `FILTER_DAY_RANGE` | 获取最近N天的数据 | 7 |
| `FILTER_KEYWORDS` | 包含关键词(逗号分隔) | - |
| `FILTER_EXCLUDE_KEYWORDS` | 排除关键词(逗号分隔) | - |
| `FILTER_CACHE_SIZE` | 内存缓存大小 | 1000 |

### 定时任务配置

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `SCHEDULE_ENABLED` | 启用定时任务 | true |
| `SCHEDULE_CRON` | Cron 表达式 | `0 */1 * * *` (每小时) |

### 常用 Cron 表达式

- `0 */1 * * *` - 每小时执行
- `0 */30 * * * *` - 每30分钟执行  
- `0 0 9,12,18 * * *` - 每天9点、12点、18点执行
- `0 0 9 * * 1-5` - 工作日上午9点执行

## 使用示例

### 单次运行测试

```bash
# 测试系统功能
RUN_ONCE=true npm start

# 查看日志
tail -f logs/combined-*.log
```

### 自定义过滤条件

```bash
# 只获取包含"住房"或"建设"的最近3天公告
FILTER_DAY_RANGE=3 FILTER_KEYWORDS=住房,建设 npm start
```

### 开发模式调试

```bash
# 启用调试日志
LOG_LEVEL=debug npm run dev
```

## 监控与维护

### 日志查看

```bash
# 查看所有日志
tail -f logs/combined-*.log

# 查看错误日志
tail -f logs/error-*.log

# PM2 日志
pm2 logs sz-room-crawler
```

### 健康检查

系统提供多种健康检查方式：

- 通过飞书推送测试连接状态
- Docker 容器健康检查
- PM2 进程监控

### 故障排除

1. **网络连接问题**
   - 检查目标网站可访问性
   - 验证防火墙设置
   - 确认代理配置

2. **飞书推送失败**
   - 验证 Webhook URL 有效性
   - 检查 App ID/Secret 配置
   - 确认机器人权限

3. **解析数据为空**
   - 确认网站结构未发生变化
   - 检查选择器配置
   - 验证过滤条件设置

## 项目结构

```
src/
├── config/           # 配置文件
│   ├── config.ts     # 主配置
│   └── feishu.ts     # 飞书配置
├── crawler/          # 爬虫模块
│   ├── scraper.ts    # 网页抓取
│   └── parser.ts     # 数据解析
├── filter/           # 过滤模块
│   ├── dataFilter.ts    # 数据过滤
│   └── deduplication.ts # 去重处理
├── notification/     # 推送模块
│   ├── feishuBot.ts     # 飞书机器人
│   └── messageTemplate.ts # 消息模板
├── scheduler/        # 定时任务
│   └── cronJob.ts    # 任务调度
├── services/         # 业务服务
│   └── crawlerService.ts # 爬虫服务
├── utils/           # 工具类
│   ├── cache.ts     # 缓存管理
│   └── logger.ts    # 日志工具
├── types/           # 类型定义
│   └── index.ts
└── app.ts           # 应用入口
```

## 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 许可证

本项目基于 MIT 许可证开源 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 更新日志

### v1.0.0 (2024-01-01)
- 初始版本发布
- 支持深圳住建局通知公告抓取
- 集成飞书推送功能
- 提供 Docker 部署支持 