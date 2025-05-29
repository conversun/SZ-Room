import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

export interface CrawlerConfig {
  baseUrl: string;
  userAgent: string;
  timeout: number;
  retryTimes: number;
}

export interface FilterConfig {
  dayRange: number;
  keywords: string[];
  excludeKeywords: string[];
  cacheSize: number;
}

export interface FeishuConfig {
  // Webhook 方式
  webhookUrl?: string;
  webhookSecret?: string;
  // Bot API 方式
  appId?: string;
  appSecret?: string;
  chatId?: string;
}

export interface ScheduleConfig {
  cronExpression: string;
  enabled: boolean;
}

export interface AppConfig {
  nodeEnv: string;
  logLevel: string;
  runOnce: boolean;
}

export interface Config {
  app: AppConfig;
  crawler: CrawlerConfig;
  filter: FilterConfig;
  feishu: FeishuConfig;
  schedule: ScheduleConfig;
}

// 解析逗号分隔的字符串为数组
const parseStringArray = (str: string = ''): string[] => {
  return str.split(',').map(s => s.trim()).filter(s => s.length > 0);
};

// 创建配置对象
export const config: Config = {
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    runOnce: process.env.RUN_ONCE === 'true',
  },
  crawler: {
    baseUrl: process.env.CRAWLER_BASE_URL || 'https://zjj.sz.gov.cn/ztfw/zfbz/tzgg2017/index.html',
    userAgent: process.env.CRAWLER_USER_AGENT || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    timeout: parseInt(process.env.CRAWLER_TIMEOUT || '10000'),
    retryTimes: parseInt(process.env.CRAWLER_RETRY_TIMES || '3'),
  },
  filter: {
    dayRange: parseInt(process.env.FILTER_DAY_RANGE || '7'),
    keywords: parseStringArray(process.env.FILTER_KEYWORDS),
    excludeKeywords: parseStringArray(process.env.FILTER_EXCLUDE_KEYWORDS),
    cacheSize: parseInt(process.env.FILTER_CACHE_SIZE || '1000'),
  },
  feishu: {
    webhookUrl: process.env.FEISHU_WEBHOOK_URL,
    webhookSecret: process.env.FEISHU_WEBHOOK_SECRET,
    appId: process.env.FEISHU_APP_ID,
    appSecret: process.env.FEISHU_APP_SECRET,
    chatId: process.env.FEISHU_CHAT_ID,
  },
  schedule: {
    cronExpression: process.env.SCHEDULE_CRON || '0 */1 * * *',
    enabled: process.env.SCHEDULE_ENABLED !== 'false',
  },
};

// 验证配置
export const validateConfig = (): void => {
  // 验证飞书配置
  const hasWebhook = config.feishu.webhookUrl;
  const hasBotApi = config.feishu.appId && config.feishu.appSecret && config.feishu.chatId;
  
  if (!hasWebhook && !hasBotApi) {
    throw new Error('飞书配置错误：必须配置 Webhook 或 Bot API 其中一种方式');
  }
  
  if (config.crawler.timeout <= 0) {
    throw new Error('爬虫超时时间必须大于 0');
  }
  
  if (config.filter.dayRange <= 0) {
    throw new Error('过滤天数范围必须大于 0');
  }
  
  if (config.filter.cacheSize <= 0) {
    throw new Error('缓存大小必须大于 0');
  }
}; 