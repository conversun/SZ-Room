import dotenv from 'dotenv';
import { CategoryRule, RedisConfig } from '../types';
import * as fs from 'fs';
import * as path from 'path';

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
  categoryRules: CategoryRule[];  // 分类规则
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
  redis: RedisConfig;  // Redis配置
}

// 解析逗号分隔的字符串为数组
const parseStringArray = (str: string = ''): string[] => {
  return str.split(',').map(s => s.trim()).filter(s => s.length > 0);
};

// 从JSON文件加载分类规则
function loadCategoryRules(): CategoryRule[] {
  try {
    const rulesPath = path.join(__dirname, 'categoryRules.json');
    
    if (fs.existsSync(rulesPath)) {
      const rulesContent = fs.readFileSync(rulesPath, 'utf8');
      const rules = JSON.parse(rulesContent);
      
      // 验证分类规则格式
      if (Array.isArray(rules) && rules.length > 0) {
        console.log(`✅ 从文件加载分类规则: ${rules.length} 个分类`);
        return rules;
      } else {
        console.warn('分类规则文件格式不正确，使用默认规则');
      }
    } else {
      console.warn('分类规则文件不存在，使用默认规则');
    }
  } catch (error: any) {
    console.warn('加载分类规则文件失败，使用默认规则:', error.message);
  }

  // 返回默认分类规则
  return [
    {
      name: '房地产相关',
      keywords: ['房地产', '住房', '楼盘', '商品房', '保障房', '租赁'],
      priority: 1
    },
    {
      name: '建设工程',
      keywords: ['建设工程', '工程建设', '施工', '监理', '造价'],
      priority: 2
    },
    {
      name: '行政审批',
      keywords: ['行政审批', '许可证', '备案', '审批', '资质'],
      priority: 3
    },
    {
      name: '通用公告',
      keywords: [],
      priority: 999
    }
  ];
}

// 解析分类规则（保留向后兼容性）
function parseCategoryRules(rulesString?: string): CategoryRule[] {
  // 如果环境变量中有配置，优先使用环境变量
  if (rulesString && rulesString.trim()) {
    try {
      const envRules = JSON.parse(rulesString);
      console.log('✅ 从环境变量加载分类规则');
      return envRules;
    } catch (error) {
      console.warn('环境变量中的分类规则格式错误，使用文件配置');
    }
  }

  // 从文件加载分类规则
  return loadCategoryRules();
}

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
    categoryRules: parseCategoryRules(process.env.FILTER_CATEGORY_RULES),
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
  redis: {
    enabled: process.env.REDIS_ENABLED !== 'false', // 默认启用，设置为'false'时禁用
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'sz-room:',
    ttl: parseInt(process.env.REDIS_TTL || '604800'), // 默认7天
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