#!/bin/bash
#
# UnblockNeteaseMusic API服务安全配置脚本
# 用于增强服务器安全性
#

set -e  # 遇到错误立即退出

# 颜色设置
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置变量
APP_NAME="unm-server"
APP_DIR="/opt/${APP_NAME}"
SERVICE_PORT=5678

# 打印函数
log_info() {
    echo -e "${GREEN}[信息]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[警告]${NC} $1"
}

log_error() {
    echo -e "${RED}[错误]${NC} $1"
}

log_step() {
    echo -e "\n${BLUE}[步骤]${NC} $1"
    echo -e "${BLUE}=======================================${NC}"
}

# 检查权限
if [ "$EUID" -ne 0 ]; then
    log_error "请使用root权限运行此脚本: sudo bash security.sh"
    exit 1
fi

# 显示欢迎信息
clear
echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}    UnblockNeteaseMusic API服务安全配置脚本      ${NC}"
echo -e "${GREEN}=================================================${NC}"
echo ""
echo "此脚本将加强服务器安全设置"
echo ""
echo -e "${YELLOW}注意: 此脚本会修改系统安全配置${NC}"
echo ""
read -p "按Enter键继续，或Ctrl+C取消..."

# 检测Linux发行版
log_step "检测系统环境"

if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_NAME=$NAME
    OS_VERSION=$VERSION_ID
    OS_ID=$ID
    log_info "检测到操作系统: $OS_NAME $OS_VERSION"
else
    log_error "不支持的操作系统"
    exit 1
fi

# 更新系统
log_step "更新系统"
log_info "更新软件包列表和系统安全补丁..."

case $OS_ID in
    debian|ubuntu)
        apt update && apt upgrade -y
        ;;
    centos|rhel|fedora)
        yum update -y
        ;;
    *)
        log_warn "未知的Linux发行版，跳过系统更新"
        ;;
esac

# 配置防火墙
log_step "配置防火墙"

# 检测防火墙
if command -v ufw &> /dev/null; then
    log_info "配置UFW防火墙..."
    
    # 默认策略：拒绝所有入站，允许所有出站
    ufw default deny incoming
    ufw default allow outgoing
    
    # 允许SSH
    ufw allow ssh
    
    # 允许应用端口
    ufw allow $SERVICE_PORT/tcp
    
    # 如果未启用，则启用防火墙
    if ! ufw status | grep -q "Status: active"; then
        log_warn "启用UFW防火墙，可能会断开当前SSH连接..."
        echo "y" | ufw enable
    fi
    
    ufw status
elif command -v firewall-cmd &> /dev/null; then
    log_info "配置Firewalld防火墙..."
    
    # 允许SSH和应用端口
    firewall-cmd --permanent --add-service=ssh
    firewall-cmd --permanent --add-port=$SERVICE_PORT/tcp
    
    # 应用配置
    firewall-cmd --reload
    
    firewall-cmd --list-all
else
    log_warn "未检测到支持的防火墙，建议手动安装配置防火墙"
    
    # 提示安装防火墙
    case $OS_ID in
        debian|ubuntu)
            log_info "建议安装UFW: apt install -y ufw"
            ;;
        centos|rhel|fedora)
            log_info "建议安装Firewalld: yum install -y firewalld"
            ;;
    esac
fi

# 配置SSH
log_step "增强SSH安全配置"

SSH_CONFIG="/etc/ssh/sshd_config"
SSH_BACKUP="${SSH_CONFIG}.backup"

if [ -f "$SSH_CONFIG" ]; then
    # 备份原配置
    cp "$SSH_CONFIG" "$SSH_BACKUP"
    log_info "已备份SSH配置到 $SSH_BACKUP"
    
    # 禁用root登录
    log_info "禁用SSH的root账户直接登录..."
    if grep -q "^PermitRootLogin" "$SSH_CONFIG"; then
        sed -i 's/^PermitRootLogin.*/PermitRootLogin no/' "$SSH_CONFIG"
    else
        echo "PermitRootLogin no" >> "$SSH_CONFIG"
    fi
    
    # 禁用密码认证
    read -p "是否禁用SSH密码认证（仅允许密钥登录）? (y/n): " disable_password
    if [[ $disable_password =~ ^[Yy]$ ]]; then
        log_info "禁用SSH密码认证..."
        if grep -q "^PasswordAuthentication" "$SSH_CONFIG"; then
            sed -i 's/^PasswordAuthentication.*/PasswordAuthentication no/' "$SSH_CONFIG"
        else
            echo "PasswordAuthentication no" >> "$SSH_CONFIG"
        fi
        
        log_warn "确保您已经设置了SSH密钥，否则将无法登录系统"
    fi
    
    # 更改SSH端口
    read -p "是否更改SSH默认端口 (默认22)? (y/n): " change_ssh_port
    if [[ $change_ssh_port =~ ^[Yy]$ ]]; then
        read -p "请输入新的SSH端口 (建议使用1024-65535之间的端口): " new_ssh_port
        
        if [[ $new_ssh_port =~ ^[0-9]+$ ]] && [ $new_ssh_port -ge 1024 ] && [ $new_ssh_port -le 65535 ]; then
            log_info "更改SSH端口为 $new_ssh_port..."
            
            if grep -q "^Port " "$SSH_CONFIG"; then
                sed -i "s/^Port .*/Port $new_ssh_port/" "$SSH_CONFIG"
            else
                echo "Port $new_ssh_port" >> "$SSH_CONFIG"
            fi
            
            # 更新防火墙配置
            if command -v ufw &> /dev/null; then
                ufw allow $new_ssh_port/tcp
                ufw delete allow ssh
            elif command -v firewall-cmd &> /dev/null; then
                firewall-cmd --permanent --add-port=$new_ssh_port/tcp
                firewall-cmd --permanent --remove-service=ssh
                firewall-cmd --reload
            fi
            
            log_warn "SSH端口已变更为 $new_ssh_port，请在新窗口确认SSH访问正常后再关闭当前会话"
        else
            log_error "无效的端口号: $new_ssh_port，保持默认端口"
        fi
    fi
    
    # 重启SSH服务
    log_info "重启SSH服务以应用新配置..."
    systemctl restart sshd
    
    log_info "SSH安全配置已完成"
