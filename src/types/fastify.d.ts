import 'fastify';

declare module 'fastify' {
    interface FastifyRequest {
        // For cache-stats plugin
        requestTime?: number;

        // For source-manager plugin
        startTime?: number;
        source?: string;
    }
} 