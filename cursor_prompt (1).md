# 深圳住建局通知公告抓取与飞书推送系统

## 项目需求
创建一个 Node.js 应用程序，抓取深圳市住房和建设局通知公告页面的信息，过滤处理后通过飞书机器人 API 发送通知。

## 技术栈要求
- Node.js + TypeScript
- axios (HTTP 请求)
- cheerio (HTML 解析)
- node-cron (定时任务)
- @larksuiteoapi/node-sdk (飞书官方 SDK)

## 核心功能实现

### 1. 网页数据抓取模块
```typescript
// 目标URL: https://zjj.sz.gov.cn/ztfw/zfbz/tzgg2017/index.html
// 需要抓取的数据字段：
// - 公告标题
// - 发布时间
// - 公告链接
// - 公告内容摘要（如果有）
```

### 2. 数据过滤处理模块
```typescript
// 过滤条件（可配置）：
// - 时间范围：只获取最近N天的公告
// - 关键词过滤：包含特定关键词的公告
// - 内存去重：使用 Set 或 Map 避免重复推送（程序运行期间）
```

### 3. 飞书机器人推送模块
```typescript
// 飞书官方 SDK 配置：
// - 使用 @larksuiteoapi/node-sdk
// - 支持 Webhook 和 Bot API 两种方式
// - 消息格式：富文本卡片或交互式卡片
// - 错误重试机制
// - 推送频率控制
```

## 具体实现要求

### 文件结构
```
src/
├── config/
│   ├── config.ts          // 配置文件
│   └── feishu.ts          // 飞书SDK配置
├── crawler/
│   ├── scraper.ts         // 网页抓取
│   └── parser.ts          // 数据解析
├── filter/
│   ├── dataFilter.ts      // 数据过滤
│   └── deduplication.ts   // 内存去重处理
├── notification/
│   ├── feishuBot.ts       // 飞书SDK封装
│   └── messageTemplate.ts // 消息模板
├── scheduler/
│   └── cronJob.ts         // 定时任务
├── utils/
│   └── cache.ts           // 内存缓存工具
└── app.ts                 // 主程序入口
```

### 关键实现细节

1. **网页抓取**：
   - 使用 User-Agent 伪装浏览器请求
   - 处理可能的反爬虫机制
   - 支持分页数据抓取
   - 异常处理和重试机制

2. **数据解析**：
   - 使用 cheerio 解析 HTML
   - 提取标题、时间、链接等关键信息
   - 处理相对链接转绝对链接
   - 时间格式标准化

3. **过滤逻辑**：
   - 时间过滤：只处理指定时间范围内的公告
   - 关键词过滤：支持包含/排除关键词列表
   - 内存去重：使用 Set/Map 存储已处理的公告标识（程序运行期间有效）
   - 缓存机制：内存中保存最近处理的公告列表

4. **飞书推送**：
   - 使用 @larksuiteoapi/node-sdk 官方 SDK
   - 支持富文本消息和交互式卡片两种格式
   - 消息内容包括：标题、发布时间、摘要、原文链接
   - 支持 Webhook 和 Bot API 两种推送方式
   - 错误处理和重试机制
   - 推送频率限制

5. **定时任务**：
   - 支持 cron 表达式配置执行频率
   - 默认每小时检查一次新公告
   - 支持手动触发执行

### 配置文件示例
```typescript
// config.ts
export interface Config {
  crawler: {
    baseUrl: string;
    userAgent: string;
    timeout: number;
    retryTimes: number;
  };
  filter: {
    dayRange: number;           // 获取最近N天的数据
    keywords: string[];         // 关键词过滤
    excludeKeywords: string[];  // 排除关键词
    cacheSize: number;          // 内存缓存大小
  };
  feishu: {
    // Webhook 方式
    webhookUrl?: string;
    webhookSecret?: string;
    // Bot API 方式
    appId?: string;
    appSecret?: string;
    chatId?: string;
  };
  schedule: {
    cronExpression: string;     // 定时任务表达式
    enabled: boolean;
  };
}
```

### 飞书消息模板
```typescript
// 使用 @larksuiteoapi/node-sdk 创建：
// 1. 富文本消息：简单的文本+链接格式
// 2. 交互式卡片：包含标题、发布时间、内容摘要、操作按钮
// 支持 Markdown 格式和自定义样式
```

## 额外要求

1. **日志系统**：
   - 使用 winston 记录详细日志
   - 分级日志：info、warn、error
   - 日志轮转和存档

2. **错误处理**：
   - 网络请求失败重试
   - 飞书推送失败重试
   - 异常捕获和记录

3. **环境配置**：
   - 支持 .env 文件配置
   - 开发/生产环境区分
   - Docker 容器化支持

4. **内存管理**：
   - 合理的缓存大小限制
   - 定期清理过期缓存
   - 内存使用监控

## 部署说明
- 提供 Docker Dockerfile
- 包含部署脚本和说明文档
- 支持 PM2 进程管理

请根据以上需求创建完整的项目代码，包括所有必要的文件和配置。代码应该具有良好的可读性、可维护性和扩展性。