import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { sourceRankingService } from '../services/quality/SourceRankingService';
import { qualityAssessmentService, QualityProfile } from '../services/quality/QualityAssessmentService';
import { config } from '../config';

const sourceManagerPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // 定义音源统计API
  fastify.get('/api/sources/stats', async (request, reply) => {
    const sourceStats = sourceRankingService.getSourceStats();
    return {
      success: true,
      data: sourceStats
    };
  });

  // 获取单个音源统计
  fastify.get<{
    Params: { source: string }
  }>('/api/sources/stats/:source', async (request, reply) => {
    const { source } = request.params;
    const sourceStats = sourceRankingService.getSourceStats(source);

    if (!sourceStats) {
      return reply.code(404).send({
        success: false,
        message: `未找到音源: ${source}`
      });
    }

    return {
      success: true,
      data: sourceStats
    };
  });

  // 重置音源统计
  fastify.delete<{
    Querystring: { source?: string }
  }>('/api/sources/stats', async (request, reply) => {
    const { source } = request.query;
    sourceRankingService.resetSourceStats(source);

    return {
      success: true,
      message: source ? `已重置音源 ${source} 的统计数据` : '已重置所有音源统计数据'
    };
  });

  // 获取排序后的音源列表
  fastify.get<{
    Querystring: { sources?: string, network?: 'wifi' | '4g' | '3g' | '2g' | 'unknown' }
  }>('/api/sources/rank', async (request, reply) => {
    const { sources: sourcesParam, network = 'wifi' } = request.query;

    // 解析音源列表
    let sources: string[] = [];
    if (sourcesParam) {
      sources = sourcesParam.split(',');
    } else {
      sources = config.DEFAULT_SOURCES;
    }

    // 根据网络类型进行调整
    const rankedSources = network
      ? sourceRankingService.adjustSourcesForNetwork(sources, network as any)
      : sourceRankingService.rankSources(sources);

    return {
      success: true,
      data: {
        rankedSources,
        network
      }
    };
  });

  // 记录音源结果API
  fastify.post<{
    Body: {
      source: string;
      success: boolean;
      responseTime: number;
      songInfo?: any;
    }
  }>('/api/sources/record', async (request, reply) => {
    const { source, success, responseTime, songInfo } = request.body;

    // 记录结果
    sourceRankingService.recordSourceResult(source, success, responseTime);

    // 如果提供了歌曲信息，也评估其质量
    let qualityProfile: QualityProfile | null = null;
    if (songInfo) {
      qualityProfile = qualityAssessmentService.assessQuality(songInfo);
    }

    return {
      success: true,
      data: {
        source,
        recorded: true,
        quality: qualityProfile
      }
    };
  });

  // 获取支持的音源列表
  fastify.get('/api/sources/list', async (request, reply) => {
    return {
      success: true,
      data: {
        sources: config.DEFAULT_SOURCES,
        defaultSources: config.DEFAULT_SOURCES
      }
    };
  });

  // 添加请求钩子以记录音源响应时间
  fastify.addHook('onRequest', (request, reply, done) => {
    // 只监控音源API请求
    const url = request.url;
    if (url.startsWith('/api/song') || url.startsWith('/api/match')) {
      // 记录开始时间
      request.startTime = Date.now();
      request.source = undefined;
    }
    done();
  });

  fastify.addHook('onResponse', (request, reply, done) => {
    // 只监控音源API请求
    const url = request.url;
    if ((url.startsWith('/api/song') || url.startsWith('/api/match')) && request.startTime) {
      const source = request.source;
      const responseTime = Date.now() - request.startTime;

      // 如果能识别出音源，记录结果
      if (source) {
        // 使用状态码判断成功与否
        const success = reply.statusCode >= 200 && reply.statusCode < 300;
        sourceRankingService.recordSourceResult(source, success, responseTime);
      }

      // 当响应时间超过阈值，记录警告日志
      if (responseTime > 500) {
        fastify.log.warn({
          url: request.url,
          source,
          responseTime,
          msg: '音源响应时间过长'
        });
      }
    }
    done();
  });
};

export default sourceManagerPlugin; 