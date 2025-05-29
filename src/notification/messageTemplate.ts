import { Notice, CategorizedNotices } from '../types';

/**
 * 飞书消息模板 - 简化版
 */
export class MessageTemplate {
  private static readonly EMOJI = {
    BUILDING: '🏢',
    BELL: '🔔',
    NEW: '🆕',
    CALENDAR: '📅',
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

  // 简化的分类颜色映射
  private static readonly CATEGORY_COLORS = {
    '人才住房配售': 'blue',
    '安居型商品房': 'green',
    '保障性租赁住房': 'turquoise',
    '政策法规': 'purple',
    '招标采购': 'orange',
    '其他': 'grey'
  } as const;

  /**
   * 格式化时间
   */
  private static formatTime(date?: string): string {
    const targetDate = date ? new Date(date) : new Date();
    return targetDate.toLocaleString('zh-CN', { 
      timeZone: 'Asia/Shanghai',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * 检查是否为今日发布
   */
  private static isToday(publishDate: string): boolean {
    const today = new Date().toDateString();
    const noticeDate = new Date(publishDate).toDateString();
    return today === noticeDate;
  }

  /**
   * 获取分类颜色
   */
  private static getCategoryColor(category?: string): string {
    if (!category) return this.COLORS.NEUTRAL;
    return this.CATEGORY_COLORS[category as keyof typeof this.CATEGORY_COLORS] || this.COLORS.NEUTRAL;
  }

  /**
   * 创建简洁的通知标题
   */
  private static createNoticeTitle(notice: Notice, index?: number): string {
    const isNew = this.isToday(notice.publishDate);
    const prefix = isNew ? `${this.EMOJI.NEW} ` : '';
    const indexStr = typeof index === 'number' ? `${index + 1}. ` : '';
    return `${prefix}${indexStr}${notice.title}`;
  }

  /**
   * 创建通知元信息
   */
  private static createNoticeMeta(notice: Notice): string {
    const publishTime = this.formatTime(notice.publishDate);
    const isNew = this.isToday(notice.publishDate);
    const timeTag = isNew ? '今日发布' : publishTime;
    
    let meta = `${this.EMOJI.CALENDAR} ${timeTag}`;
    if (notice.category) {
      meta += ` • ${notice.category}`;
    }
    return meta;
  }

  /**
   * 创建基础卡片元素
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
  private static createActionButton(notice: Notice, buttonText = '>'): any {
    return {
      tag: 'action',
      actions: [
        {
          tag: 'button',
          text: {
            tag: 'plain_text',
            content: buttonText
          },
          type: 'default',
          size: 'tiny',
          url: notice.url
        }
      ]
    };
  }

  /**
   * 创建单个通知的卡片内容
   */
  private static createSingleNoticeCard(notice: Notice): any[] {
    const elements = [];

    // 标题
    elements.push(this.createCardElement(`**${notice.title}**`));

    // 元信息
    elements.push(this.createCardElement(this.createNoticeMeta(notice)));

    // 摘要（如果有）
    if (notice.summary) {
      elements.push(this.createCardElement(`> ${notice.summary}`));
    }

    // 操作按钮
    elements.push(this.createActionButton(notice));

    return elements;
  }

  /**
   * 创建多个通知的列表
   */
  private static createNoticeList(notices: Notice[]): any[] {
    const elements = [];
    
    // 统计信息
    const newCount = notices.filter(n => this.isToday(n.publishDate)).length;
    let statsText = `${this.EMOJI.CHART} 共 ${notices.length} 条通知`;
    if (newCount > 0) {
      statsText += `，${newCount} 条今日发布`;
    }
    
    elements.push(this.createCardElement(statsText));
    elements.push(this.createDivider());

    // 通知列表
    notices.forEach((notice, index) => {
      // 标题和时间拼接在一起
      const publishTime = this.formatTime(notice.publishDate);
      const isNew = this.isToday(notice.publishDate);
      const timeTag = isNew ? '今日发布' : publishTime;
      const titleWithTime = `**${this.createNoticeTitle(notice, index)}** ${this.EMOJI.CALENDAR} ${timeTag}`;
      
      elements.push(this.createCardElement(titleWithTime));
      
      // 摘要（简化显示）
      if (notice.summary) {
        const summary = notice.summary.length > 50 
          ? notice.summary.substring(0, 50) + '...' 
          : notice.summary;
        elements.push(this.createCardElement(`${this.EMOJI.MEMO} ${summary}`));
      }

      // 查看链接
      elements.push(this.createActionButton(notice));

      // 分隔线（非最后一条）
      if (index < notices.length - 1) {
        elements.push(this.createDivider());
      }
    });

    return elements;
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
   * 创建时间戳元素
   */
  private static createTimestamp(): any {
    return this.createCardElement(`${this.EMOJI.TIME} ${this.formatTime()}`);
  }

  /**
   * 创建交互式卡片消息（主要接口）
   */
  static createInteractiveCard(notices: Notice[]): any {
    if (notices.length === 0) {
      return this.createEmptyCard();
    }

    // 确定标题和模板
    const title = notices.length === 1 
      ? `${this.EMOJI.BELL} ${notices[0].title}`
      : `${this.EMOJI.BUILDING} 深圳住建局通知公告`;

    // 创建卡片头部
    const header = this.createCardHeader(title);

    // 创建卡片内容
    const elements = [this.createTimestamp(), this.createDivider()];

    if (notices.length === 1) {
      // 单条通知 - 详细展示
      elements.push(...this.createSingleNoticeCard(notices[0]));
    } else {
      // 多条通知 - 列表展示
      elements.push(...this.createNoticeList(notices));
    }

    return {
      msg_type: 'interactive',
      card: {
        header,
        elements
      }
    };
  }

  /**
   * 创建分类消息
   */
  static createCategorizedInteractiveCard(categorized: CategorizedNotices): any {
    const categories = Object.keys(categorized);
    if (categories.length === 0) {
      return this.createEmptyCard();
    }

    // 统计所有通知
    const allNotices: Notice[] = [];
    Object.values(categorized).forEach(notices => {
      allNotices.push(...notices);
    });

    const newCount = allNotices.filter(n => this.isToday(n.publishDate)).length;

    // 创建卡片头部
    const title = `${this.EMOJI.BUILDING} 深圳住建局通知公告 (${categories.length}个分类)`;
    const header = this.createCardHeader(title);

    // 创建卡片内容
    const elements = [this.createTimestamp(), this.createDivider()];

    // 总体统计
    let statsText = `${this.EMOJI.CHART} 共 ${allNotices.length} 条通知，${categories.length} 个分类`;
    if (newCount > 0) {
      statsText += `，${newCount} 条今日发布`;
    }
    elements.push(this.createCardElement(statsText));

    // 分类统计
    const categoryStats = categories.map(cat => 
      `• **${cat}**: ${categorized[cat].length} 条`
    ).join('\n');
    elements.push(this.createCardElement(categoryStats));
    elements.push(this.createDivider());

    // 按分类展示通知（只显示标题）
    categories.forEach((category, catIndex) => {
      const notices = categorized[category];
      const color = this.getCategoryColor(category);
      
      elements.push(this.createCardElement(`<text_tag color="${color}">${category}</text_tag>`));
      
      notices.forEach((notice, index) => {
        const title = this.createNoticeTitle(notice);
        const publishTime = this.formatTime(notice.publishDate);
        const isNew = this.isToday(notice.publishDate);
        const timeTag = isNew ? '今日发布' : publishTime;
        elements.push(this.createCardElement(`• **${title}** ${this.EMOJI.CALENDAR} ${timeTag}`));
        elements.push(this.createActionButton(notice, '→'));
      });

      // 分类间分隔线
      if (catIndex < categories.length - 1) {
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
   * 创建单个分类消息
   */
  static createSingleCategoryMessage(category: string, notices: Notice[]): any {
    if (notices.length === 0) {
      return null;
    }

    const newCount = notices.filter(n => this.isToday(n.publishDate)).length;
    const title = `${this.EMOJI.BELL} ${category} (${notices.length}条${newCount > 0 ? `，${newCount}条新` : ''})`;
    
    // 创建卡片头部
    const color = this.getCategoryColor(category);
    const header = this.createCardHeader(title, color);

    // 创建卡片内容
    const elements = [this.createTimestamp(), this.createDivider()];

    if (notices.length === 1) {
      elements.push(...this.createSingleNoticeCard(notices[0]));
    } else {
      elements.push(...this.createNoticeList(notices));
    }

    return {
      msg_type: 'interactive',
      card: {
        header,
        elements
      }
    };
  }

  /**
   * 缩短URL显示
   */
  private static shortenUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // 只显示域名部分，去掉协议和路径
      return urlObj.hostname;
    } catch {
      // 如果URL解析失败，返回原始链接的前30个字符
      return url.length > 30 ? url.substring(0, 30) + '...' : url;
    }
  }

  /**
   * 创建富文本消息（简化版）
   */
  static createRichTextMessage(notices: Notice[]): any {
    if (notices.length === 0) {
      return {
        msg_type: 'text',
        content: {
          text: `${this.EMOJI.CHECK} 暂无新的通知公告`
        }
      };
    }

    const newCount = notices.filter(n => this.isToday(n.publishDate)).length;
    let content = `${this.EMOJI.BUILDING} 深圳住建局通知公告\n`;
    content += `${this.EMOJI.CHART} 共 ${notices.length} 条${newCount > 0 ? `，${newCount} 条今日发布` : ''}\n`;
    content += `${this.EMOJI.TIME} ${this.formatTime()}\n\n`;
    
    notices.forEach((notice, index) => {
      const isNew = this.isToday(notice.publishDate);
      const prefix = isNew ? `${this.EMOJI.NEW} ` : '';
      content += `${prefix}${index + 1}. ${notice.title}\n`;
      content += `${this.createNoticeMeta(notice)}\n`;
      if (notice.summary) {
        content += `${this.EMOJI.MEMO} ${notice.summary}\n`;
      }
      content += `链接: ${this.shortenUrl(notice.url)}\n\n`;
    });

    return {
      msg_type: 'text',
      content: {
        text: content.trim()
      }
    };
  }

  /**
   * 创建空内容卡片
   */
  private static createEmptyCard(): any {
    return {
      msg_type: 'interactive',
      card: {
        header: this.createCardHeader(`${this.EMOJI.BUILDING} 深圳住建局通知公告`, this.COLORS.NEUTRAL),
        elements: [
          this.createTimestamp(),
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
          this.createTimestamp(),
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
          this.createTimestamp(),
          this.createDivider(),
          this.createCardElement(`${this.EMOJI.CHART} **处理统计**\n• 总处理: ${status.totalProcessed} 条\n• 新增: ${status.newNotices} 条\n• 过滤: ${status.filteredOut} 条\n• 成功率: ${successRate}%`),
          this.createCardElement(`${this.EMOJI.CHECK} 系统运行正常，上次更新: ${status.lastUpdate}`)
        ]
      }
    };
  }

  /**
   * Webhook 消息格式（使用交互式卡片）
   */
  static createWebhookMessage(notices: Notice[]): any {
    return this.createInteractiveCard(notices);
  }

  /**
   * 分类富文本消息
   */
  static createCategorizedRichTextMessage(categorized: CategorizedNotices): any {
    const allNotices: Notice[] = [];
    Object.values(categorized).forEach(notices => {
      allNotices.push(...notices);
    });
    return this.createRichTextMessage(allNotices);
  }
}
