// 公告数据结构
export interface Notice {
  id: string;           // 唯一标识（用于去重）
  title: string;        // 公告标题
  url: string;          // 公告链接
  publishDate: string;  // 发布时间（ISO字符串）
  summary?: string;     // 内容摘要
  content?: string;     // 完整内容
  category?: string;    // 公告分类
}

// 过滤结果
export interface FilterResult {
  notices: Notice[];
  totalCount: number;
  filteredCount: number;
  newCount: number;     // 新增的数量
}

// 推送结果
export interface PushResult {
  success: boolean;
  message: string;
  timestamp: string;
}

// 缓存项
export interface CacheItem {
  id: string;
  timestamp: number;
}

// 爬虫错误类型
export class CrawlerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'CrawlerError';
  }
}

// 飞书推送错误类型
export class FeishuError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'FeishuError';
  }
}

// HTTP 请求重试配置
export interface RetryConfig {
  retries: number;
  delay: number;
  backoff?: number;
}

// 分类规则配置
export interface CategoryRule {
  name: string;         // 分类名称
  keywords: string[];   // 关键词列表
  priority: number;     // 优先级（数字越小优先级越高）
}

// 分类结果
export interface CategorizedNotices {
  [category: string]: Notice[];
}

// Redis配置
export interface RedisConfig {
  enabled: boolean;     // 是否启用Redis
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;    // Redis key 前缀
  ttl: number;          // 缓存过期时间（秒）
} 