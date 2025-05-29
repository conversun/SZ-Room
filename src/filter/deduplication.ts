import { Notice, FilterResult } from '../types';
import { cache } from '../utils/cache';
import { logger } from '../utils/logger';

// 动态导入Redis服务，避免在Redis不可用时影响内存缓存
let redisService: any = null;
let isRedisAvailable = false;

// 尝试导入Redis服务
(async () => {
  try {
    const { redisService: redis } = await import('../services/redisService');
    redisService = redis;
    
    // 检查Redis连接状态
    setTimeout(async () => {
      if (redisService && await redisService.ping()) {
        isRedisAvailable = true;
        logger.info('Redis服务可用，将使用Redis进行去重');
      } else {
        logger.warn('Redis服务不可用，将使用内存缓存');
      }
    }, 2000);
  } catch (error) {
    logger.warn('无法加载Redis服务，将使用内存缓存:', error);
  }
})();

/**
 * 去重处理器
 */
export class DeduplicationFilter {
  /**
   * 处理去重（支持Redis和内存缓存双重模式）
   */
  static async process(filterResult: FilterResult): Promise<FilterResult> {
    const { notices, totalCount, filteredCount } = filterResult;
    
    logger.info(`开始去重处理，输入 ${notices.length} 条公告`);

    // 1. 内部去重（同一批次内的重复）
    const internallyDeduped = this.removeDuplicatesWithinBatch(notices);
    logger.info(`内部去重后剩余: ${internallyDeduped.length} 条`);

    // 2. 缓存去重（与历史记录比较）
    let newNotices: Notice[];
    if (isRedisAvailable && redisService) {
      newNotices = await this.filterNewNoticesWithRedis(internallyDeduped);
    } else {
      newNotices = this.filterNewNotices(internallyDeduped);
    }
    
    logger.info(`缓存去重后新增: ${newNotices.length} 条`);

    // 3. 更新缓存
    if (isRedisAvailable && redisService) {
      await this.updateRedisCache(newNotices);
    } else {
      this.updateCache(newNotices);
    }

    return {
      notices: newNotices,
      totalCount,
      filteredCount,
      newCount: newNotices.length,
    };
  }

  /**
   * 使用Redis过滤新公告
   */
  private static async filterNewNoticesWithRedis(notices: Notice[]): Promise<Notice[]> {
    if (!redisService || notices.length === 0) {
      return notices;
    }

    try {
      const noticeIds = notices.map(notice => notice.id);
      const sentStatus = await redisService.checkBatchSentStatus(noticeIds);
      
      const newNotices = notices.filter(notice => !sentStatus[notice.id]);
      
      logger.info(`Redis去重: 输入 ${notices.length} 条，过滤掉 ${notices.length - newNotices.length} 条已发送的公告`);
      
      return newNotices;
    } catch (error: any) {
      logger.error('Redis去重失败，降级到内存缓存:', error);
      return this.filterNewNotices(notices);
    }
  }

  /**
   * 更新Redis缓存
   */
  private static async updateRedisCache(notices: Notice[]): Promise<void> {
    if (!redisService || notices.length === 0) {
      return;
    }

    try {
      const ids = notices.map(notice => notice.id);
      await redisService.markBatchAsSent(ids);
      
      logger.info(`Redis缓存更新完成，新增 ${ids.length} 条记录`);
    } catch (error: any) {
      logger.error('Redis缓存更新失败:', error);
      // 降级到内存缓存
      this.updateCache(notices);
    }
  }

  /**
   * 检查单个公告是否为新公告（Redis优先）
   */
  static async isNewNotice(notice: Notice): Promise<boolean> {
    if (isRedisAvailable && redisService) {
      try {
        const hasSent = await redisService.hasSent(notice.id);
        return !hasSent;
      } catch (error: any) {
        logger.error('Redis检查失败，降级到内存缓存:', error);
      }
    }
    
    // 降级到内存缓存
    return !cache.has(notice.id);
  }

  /**
   * 标记公告为已发送（Redis优先）
   */
  static async markAsSent(noticeId: string): Promise<void> {
    if (isRedisAvailable && redisService) {
      try {
        await redisService.markAsSent(noticeId);
        return;
      } catch (error: any) {
        logger.error('Redis标记失败，降级到内存缓存:', error);
      }
    }
    
    // 降级到内存缓存
    cache.add(noticeId);
  }

