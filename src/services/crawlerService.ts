import { Notice, FilterResult, PushResult } from '../types';
import { WebScraper } from '../crawler/scraper';
import { HtmlParser } from '../crawler/parser';
import { DataFilter } from '../filter/dataFilter';
import { DeduplicationFilter } from '../filter/deduplication';
import { FeishuBot } from '../notification/feishuBot';
import { CategoryService } from './categoryService';
import { logger } from '../utils/logger';
import { config } from '../config/config';

/**
 * 爬虫服务主类
 */
export class CrawlerService {
  private scraper: WebScraper;
  private lastRunTime: string | null = null;
  private totalProcessed = 0;
  private pushMode: 'single' | 'categorized' | 'by-category' = 'categorized'; // 推送模式

  constructor(pushMode: 'single' | 'categorized' | 'by-category' = 'categorized') {
    this.scraper = new WebScraper();
    this.pushMode = pushMode;
    logger.info(`爬虫服务初始化完成，推送模式: ${pushMode}`);
  }

  /**
   * 设置推送模式
   */
  setPushMode(mode: 'single' | 'categorized' | 'by-category'): void {
    this.pushMode = mode;
    logger.info(`推送模式已设置为: ${mode}`);
  }

  /**
   * 执行完整的爬虫流程
   */
  async run(): Promise<{
    success: boolean;
    totalProcessed: number;
    newNotices: number;
    filteredOut: number;
    pushResult?: PushResult | PushResult[];
    error?: string;
  }> {
    const startTime = Date.now();
    logger.info('开始执行爬虫任务');

    try {
      // 1. 抓取网页数据
      const htmlPages = await this.fetchPages();
      
      // 2. 解析HTML数据
      const allNotices = await this.parsePages(htmlPages);
      
      // 3. 数据过滤
      const filterResult = this.filterNotices(allNotices);
      
      // 4. 去重处理（异步）
      const dedupeResult = await this.deduplicateNotices(filterResult);
      
      // 5. 推送新公告
      let pushResult: PushResult | PushResult[] | undefined;
      if (dedupeResult.newCount > 0) {
        pushResult = await this.pushNotices(dedupeResult.notices);
        
        // 标记公告为已发送
        await this.markNoticesAsSent(dedupeResult.notices);
      } else {
        logger.info('没有新公告需要推送');
      }

      // 6. 记录统计信息
      this.updateStats(dedupeResult);
      
      const duration = Date.now() - startTime;
      const result = {
        success: true,
        totalProcessed: dedupeResult.totalCount,
        newNotices: dedupeResult.newCount,
        filteredOut: dedupeResult.totalCount - dedupeResult.filteredCount,
        pushResult,
      };

      logger.info(`爬虫任务执行完成，耗时: ${duration}ms`, result);
      return result;

    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error(`爬虫任务执行失败，耗时: ${duration}ms`, error);

      // 推送错误通知
      try {
        await FeishuBot.pushError('爬虫任务执行失败', {
          error: error.message,
          duration,
          timestamp: new Date().toISOString(),
        });
      } catch (pushError: any) {
        logger.error('推送错误通知失败:', pushError);
      }

      return {
        success: false,
        totalProcessed: 0,
        newNotices: 0,
        filteredOut: 0,
        error: error.message,
      };
    }
  }

  /**
   * 抓取网页数据
   */
  private async fetchPages(): Promise<string[]> {
    logger.info('开始抓取网页数据');
    
    try {
      // 抓取前3页数据（可配置）
      const pages = await this.scraper.fetchMultiplePages(1);
      
      if (pages.length === 0) {
        throw new Error('未能抓取到任何页面数据');
      }

      logger.info(`成功抓取 ${pages.length} 个页面`);
      return pages;

    } catch (error: any) {
      logger.error('抓取网页数据失败:', error);
      throw new Error(`网页抓取失败: ${error.message}`);
    }
  }

  /**
   * 解析HTML页面
   */
  private async parsePages(htmlPages: string[]): Promise<Notice[]> {
    logger.info('开始解析HTML数据');
    
    const allNotices: Notice[] = [];
    
    for (let i = 0; i < htmlPages.length; i++) {
      try {
        const notices = HtmlParser.parseNoticeList(htmlPages[i]);
        allNotices.push(...notices);
        logger.debug(`第 ${i + 1} 页解析出 ${notices.length} 条公告`);
      } catch (error: any) {
        logger.warn(`解析第 ${i + 1} 页失败: ${error.message}`);
        // 继续处理其他页面
      }
    }

    if (allNotices.length === 0) {
      throw new Error('未能解析到任何公告数据');
    }

    logger.info(`总共解析出 ${allNotices.length} 条公告`);
    return allNotices;
  }

  /**
   * 过滤公告数据
   */
  private filterNotices(notices: Notice[]): FilterResult {
    logger.info('开始过滤公告数据');
    
    const filterResult = DataFilter.filter(notices);
    
    logger.info(`过滤完成：${filterResult.totalCount} -> ${filterResult.filteredCount} 条`);
    return filterResult;
  }

  /**
   * 去重处理（异步版本）
   */
  private async deduplicateNotices(filterResult: FilterResult): Promise<FilterResult> {
    logger.info('开始去重处理');
    
    const dedupeResult = await DeduplicationFilter.process(filterResult);
    
    logger.info(`去重完成：${dedupeResult.filteredCount} -> ${dedupeResult.newCount} 条新公告`);
    return dedupeResult;
  }

