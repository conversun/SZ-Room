import * as cron from 'node-cron';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { CrawlerService } from '../services/crawlerService';

/**
 * 定时任务管理器
 */
export class CronJobManager {
  private static task: cron.ScheduledTask | null = null;
  private static isRunning = false;
  private static lastExecutionTime: string | null = null;
  private static executionCount = 0;

  /**
   * 启动定时任务
   */
  static start(): void {
    if (this.task) {
      logger.warn('定时任务已经在运行');
      return;
    }

    if (!config.schedule.enabled) {
      logger.info('定时任务已禁用');
      return;
    }

    try {
      // 验证 cron 表达式
      if (!cron.validate(config.schedule.cronExpression)) {
        throw new Error(`无效的 cron 表达式: ${config.schedule.cronExpression}`);
      }

      // 创建定时任务
      this.task = cron.schedule(config.schedule.cronExpression, async () => {
        await this.executeTask();
      }, {
        timezone: 'Asia/Shanghai',
      });

      // 启动任务
      this.task.start();
      
      logger.info(`定时任务已启动，执行规则: ${config.schedule.cronExpression}`);
      logger.info(`下次执行时间: ${this.getNextExecutionTime()}`);

    } catch (error: any) {
      logger.error(`启动定时任务失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 停止定时任务
   */
  static stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      logger.info('定时任务已停止');
    } else {
      logger.warn('定时任务未运行');
    }
  }

  /**
   * 重启定时任务
   */
  static restart(): void {
    this.stop();
    this.start();
  }

  /**
   * 手动执行一次任务
   */
  static async executeOnce(): Promise<void> {
    logger.info('手动执行爬虫任务');
    await this.executeTask();
  }

  /**
   * 执行任务逻辑
   */
  private static async executeTask(): Promise<void> {
    if (this.isRunning) {
      logger.warn('任务正在执行中，跳过本次执行');
      return;
    }

    this.isRunning = true;
    this.executionCount++;
    const startTime = Date.now();
    
    try {
      logger.info(`开始执行第 ${this.executionCount} 次定时任务`);
      
      // 执行爬虫服务
      const crawlerService = new CrawlerService();
      await crawlerService.run();
      
      const duration = Date.now() - startTime;
      this.lastExecutionTime = new Date().toISOString();
      
      logger.info(`第 ${this.executionCount} 次任务执行完成，耗时: ${duration}ms`);
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error(`第 ${this.executionCount} 次任务执行失败，耗时: ${duration}ms`, error);
      
      // 可以在这里添加错误通知逻辑
      try {
        const { FeishuBot } = await import('../notification/feishuBot');
        await FeishuBot.pushError('定时任务执行失败', {
          executionCount: this.executionCount,
          error: error.message,
          duration,
          timestamp: new Date().toISOString(),
        });
      } catch (notifyError: any) {
        logger.error('发送错误通知失败:', notifyError);
      }
    } finally {
      this.isRunning = false;
      
      if (this.task) {
        logger.info(`下次执行时间: ${this.getNextExecutionTime()}`);
      }
    }
  }

  /**
   * 获取下次执行时间
   */
  private static getNextExecutionTime(): string {
    if (!this.task) {
      return '任务未启动';
    }

    try {
      // 这里需要一个获取下次执行时间的方法
      // node-cron 没有直接提供，我们可以使用一个近似的方法
      return '请查看 cron 表达式计算';
    } catch (error) {
      return '无法计算';
    }
  }

  /**
   * 获取任务状态
   */
  static getStatus(): {
    isScheduled: boolean;
    isRunning: boolean;
    cronExpression: string;
    executionCount: number;
    lastExecutionTime: string | null;
    nextExecutionTime: string;
    enabled: boolean;
  } {
    return {
      isScheduled: !!this.task,
      isRunning: this.isRunning,
      cronExpression: config.schedule.cronExpression,
      executionCount: this.executionCount,
      lastExecutionTime: this.lastExecutionTime,
      nextExecutionTime: this.getNextExecutionTime(),
      enabled: config.schedule.enabled,
    };
  }

  /**
   * 更新 cron 表达式
   */
  static updateSchedule(cronExpression: string): void {
    if (!cron.validate(cronExpression)) {
      throw new Error(`无效的 cron 表达式: ${cronExpression}`);
    }

    // 更新配置
    config.schedule.cronExpression = cronExpression;
    
    // 重启任务
    if (this.task) {
      this.restart();
      logger.info(`定时任务已更新，新的执行规则: ${cronExpression}`);
    }
  }

  /**
   * 设置任务启用状态
   */
  static setEnabled(enabled: boolean): void {
    config.schedule.enabled = enabled;
    
    if (enabled && !this.task) {
      this.start();
    } else if (!enabled && this.task) {
      this.stop();
    }
    
    logger.info(`定时任务已${enabled ? '启用' : '禁用'}`);
  }

  /**
   * 优雅关闭
   */
  static async shutdown(): Promise<void> {
    logger.info('开始关闭定时任务管理器');
    
    if (this.isRunning) {
      logger.info('等待当前任务执行完成...');
      // 等待当前任务完成（最多等待60秒）
      let waitTime = 0;
      const maxWaitTime = 60000;
      
      while (this.isRunning && waitTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        waitTime += 1000;
      }
      
      if (this.isRunning) {
        logger.warn('任务执行超时，强制关闭');
      }
    }
    
    this.stop();
    logger.info('定时任务管理器已关闭');
  }
} 