#!/bin/bash
#
# UnblockNeteaseMusic API服务备份脚本
# 可通过crontab定期执行，例如: 
# 0 2 * * * /opt/unm-server/backup.sh >> /var/log/unm-backup.log 2>&1
#

# 配置
APP_NAME="unm-server"
APP_DIR="/opt/${APP_NAME}"
BACKUP_DIR="/var/backups/${APP_NAME}"
MAX_BACKUPS=7  # 保留最近7份备份
COMPRESS=true  # 是否压缩备份

# 时间戳
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/${APP_NAME}_backup_${TIMESTAMP}"

# 颜色设置
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 检查是否以root运行
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}[错误]${NC} 此脚本需要root权限运行"
    exit 1
fi

# 确保备份目录存在
if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
    echo -e "${GREEN}[INFO]${NC} 已创建备份目录: $BACKUP_DIR"
fi

# 显示备份开始信息
echo -e "${GREEN}[INFO]${NC} 开始备份 ${APP_NAME} 于 $(date)"

# 检查应用目录是否存在
if [ ! -d "$APP_DIR" ]; then
    echo -e "${RED}[错误]${NC} 应用目录不存在: $APP_DIR"
    exit 1
fi

# 停止服务
echo -e "${YELLOW}[警告]${NC} 临时停止服务进行备份..."
systemctl stop ${APP_NAME}

# 备份配置文件和其他重要文件
echo -e "${GREEN}[INFO]${NC} 备份配置文件..."
mkdir -p "${BACKUP_FILE}"
cp -R "${APP_DIR}/.env" "${BACKUP_FILE}/" 2>/dev/null || echo -e "${YELLOW}[警告]${NC} .env文件不存在"
cp -R "${APP_DIR}/.env.example" "${BACKUP_FILE}/" 2>/dev/null || echo -e "${YELLOW}[警告]${NC} .env.example文件不存在"
cp -R "${APP_DIR}/package.json" "${BACKUP_FILE}/" 2>/dev/null || echo -e "${YELLOW}[警告]${NC} package.json文件不存在"
cp -R "${APP_DIR}/package-lock.json" "${BACKUP_FILE}/" 2>/dev/null || echo -e "${YELLOW}[警告]${NC} package-lock.json文件不存在"

# 备份源代码
echo -e "${GREEN}[INFO]${NC} 备份源代码..."
cp -R "${APP_DIR}/src" "${BACKUP_FILE}/" 2>/dev/null || echo -e "${YELLOW}[警告]${NC} src目录不存在"

# 备份构建文件
echo -e "${GREEN}[INFO]${NC} 备份构建文件..."
cp -R "${APP_DIR}/dist" "${BACKUP_FILE}/" 2>/dev/null || echo -e "${YELLOW}[警告]${NC} dist目录不存在"

# 压缩备份
if [ "$COMPRESS" = true ]; then
    echo -e "${GREEN}[INFO]${NC} 压缩备份文件..."
    tar -czf "${BACKUP_FILE}.tar.gz" -C "${BACKUP_DIR}" "${APP_NAME}_backup_${TIMESTAMP}"
    rm -rf "${BACKUP_FILE}"
    BACKUP_FILE="${BACKUP_FILE}.tar.gz"
    echo -e "${GREEN}[INFO]${NC} 备份已压缩为: $(basename ${BACKUP_FILE})"
fi

# 设置适当的权限
chmod 600 "$BACKUP_FILE"

# 重启服务
echo -e "${GREEN}[INFO]${NC} 重新启动服务..."
systemctl start ${APP_NAME}

# 清理旧备份
echo -e "${GREEN}[INFO]${NC} 清理旧备份..."
if [ "$COMPRESS" = true ]; then
    backup_files=$(ls -t "${BACKUP_DIR}"/*.tar.gz 2>/dev/null)
else
    backup_files=$(ls -td "${BACKUP_DIR}"/*/ 2>/dev/null)
fi

count=0
for backup in $backup_files; do
    count=$((count+1))
    if [ $count -gt $MAX_BACKUPS ]; then
        echo -e "${YELLOW}[警告]${NC} 删除旧备份: $(basename $backup)"
        rm -rf "$backup"
    fi
done

echo -e "${GREEN}[INFO]${NC} 备份完成，总共保留 $(( count > MAX_BACKUPS ? MAX_BACKUPS : count )) 份备份"
echo -e "${GREEN}[INFO]${NC} 备份位置: $BACKUP_FILE"

# 检查服务状态
if systemctl is-active --quiet ${APP_NAME}; then
    echo -e "${GREEN}[INFO]${NC} 服务已成功重启"
else
    echo -e "${RED}[错误]${NC} 服务重启失败，请检查日志"
    echo -e "${YELLOW}[警告]${NC} 尝试再次启动服务..."
    systemctl start ${APP_NAME}
    sleep 2
    if systemctl is-active --quiet ${APP_NAME}; then
        echo -e "${GREEN}[INFO]${NC} 服务已在第二次尝试后成功启动"
    else
        echo -e "${RED}[错误]${NC} 服务启动失败，请手动检查"
    fi
fi

# 显示备份摘要
backup_size=$(du -h "$BACKUP_FILE" | cut -f1)
echo -e "\n${GREEN}[备份摘要]${NC}"
echo -e "时间: $(date)"
echo -e "文件: $(basename $BACKUP_FILE)"
echo -e "大小: $backup_size"
echo -e "保留备份数: $(( count > MAX_BACKUPS ? MAX_BACKUPS : count ))"

exit 0 