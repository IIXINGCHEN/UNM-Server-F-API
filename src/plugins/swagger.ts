import { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import { config } from '../config/env';

/**
 * 配置Swagger API文档插件
 */
export default async function setupSwagger(fastify: FastifyInstance) {
    // 只在开发环境或启用文档时加载Swagger
    if (config.NODE_ENV === 'development' || config.ENABLE_DOCS) {
        // 注册Swagger生成器
        await fastify.register(fastifySwagger, {
            swagger: {
                info: {
                    title: 'UNM-Server API',
                    description: '网易云解灰-API服务接口文档',
                    version: '2.0.0',
                },
                externalDocs: {
                    url: 'https://github.com/imsyy/UNM-Server',
                    description: 'GitHub仓库',
                },
                host: `localhost:${config.PORT}`,
                schemes: ['http', 'https'],
                consumes: ['application/json'],
                produces: ['application/json'],
                tags: [
                    { name: 'music', description: '音乐API' },
                    { name: 'system', description: '系统API' },
                ],
                securityDefinitions: {
                    apiKey: {
                        type: 'apiKey',
                        name: 'apiKey',
                        in: 'header',
                    },
                },
            },
        });

        // 注册Swagger UI
        await fastify.register(fastifySwaggerUI, {
            routePrefix: '/docs',
            uiConfig: {
                docExpansion: 'list',
                deepLinking: true,
            },
            staticCSP: true,
            transformSpecification: (swaggerObject) => swaggerObject,
            transformSpecificationClone: true,
        });

        fastify.log.info('Swagger API文档已启用: /docs');
    }
} 