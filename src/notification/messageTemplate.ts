import { Notice, CategorizedNotices } from '../types';

/**
 * 飞书消息模板 - 简化版
 */
export class MessageTemplate {
  private static readonly EMOJI = {
    BUILDING: '🏢',
    BELL: '🔔',
    MEMO: '📝',
    CHECK: '✅',
    ERROR: '❌',
    TIME: '🕐',
    CHART: '📊',
    WARNING: '⚠️',
    INFO: 'ℹ️'
  } as const;

  private static readonly COLORS = {
    PRIMARY: 'blue',
    SUCCESS: 'green',
    WARNING: 'orange',
    ERROR: 'red',
    NEUTRAL: 'grey'
  } as const;

  /**
   * 格式化日期为 YYYY-MM-DD 格式
   */
  private static formatDate(date?: string): string {
    const targetDate = date ? new Date(date) : new Date();
    const year = targetDate.getFullYear();
    const month = (targetDate.getMonth() + 1).toString().padStart(2, '0');
    const day = targetDate.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 创建卡片元素
   */
  private static createCardElement(content: string, isMarkdown = true): any {
    return {
      tag: 'div',
      text: {
        tag: isMarkdown ? 'lark_md' : 'plain_text',
        content
      }
    };
  }

  /**
   * 创建分隔线
   */
  private static createDivider(): any {
    return { tag: 'hr' };
  }

  /**
   * 创建操作按钮
   */
  private static createActionButton(notice: Notice): any {
    return {
      tag: 'action',
      actions: [
        {
          tag: 'button',
          text: {
            tag: 'plain_text',
            content: '详情'
          },
          type: 'default',
          size: 'tiny',
          url: notice.url
        }
      ]
    };
  }

  /**
   * 创建卡片头部
   */
  private static createCardHeader(title: string, template: string = this.COLORS.PRIMARY): any {
    return {
      title: {
        tag: 'plain_text',
        content: title
      },
      template
    };
  }

  /**
   * 格式化单个通知内容
   * 格式：{分类名} {日期} {文章标题}
   */
  private static formatNoticeContent(notice: Notice): string {
    const category = notice.category || '未分类';
    const date = this.formatDate(notice.publishDate);
    const title = this.cleanNoticeTitle(notice.title);
    
    return `**${category}** ${date} ${title}`;
  }

  /**
   * 清理公告标题，移除冗余前缀
   */
  private static cleanNoticeTitle(title: string): string {
    const prefixesToRemove = [
      '深圳市住房保障署关于',
      '深圳市住房和建设局关于'
    ];

    let cleanedTitle = title;
    
    // 依次检查并移除前缀
    for (const prefix of prefixesToRemove) {
      if (cleanedTitle.startsWith(prefix)) {
        cleanedTitle = cleanedTitle.substring(prefix.length);
        break; // 找到匹配的前缀后就停止
      }
    }

    return cleanedTitle.trim();
  }

  /**
   * 创建单条通知消息
   */
  static createSingleNoticeMessage(notice: Notice): any {
    const title = `${this.EMOJI.BELL} 深圳住建局新通知`;
    const header = this.createCardHeader(title, this.COLORS.PRIMARY);

    const elements = [
      this.createDivider(),
      // 通知标题信息
      this.createCardElement(this.formatNoticeContent(notice)),
      // 详情
      this.createCardElement(`${this.EMOJI.MEMO} ${notice.summary || '暂无详情'}`),
      // 操作按钮
      this.createActionButton(notice)
    ];

    return {
      msg_type: 'interactive',
      card: {
        header,
        elements
      }
    };
  }

  /**
   * 创建多条通知消息
   */
  static createMultipleNoticesMessage(notices: Notice[]): any {
    const title = `${this.EMOJI.BUILDING} 深圳住建局通知公告 (${notices.length}条)`;
    const header = this.createCardHeader(title, this.COLORS.PRIMARY);

    const elements = [this.createDivider()];

    // 按原始顺序展示通知
    notices.forEach((notice, index) => {
      // 通知标题信息
      elements.push(this.createCardElement(`${index + 1}. ${this.formatNoticeContent(notice)}`));
      
      // 详情（简化显示）
      if (notice.summary) {
        const summary = notice.summary.length > 80 
          ? notice.summary.substring(0, 80) + '...' 
          : notice.summary;
        elements.push(this.createCardElement(`${this.EMOJI.MEMO} ${summary}`));
      }

      // 操作按钮
      elements.push(this.createActionButton(notice));

      // 分隔线（非最后一条）
      if (index < notices.length - 1) {
        elements.push(this.createDivider());
      }
    });

    return {
      msg_type: 'interactive',
      card: {
        header,
        elements
      }
    };
  }

  /**
   * 创建主要消息接口 - 自动判断单条还是多条
   */
  static createNotificationMessage(notices: Notice[]): any {
    if (notices.length === 0) {
      return this.createEmptyMessage();
    }

    if (notices.length === 1) {
      return this.createSingleNoticeMessage(notices[0]);
    } else {
      return this.createMultipleNoticesMessage(notices);
    }
  }

  /**
   * 创建空消息
   */
  private static createEmptyMessage(): any {
    return {
      msg_type: 'interactive',
      card: {
        header: this.createCardHeader(`${this.EMOJI.BUILDING} 深圳住建局通知公告`, this.COLORS.NEUTRAL),
        elements: [
          this.createDivider(),
          this.createCardElement(`${this.EMOJI.CHECK} 暂无新的通知公告`)
        ]
      }
    };
  }

  /**
   * 创建错误消息
   */
  static createErrorMessage(error: string, details?: any): any {
    return {
      msg_type: 'interactive',
      card: {
        header: this.createCardHeader(`${this.EMOJI.ERROR} 系统异常通知`, this.COLORS.ERROR),
        elements: [
          this.createDivider(),
          this.createCardElement(`${this.EMOJI.WARNING} **错误信息**\n${error}`),
          ...(details ? [this.createCardElement(`${this.EMOJI.INFO} **详细信息**\n\`\`\`\n${JSON.stringify(details, null, 2)}\n\`\`\``)] : [])
        ]
      }
    };
  }

  /**
   * 创建状态消息
   */
  static createStatusMessage(status: {
    totalProcessed: number;
    newNotices: number;
    filteredOut: number;
    lastUpdate: string;
  }): any {
    const successRate = status.totalProcessed > 0 
      ? ((status.newNotices / status.totalProcessed) * 100).toFixed(1)
      : '0';

    return {
      msg_type: 'interactive',
      card: {
        header: this.createCardHeader(`${this.EMOJI.CHART} 系统运行状态`, this.COLORS.SUCCESS),
        elements: [
          this.createDivider(),
          this.createCardElement(`${this.EMOJI.CHART} **处理统计**\n总处理: ${status.totalProcessed} 条\n新增: ${status.newNotices} 条\n过滤: ${status.filteredOut} 条\n成功率: ${successRate}%`),
          this.createCardElement(`${this.EMOJI.CHECK} 系统运行正常，上次更新: ${status.lastUpdate}`)
        ]
      }
    };
  }

  /**
   * Webhook 消息格式
   */
  static createWebhookMessage(notices: Notice[]): any {
    return this.createNotificationMessage(notices);
  }

  // 保持向后兼容的接口
  static createInteractiveCard(notices: Notice[]): any {
    return this.createNotificationMessage(notices);
  }

  static createCategorizedInteractiveCard(categorized: CategorizedNotices): any {
    // 收集所有公告并按原始索引排序以保持原始顺序
    const allNotices: Notice[] = [];
    Object.values(categorized).forEach(notices => {
      allNotices.push(...notices);
    });
    
    // 按原始索引排序以恢复原始顺序
    allNotices.sort((a, b) => {
      const indexA = (a as any).originalIndex || 0;
      const indexB = (b as any).originalIndex || 0;
      return indexA - indexB;
    });
    
    return this.createNotificationMessage(allNotices);
  }
}
