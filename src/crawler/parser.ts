import * as cheerio from 'cheerio';
import { Notice, CrawlerError } from '../types';
import { logger } from '../utils/logger';

/**
 * HTML 数据解析器
 */
export class HtmlParser {
  /**
   * 解析通知公告列表页面
   */
  static parseNoticeList(html: string, baseUrl: string = 'https://zjj.sz.gov.cn'): Notice[] {
    try {
      const $ = cheerio.load(html);
      const notices: Notice[] = [];
      
      // 查找公告列表项 - 更新选择器以匹配深圳住建局网站的实际结构
      const listItems = $('ul.ftdt-list li, ul.articleList li, .articleList li, table tr, .list-item, .news-list li');
      
      if (listItems.length === 0) {
        // 尝试其他可能的选择器
        const alternativeItems = $('.content a[href*="html"], .main-content a[href*="html"], a[title]');
        if (alternativeItems.length === 0) {
          logger.warn('未找到公告列表项，可能需要更新选择器');
          return notices;
        }
        // 将jQuery对象合并
        alternativeItems.each((_, el) => {
          listItems.get().push(el);
        });
      }

      logger.info(`找到 ${listItems.length} 个列表项`);

      listItems.each((index, element) => {
        try {
          const $item = $(element);
          
          // 查找标题和链接
          let $link = $item.find('a[href]').first();
          if ($link.length === 0) {
            $link = $item.is('a') ? $item : $item.find('a').first();
          }
          
          if ($link.length === 0) {
            return; // 跳过没有链接的项
          }

          const title = this.extractTitle($link);
          const relativeUrl = $link.attr('href');
          
          if (!title || !relativeUrl) {
            return; // 跳过无效项
          }

          // 处理相对路径
          const fullUrl = this.resolveUrl(relativeUrl, baseUrl);
          
          // 查找发布时间
          const publishDate = this.extractPublishDate($item);
          
          // 生成唯一ID（基于URL）
          const id = this.generateId(fullUrl);

          const notice: Notice = {
            id,
            title: title.trim(),
            url: fullUrl,
            publishDate,
          };

          notices.push(notice);
          
        } catch (error: any) {
          logger.warn(`解析第 ${index + 1} 项时出错: ${error.message}`);
        }
      });

      logger.info(`成功解析 ${notices.length} 条公告`);
      return notices;

    } catch (error: any) {
      const errorMessage = `解析公告列表失败: ${error.message}`;
      logger.error(errorMessage, error);
      throw new CrawlerError(errorMessage, 'PARSE_ERROR', { originalError: error });
    }
  }

  /**
   * 解析公告详情页面
   */
  static parseNoticeDetail(html: string): { content: string; summary: string } {
    try {
      const $ = cheerio.load(html);
      
      // 查找内容区域
      const contentSelectors = [
        '.article-content',
        '.content',
        '.main-content',
        '.detail-content',
        '#content',
        '.TRS_Editor',
        '.article-body'
      ];
      
      let $content = $();
      for (const selector of contentSelectors) {
        $content = $(selector);
        if ($content.length > 0) break;
      }
      
      if ($content.length === 0) {
        // 如果找不到特定内容区域，尝试获取 body 中的文本
        $content = $('body');
      }

      // 清理内容
      $content.find('script, style, nav, header, footer, .nav, .navigation').remove();
      
      const fullContent = $content.text().trim();
      
      // 生成摘要（前200字符）
      const summary = this.generateSummary(fullContent);
      
      return {
        content: fullContent,
        summary,
      };

    } catch (error: any) {
      logger.warn(`解析详情页面失败: ${error.message}`);
      return {
        content: '',
        summary: '',
      };
    }
  }

  /**
   * 提取标题
   */
  private static extractTitle($element: cheerio.Cheerio<any>): string {
    // 尝试多种方式获取标题
    let title = $element.attr('title') || '';
    
    if (!title) {
      title = $element.text().trim();
    }
    
    if (!title) {
      title = $element.find('span, div').first().text().trim();
    }
    
    // 清理标题
    title = title.replace(/\s+/g, ' ').trim();
    
    return title;
  }

