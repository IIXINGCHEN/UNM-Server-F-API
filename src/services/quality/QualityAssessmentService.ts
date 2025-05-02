import { SongInfo } from '../../types';

export interface QualityProfile {
  bitrate: number;
  format: string;
  size?: number;
  duration?: number;
  score: number;
}

export class QualityAssessmentService {
  // 评估音源质量
  assessQuality(songInfo: SongInfo): QualityProfile {
    const format = songInfo.format?.toLowerCase() || 'unknown';
    const bitrate = this.parseBitrate(songInfo.br);
    const size = songInfo.size || 0;
    const duration = songInfo.duration || 0;
    
    // 计算基础得分
    let score = this.calculateBaseScore(format, bitrate);
    
    // 如果有大小和时长信息，计算比特率
    if (size > 0 && duration > 0) {
      const calculatedBitrate = (size * 8) / (duration / 1000) / 1000; // kbps
      
      // 如果计算的比特率与声明的差异较大，降低得分
      if (bitrate > 0 && Math.abs(calculatedBitrate - bitrate) / bitrate > 0.2) {
        score *= 0.8;
      }
    }
    
    return {
      bitrate,
      format,
      size,
      duration,
      score
    };
  }
  
  // 解析比特率
  private parseBitrate(bitrate: any): number {
    if (typeof bitrate === 'number') {
      return bitrate;
    }
    
    if (typeof bitrate === 'string') {
      // 尝试解析 "320kbps" 这样的格式
      const match = bitrate.match(/(\d+)/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    
    return 0;
  }
  
  // 计算基础质量得分
  private calculateBaseScore(format: string, bitrate: number): number {
    // 基于格式的基础得分
    let baseScore = 0;
    
    switch (format.toLowerCase()) {
      case 'flac':
      case 'wav':
      case 'ape':
      case 'alac':
        baseScore = 90; // 无损格式
        break;
        
      case 'mp3':
        baseScore = 70;
        break;
        
      case 'aac':
      case 'm4a':
        baseScore = 75;
        break;
        
      case 'ogg':
      case 'opus':
        baseScore = 80;
        break;
        
      default:
        baseScore = 60;
    }
    
    // 基于比特率调整得分
    if (bitrate > 0) {
      if (bitrate >= 320) {
        baseScore = Math.min(baseScore + 10, 100);
      } else if (bitrate >= 256) {
        baseScore = Math.min(baseScore + 5, 95);
      } else if (bitrate <= 128) {
        baseScore = Math.max(baseScore - 10, 0);
      } else if (bitrate <= 96) {
        baseScore = Math.max(baseScore - 20, 0);
      }
    }
    
    return baseScore;
  }
  
  // 在多个音源结果中选择最佳质量
  selectBestQuality(results: Array<{ source: string, data: SongInfo }>): { source: string, data: SongInfo, quality: QualityProfile } | null {
    if (results.length === 0) {
      return null;
    }
    
    // 为每个结果评估质量
    const assessedResults = results.map(result => ({
      source: result.source,
      data: result.data,
      quality: this.assessQuality(result.data)
    }));
    
    // 按质量得分排序
    assessedResults.sort((a, b) => b.quality.score - a.quality.score);
    
    return assessedResults[0];
  }
  
  // 根据网络条件选择合适的音质
  selectForNetworkCondition(results: Array<{ source: string, data: SongInfo }>, networkType: 'wifi' | '4g' | '3g' | '2g' | 'unknown'): { source: string, data: SongInfo, quality: QualityProfile } | null {
    if (results.length === 0) {
      return null;
    }
    
    // 为每个结果评估质量
    const assessedResults = results.map(result => ({
      source: result.source,
      data: result.data,
      quality: this.assessQuality(result.data)
    }));
    
    // 根据网络条件筛选
    let filteredResults = [...assessedResults];
    
    switch (networkType) {
      case 'wifi':
        // WiFi环境优先考虑高音质，无需过滤
        break;
        
      case '4g':
        // 4G环境平衡音质和大小，过滤掉超大文件
        filteredResults = assessedResults.filter(item => 
          item.quality.size === undefined || item.quality.size <= 15 * 1024 * 1024 // 不超过15MB
        );
        break;
        
      case '3g':
        // 3G环境优先考虑中等音质
        filteredResults = assessedResults.filter(item => 
          item.quality.bitrate <= 192 && 
          (item.quality.size === undefined || item.quality.size <= 8 * 1024 * 1024) // 不超过8MB
        );
        break;
        
      case '2g':
        // 2G环境只使用低音质
        filteredResults = assessedResults.filter(item => 
          item.quality.bitrate <= 128 &&
          (item.quality.size === undefined || item.quality.size <= 3 * 1024 * 1024) // 不超过3MB
        );
        break;
    }
    
    // 如果过滤后没有结果，回退到原始列表
    if (filteredResults.length === 0) {
      filteredResults = assessedResults;
    }
    
    // 排序并返回最佳选择
    filteredResults.sort((a, b) => {
      // 根据网络条件调整权重
      let aScore = a.quality.score;
      let bScore = b.quality.score;
      
      if (networkType === '2g' || networkType === '3g') {
        // 对于低速网络，文件大小因素权重更高
        if (a.quality.size && b.quality.size) {
          const sizeFactorA = Math.max(0, 1 - (a.quality.size / (10 * 1024 * 1024)));
          const sizeFactorB = Math.max(0, 1 - (b.quality.size / (10 * 1024 * 1024)));
          
          aScore = aScore * 0.6 + sizeFactorA * 40;
          bScore = bScore * 0.6 + sizeFactorB * 40;
        }
      }
      
      return bScore - aScore;
    });
    
    return filteredResults[0];
  }
}

// 导出单例
export const qualityAssessmentService = new QualityAssessmentService(); 