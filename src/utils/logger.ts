/**
 * 日志工具
 * 提供结构化日志记录功能
 */
import fs from 'fs';
import path from 'path';

interface LogMetadata {
    [key: string]: any;
}

/**
 * 定义日志条目结构
 */
interface LogEntry extends LogMetadata {
    timestamp: string;
    level: LogLevel;
    message: string;
    callSite?: string; // 添加可选的 callSite 属性
}

/**
 * 日志级别枚举
 */
export enum LogLevel {
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error'
}

/**
 * 获取当前格式化时间
 */
function getFormattedTime(): string {
    const now = new Date();
    return now.toISOString();
}

/**
 * 日志服务类
 */
class Logger {
    /**
     * 是否为开发环境
     */
    private isDev: boolean = process.env.NODE_ENV !== 'production';

    /**
     * 最小日志级别
     */
    private minLevel: LogLevel = this.isDev ? LogLevel.DEBUG : LogLevel.INFO;

    /**
     * 是否启用文件日志
     */
    private logToFile: boolean = process.env.LOG_TO_FILE === 'true';

    /**
     * 日志目录
     */
    private logDir: string = process.env.LOG_DIR || 'logs';

    /**
     * 创建基础日志条目
     */
    private createLogEntry(level: LogLevel, message: string, metadata?: LogMetadata): LogEntry {
        const entry: LogEntry = {
            timestamp: getFormattedTime(),
            level,
            message,
            ...metadata
        };

        // 在开发环境中，添加调用堆栈信息以便于调试
        if (this.isDev && (level === LogLevel.ERROR || level === LogLevel.WARN)) {
            const stack = new Error().stack;
            if (stack) {
                // 提取堆栈中的调用位置（跳过前两行，它们是当前函数和log函数）
                const stackLines = stack.split('\n').slice(3);
                entry.callSite = stackLines[0]?.trim() || 'unknown';
            }
        }

        return entry;
    }

    /**
     * 确保日志目录存在
     */
    private ensureLogDirectory(): void {
        if (this.logToFile) {
            try {
                if (!fs.existsSync(this.logDir)) {
                    fs.mkdirSync(this.logDir, { recursive: true });
                }
            } catch (error) {
                console.error(`创建日志目录失败: ${error}`);
                // 禁用文件日志
                this.logToFile = false;
            }
        }
    }

    /**
     * 写入日志到文件
     */
    private writeToFile(entry: LogEntry): void {
        if (!this.logToFile) return;

        this.ensureLogDirectory();

        try {
            const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const logFile = path.join(this.logDir, `${date}-${entry.level}.log`);

            // 追加写入日志
            fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
        } catch (error) {
            console.error(`写入日志文件失败: ${error}`);
        }
    }

    /**
     * 记录日志
     */
    private log(level: LogLevel, message: string, metadata?: LogMetadata): void {
        // 检查日志级别
        if (!this.shouldLog(level)) {
            return;
        }

        const entry: LogEntry = this.createLogEntry(level, message, metadata);

        // 生产环境使用JSON格式，开发环境使用更可读的格式
        if (this.isDev) {
            const metadataStr = metadata ? ` ${JSON.stringify(metadata)}` : '';
            const output = `[${entry.timestamp}] ${level.toUpperCase()}: ${message}${metadataStr}`;

            switch (level) {
                case LogLevel.ERROR:
                    console.error(output);
                    break;
                case LogLevel.WARN:
                    console.warn(output);
                    break;
                case LogLevel.INFO:
                    console.info(output);
                    break;
                case LogLevel.DEBUG:
                    console.debug(output);
                    break;
            }
        } else {
            // 生产环境使用结构化JSON日志
            console.log(JSON.stringify(entry));
        }

        // 写入日志到文件（如果启用）
        if (this.logToFile) {
            this.writeToFile(entry);
        }
    }

    /**
     * 判断是否应该记录该级别的日志
     */
    private shouldLog(level: LogLevel): boolean {
        const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
        const minLevelIndex = levels.indexOf(this.minLevel);
        const currentLevelIndex = levels.indexOf(level);

        return currentLevelIndex >= minLevelIndex;
    }

    /**
     * 设置最小日志级别
     */
    setMinLevel(level: LogLevel): void {
        this.minLevel = level;
    }

    /**
     * 记录调试日志
     */
    debug(message: string, metadata?: LogMetadata): void {
        this.log(LogLevel.DEBUG, message, metadata);
    }

    /**
     * 记录信息日志
     */
    info(message: string, metadata?: LogMetadata): void {
        this.log(LogLevel.INFO, message, metadata);
    }

    /**
     * 记录警告日志
     */
    warn(message: string, metadata?: LogMetadata): void {
        this.log(LogLevel.WARN, message, metadata);
    }

    /**
     * 记录错误日志
     */
    error(message: string, metadata?: LogMetadata): void {
        this.log(LogLevel.ERROR, message, metadata);
    }

    /**
     * 记录API请求日志
     */
    logApiRequest(method: string, url: string, metadata?: LogMetadata): void {
        this.info(`API请求 ${method} ${url}`, {
            type: 'api_request',
            method,
            url,
            ...metadata
        });
    }

    /**
     * 记录API响应日志
     */
    logApiResponse(method: string, url: string, statusCode: number, duration: number, metadata?: LogMetadata): void {
        const level = statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;

        this.log(level, `API响应 ${method} ${url} ${statusCode} (${duration}ms)`, {
            type: 'api_response',
            method,
            url,
            statusCode,
            duration,
            ...metadata
        });
    }

    /**
     * 记录缓存操作日志
     */
    logCache(operation: string, key: string, hit: boolean, metadata?: LogMetadata): void {
        this.debug(`缓存${operation} ${key} ${hit ? '命中' : '未命中'}`, {
            type: 'cache',
            operation,
            key,
            hit,
            ...metadata
        });
    }
}

// 导出单例
const logger = new Logger();

/**
 * 初始化日志记录器
 * 应在应用启动时调用
 */
export function initLogger(options?: {
    minLevel?: LogLevel;
    logToFile?: boolean;
    logDir?: string;
}): void {
    if (options?.minLevel) {
        logger.setMinLevel(options.minLevel);
    }

    // 记录初始化信息
    logger.info('日志记录器初始化完成', {
        level: logger['minLevel'],
        logToFile: logger['logToFile'],
        logDir: logger['logDir']
    });
}

export default logger;