import { CacheItem } from '../types';
import { config } from '../config/config';
import { logger } from './logger';

/**
 * 内存缓存管理器
 * 用于存储已处理的公告 ID，避免重复推送
 */
export class MemoryCache {
  private cache: Map<string, CacheItem> = new Map();
  private maxSize: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxSize: number = config.filter.cacheSize) {
    this.maxSize = maxSize;
    this.startCleanupTimer();
    logger.info(`内存缓存初始化完成，最大容量: ${maxSize}`);
  }

  /**
   * 检查 ID 是否已存在
   */
  has(id: string): boolean {
    return this.cache.has(id);
  }

  /**
   * 添加 ID 到缓存
   */
  add(id: string): void {
    // 如果缓存已满，删除最旧的项
    if (this.cache.size >= this.maxSize) {
      this.removeOldest();
    }

    this.cache.set(id, {
      id,
      timestamp: Date.now(),
    });

    logger.debug(`缓存添加: ${id}，当前缓存大小: ${this.cache.size}`);
  }

  /**
   * 批量添加 ID
   */
  addBatch(ids: string[]): void {
    ids.forEach(id => this.add(id));
    logger.info(`批量添加 ${ids.length} 项到缓存`);
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    logger.info('缓存已清空');
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): { size: number; maxSize: number; oldestTimestamp: number | null } {
    let oldestTimestamp: number | null = null;
    
    if (this.cache.size > 0) {
      oldestTimestamp = Math.min(...Array.from(this.cache.values()).map(item => item.timestamp));
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      oldestTimestamp,
    };
  }

  /**
   * 移除最旧的项
   */
  private removeOldest(): void {
    if (this.cache.size === 0) return;

    let oldestKey = '';
    let oldestTimestamp = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (item.timestamp < oldestTimestamp) {
        oldestTimestamp = item.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug(`移除最旧缓存项: ${oldestKey}`);
    }
  }

  /**
   * 清理过期项（超过7天的项）
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7天
    let removedCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > maxAge) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.info(`清理过期缓存项: ${removedCount} 项`);
    }
  }

  /**
   * 启动定期清理任务
   */
  private startCleanupTimer(): void {
    // 每小时清理一次过期项
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }

  /**
   * 停止清理任务
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
    logger.info('缓存管理器已销毁');
  }
}

// 导出单例实例
export const cache = new MemoryCache(); 