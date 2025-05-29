import { config, validateConfig } from './config/config';
import { FeishuConfig } from './config/feishu';
import { logger } from './utils/logger';
import { CrawlerService } from './services/crawlerService';
import { CronJobManager } from './scheduler/cronJob';
import { cache } from './utils/cache';

/**
 * 应用程序主类
 */
class Application {
  private crawlerService: CrawlerService;
  private isShuttingDown = false;

  constructor() {
    this.crawlerService = new CrawlerService();
  }

  /**
   * 启动应用程序
   */
  async start(): Promise<void> {
    try {
      logger.info('🚀 深圳住建局通知公告抓取系统启动中...');
      
      // 1. 验证配置
      await this.validateConfiguration();
      
      // 2. 初始化系统
      await this.initialize();
      
      // 3. 启动服务
      await this.startServices();
      
      logger.info('✅ 系统启动完成');
      
    } catch (error: any) {
      logger.error('❌ 系统启动失败:', error);
      process.exit(1);
    }
  }

  /**
   * 验证配置
   */
  private async validateConfiguration(): Promise<void> {
    logger.info('验证系统配置...');
    
    try {
      // 验证基础配置
      validateConfig();
      
      // 验证飞书配置
      FeishuConfig.validateConfig();
      
      logger.info('✅ 配置验证通过');
      logger.info('系统配置信息:', {
        nodeEnv: config.app.nodeEnv,
        runOnce: config.app.runOnce,
        crawlerUrl: config.crawler.baseUrl,
        filterDayRange: config.filter.dayRange,
        scheduleEnabled: config.schedule.enabled,
        cronExpression: config.schedule.cronExpression,
        feishuConfig: FeishuConfig.getConfigInfo(),
      });
      
    } catch (error: any) {
      logger.error('配置验证失败:', error);
      throw error;
    }
  }

  /**
   * 初始化系统
   */
  private async initialize(): Promise<void> {
    logger.info('初始化系统组件...');
    
    try {
      // 测试飞书连接
      logger.info('测试飞书推送连接...');
      const testResult = await this.crawlerService.test();
      
      if (!testResult.pushTest) {
        logger.warn('飞书推送测试失败，但系统将继续运行');
      }
      
      // 设置进程信号处理
      this.setupSignalHandlers();
      
      logger.info('✅ 系统初始化完成');
      
    } catch (error: any) {
      logger.error('系统初始化失败:', error);
      throw error;
    }
  }

  /**
   * 启动服务
   */
  private async startServices(): Promise<void> {
    logger.info('启动服务...');
    
    try {
      if (config.app.runOnce) {
        // 单次运行模式
        logger.info('单次运行模式');
        await this.runOnce();
      } else {
        // 定时任务模式
        logger.info('定时任务模式');
        await this.startScheduler();
      }
      
    } catch (error: any) {
      logger.error('启动服务失败:', error);
      throw error;
    }
  }

  /**
   * 单次运行
   */
  private async runOnce(): Promise<void> {
    logger.info('开始执行单次爬虫任务');
    
    try {
      const result = await this.crawlerService.run();
      
      if (result.success) {
        logger.info('✅ 单次任务执行成功', {
          totalProcessed: result.totalProcessed,
          newNotices: result.newNotices,
          filteredOut: result.filteredOut,
        });
      } else {
        logger.error('❌ 单次任务执行失败:', result.error);
        process.exit(1);
      }
      
    } catch (error: any) {
      logger.error('单次任务执行异常:', error);
      process.exit(1);
    }
  }

  /**
   * 启动定时任务调度器
   */
  private async startScheduler(): Promise<void> {
    try {
      CronJobManager.start();
      
      // 打印任务状态
      const status = CronJobManager.getStatus();
      logger.info('定时任务状态:', status);
      
      // 保持程序运行
      logger.info('系统正在运行中，按 Ctrl+C 退出...');
      
      // 可选：立即执行一次任务
      if (config.app.nodeEnv === 'development') {
        logger.info('开发环境，立即执行一次任务进行测试');
        setTimeout(async () => {
          await CronJobManager.executeOnce();
        }, 5000); // 5秒后执行
      }
      
    } catch (error: any) {
      logger.error('启动定时任务失败:', error);
      throw error;
    }
  }

  /**
   * 设置信号处理器
   */
  private setupSignalHandlers(): void {
    // 处理 SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      logger.info('收到 SIGINT 信号，开始优雅关闭...');
      this.shutdown('SIGINT');
    });

    // 处理 SIGTERM
    process.on('SIGTERM', () => {
      logger.info('收到 SIGTERM 信号，开始优雅关闭...');
      this.shutdown('SIGTERM');
    });

    // 处理未捕获的异常
    process.on('uncaughtException', (error) => {
      logger.error('未捕获的异常:', error);
      this.shutdown('uncaughtException', 1);
    });

    // 处理未处理的 Promise 拒绝
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('未处理的 Promise 拒绝:', { reason, promise });
      this.shutdown('unhandledRejection', 1);
    });
  }

  /**
   * 优雅关闭
   */
  private async shutdown(signal: string, exitCode: number = 0): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('系统正在关闭中，请勿重复操作');
      return;
    }

    this.isShuttingDown = true;
    logger.info(`开始关闭系统 (${signal})...`);

    try {
      // 停止定时任务
      await CronJobManager.shutdown();
      
      // 清理缓存
      cache.destroy();
      
      logger.info('✅ 系统已优雅关闭');
      process.exit(exitCode);
      
    } catch (error: any) {
      logger.error('关闭系统时发生错误:', error);
      process.exit(1);
    }
  }

  /**
   * 获取应用状态
   */
  getStatus(): {
    app: {
      uptime: number;
      nodeEnv: string;
      runOnce: boolean;
    };
    crawler: any;
    scheduler: any;
  } {
    return {
      app: {
        uptime: process.uptime(),
        nodeEnv: config.app.nodeEnv,
        runOnce: config.app.runOnce,
      },
      crawler: this.crawlerService.getStatus(),
      scheduler: CronJobManager.getStatus(),
    };
  }
}

// 创建应用实例并启动
const app = new Application();

// 如果直接运行此文件，则启动应用
if (require.main === module) {
  app.start().catch((error) => {
    logger.error('应用启动失败:', error);
    process.exit(1);
  });
}

export default app; 