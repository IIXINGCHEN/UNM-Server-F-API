import { config } from '../../config';

interface SourceStats {
  availableCount: number;
  totalRequests: number;
  avgResponseTime: number;
  lastSuccess: number | null;
  lastFailure: number | null;
  successRate: number;
  qualityScore: number; // 音质评分
}

export class SourceRankingService {
  private sourceStats: Map<string, SourceStats> = new Map();
  // 默认音源质量评分
  private readonly DEFAULT_QUALITY_SCORES: Record<string, number> = {
    'qq': 85,    // QQ音乐质量不错
    'kugou': 80, // 酷狗音乐
    'kuwo': 75,  // 酷我音乐
    'migu': 90,  // 咪咕音乐质量较高
    'joox': 70,
    'youtube': 88, // YouTube质量不错
    'ytdlp': 95,   // yt-dlp提供高质量
    'bilibili': 65,
    'pyncmd': 60,
  };

  constructor() {
    // 初始化音源统计
    this.initSourceStats();
  }

  private initSourceStats() {
    // 为所有支持的音源初始化统计数据
    for (const source in this.DEFAULT_QUALITY_SCORES) {
      this.sourceStats.set(source, {
        availableCount: 0,
        totalRequests: 0,
        avgResponseTime: 0,
        lastSuccess: null,
        lastFailure: null,
        successRate: 0,
        qualityScore: this.DEFAULT_QUALITY_SCORES[source]
      });
    }

    // 尝试从本地存储加载历史数据
    this.loadStatsFromStorage();
  }

  // 记录音源请求结果
  recordSourceResult(source: string, success: boolean, responseTime: number) {
    let stats = this.sourceStats.get(source);

    if (!stats) {
      // 如果是新音源，初始化统计
      stats = {
        availableCount: 0,
        totalRequests: 0,
        avgResponseTime: 0,
        lastSuccess: null,
        lastFailure: null,
        successRate: 0,
        qualityScore: 70 // 默认质量分数
      };
    }

    // 更新统计
    stats.totalRequests++;

    if (success) {
      stats.availableCount++;
      stats.lastSuccess = Date.now();

      // 更新平均响应时间 (移动平均)
      stats.avgResponseTime = (stats.avgResponseTime * (stats.availableCount - 1) + responseTime) / stats.availableCount;
    } else {
      stats.lastFailure = Date.now();
    }

    // 计算成功率
    stats.successRate = stats.availableCount / stats.totalRequests;

    // 更新统计
    this.sourceStats.set(source, stats);

    // 持久化存储
    this.saveStatsToStorage();
  }

  // 获取音源排名
  rankSources(sources: string[]): string[] {
    // 默认使用配置中的音源
    if (!sources || sources.length === 0) {
      sources = config.DEFAULT_SOURCES;
    }

    // 筛选请求的音源，并排序
    return sources
      .filter(source => {
        // 如果有统计数据则使用，否则默认可用
        if (this.sourceStats.has(source)) {
          const stats = this.sourceStats.get(source)!;
          // 如果成功率过低且请求次数足够，则排除
          if (stats.totalRequests > 5 && stats.successRate < 0.2) {
            return false;
          }
          return true;
        }
        return true;
      })
      .sort((a, b) => {
        const statsA = this.sourceStats.get(a);
        const statsB = this.sourceStats.get(b);

        // 如果没有统计数据，使用默认顺序
        if (!statsA || !statsB) {
          const defaultOrderA = config.DEFAULT_SOURCES.indexOf(a);
          const defaultOrderB = config.DEFAULT_SOURCES.indexOf(b);

          if (defaultOrderA !== -1 && defaultOrderB !== -1) {
            return defaultOrderA - defaultOrderB;
          } else if (defaultOrderA !== -1) {
            return -1;
          } else if (defaultOrderB !== -1) {
            return 1;
          }
          return 0;
        }

        // 计算综合得分 (成功率 * 0.4 + 音质 * 0.4 + 响应速度 * 0.2)
        const scoreA = (statsA.successRate * 0.4) +
          (statsA.qualityScore / 100 * 0.4) +
          (Math.max(0, (1000 - statsA.avgResponseTime) / 1000) * 0.2);

        const scoreB = (statsB.successRate * 0.4) +
          (statsB.qualityScore / 100 * 0.4) +
          (Math.max(0, (1000 - statsB.avgResponseTime) / 1000) * 0.2);

        return scoreB - scoreA; // 降序排列
      });
  }

