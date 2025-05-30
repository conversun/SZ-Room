import { Notice, CategoryRule, CategorizedNotices } from '../types';
import { config } from '../config/config';
import { logger } from '../utils/logger';

/**
 * 公告分类服务
 */
export class CategoryService {
  /**
   * 对公告进行分类
   */
  static categorizeNotices(notices: Notice[]): CategorizedNotices {
    logger.info(`开始对 ${notices.length} 条公告进行分类`);

    const categorized: CategorizedNotices = {};
    const rules = config.filter.categoryRules.sort((a, b) => a.priority - b.priority);

    notices.forEach((notice, index) => {
      const category = this.getNoticeCategory(notice, rules);
      notice.category = category;
      
      // 添加原始索引以保持顺序
      (notice as any).originalIndex = index;

      if (!categorized[category]) {
        categorized[category] = [];
      }
      categorized[category].push(notice);
    });

    // 记录分类结果
    Object.keys(categorized).forEach(category => {
      logger.info(`分类 "${category}": ${categorized[category].length} 条公告`);
    });

    return categorized;
  }

  /**
   * 获取单个公告的分类
   */
  private static getNoticeCategory(notice: Notice, rules: CategoryRule[]): string {
    const title = notice.title.toLowerCase();
    const summary = (notice.summary || '').toLowerCase();
    const content = title + ' ' + summary;

    for (const rule of rules) {
      // 如果关键词为空，这是默认分类（通常是最后一个）
      if (rule.keywords.length === 0) {
        return rule.name;
      }

      // 检查是否包含关键词
      const hasKeyword = rule.keywords.some(keyword => 
        content.includes(keyword.toLowerCase())
      );

      if (hasKeyword) {
        logger.debug(`公告 "${notice.title}" 归类为: ${rule.name}`);
        return rule.name;
      }
    }

    // 如果没有匹配的规则，返回默认分类
    return '其他';
  }

  /**
   * 获取分类统计信息
   */
  static getCategoryStats(categorized: CategorizedNotices): {
    totalCategories: number;
    totalNotices: number;
    categoryBreakdown: { [category: string]: number };
  } {
    const categoryBreakdown: { [category: string]: number } = {};
    let totalNotices = 0;

    Object.keys(categorized).forEach(category => {
      const count = categorized[category].length;
      categoryBreakdown[category] = count;
      totalNotices += count;
    });

    return {
      totalCategories: Object.keys(categorized).length,
      totalNotices,
      categoryBreakdown,
    };
  }

  /**
   * 按分类过滤公告
   */
  static filterByCategory(categorized: CategorizedNotices, categoryName: string): Notice[] {
    return categorized[categoryName] || [];
  }

  /**
   * 获取所有分类名称
   */
  static getAllCategories(categorized: CategorizedNotices): string[] {
    return Object.keys(categorized).sort();
  }

  /**
   * 验证分类规则配置
   */
  static validateCategoryRules(rules: CategoryRule[]): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!Array.isArray(rules) || rules.length === 0) {
      errors.push('分类规则不能为空');
      return { isValid: false, errors };
    }

    const names = new Set<string>();
    const priorities = new Set<number>();

    rules.forEach((rule, index) => {
      // 检查必要字段
      if (!rule.name || typeof rule.name !== 'string') {
        errors.push(`规则 ${index + 1}: 分类名称无效`);
      }

      if (!Array.isArray(rule.keywords)) {
        errors.push(`规则 ${index + 1}: 关键词必须是数组`);
      }

      if (typeof rule.priority !== 'number') {
        errors.push(`规则 ${index + 1}: 优先级必须是数字`);
      }

      // 检查重复
      if (names.has(rule.name)) {
        errors.push(`规则 ${index + 1}: 分类名称重复 "${rule.name}"`);
      } else {
        names.add(rule.name);
      }

      if (priorities.has(rule.priority)) {
        errors.push(`规则 ${index + 1}: 优先级重复 ${rule.priority}`);
      } else {
        priorities.add(rule.priority);
      }
    });

    // 检查是否有默认分类（关键词为空的分类）
    const hasDefaultCategory = rules.some(rule => rule.keywords.length === 0);
    if (!hasDefaultCategory) {
      errors.push('必须至少有一个默认分类（关键词为空）');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 获取推荐的分类规则
   */
  static getRecommendedRules(): CategoryRule[] {
    return [
      {
        name: '房地产开发',
        keywords: ['房地产开发', '商品房', '预售许可', '楼盘', '房地产项目'],
        priority: 1
      },
      {
        name: '保障房政策',
        keywords: ['保障房', '公租房', '安居房', '人才房', '经济适用房'],
        priority: 2
      },
      {
        name: '建设工程',
        keywords: ['建设工程', '工程建设', '施工许可', '竣工验收', '工程监理'],
        priority: 3
      },
      {
        name: '规划审批',
        keywords: ['规划许可', '用地规划', '建设用地', '土地使用', '规划审批'],
        priority: 4
      },
      {
        name: '房屋租赁',
        keywords: ['房屋租赁', '租赁备案', '租金', '租房', '出租'],
        priority: 5
      },
      {
        name: '物业管理',
        keywords: ['物业管理', '物业服务', '业主', '物业费', '小区管理'],
        priority: 6
      },
      {
        name: '行政执法',
        keywords: ['行政处罚', '违法建设', '执法检查', '整改通知', '停工令'],
        priority: 7
      },
      {
        name: '政策法规',
        keywords: ['政策', '法规', '办法', '规定', '通知', '公示'],
        priority: 8
      },
      {
        name: '其他',
        keywords: [], // 默认分类
        priority: 999
      }
    ];
  }
} 