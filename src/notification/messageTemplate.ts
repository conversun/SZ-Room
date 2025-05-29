import { Notice } from '../types';

/**
 * 飞书消息模板
 */
export class MessageTemplate {
  /**
   * 创建富文本消息
   */
  static createRichTextMessage(notices: Notice[]): any {
    if (notices.length === 0) {
      return {
        msg_type: 'text',
        content: {
          text: '暂无新的通知公告'
        }
      };
    }

    const title = `🏢 深圳住建局通知公告 (${notices.length}条新公告)`;
    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    
    let content = `${title}\n更新时间：${timestamp}\n\n`;
    
    notices.forEach((notice, index) => {
      const publishDate = new Date(notice.publishDate).toLocaleDateString('zh-CN');
      content += `📄 ${index + 1}. ${notice.title}\n`;
      content += `📅 发布时间：${publishDate}\n`;
      if (notice.summary) {
        content += `📝 摘要：${notice.summary}\n`;
      }
      content += `🔗 详情：${notice.url}\n\n`;
    });

    return {
      msg_type: 'text',
      content: {
        text: content.trim()
      }
    };
  }

  /**
   * 创建交互式卡片消息
   */
  static createInteractiveCard(notices: Notice[]): any {
    if (notices.length === 0) {
      return this.createEmptyCard();
    }

    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    
    // 卡片头部
    const header = {
      title: {
        tag: 'plain_text',
        content: `🏢 深圳住建局通知公告 (${notices.length}条)`
      },
      template: 'blue'
    };

    // 卡片元素
    const elements = [
      // 更新时间
      {
        tag: 'div',
        text: {
          tag: 'plain_text',
          content: `📅 更新时间：${timestamp}`
        }
      },
      {
        tag: 'hr'
      }
    ];

    // 添加每个公告
    notices.forEach((notice, index) => {
      const publishDate = new Date(notice.publishDate).toLocaleDateString('zh-CN');
      
      // 公告标题和信息
      elements.push({
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**📄 ${index + 1}. ${notice.title}**\n📅 ${publishDate}`
        }
      });

      // 摘要（如果有）
      if (notice.summary) {
        elements.push({
          tag: 'div',
          text: {
            tag: 'plain_text',
            content: `📝 ${notice.summary}`
          }
        });
      }

      // 查看详情按钮
      elements.push({
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `🔗 [查看详情](${notice.url})`
        }
      });

      // 分隔线（最后一个除外）
      if (index < notices.length - 1) {
        elements.push({
          tag: 'hr'
        });
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
   * 创建空内容卡片
   */
  private static createEmptyCard(): any {
    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    
    return {
      msg_type: 'interactive',
      card: {
        header: {
          title: {
            tag: 'plain_text',
            content: '🏢 深圳住建局通知公告'
          },
          template: 'grey'
        },
        elements: [
          {
            tag: 'div',
            text: {
              tag: 'plain_text',
              content: `📅 更新时间：${timestamp}`
            }
          },
          {
            tag: 'hr'
          },
          {
            tag: 'div',
            text: {
              tag: 'plain_text',
              content: '✅ 暂无新的通知公告'
            }
          }
        ]
      }
    };
  }

  /**
   * 创建错误提醒消息
   */
  static createErrorMessage(error: string, details?: any): any {
    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    
    let content = `❌ 深圳住建局公告抓取失败\n`;
    content += `⏰ 时间：${timestamp}\n`;
    content += `🔍 错误：${error}\n`;
    
    if (details) {
      content += `📋 详情：${JSON.stringify(details, null, 2)}\n`;
    }
    
    content += `\n🔧 请检查系统配置和网络连接`;

    return {
      msg_type: 'text',
      content: {
        text: content
      }
    };
  }

  /**
   * 创建系统状态消息
   */
  static createStatusMessage(status: {
    totalProcessed: number;
    newNotices: number;
    filteredOut: number;
    cacheSize: number;
    lastUpdate: string;
  }): any {
    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    
    return {
      msg_type: 'interactive',
      card: {
        header: {
          title: {
            tag: 'plain_text',
            content: '📊 系统运行状态'
          },
          template: 'green'
        },
        elements: [
          {
            tag: 'div',
            text: {
              tag: 'plain_text',
              content: `⏰ 检查时间：${timestamp}`
            }
          },
          {
            tag: 'hr'
          },
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: `**📊 统计信息**\n总处理：${status.totalProcessed} 条\n新增：${status.newNotices} 条\n过滤：${status.filteredOut} 条\n缓存：${status.cacheSize} 项`
            }
          },
          {
            tag: 'div',
            text: {
              tag: 'plain_text',
              content: `📅 上次更新：${status.lastUpdate}`
            }
          }
        ]
      }
    };
  }

  /**
   * 创建 Webhook 格式消息
   */
  static createWebhookMessage(notices: Notice[]): any {
    // Webhook 消息格式与 Bot API 基本相同，但可能需要额外的签名
    return this.createInteractiveCard(notices);
  }
}