  // 获取最佳音源
  getBestSource(sources: string[]): string | null {
    const ranked = this.rankSources(sources);
    return ranked.length > 0 ? ranked[0] : null;
  }

  // 根据用户网络条件调整音源选择
  adjustSourcesForNetwork(sources: string[], networkType: 'wifi' | '4g' | '3g' | '2g' | 'unknown'): string[] {
    const ranked = this.rankSources(sources);

    // 根据网络类型调整
    switch (networkType) {
      case 'wifi':
        // WiFi环境优先考虑高音质
        return ranked;

      case '4g':
        // 4G环境平衡音质和速度
        return ranked.map(source => {
          const stats = this.sourceStats.get(source);
          if (stats && stats.qualityScore > 90 && stats.avgResponseTime > 500) {
            // 如果是高音质但响应较慢的源，降低其优先级
            return { source, score: stats.qualityScore * 0.8 };
          }
          // Use optional chaining and nullish coalescing for safety
          return { source, score: stats?.qualityScore ?? 70 };
        })
          .sort((a, b) => b.score - a.score)
          .map(item => item.source);

      case '3g':
      case '2g':
        // 低速网络优先考虑速度和稳定性
        return ranked.filter(source => {
          const stats = this.sourceStats.get(source);
          // 过滤掉高音质但响应慢的源
          return !(stats && stats.qualityScore > 85 && stats.avgResponseTime > 300);
        });

      default:
        return ranked;
    }
  }

  // 获取音源统计数据
  getSourceStats(source?: string) {
    if (source) {
      return this.sourceStats.get(source);
    }
    return Object.fromEntries(this.sourceStats.entries());
  }

  // 重置音源统计
  resetSourceStats(source?: string) {
    if (source) {
      // 重置单个音源
      if (this.sourceStats.has(source)) {
        this.sourceStats.set(source, {
          availableCount: 0,
          totalRequests: 0,
          avgResponseTime: 0,
          lastSuccess: null,
          lastFailure: null,
          successRate: 0,
          qualityScore: this.DEFAULT_QUALITY_SCORES[source] || 70
        });
      }
    } else {
      // 重置所有音源
      this.initSourceStats();
    }

    this.saveStatsToStorage();
  }

  // 从存储加载统计数据 (根据实际存储方式修改)
  private loadStatsFromStorage() {
    try {
      // 在浏览器环境
      if (typeof localStorage !== 'undefined') {
        const savedStats = localStorage.getItem('sourceStats');
        if (savedStats) {
          const parsed = JSON.parse(savedStats);
          Object.entries(parsed).forEach(([source, stats]) => {
            this.sourceStats.set(source, stats as SourceStats);
          });
        }
      }
      // 在Node.js环境，可以使用文件系统
      // 此处简化实现
    } catch (error) {
      console.error('加载音源统计失败', error);
    }
  }

  // 保存统计数据到存储 (根据实际存储方式修改)
  private saveStatsToStorage() {
    try {
      const statsObj = Object.fromEntries(this.sourceStats.entries());

      // 在浏览器环境
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sourceStats', JSON.stringify(statsObj));
      }
      // 在Node.js环境，可以使用文件系统
      // 此处简化实现
    } catch (error) {
      console.error('保存音源统计失败', error);
    }
  }
}

// 导出单例
export const sourceRankingService = new SourceRankingService(); 