  /**
   * 推送公告（支持多种模式）
   */
  private async pushNotices(notices: Notice[]): Promise<PushResult | PushResult[]> {
    logger.info(`开始推送 ${notices.length} 条公告，推送模式: ${this.pushMode}`);
    
    try {
      let pushResult: PushResult | PushResult[];

      switch (this.pushMode) {
        case 'single':
          // 原有的单条消息推送
          pushResult = await FeishuBot.pushNotices(notices);
          break;
          
        case 'categorized':
          // 分类后的单条消息推送
          pushResult = await FeishuBot.pushCategorizedNotices(notices);
          break;
          
        case 'by-category':
          // 按分类分别推送
          pushResult = await FeishuBot.pushNoticesByCategory(notices);
          break;
          
        default:
          throw new Error(`未知的推送模式: ${this.pushMode}`);
      }

      // 记录推送结果
      if (Array.isArray(pushResult)) {
        const successCount = pushResult.filter(r => r.success).length;
        logger.info(`分类推送完成，成功: ${successCount}/${pushResult.length}`);
      } else {
        if (pushResult.success) {
          logger.info('公告推送成功');
        } else {
          logger.error('公告推送失败:', pushResult.message);
        }
      }
      
      return pushResult;

    } catch (error: any) {
      logger.error('推送公告时发生错误:', error);
      return {
        success: false,
        message: `推送失败: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 标记公告为已发送
   */
  private async markNoticesAsSent(notices: Notice[]): Promise<void> {
    try {
      const noticeIds = notices.map(notice => notice.id);
      await DeduplicationFilter.markBatchAsSent(noticeIds);
      logger.info(`标记 ${noticeIds.length} 条公告为已发送`);
    } catch (error: any) {
      logger.error('标记公告为已发送失败:', error);
    }
  }

  /**
   * 更新统计信息
   */
  private updateStats(result: FilterResult): void {
    this.totalProcessed += result.totalCount;
    this.lastRunTime = new Date().toISOString();
    
    logger.info('统计信息已更新', {
      totalProcessed: this.totalProcessed,
      lastRunTime: this.lastRunTime,
    });
  }

  /**
   * 获取运行状态
   */
  getStatus(): {
    totalProcessed: number;
    lastRunTime: string | null;
    config: {
      baseUrl: string;
      dayRange: number;
      keywords: string[];
      excludeKeywords: string[];
    };
  } {
    return {
      totalProcessed: this.totalProcessed,
      lastRunTime: this.lastRunTime,
      config: {
        baseUrl: config.crawler.baseUrl,
        dayRange: config.filter.dayRange,
        keywords: config.filter.keywords,
        excludeKeywords: config.filter.excludeKeywords,
      },
    };
  }

  /**
   * 测试爬虫功能
   */
  async test(): Promise<{
    fetchTest: boolean;
    parseTest: boolean;
    filterTest: boolean;
    pushTest: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    let fetchTest = false;
    let parseTest = false;
    let filterTest = false;
    let pushTest = false;

    logger.info('开始测试爬虫功能');

    // 测试网页抓取
    try {
      const page = await this.scraper.fetchNoticeListPage(1);
      if (page && page.length > 0) {
        fetchTest = true;
        logger.info('✓ 网页抓取测试通过');

        // 测试HTML解析
        try {
          const notices = HtmlParser.parseNoticeList(page);
          if (notices.length > 0) {
            parseTest = true;
            logger.info(`✓ HTML解析测试通过，解析出 ${notices.length} 条公告`);

            // 测试数据过滤
            try {
              const filterResult = DataFilter.filter(notices.slice(0, 5)); // 只测试前5条
              filterTest = true;
              logger.info(`✓ 数据过滤测试通过，过滤结果: ${filterResult.filteredCount} 条`);
            } catch (error: any) {
              errors.push(`过滤测试失败: ${error.message}`);
            }
          } else {
            errors.push('解析测试失败: 未解析到公告数据');
          }
        } catch (error: any) {
          errors.push(`解析测试失败: ${error.message}`);
        }
      } else {
        errors.push('抓取测试失败: 页面内容为空');
      }
    } catch (error: any) {
      errors.push(`抓取测试失败: ${error.message}`);
    }

    // 测试推送功能
    try {
      const testResult = await FeishuBot.testConnection();
      if (testResult.success) {
        pushTest = true;
        logger.info('✓ 推送测试通过');
      } else {
        errors.push(`推送测试失败: ${testResult.message}`);
      }
    } catch (error: any) {
      errors.push(`推送测试失败: ${error.message}`);
    }

    const result = {
      fetchTest,
      parseTest,
      filterTest,
      pushTest,
      errors,
    };

    if (errors.length === 0) {
      logger.info('✓ 所有功能测试通过');
    } else {
      logger.warn(`测试完成，发现 ${errors.length} 个问题:`, errors);
    }

    return result;
  }

  /**
   * 推送系统状态
   */
  async pushSystemStatus(): Promise<PushResult> {
    const cacheStats = await DeduplicationFilter.getStats();
    
    const status = {
      totalProcessed: this.totalProcessed,
      newNotices: 0, // 这次调用不统计新公告
      filteredOut: 0,
      cacheSize: cacheStats.cacheSize,
      lastUpdate: this.lastRunTime || '从未运行',
    };

    return await FeishuBot.pushStatus(status);
  }
} 