  /**
   * 批量标记公告为已发送（Redis优先）
   */
  static async markBatchAsSent(noticeIds: string[]): Promise<void> {
    if (isRedisAvailable && redisService) {
      try {
        await redisService.markBatchAsSent(noticeIds);
        return;
      } catch (error: any) {
        logger.error('Redis批量标记失败，降级到内存缓存:', error);
      }
    }
    
    // 降级到内存缓存
    cache.addBatch(noticeIds);
  }

  /**
   * 获取去重统计信息（包含Redis和内存缓存信息）
   */
  static async getStats(): Promise<{
    cacheType: 'redis' | 'memory';
    cacheSize: number;
    maxCacheSize?: number;
    oldestCacheTimestamp?: number | null;
    isRedisConnected?: boolean;
  }> {
    if (isRedisAvailable && redisService) {
      try {
        const redisStats = await redisService.getStats();
        return {
          cacheType: 'redis',
          cacheSize: redisStats.totalSentMessages,
          isRedisConnected: redisStats.isConnected,
        };
      } catch (error: any) {
        logger.error('获取Redis统计失败:', error);
      }
    }
    
    // 降级到内存缓存统计
    const cacheStats = cache.getStats();
    return {
      cacheType: 'memory',
      cacheSize: cacheStats.size,
      maxCacheSize: cacheStats.maxSize,
      oldestCacheTimestamp: cacheStats.oldestTimestamp,
    };
  }

  /**
   * 清空缓存（Redis优先）
   */
  static async clearCache(): Promise<void> {
    if (isRedisAvailable && redisService) {
      try {
        await redisService.clearCache();
        logger.info('Redis缓存已清空');
        return;
      } catch (error: any) {
        logger.error('清空Redis缓存失败:', error);
      }
    }
    
    // 清空内存缓存
    cache.clear();
    logger.info('内存缓存已清空');
  }

  /**
   * 检查Redis可用性
   */
  static isRedisAvailable(): boolean {
    return isRedisAvailable;
  }

  /**
   * 移除批次内重复项
   */
  private static removeDuplicatesWithinBatch(notices: Notice[]): Notice[] {
    const seen = new Set<string>();
    const uniqueNotices: Notice[] = [];

    for (const notice of notices) {
      // 使用多个字段组合生成去重键
      const dedupeKey = this.generateDedupeKey(notice);
      
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        uniqueNotices.push(notice);
      } else {
        logger.debug(`发现重复公告（批次内）: ${notice.title}`);
      }
    }

    const removedCount = notices.length - uniqueNotices.length;
    if (removedCount > 0) {
      logger.info(`批次内去重移除 ${removedCount} 条重复公告`);
    }

    return uniqueNotices;
  }

  /**
   * 过滤新公告（排除缓存中已存在的）
   */
  private static filterNewNotices(notices: Notice[]): Notice[] {
    const newNotices: Notice[] = [];

    for (const notice of notices) {
      if (!cache.has(notice.id)) {
        newNotices.push(notice);
      } else {
        logger.debug(`发现重复公告（缓存中）: ${notice.title}`);
      }
    }

    const cachedCount = notices.length - newNotices.length;
    if (cachedCount > 0) {
      logger.info(`缓存去重过滤掉 ${cachedCount} 条已处理公告`);
    }

    return newNotices;
  }

  /**
   * 更新缓存
   */
  private static updateCache(notices: Notice[]): void {
    if (notices.length === 0) {
      return;
    }

    const ids = notices.map(notice => notice.id);
    cache.addBatch(ids);
    
    logger.info(`缓存更新完成，新增 ${ids.length} 条记录`);
  }

  /**
   * 生成去重键
   */
  private static generateDedupeKey(notice: Notice): string {
    // 使用标题和URL的组合生成去重键
    const normalizedTitle = this.normalizeTitle(notice.title);
    const normalizedUrl = this.normalizeUrl(notice.url);
    
    return `${normalizedTitle}|${normalizedUrl}`;
  }

  /**
   * 标准化标题（用于去重）
   */
  private static normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/\s+/g, '')          // 移除所有空格
      .replace(/[【】\[\]()（）]/g, '') // 移除括号
      .replace(/[的了]/g, '')        // 移除常见助词
      .trim();
  }

  /**
   * 标准化URL（用于去重）
   */
  private static normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // 只保留路径部分，去除查询参数和fragment
      return urlObj.pathname.toLowerCase();
    } catch (error) {
      // 如果URL解析失败，返回原始URL的小写版本
      return url.toLowerCase();
    }
  }

  /**
   * 批量检查新公告
   */
  static filterOnlyNewNotices(notices: Notice[]): Notice[] {
    return notices.filter(notice => this.isNewNotice(notice));
  }
} 