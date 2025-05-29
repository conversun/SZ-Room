# 深圳住建局通知公告抓取系统

智能抓取深圳住建局通知公告，支持分类推送和Redis去重的飞书机器人推送系统。

## ✨ 新功能

### 🔄 Redis 去重支持
- 使用Redis缓存已发送的公告ID，避免重复推送
- 支持Redis不可用时自动降级到内存缓存
- 可配置TTL过期时间，自动清理历史记录

### 📂 智能分类推送
- 根据关键词自动对公告进行分类
- 支持三种推送模式：
  - `single`: 传统单条消息（不分类）
  - `categorized`: 分类后的单条消息
  - `by-category`: 每个分类单独发送一条消息
- 可自定义分类规则和优先级

## 🚀 功能特性

- **智能爬虫**: 定时抓取深圳住建局通知公告
- **过滤筛选**: 支持关键词过滤和时间范围筛选
- **去重机制**: Redis + 内存双重去重，确保不重复推送
- **分类推送**: 智能分类，按类别组织公告信息
- **飞书推送**: 支持飞书机器人API和Webhook两种推送方式
- **容错设计**: 网络异常自动重试，Redis故障自动降级
- **定时任务**: 支持Cron表达式配置定时执行
- **Docker部署**: 一键部署，包含Redis服务

## 🛠️ 技术栈

- **Runtime**: Node.js + TypeScript
- **爬虫**: Axios + Cheerio
- **缓存**: Redis + 内存缓存
- **推送**: 飞书机器人API
- **调度**: node-cron
- **日志**: Winston
- **部署**: Docker + Docker Compose

## 📦 快速开始

### 使用 Docker Compose（推荐）

1. **克隆项目**
```bash
git clone <repository-url>
cd sz-room-crawler
```

2. **配置环境变量**
```bash
cp env.example .env
# 编辑 .env 文件，配置飞书机器人参数
```

3. **启动服务**
```bash
# 启动 Redis 和爬虫服务
docker-compose up -d

# 查看日志
docker-compose logs -f sz-room-crawler
```

### 手动部署

1. **安装依赖**
```bash
npm install
```

2. **配置 Redis（可选）**
```bash
# 安装并启动 Redis
redis-server

# 或使用 Docker 启动 Redis
docker run -d --name redis -p 6379:6379 redis:7.2-alpine
```

3. **配置环境变量**
```bash
cp env.example .env
```

4. **构建并运行**
```bash
npm run build
npm start
```

## ⚙️ 配置说明

### 基础配置
```env
# 应用配置
NODE_ENV=production
LOG_LEVEL=info
RUN_ONCE=false  # true: 单次运行, false: 定时任务

# 爬虫配置
CRAWLER_BASE_URL=https://zjj.sz.gov.cn/ztfw/zfbz/tzgg2017/index.html
CRAWLER_TIMEOUT=10000
CRAWLER_RETRY_TIMES=3

# 过滤配置
FILTER_DAY_RANGE=7  # 抓取最近N天的公告
FILTER_KEYWORDS=住房,建设,规划,土地,房屋
FILTER_EXCLUDE_KEYWORDS=招聘,人事,领军
```

### Redis 配置（可选）
```env
# Redis配置 - 用于消息去重
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_KEY_PREFIX=sz-room:
REDIS_TTL=604800  # 7天过期
```

### 分类规则配置

分类规则通过 `src/config/categoryRules.json` 文件配置：

```json
[
  {
    "name": "分类1",
    "keywords": ["Keyword1"],
    "priority": 1
  },
  {
    "name": "房地产相关",
    "keywords": ["房地产", "住房", "楼盘", "商品房"],
    "priority": 2
  },
  {
    "name": "其他",
    "keywords": [],
    "priority": 999
  }
]
```

**字段说明:**
- `name`: 分类名称
- `keywords`: 匹配关键词列表，为空时作为默认分类
- `priority`: 优先级，数字越小优先级越高

**注意:** 如果在环境变量中设置了 `FILTER_CATEGORY_RULES`，将优先使用环境变量配置。

### 飞书配置

#### 方式一：Webhook（推荐）
```env
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/your-webhook-key
FEISHU_WEBHOOK_SECRET=your-secret  # 可选
```

#### 方式二：Bot API
```env
FEISHU_APP_ID=your-app-id
FEISHU_APP_SECRET=your-app-secret
FEISHU_CHAT_ID=your-chat-id
```

### 定时任务配置
```env
SCHEDULE_ENABLED=true
SCHEDULE_CRON=0 */1 * * *  # 每小时执行一次
```

## 🎯 推送模式

系统支持三种推送模式，可在代码中配置：

### 1. 单条消息模式 (`single`)
- 所有新公告合并为一条消息发送
- 保持原有功能不变

### 2. 分类单条模式 (`categorized`) - 默认
- 按分类组织公告，发送一条包含所有分类的消息
- 结构清晰，信息完整

### 3. 分类分发模式 (`by-category`)
- 每个分类单独发送一条消息
- 适合不同分类需要发送到不同群组的场景

## 📊 分类规则

### 默认分类
- **房地产开发**: 房地产开发、商品房、预售许可等
- **保障房政策**: 保障房、公租房、安居房等
- **建设工程**: 建设工程、工程建设、施工许可等
- **规划审批**: 规划许可、用地规划、建设用地等
- **房屋租赁**: 房屋租赁、租赁备案、租金等
- **物业管理**: 物业管理、物业服务、业主等
- **行政执法**: 行政处罚、违法建设、执法检查等
- **政策法规**: 政策、法规、办法、规定等
- **其他**: 未匹配到上述分类的公告

### 自定义分类
可通过编辑 `src/config/categoryRules.json` 文件配置自定义分类规则：

```json
[
  {
    "name": "分类名称",
    "keywords": ["关键词1", "关键词2"],
    "priority": 1
  }
]
```

- `name`: 分类名称
- `keywords`: 匹配关键词列表，为空时作为默认分类
- `priority`: 优先级，数字越小优先级越高

**配置优先级:**
1. 环境变量 `FILTER_CATEGORY_RULES`（如果设置）
2. 文件 `src/config/categoryRules.json`
3. 内置默认规则

## 🔧 运维管理

### 查看日志
```bash
# Docker 方式
docker-compose logs -f sz-room-crawler

# PM2 方式
npm run logs:pm2
```

### 重启服务
```bash
# Docker 方式
docker-compose restart sz-room-crawler

# PM2 方式
npm run restart:pm2
```

### Redis 管理
```bash
# 连接 Redis
redis-cli

# 查看缓存的key
KEYS sz-room:*

# 清空缓存
FLUSHDB
```

## 🚨 故障排除

### Redis 连接问题
- 检查Redis服务是否启动
- 确认网络连接和端口配置
- 系统会自动降级到内存缓存

### 飞书推送失败
- 检查Webhook URL或Bot配置
- 确认网络连接
- 查看日志中的详细错误信息

### 爬虫抓取失败
- 检查目标网站是否可访问
- 确认网站结构是否发生变化
- 调整超时时间和重试次数

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！ 