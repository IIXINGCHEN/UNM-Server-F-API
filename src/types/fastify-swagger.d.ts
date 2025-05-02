declare module '@fastify/swagger' {
    import { FastifyPluginCallback } from 'fastify';

    const fastifySwagger: FastifyPluginCallback<{
        swagger?: {
            info: {
                title: string;
                description: string;
                version: string;
            };
            externalDocs?: {
                url: string;
                description: string;
            };
            host?: string;
            schemes?: string[];
            consumes?: string[];
            produces?: string[];
            tags?: { name: string; description: string }[];
            securityDefinitions?: Record<string, any>;
        };
    }>;

    export default fastifySwagger;
}

declare module '@fastify/swagger-ui' {
    import { FastifyPluginCallback } from 'fastify';

    const fastifySwaggerUI: FastifyPluginCallback<{
        routePrefix?: string;
        uiConfig?: {
            docExpansion?: string;
            deepLinking?: boolean;
        };
        staticCSP?: boolean;
        transformSpecification?: (swaggerObject: any) => any;
        transformSpecificationClone?: boolean;
    }>;

    export default fastifySwaggerUI;
} 