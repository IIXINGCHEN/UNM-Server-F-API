#!/bin/bash
# UNM-Server 生产环境启动脚本
# 使用方法: bash script/production-start.sh [start|stop|restart|status|logs]

# 设置环境变量
export NODE_ENV=production

# 配置
APP_NAME="unm-server"
LOG_DIR="./logs"
MAX_LOG_SIZE="10M"
MAX_LOG_FILES=5

# 确保日志目录存在
mkdir -p "$LOG_DIR"

# 确保 PM2 已安装
if ! command -v pm2 &> /dev/null; then
    echo "PM2 未安装，正在安装..."
    npm install -g pm2 || { echo "PM2 安装失败，请手动安装后重试"; exit 1; }
fi

# 日志轮转函数
setup_log_rotation() {
    if command -v logrotate &> /dev/null; then
        # 创建 logrotate 配置
        LOGROTATE_CONF="/tmp/unm-server-logrotate.conf"
        echo "$LOG_DIR/*.log {
    daily
    rotate $MAX_LOG_FILES
    size $MAX_LOG_SIZE
    missingok
    notifempty
    compress
    delaycompress
    copytruncate
}" > "$LOGROTATE_CONF"
        
        # 添加到 crontab (如果不存在)
        CRON_CMD="logrotate $LOGROTATE_CONF"
        (crontab -l 2>/dev/null | grep -q "$CRON_CMD") || {
            (crontab -l 2>/dev/null; echo "0 0 * * * $CRON_CMD") | crontab -
            echo "已设置每日日志轮转"
        }
    else
        echo "警告: logrotate 未安装，无法设置日志轮转"
    fi
}

# 启动服务
start_server() {
    echo "正在启动 $APP_NAME..."
    
    # 检查环境文件
    if [[ ! -f ".env" ]]; then
        if [[ -f ".env.production" ]]; then
            echo "未找到 .env 文件, 使用 .env.production 替代"
            cp .env.production .env
        else
            echo "警告: 未找到环境配置文件 (.env 或 .env.production)"
            echo "将使用默认配置启动"
        fi
    fi
    
    # 启动应用
    pm2 start ecosystem.config.js --env production
    
    # 保存 PM2 配置
    pm2 save
    
    # 设置启动自动恢复
    pm2 startup || echo "无法设置开机自启动，请手动配置"
    
    echo "$APP_NAME 服务已启动"
    pm2 show $APP_NAME
}

# 停止服务
stop_server() {
    echo "正在停止 $APP_NAME..."
    pm2 stop $APP_NAME
    echo "$APP_NAME 服务已停止"
}

# 重启服务
restart_server() {
    echo "正在重启 $APP_NAME..."
    pm2 restart $APP_NAME
    echo "$APP_NAME 服务已重启"
}

# 查看服务状态
status_server() {
    echo "$APP_NAME 服务状态:"
    pm2 show $APP_NAME
}

# 查看日志
view_logs() {
    echo "显示 $APP_NAME 日志:"
    pm2 logs $APP_NAME --lines 50
}

# 主函数
main() {
    case "$1" in
        start)
            start_server
            setup_log_rotation
            ;;
        stop)
            stop_server
            ;;
        restart)
            restart_server
            ;;
        status)
            status_server
            ;;
        logs)
            view_logs
            ;;
        *)
            echo "使用方法: $0 [start|stop|restart|status|logs]"
            exit 1
            ;;
    esac
}

# 执行主函数
main "$1" 