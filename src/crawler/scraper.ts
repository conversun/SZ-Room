import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { CrawlerError, RetryConfig } from '../types';
import { config } from '../config/config';
import { logger } from '../utils/logger';

/**
 * HTTP 请求封装类
 * 提供重试机制和错误处理
 */
export class HttpClient {
  private client: AxiosInstance;
  private retryConfig: RetryConfig;

  constructor() {
    this.client = axios.create({
      timeout: config.crawler.timeout,
      headers: {
        'User-Agent': config.crawler.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0',
      },
    });

    this.retryConfig = {
      retries: config.crawler.retryTimes,
      delay: 1000, // 1秒
      backoff: 2,  // 指数退避
    };

    this.setupInterceptors();
  }

  /**
   * 设置请求和响应拦截器
   */
  private setupInterceptors(): void {
    // 请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`发起请求: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('请求配置错误:', error);
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`请求成功: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        const url = error.config?.url || 'unknown';
        const status = error.response?.status || 'unknown';
        logger.debug(`请求失败: ${status} ${url} - ${error.message}`);
        return Promise.reject(error);
      }
    );
  }

  /**
   * GET 请求
   */
  async get(url: string, config?: AxiosRequestConfig): Promise<string> {
    return this.requestWithRetry('GET', url, config);
  }

  /**
   * POST 请求
   */
  async post(url: string, data?: any, config?: AxiosRequestConfig): Promise<string> {
    return this.requestWithRetry('POST', url, { ...config, data });
  }

  /**
   * 带重试机制的请求
   */
  private async requestWithRetry(
    method: 'GET' | 'POST',
    url: string,
    config?: AxiosRequestConfig
  ): Promise<string> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= this.retryConfig.retries; attempt++) {
      try {
        const response = method === 'GET' 
          ? await this.client.get(url, config)
          : await this.client.post(url, config?.data, config);
        
        if (response.status === 200) {
          return response.data;
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error: any) {
        lastError = error;
        
        if (attempt === this.retryConfig.retries) {
          break; // 最后一次尝试失败
        }

        // 计算延迟时间（指数退避）
        const delay = this.retryConfig.delay * Math.pow(this.retryConfig.backoff || 2, attempt);
        
        logger.warn(`请求失败，第 ${attempt + 1}/${this.retryConfig.retries + 1} 次尝试，${delay}ms 后重试: ${error.message}`);
        
        await this.sleep(delay);
      }
    }

    // 所有重试都失败了
    const errorMessage = `请求失败，已重试 ${this.retryConfig.retries} 次: ${lastError.message}`;
    throw new CrawlerError(errorMessage, 'NETWORK_ERROR', {
      url,
      originalError: lastError,
      attempts: this.retryConfig.retries + 1,
    });
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 网页抓取器
 */
export class WebScraper {
  private httpClient: HttpClient;

  constructor() {
    this.httpClient = new HttpClient();
    logger.info('网页抓取器初始化完成');
  }

  /**
   * 抓取深圳住建局通知公告列表页面
   */
  async fetchNoticeListPage(pageNum: number = 1): Promise<string> {
    try {
      logger.info(`开始抓取通知公告列表页面，页码: ${pageNum}`);
      
      let url = config.crawler.baseUrl;
      if (pageNum > 1) {
        // 分页URL格式：index_2.html, index_3.html, ...
        url = url.replace('/index.html', `/index_${pageNum}.html`);
      }

      const html = await this.httpClient.get(url);
      
      if (!html || html.trim().length === 0) {
        throw new CrawlerError('页面内容为空', 'EMPTY_CONTENT', { url, pageNum });
      }

      logger.info(`成功抓取页面，内容长度: ${html.length} 字符`);
      return html;
      
    } catch (error: any) {
      if (error instanceof CrawlerError) {
        throw error;
      }
      
      const errorMessage = `抓取页面失败: ${error.message}`;
      logger.error(errorMessage, error);
      throw new CrawlerError(errorMessage, 'FETCH_ERROR', { pageNum, originalError: error });
    }
  }

  /**
   * 抓取公告详情页面
   */
  async fetchNoticeDetail(url: string): Promise<string> {
    try {
      logger.debug(`抓取公告详情: ${url}`);
      
      const html = await this.httpClient.get(url);
      
      if (!html || html.trim().length === 0) {
        throw new CrawlerError('详情页面内容为空', 'EMPTY_CONTENT', { url });
      }

      return html;
      
    } catch (error: any) {
      if (error instanceof CrawlerError) {
        throw error;
      }
      
      const errorMessage = `抓取详情页面失败: ${error.message}`;
      logger.error(errorMessage, error);
      throw new CrawlerError(errorMessage, 'FETCH_DETAIL_ERROR', { url, originalError: error });
    }
  }

  /**
   * 批量抓取多个页面
   */
  async fetchMultiplePages(pageCount: number = 3): Promise<string[]> {
    const results: string[] = [];
    
    logger.info(`开始批量抓取 ${pageCount} 个页面`);
    
    for (let i = 1; i <= pageCount; i++) {
      try {
        const html = await this.fetchNoticeListPage(i);
        results.push(html);
        
        // 避免请求过于频繁
        if (i < pageCount) {
          await this.sleep(500); // 500ms 间隔
        }
      } catch (error: any) {
        logger.error(`抓取第 ${i} 页失败: ${error.message}`);
        // 继续抓取下一页，而不是中断整个过程
      }
    }
    
    logger.info(`批量抓取完成，成功 ${results.length}/${pageCount} 页`);
    return results;
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 