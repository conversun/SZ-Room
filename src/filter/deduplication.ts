import { Notice, FilterResult } from '../types';
import { cache } from '../utils/cache';
import { logger } from '../utils/logger';

/**
 * 去重处理器
 */
export class DeduplicationFilter {
  /**
   * 处理去重
   */
  static process(filterResult: FilterResult): FilterResult {
    const { notices, totalCount, filteredCount } = filterResult;
    
    logger.info(`开始去重处理，输入 ${notices.length} 条公告`);

    // 1. 内部去重（同一批次内的重复）
    const internallyDeduped = this.removeDuplicatesWithinBatch(notices);
    logger.info(`内部去重后剩余: ${internallyDeduped.length} 条`);

    // 2. 缓存去重（与历史记录比较）
    const newNotices = this.filterNewNotices(internallyDeduped);
    logger.info(`缓存去重后新增: ${newNotices.length} 条`);

    // 3. 更新缓存
    this.updateCache(newNotices);

    return {
      notices: newNotices,
      totalCount,
      filteredCount,
      newCount: newNotices.length,
    };
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
   * 获取去重统计信息
   */
  static getStats(): {
    cacheSize: number;
    maxCacheSize: number;
    oldestCacheTimestamp: number | null;
  } {
    const cacheStats = cache.getStats();
    return {
      cacheSize: cacheStats.size,
      maxCacheSize: cacheStats.maxSize,
      oldestCacheTimestamp: cacheStats.oldestTimestamp,
    };
  }

  /**
   * 清空去重缓存
   */
  static clearCache(): void {
    cache.clear();
    logger.info('去重缓存已清空');
  }

  /**
   * 手动添加到缓存（用于初始化或测试）
   */
  static addToCache(notices: Notice[]): void {
    const ids = notices.map(notice => notice.id);
    cache.addBatch(ids);
    logger.info(`手动添加 ${ids.length} 条记录到缓存`);
  }

  /**
   * 检查是否为新公告
   */
  static isNewNotice(notice: Notice): boolean {
    return !cache.has(notice.id);
  }

  /**
   * 批量检查新公告
   */
  static filterOnlyNewNotices(notices: Notice[]): Notice[] {
    return notices.filter(notice => this.isNewNotice(notice));
  }
} 