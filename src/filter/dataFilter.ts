import { Notice, FilterResult } from '../types';
import { config } from '../config/config';
import { logger } from '../utils/logger';

/**
 * 数据过滤器
 */
export class DataFilter {
  /**
   * 过滤公告数据
   */
  static filter(notices: Notice[]): FilterResult {
    const originalCount = notices.length;
    logger.info(`开始过滤 ${originalCount} 条公告`);

    let filteredNotices = notices;

    // 1. 时间过滤
    filteredNotices = this.filterByDate(filteredNotices);
    logger.info(`时间过滤后剩余: ${filteredNotices.length} 条`);

    // 2. 关键词过滤
    filteredNotices = this.filterByKeywords(filteredNotices);
    logger.info(`关键词过滤后剩余: ${filteredNotices.length} 条`);

    // 3. 排除关键词过滤
    filteredNotices = this.filterByExcludeKeywords(filteredNotices);
    logger.info(`排除关键词过滤后剩余: ${filteredNotices.length} 条`);

    // 4. 数据清理和验证
    filteredNotices = this.cleanAndValidate(filteredNotices);
    logger.info(`数据清理后最终剩余: ${filteredNotices.length} 条`);

    return {
      notices: filteredNotices,
      totalCount: originalCount,
      filteredCount: filteredNotices.length,
      newCount: 0, // 将在去重模块中计算
    };
  }

  /**
   * 按时间过滤
   */
  private static filterByDate(notices: Notice[]): Notice[] {
    if (config.filter.dayRange <= 0) {
      return notices;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - config.filter.dayRange);

    return notices.filter(notice => {
      try {
        const publishDate = new Date(notice.publishDate);
        return publishDate >= cutoffDate;
      } catch (error) {
        logger.warn(`解析日期失败，保留公告: ${notice.title}`);
        return true; // 解析失败时保留
      }
    });
  }

  /**
   * 按包含关键词过滤
   */
  private static filterByKeywords(notices: Notice[]): Notice[] {
    if (!config.filter.keywords || config.filter.keywords.length === 0) {
      return notices;
    }

    return notices.filter(notice => {
      const searchText = `${notice.title} ${notice.summary || ''}`.toLowerCase();
      
      return config.filter.keywords.some(keyword => 
        searchText.includes(keyword.toLowerCase())
      );
    });
  }

  /**
   * 按排除关键词过滤
   */
  private static filterByExcludeKeywords(notices: Notice[]): Notice[] {
    if (!config.filter.excludeKeywords || config.filter.excludeKeywords.length === 0) {
      return notices;
    }

    return notices.filter(notice => {
      const searchText = `${notice.title} ${notice.summary || ''}`.toLowerCase();
      
      return !config.filter.excludeKeywords.some(keyword => 
        searchText.includes(keyword.toLowerCase())
      );
    });
  }

  /**
   * 数据清理和验证
   */
  private static cleanAndValidate(notices: Notice[]): Notice[] {
    return notices
      .filter(notice => {
        // 验证必要字段
        if (!notice.id || !notice.title || !notice.url) {
          logger.warn(`公告数据不完整，已跳过: ${notice.title || '未知标题'}`);
          return false;
        }

        // 验证URL格式
        try {
          new URL(notice.url);
        } catch (error) {
          logger.warn(`公告URL格式无效，已跳过: ${notice.url}`);
          return false;
        }

        // 验证标题长度
        if (notice.title.length < 5 || notice.title.length > 200) {
          logger.warn(`公告标题长度异常，已跳过: ${notice.title}`);
          return false;
        }

        return true;
      })
      .map(notice => ({
        ...notice,
        // 清理标题
        title: this.cleanTitle(notice.title),
        // 清理摘要
        summary: notice.summary ? this.cleanSummary(notice.summary) : undefined,
      }));
  }

  /**
   * 清理标题
   */
  private static cleanTitle(title: string): string {
    return title
      .replace(/\s+/g, ' ')           // 合并多个空格
      .replace(/[\r\n\t]/g, ' ')      // 替换换行符和制表符
      .replace(/[【】\[\]]/g, '')      // 移除方括号
      .trim();
  }

  /**
   * 清理摘要
   */
  private static cleanSummary(summary: string): string {
    return summary
      .replace(/\s+/g, ' ')           // 合并多个空格
      .replace(/[\r\n\t]/g, ' ')      // 替换换行符和制表符
      .trim();
  }

  /**
   * 按相关性排序
   */
  static sortByRelevance(notices: Notice[]): Notice[] {
    return notices.sort((a, b) => {
      // 首先按发布时间排序（最新的在前）
      const dateA = new Date(a.publishDate);
      const dateB = new Date(b.publishDate);
      
      if (dateA.getTime() !== dateB.getTime()) {
        return dateB.getTime() - dateA.getTime();
      }

      // 然后按标题长度排序（标题更具体的在前）
      return b.title.length - a.title.length;
    });
  }

  /**
   * 获取过滤统计信息
   */
  static getFilterStats(): {
    dayRange: number;
    keywordsCount: number;
    excludeKeywordsCount: number;
    keywords: string[];
    excludeKeywords: string[];
  } {
    return {
      dayRange: config.filter.dayRange,
      keywordsCount: config.filter.keywords.length,
      excludeKeywordsCount: config.filter.excludeKeywords.length,
      keywords: config.filter.keywords,
      excludeKeywords: config.filter.excludeKeywords,
    };
  }
} 