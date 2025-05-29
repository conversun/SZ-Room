import { Client } from '@larksuiteoapi/node-sdk';
import { config } from './config';
import { logger } from '../utils/logger';

/**
 * 飞书客户端配置
 */
export class FeishuConfig {
  private static client: Client | null = null;

  /**
   * 获取飞书客户端实例
   */
  static getClient(): Client | null {
    if (!this.client && this.shouldUseBotApi()) {
      this.client = new Client({
        appId: config.feishu.appId!,
        appSecret: config.feishu.appSecret!,
        loggerLevel: config.app.nodeEnv === 'development' ? 'debug' as any : 'warn' as any,
      });
      
      logger.info('飞书 Bot API 客户端初始化完成');
    }
    
    return this.client;
  }

  /**
   * 检查是否应该使用 Bot API
   */
  static shouldUseBotApi(): boolean {
    return !!(config.feishu.appId && config.feishu.appSecret && config.feishu.chatId);
  }

  /**
   * 检查是否应该使用 Webhook
   */
  static shouldUseWebhook(): boolean {
    return !!config.feishu.webhookUrl;
  }

  /**
   * 获取配置信息
   */
  static getConfigInfo(): {
    useBotApi: boolean;
    useWebhook: boolean;
    chatId?: string;
    webhookUrl?: string;
  } {
    return {
      useBotApi: this.shouldUseBotApi(),
      useWebhook: this.shouldUseWebhook(),
      chatId: config.feishu.chatId,
      webhookUrl: config.feishu.webhookUrl ? '***' : undefined, // 隐藏实际URL
    };
  }

  /**
   * 验证配置
   */
  static validateConfig(): void {
    const hasBotApi = this.shouldUseBotApi();
    const hasWebhook = this.shouldUseWebhook();

    if (!hasBotApi && !hasWebhook) {
      throw new Error('飞书配置错误：必须配置 Bot API 或 Webhook 其中一种方式');
    }

    if (hasBotApi && hasWebhook) {
      logger.warn('同时配置了 Bot API 和 Webhook，将优先使用 Bot API');
    }

    if (hasBotApi) {
      if (!config.feishu.appId) {
        throw new Error('使用 Bot API 时必须配置 appId');
      }
      if (!config.feishu.appSecret) {
        throw new Error('使用 Bot API 时必须配置 appSecret');
      }
      if (!config.feishu.chatId) {
        throw new Error('使用 Bot API 时必须配置 chatId');
      }
    }

    if (hasWebhook && !hasBotApi) {
      if (!config.feishu.webhookUrl) {
        throw new Error('使用 Webhook 时必须配置 webhookUrl');
      }
      
      // 验证 Webhook URL 格式
      try {
        const url = new URL(config.feishu.webhookUrl);
        if (!url.hostname.includes('feishu') && !url.hostname.includes('larksuite')) {
          logger.warn('Webhook URL 似乎不是有效的飞书地址');
        }
      } catch (error) {
        throw new Error('Webhook URL 格式无效');
      }
    }

    logger.info('飞书配置验证通过');
  }
} 