else
    log_error "未找到SSH配置文件: $SSH_CONFIG"
fi

# 配置Fail2ban (可选)
log_step "配置Fail2ban防止暴力破解"

read -p "是否安装配置Fail2ban? (y/n): " install_fail2ban
if [[ $install_fail2ban =~ ^[Yy]$ ]]; then
    log_info "安装Fail2ban..."
    
    case $OS_ID in
        debian|ubuntu)
            apt install -y fail2ban
            ;;
        centos|rhel|fedora)
            yum install -y epel-release
            yum install -y fail2ban
            ;;
        *)
            log_error "未知的Linux发行版，无法安装Fail2ban"
            ;;
    esac
    
    # 配置Fail2ban
    if [ -f /etc/fail2ban/jail.conf ]; then
        cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
        
        # 更新配置
        cat > /etc/fail2ban/jail.d/custom.conf << EOF
[sshd]
enabled = true
bantime = 3600
findtime = 600
maxretry = 3

[nginx-http-auth]
enabled = true
EOF
        
        # 启动服务
        systemctl enable fail2ban
        systemctl restart fail2ban
        
        log_info "Fail2ban配置完成并已启动"
        
        fail2ban-client status
    else
        log_error "Fail2ban安装失败或配置文件不存在"
    fi
else
    log_info "跳过Fail2ban安装"
fi

# 配置应用目录权限
log_step "设置应用目录权限"

if [ -d "$APP_DIR" ]; then
    log_info "设置应用目录的安全权限..."
    
    # 设置目录权限
    chmod 750 "$APP_DIR"
    
    # 保护敏感文件
    if [ -f "$APP_DIR/.env" ]; then
        chmod 600 "$APP_DIR/.env"
        log_info "已保护 .env 配置文件"
    fi
    
    log_info "应用目录权限已设置"
else
    log_warn "应用目录不存在: $APP_DIR，跳过权限设置"
fi

# 设置定期系统更新
log_step "配置定期系统更新"

read -p "是否配置自动系统更新? (y/n): " setup_auto_update
if [[ $setup_auto_update =~ ^[Yy]$ ]]; then
    case $OS_ID in
        debian|ubuntu)
            # 安装unattended-upgrades
            apt install -y unattended-upgrades
            dpkg-reconfigure -plow unattended-upgrades
            
            log_info "已配置Debian/Ubuntu自动更新"
            ;;
        centos|rhel|fedora)
            # 配置yum-cron
            yum install -y yum-cron
            
            # 修改配置文件
            if [ -f /etc/yum/yum-cron.conf ]; then
                sed -i 's/apply_updates = no/apply_updates = yes/' /etc/yum/yum-cron.conf
                systemctl enable yum-cron
                systemctl start yum-cron
                
                log_info "已配置CentOS/RHEL自动更新"
            else
                log_error "未找到yum-cron配置文件"
            fi
            ;;
        *)
            log_warn "未知的Linux发行版，无法配置自动更新"
            ;;
    esac
    
    # 添加每周检查更新的Cron任务
    (crontab -l 2>/dev/null; echo "0 2 * * 0 /usr/bin/apt update && /usr/bin/apt upgrade -y") | crontab -
    
    log_info "已配置系统自动更新"
else
    log_info "跳过自动更新配置"
    
    # 提示手动更新
    log_info "请记得定期运行系统更新命令:"
    case $OS_ID in
        debian|ubuntu)
            echo "  apt update && apt upgrade -y"
            ;;
        centos|rhel|fedora)
            echo "  yum update -y"
            ;;
    esac
fi

log_step "安全配置完成"

echo ""
echo -e "${GREEN}安全配置已完成！以下是已执行的加固措施:${NC}"
echo ""
echo "1. 系统更新: 已更新系统和安装安全补丁"
echo "2. 防火墙配置: 仅开放必要端口 (SSH + $SERVICE_PORT)"
echo "3. SSH加固: 禁用root登录，可选禁用密码认证和更改端口"
echo "4. 可选安装Fail2ban防止暴力破解"
echo "5. 设置应用目录权限，保护敏感配置文件"
echo "6. 可选配置自动系统更新"
echo ""
echo -e "${YELLOW}请记得定期检查系统安全更新和日志${NC}"
echo ""

exit 0 