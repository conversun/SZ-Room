// 公告数据结构
export interface Notice {
  id: string;           // 唯一标识（用于去重）
  title: string;        // 公告标题
  url: string;          // 公告链接
  publishDate: string;  // 发布时间（ISO字符串）
  summary?: string;     // 内容摘要
  content?: string;     // 完整内容
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