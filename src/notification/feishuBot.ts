import axios from 'axios';
import crypto from 'crypto';
import { Notice, PushResult, FeishuError } from '../types';
import { config } from '../config/config';
import { FeishuConfig } from '../config/feishu';
import { MessageTemplate } from './messageTemplate';
import { logger } from '../utils/logger';

/**
 * 飞书机器人推送器
 */
export class FeishuBot {
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000; // 1秒

  /**
   * 推送通知公告
   */
  static async pushNotices(notices: Notice[]): Promise<PushResult> {
    try {
      logger.info(`开始推送 ${notices.length} 条公告到飞书`);

      if (FeishuConfig.shouldUseBotApi()) {
        return await this.pushViaBotApi(notices);
      } else if (FeishuConfig.shouldUseWebhook()) {
        return await this.pushViaWebhook(notices);
      } else {
        throw new FeishuError('飞书配置错误：未配置有效的推送方式', 'CONFIG_ERROR');
      }
    } catch (error: any) {
      logger.error('推送失败:', error);
      return {
        success: false,
        message: error.message || '未知错误',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 通过 Bot API 推送
   */
  private static async pushViaBotApi(notices: Notice[]): Promise<PushResult> {
    const client = FeishuConfig.getClient();
    if (!client) {
      throw new FeishuError('飞书客户端未初始化', 'CLIENT_ERROR');
    }

    try {
      // 创建消息内容
      const message = MessageTemplate.createInteractiveCard(notices);
      
      // 发送消息
      const response = await client.im.message.create({
        params: {
          receive_id_type: 'chat_id',
        },
        data: {
          receive_id: config.feishu.chatId!,
          msg_type: message.msg_type,
          content: JSON.stringify(message.msg_type === 'interactive' ? message.card : message.content),
        },
      });

      if (response.code === 0) {
        logger.info(`Bot API 推送成功，消息ID: ${response.data?.message_id}`);
        return {
          success: true,
          message: '推送成功',
          timestamp: new Date().toISOString(),
        };
      } else {
        throw new FeishuError(`Bot API 推送失败: ${response.msg}`, 'API_ERROR', response);
      }
    } catch (error: any) {
      logger.error('Bot API 推送失败:', error);
      throw new FeishuError(`Bot API 推送失败: ${error.message}`, 'PUSH_ERROR', error);
    }
  }

  /**
   * 通过 Webhook 推送
   */
  private static async pushViaWebhook(notices: Notice[]): Promise<PushResult> {
    if (!config.feishu.webhookUrl) {
      throw new FeishuError('Webhook URL 未配置', 'CONFIG_ERROR');
    }

    let lastError: any;
    
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        // 创建消息内容
        const message = MessageTemplate.createWebhookMessage(notices);
        
        // 添加签名（如果有密钥）
        if (config.feishu.webhookSecret) {
          this.addWebhookSignature(message, config.feishu.webhookSecret);
        }

        // 发送请求
        const response = await axios.post(config.feishu.webhookUrl, message, {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        });

        if (response.status === 200 && response.data?.code === 0) {
          logger.info(`Webhook 推送成功 (尝试 ${attempt}/${this.MAX_RETRIES})`);
          return {
            success: true,
            message: '推送成功',
            timestamp: new Date().toISOString(),
          };
        } else {
          throw new Error(`HTTP ${response.status}: ${response.data?.msg || response.statusText}`);
        }
      } catch (error: any) {
        lastError = error;
        logger.warn(`Webhook 推送失败 (尝试 ${attempt}/${this.MAX_RETRIES}): ${error.message}`);
        
        if (attempt < this.MAX_RETRIES) {
          await this.sleep(this.RETRY_DELAY * attempt);
        }
      }
    }

    throw new FeishuError(`Webhook 推送失败，已重试 ${this.MAX_RETRIES} 次: ${lastError.message}`, 'WEBHOOK_ERROR', lastError);
  }

  /**
   * 添加 Webhook 签名
   */
  private static addWebhookSignature(message: any, secret: string): void {
    const timestamp = Math.floor(Date.now() / 1000);
    const stringToSign = `${timestamp}\n${secret}`;
    const signature = crypto.createHmac('sha256', stringToSign).digest('base64');
    
    message.timestamp = timestamp;
    message.sign = signature;
  }

  /**
   * 推送错误消息
   */
  static async pushError(error: string, details?: any): Promise<PushResult> {
    try {
      logger.info('推送错误消息到飞书');
      
      const errorMessage = MessageTemplate.createErrorMessage(error, details);
      
      if (FeishuConfig.shouldUseBotApi()) {
        return await this.pushSingleMessageViaBotApi(errorMessage);
      } else if (FeishuConfig.shouldUseWebhook()) {
        return await this.pushSingleMessageViaWebhook(errorMessage);
      } else {
        throw new FeishuError('飞书配置错误：未配置有效的推送方式', 'CONFIG_ERROR');
      }
    } catch (pushError: any) {
      logger.error('推送错误消息失败:', pushError);
      return {
        success: false,
        message: `推送错误消息失败: ${pushError.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 推送系统状态
   */
  static async pushStatus(status: {
    totalProcessed: number;
    newNotices: number;
    filteredOut: number;
    cacheSize: number;
    lastUpdate: string;
  }): Promise<PushResult> {
    try {
      logger.info('推送系统状态到飞书');
      
      const statusMessage = MessageTemplate.createStatusMessage(status);
      
      if (FeishuConfig.shouldUseBotApi()) {
        return await this.pushSingleMessageViaBotApi(statusMessage);
      } else if (FeishuConfig.shouldUseWebhook()) {
        return await this.pushSingleMessageViaWebhook(statusMessage);
      } else {
        throw new FeishuError('飞书配置错误：未配置有效的推送方式', 'CONFIG_ERROR');
      }
    } catch (error: any) {
      logger.error('推送状态消息失败:', error);
      return {
        success: false,
        message: `推送状态消息失败: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 通过 Bot API 推送单条消息
   */
  private static async pushSingleMessageViaBotApi(message: any): Promise<PushResult> {
    const client = FeishuConfig.getClient();
    if (!client) {
      throw new FeishuError('飞书客户端未初始化', 'CLIENT_ERROR');
    }

    const response = await client.im.message.create({
      params: {
        receive_id_type: 'chat_id',
      },
      data: {
        receive_id: config.feishu.chatId!,
        msg_type: message.msg_type,
        content: JSON.stringify(message.msg_type === 'interactive' ? message.card : message.content),
      },
    });

    if (response.code === 0) {
      return {
        success: true,
        message: '推送成功',
        timestamp: new Date().toISOString(),
      };
    } else {
      throw new FeishuError(`Bot API 推送失败: ${response.msg}`, 'API_ERROR', response);
    }
  }

  /**
   * 通过 Webhook 推送单条消息
   */
  private static async pushSingleMessageViaWebhook(message: any): Promise<PushResult> {
    if (!config.feishu.webhookUrl) {
      throw new FeishuError('Webhook URL 未配置', 'CONFIG_ERROR');
    }

    // 添加签名（如果有密钥）
    if (config.feishu.webhookSecret) {
      this.addWebhookSignature(message, config.feishu.webhookSecret);
    }

    const response = await axios.post(config.feishu.webhookUrl, message, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    if (response.status === 200 && response.data?.code === 0) {
      return {
        success: true,
        message: '推送成功',
        timestamp: new Date().toISOString(),
      };
    } else {
      throw new Error(`HTTP ${response.status}: ${response.data?.msg || response.statusText}`);
    }
  }

  /**
   * 测试推送连接
   */
  static async testConnection(): Promise<PushResult> {
    try {
      logger.info('测试飞书推送连接');
      
      const testMessage = {
        msg_type: 'text',
        content: {
          text: '🔧 飞书推送连接测试\n\n系统运行正常，推送功能可用。'
        }
      };

      if (FeishuConfig.shouldUseBotApi()) {
        return await this.pushSingleMessageViaBotApi(testMessage);
      } else if (FeishuConfig.shouldUseWebhook()) {
        return await this.pushSingleMessageViaWebhook(testMessage);
      } else {
        throw new FeishuError('飞书配置错误：未配置有效的推送方式', 'CONFIG_ERROR');
      }
    } catch (error: any) {
      logger.error('测试推送连接失败:', error);
      return {
        success: false,
        message: `连接测试失败: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 延迟函数
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 