#!/bin/bash
#
# UnblockNeteaseMusic API服务监控脚本
# 可通过crontab定期执行，例如: 
# */10 * * * * /opt/unm-server/monitor.sh >> /var/log/unm-monitor.log 2>&1
#

# 配置
APP_NAME="unm-server"
SERVICE_PORT=5678
HEALTH_ENDPOINT="http://localhost:${SERVICE_PORT}/health"
RESTART_ON_FAILURE=true
NOTIFY_EMAIL=""  # 如需邮件通知，请设置邮箱地址

# 颜色设置
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 输出时间戳
echo -e "$(date '+%Y-%m-%d %H:%M:%S') - 开始检查服务状态"

# 检查服务是否在运行
if ! systemctl is-active --quiet ${APP_NAME}; then
    echo -e "${RED}[错误]${NC} ${APP_NAME} 服务未运行"
    
    if [ "$RESTART_ON_FAILURE" = true ]; then
        echo -e "${YELLOW}[警告]${NC} 尝试重启服务..."
        systemctl restart ${APP_NAME}
        sleep 5
        
        if systemctl is-active --quiet ${APP_NAME}; then
            echo -e "${GREEN}[成功]${NC} 服务重启成功"
        else
            echo -e "${RED}[失败]${NC} 服务重启失败"
            
            # 邮件通知
            if [ -n "$NOTIFY_EMAIL" ] && command -v mail &> /dev/null; then
                echo "服务 ${APP_NAME} 无法启动，请检查系统日志" | mail -s "[警告] ${APP_NAME} 服务异常" "$NOTIFY_EMAIL"
            fi
            
            exit 1
        fi
    else
        # 邮件通知
        if [ -n "$NOTIFY_EMAIL" ] && command -v mail &> /dev/null; then
            echo "服务 ${APP_NAME} 已停止运行，请检查系统日志" | mail -s "[警告] ${APP_NAME} 服务已停止" "$NOTIFY_EMAIL"
        fi
        
        exit 1
    fi
fi

# 检查健康接口
response=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_ENDPOINT)

if [ "$response" = "200" ]; then
    echo -e "${GREEN}[正常]${NC} 健康检查通过 (状态码: $response)"
    
    # 获取详细健康信息
    health_data=$(curl -s $HEALTH_ENDPOINT)
    echo "服务状态: $health_data" | grep -o '"status":"[^"]*"' || echo "无法解析状态信息"
    
    # 检查内存使用情况
    mem_usage=$(ps -o rss= -p $(systemctl show -p MainPID ${APP_NAME} | cut -d= -f2))
    if [ -n "$mem_usage" ]; then
        mem_mb=$(echo "scale=2; $mem_usage/1024" | bc)
        echo -e "内存使用: ${mem_mb}MB"
        
        # 如果内存使用过高，可以在此添加告警或重启逻辑
        if (( $(echo "$mem_mb > 500" | bc -l) )); then
            echo -e "${YELLOW}[警告]${NC} 内存使用较高: ${mem_mb}MB"
        fi
    fi
else
    echo -e "${RED}[错误]${NC} 健康检查失败 (状态码: $response)"
    
    if [ "$RESTART_ON_FAILURE" = true ]; then
        echo -e "${YELLOW}[警告]${NC} 尝试重启服务..."
        systemctl restart ${APP_NAME}
        sleep 5
        
        # 再次检查
        new_response=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_ENDPOINT)
        if [ "$new_response" = "200" ]; then
            echo -e "${GREEN}[成功]${NC} 服务重启后恢复正常 (状态码: $new_response)"
        else
            echo -e "${RED}[失败]${NC} 服务重启后仍然异常 (状态码: $new_response)"
            
            # 邮件通知
            if [ -n "$NOTIFY_EMAIL" ] && command -v mail &> /dev/null; then
                echo "服务 ${APP_NAME} 健康检查失败，重启后仍无法恢复" | mail -s "[严重] ${APP_NAME} 服务异常" "$NOTIFY_EMAIL"
            fi
            
            exit 1
        fi
    else
        # 邮件通知
        if [ -n "$NOTIFY_EMAIL" ] && command -v mail &> /dev/null; then
            echo "服务 ${APP_NAME} 健康检查失败，请检查系统日志" | mail -s "[警告] ${APP_NAME} 服务异常" "$NOTIFY_EMAIL"
        fi
        
        exit 1
    fi
fi

# 检查服务日志中的错误
recent_errors=$(journalctl -u ${APP_NAME} --since "10 minutes ago" | grep -i "error\|exception\|失败" | wc -l)

if [ "$recent_errors" -gt 0 ]; then
    echo -e "${YELLOW}[警告]${NC} 过去10分钟内检测到 $recent_errors 个错误日志"
    journalctl -u ${APP_NAME} --since "10 minutes ago" | grep -i "error\|exception\|失败" | tail -3
fi

echo -e "$(date '+%Y-%m-%d %H:%M:%S') - 检查完成\n"
exit 0 