  /**
   * 提取发布时间
   */
  private static extractPublishDate($element: cheerio.Cheerio<any>): string {
    // 特殊处理深圳住建局网站的日期格式
    // 日期通常在li元素的span中，格式为 "25-05-29"
    const $dateSpan = $element.find('span').last();
    if ($dateSpan.length > 0) {
      const dateText = $dateSpan.text().trim();
      const parsedDate = this.parseDate(dateText);
      if (parsedDate) {
        return parsedDate;
      }
    }
    
    // 尝试查找其他日期格式
    const dateSelectors = [
      '.date',
      '.time',
      '.publish-date',
      '.article-date',
      '[class*="date"]',
      '[class*="time"]'
    ];
    
    for (const selector of dateSelectors) {
      const $date = $element.find(selector);
      if ($date.length > 0) {
        const dateText = $date.text().trim();
        const parsedDate = this.parseDate(dateText);
        if (parsedDate) {
          return parsedDate;
        }
      }
    }
    
    // 尝试从文本中提取日期
    const fullText = $element.text();
    const dateMatch = fullText.match(/(\d{2,4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?)/);
    if (dateMatch) {
      const parsedDate = this.parseDate(dateMatch[1]);
      if (parsedDate) {
        return parsedDate;
      }
    }
    
    // 默认返回当前时间
    return new Date().toISOString();
  }

  /**
   * 解析日期字符串
   */
  private static parseDate(dateStr: string): string | null {
    if (!dateStr) return null;
    
    try {
      // 处理中文日期格式
      let normalized = dateStr
        .replace(/年/g, '-')
        .replace(/月/g, '-')
        .replace(/日/g, '')
        .replace(/\s+/g, '');
      
      // 处理不同分隔符
      normalized = normalized.replace(/[\/]/g, '-');
      
      // 处理两位年份格式（如 "25-05-29"）
      const twoDigitYearMatch = normalized.match(/^(\d{2})-(\d{1,2})-(\d{1,2})$/);
      if (twoDigitYearMatch) {
        const [, year, month, day] = twoDigitYearMatch;
        const fullYear = parseInt(year) + 2000; // 假设是21世纪
        normalized = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      
      const date = new Date(normalized);
      if (isNaN(date.getTime())) {
        return null;
      }
      
      return date.toISOString();
    } catch (error) {
      return null;
    }
  }

  /**
   * 解析相对URL
   */
  private static resolveUrl(relativeUrl: string, baseUrl: string): string {
    if (relativeUrl.startsWith('http')) {
      return relativeUrl;
    }
    
    if (relativeUrl.startsWith('//')) {
      return `https:${relativeUrl}`;
    }
    
    if (relativeUrl.startsWith('/')) {
      const base = new URL(baseUrl);
      return `${base.protocol}//${base.host}${relativeUrl}`;
    }
    
    // 相对路径
    const base = new URL(baseUrl);
    const basePath = base.pathname.endsWith('/') ? base.pathname : base.pathname + '/';
    return `${base.protocol}//${base.host}${basePath}${relativeUrl}`;
  }

  /**
   * 生成唯一ID
   */
  private static generateId(url: string): string {
    // 从URL中提取文件名或ID
    const match = url.match(/\/([^\/]+)\.html?/);
    if (match) {
      return match[1];
    }
    
    // 如果无法从URL提取，使用URL的hash
    return Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
  }

  /**
   * 生成摘要
   */
  private static generateSummary(content: string, maxLength: number = 200): string {
    if (!content) return '';
    
    // 清理多余空白
    const cleaned = content.replace(/\s+/g, ' ').trim();
    
    if (cleaned.length <= maxLength) {
      return cleaned;
    }
    
    // 截取并在单词边界处结束
    const truncated = cleaned.slice(0, maxLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    
    if (lastSpaceIndex > maxLength * 0.8) {
      return truncated.slice(0, lastSpaceIndex) + '...';
    }
    
    return truncated + '...';
  }
} 