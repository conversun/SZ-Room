import Redis from 'ioredis';
import { config } from '../config/config';
import { logger } from '../utils/logger';

/**
 * Redis 服务类
 * 用于缓存已发送的公告ID，避免重复推送
 */
export class RedisService {
  private client: Redis | null = null;
  private isConnected = false;

  constructor() {
    if (config.redis.enabled) {
      this.init();
      logger.info('Redis服务启用，正在初始化连接...');
    } else {
      logger.info('Redis服务已禁用，将使用内存缓存');
    }
  }

  /**
   * 初始化Redis连接
   */
  private async init(): Promise<void> {
    try {
      this.client = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info('Redis 连接成功');
      });

      this.client.on('error', (error: any) => {
        this.isConnected = false;
        logger.error('Redis 连接错误:', error);
      });

      this.client.on('close', () => {
        this.isConnected = false;
        logger.warn('Redis 连接已关闭');
      });

      await this.client.connect();
    } catch (error: any) {
      logger.error('Redis 初始化失败:', error);
      this.client = null;
    }
  }

  /**
   * 检查是否已连接
   */
  isReady(): boolean {
    if (!config.redis.enabled) {
      return false;
    }
    return this.isConnected && this.client !== null;
  }

  /**
   * 检查公告是否已发送
   */
  async hasSent(noticeId: string): Promise<boolean> {
    if (!this.isReady()) {
      logger.warn('Redis 未连接，跳过去重检查');
      return false;
    }

    try {
      const key = `${config.redis.keyPrefix}sent:${noticeId}`;
      const exists = await this.client!.exists(key);
      return exists === 1;
    } catch (error: any) {
      logger.error('检查Redis缓存失败:', error);
      return false;
    }
  }

  /**
   * 标记公告为已发送
   */
  async markAsSent(noticeId: string): Promise<void> {
    if (!this.isReady()) {
      logger.warn('Redis 未连接，跳过缓存标记');
      return;
    }

    try {
      const key = `${config.redis.keyPrefix}sent:${noticeId}`;
      await this.client!.setex(key, config.redis.ttl, '1');
      logger.debug(`标记公告已发送: ${noticeId}`);
    } catch (error: any) {
      logger.error('标记Redis缓存失败:', error);
    }
  }

  /**
   * 批量标记公告为已发送
   */
  async markBatchAsSent(noticeIds: string[]): Promise<void> {
    if (!this.isReady() || noticeIds.length === 0) {
      return;
    }

    try {
      const pipeline = this.client!.pipeline();
      
      noticeIds.forEach(noticeId => {
        const key = `${config.redis.keyPrefix}sent:${noticeId}`;
        pipeline.setex(key, config.redis.ttl, '1');
      });

      await pipeline.exec();
      logger.info(`批量标记 ${noticeIds.length} 条公告为已发送`);
    } catch (error: any) {
      logger.error('批量标记Redis缓存失败:', error);
    }
  }

  /**
   * 检查批量公告发送状态
   */
  async checkBatchSentStatus(noticeIds: string[]): Promise<{ [id: string]: boolean }> {
    if (!this.isReady() || noticeIds.length === 0) {
      // 如果Redis不可用，返回所有为false（都是新的）
      return noticeIds.reduce((acc, id) => {
        acc[id] = false;
        return acc;
      }, {} as { [id: string]: boolean });
    }

    try {
      const pipeline = this.client!.pipeline();
      
      noticeIds.forEach(noticeId => {
        const key = `${config.redis.keyPrefix}sent:${noticeId}`;
        pipeline.exists(key);
      });

      const results = await pipeline.exec();
      const status: { [id: string]: boolean } = {};

      noticeIds.forEach((noticeId, index) => {
        const result = results?.[index];
        status[noticeId] = result?.[1] === 1;
      });

      return status;
    } catch (error: any) {
      logger.error('检查批量发送状态失败:', error);
      // 出错时返回所有为false
      return noticeIds.reduce((acc, id) => {
        acc[id] = false;
        return acc;
      }, {} as { [id: string]: boolean });
    }
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<{
    isConnected: boolean;
    totalSentMessages: number;
    keyCount: number;
  }> {
    const stats = {
      isConnected: this.isConnected,
      totalSentMessages: 0,
      keyCount: 0,
    };

    if (!this.isReady()) {
      return stats;
    }

    try {
      const pattern = `${config.redis.keyPrefix}sent:*`;
      const keys = await this.client!.keys(pattern);
      stats.keyCount = keys.length;
      stats.totalSentMessages = keys.length;
      
      return stats;
    } catch (error: any) {
      logger.error('获取Redis统计信息失败:', error);
      return stats;
    }
  }

  /**
   * 清空缓存
   */
  async clearCache(): Promise<void> {
    if (!this.isReady()) {
      logger.warn('Redis 未连接，无法清空缓存');
      return;
    }

    try {
      const pattern = `${config.redis.keyPrefix}*`;
      const keys = await this.client!.keys(pattern);
      
      if (keys.length > 0) {
        await this.client!.del(...keys);
        logger.info(`清空Redis缓存，删除 ${keys.length} 个key`);
      } else {
        logger.info('Redis缓存为空，无需清理');
      }
    } catch (error: any) {
      logger.error('清空Redis缓存失败:', error);
    }
  }

  /**
   * 关闭连接
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
      logger.info('Redis 连接已关闭');
    }
  }

  /**
   * 健康检查
   */
  async ping(): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }

    try {
      const response = await this.client!.ping();
      return response === 'PONG';
    } catch (error: any) {
      logger.error('Redis ping 失败:', error);
      return false;
    }
  }
}

// 导出单例实例
export const redisService = new RedisService(); 