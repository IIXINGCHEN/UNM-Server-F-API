#!/bin/bash
#
# UnblockNeteaseMusic API服务部署脚本
# 适用于基于Debian/Ubuntu的Linux发行版
# 作者: Claude AI

set -e  # 遇到错误立即退出

# 文字颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # 重置颜色

# 配置变量
APP_NAME="unm-server"
APP_DIR="/opt/${APP_NAME}"
GITHUB_REPO="https://github.com/your-username/unm-server.git"  # 替换为实际仓库
NODE_VERSION="18"  # LTS版本
SERVICE_PORT=5678  # 默认端口
ENABLE_REDIS=false  # 是否使用Redis
REDIS_PORT=6379

# 打印信息函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "\n${BLUE}[STEP]${NC} $1"
    echo -e "${BLUE}=======================================${NC}"
}

# 检查权限
if [ "$EUID" -ne 0 ]; then
    log_error "请使用root权限运行此脚本: sudo bash deploy.sh"
    exit 1
fi

# 显示欢迎信息
clear
echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}      UnblockNeteaseMusic API服务部署脚本        ${NC}"
echo -e "${GREEN}=================================================${NC}"
echo ""
echo "此脚本将安装并配置UnblockNeteaseMusic API服务"
echo "适用于Debian/Ubuntu/CentOS等Linux发行版"
echo ""
echo -e "${YELLOW}注意: 此脚本会修改系统配置，请确保已备份重要数据${NC}"
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

# 安装依赖
log_step "安装系统依赖"

case $OS_ID in
    debian|ubuntu)
        log_info "更新软件包列表..."
        apt update
        
        log_info "安装基础依赖..."
        apt install -y curl wget git build-essential
        ;;
    centos|rhel|fedora)
        log_info "更新软件包列表..."
        yum update -y
        
        log_info "安装基础依赖..."
        yum install -y curl wget git gcc gcc-c++ make
        ;;
    *)
        log_warn "未知的Linux发行版，尝试使用通用方式安装依赖..."
        ;;
esac

# 安装Node.js
log_step "安装Node.js ${NODE_VERSION}"

if command -v node &> /dev/null; then
    CURRENT_NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
    if [ "$CURRENT_NODE_VERSION" -ge "$NODE_VERSION" ]; then
        log_info "检测到Node.js v$(node -v)，满足要求"
    else
        log_warn "当前Node.js版本过低: v$(node -v)，将安装Node.js ${NODE_VERSION}"
        install_nodejs=true
    fi
else
    log_info "未检测到Node.js，将安装Node.js ${NODE_VERSION}"
    install_nodejs=true
fi

if [ "$install_nodejs" = true ]; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    
    case $OS_ID in
        debian|ubuntu)
            apt install -y nodejs
            ;;
        centos|rhel|fedora)
            yum install -y nodejs
            ;;
    esac
    
    log_info "Node.js安装完成: $(node -v)"
    log_info "NPM版本: $(npm -v)"
fi

# 安装PM2
log_step "安装PM2进程管理器"

if command -v pm2 &> /dev/null; then
    log_info "检测到PM2，正在更新..."
    npm update -g pm2
else
    log_info "安装PM2..."
    npm install -g pm2
fi

# 创建应用目录
log_step "创建应用目录"

if [ -d "$APP_DIR" ]; then
    log_warn "应用目录已存在，将备份旧版本"
    mv "$APP_DIR" "${APP_DIR}_backup_$(date +%Y%m%d%H%M%S)"
fi

log_info "创建新目录: $APP_DIR"
mkdir -p "$APP_DIR"

# 下载项目代码
log_step "下载项目代码"

log_info "克隆代码仓库..."
git clone "$GITHUB_REPO" "$APP_DIR" || {
    log_error "克隆仓库失败"
    log_info "尝试直接复制项目文件..."
    
    # 如果克隆失败，询问是否手动传输文件
    echo ""
    log_warn "请确保您已将项目文件上传到服务器"
    read -p "项目文件路径: " PROJECT_PATH
    
    if [ -d "$PROJECT_PATH" ]; then
        cp -r "$PROJECT_PATH"/* "$APP_DIR"
        log_info "文件复制完成"
    else
        log_error "指定路径不存在: $PROJECT_PATH"
        exit 1
    fi
}

# 安装项目依赖
log_step "安装项目依赖"

cd "$APP_DIR"
log_info "安装NPM依赖..."
npm ci || npm install

# 配置环境变量
log_step "配置环境变量"

# 保存原始PROXY_URL，如果存在的话
ORIGINAL_PROXY_URL=""
if [ -f "$APP_DIR/.env" ]; then
    log_info "检测到已有.env文件，将备份原文件"
    cp "$APP_DIR/.env" "$APP_DIR/.env.backup"
    
    # 提取原始PROXY_URL值
    ORIGINAL_PROXY_URL=$(grep -E "^PROXY_URL\s*=" "$APP_DIR/.env.backup" | sed -E 's/^PROXY_URL\s*=\s*(.*)/\1/')
    log_info "保留原始反向代理配置: $ORIGINAL_PROXY_URL"
fi

if [ -f "$APP_DIR/.env.example" ]; then
    log_info "基于示例创建.env文件"
    cp "$APP_DIR/.env.example" "$APP_DIR/.env"
    
    # 如果有原始PROXY_URL，则替换
    if [ -n "$ORIGINAL_PROXY_URL" ]; then
        log_info "恢复原始反向代理配置"
        sed -i "s|^PROXY_URL\s*=.*|PROXY_URL = $ORIGINAL_PROXY_URL|" "$APP_DIR/.env"
    fi
else
    log_warn "未找到.env.example文件，创建基本.env文件"
    
    # 如果有原始PROXY_URL，使用它；否则留空
    if [ -n "$ORIGINAL_PROXY_URL" ]; then
        PROXY_CONFIG="PROXY_URL = $ORIGINAL_PROXY_URL"
    else
        PROXY_CONFIG="PROXY_URL = "
    fi
    
    cat > "$APP_DIR/.env" << EOF
# UNM-Server 环境变量配置示例
# 复制此文件为 .env 并根据实际情况修改

# 基础配置
PORT = $SERVICE_PORT                      # 服务监听端口
NODE_ENV = production            # 环境模式: production/development
ALLOWED_DOMAIN = '*'             # 允许访问的域名，*表示允许所有

# 反向代理配置（若无需反代则不填）
ENABLE_PROXY = true                                     # 是否启用反向代理
PROXY_URL = https://vcproxy.091017.xyz/                 # 反向代理地址

# 音乐API配置
# GD Studio's Online Music Platform API (music.gdstudio.xyz)
# 免责声明：本API仅用于学习目的，请勿用于商业用途
# 若使用本API请注明出处"GD音乐台(music.gdstudio.xyz)"
ENABLE_MUSIC_API = true                                 # 是否启用音乐API
MUSIC_API_URL = https://music-api.gdstudio.xyz/api.php  # 音乐API地址   特别感谢 https://music-api.gdstudio.xyz/ 提供API 

# Redis配置（可选，用于提高并发能力）
# REDIS_URL = redis://localhost:6379    # Redis连接URL

# UnblockNeteaseMusic 设置项
# ===================================

# 音质设置
ENABLE_FLAC = true               # 是否启用无损音质
SELECT_MAX_BR = true             # 是否优先选择最高音质
FOLLOW_SOURCE_ORDER = true       # 是否严格按照配置的音源顺序匹配

# Cookie设置（各平台认证信息）
# 推荐在生产环境使用环境变量管理这些敏感信息

# 网易云 cookie (格式：MUSIC_U=xxxxxxx)
NETEASE_COOKIE = ""

# JOOX cookie (格式：wmid=<your_wmid>; session_key=<your_key>)
JOOX_COOKIE = ""

# 咪咕 cookie (格式：<your_aversionid>)
MIGU_COOKIE = ""

# QQ音乐 cookie (格式：uin=<your_uin>; qm_keyst=<your_qm_keyst>)
QQ_COOKIE = ""

# Youtube API密钥
YOUTUBE_KEY = ""
EOF
fi

# 询问是否修改端口
read -p "是否修改默认端口? $SERVICE_PORT (y/n): " change_port
if [[ $change_port =~ ^[Yy]$ ]]; then
    read -p "请输入新端口: " new_port
    if [[ $new_port =~ ^[0-9]+$ ]] && [ $new_port -ge 1 ] && [ $new_port -le 65535 ]; then
        SERVICE_PORT=$new_port
        sed -i "s/PORT = .*/PORT = $SERVICE_PORT/" "$APP_DIR/.env"
        log_info "已将端口设置为: $SERVICE_PORT"
    else
        log_warn "无效端口号，将使用默认端口: $SERVICE_PORT"
    fi
fi

# 询问是否使用Redis
read -p "是否使用Redis缓存? (y/n): " use_redis
if [[ $use_redis =~ ^[Yy]$ ]]; then
    ENABLE_REDIS=true
    
    # 检查是否已安装Redis
    if ! command -v redis-server &> /dev/null; then
        log_info "安装Redis..."
        case $OS_ID in
            debian|ubuntu)
                apt install -y redis-server
                ;;
            centos|rhel|fedora)
                yum install -y redis
                ;;
        esac
        
        # 启动Redis服务
        systemctl enable redis
        systemctl start redis
    else
        log_info "检测到Redis已安装"
    fi
    
    # 配置Redis连接
    read -p "Redis端口 [$REDIS_PORT]: " redis_port
    redis_port=${redis_port:-$REDIS_PORT}
    
    read -p "Redis密码 (留空表示无密码): " redis_password
    
    if [ -n "$redis_password" ]; then
        REDIS_URL="redis://:${redis_password}@localhost:${redis_port}"
    else
        REDIS_URL="redis://localhost:${redis_port}"
    fi
    
    # 更新.env文件
    if grep -q "REDIS_URL" "$APP_DIR/.env"; then
        sed -i "s|REDIS_URL = .*|REDIS_URL = $REDIS_URL|" "$APP_DIR/.env"
    else
        echo -e "\n# Redis配置\nREDIS_URL = $REDIS_URL" >> "$APP_DIR/.env"
    fi
    
    log_info "Redis配置已添加: $REDIS_URL"
fi

# 构建项目
log_step "构建项目"

log_info "编译TypeScript代码..."
cd "$APP_DIR"
npm run build

# 配置系统服务
log_step "配置系统服务"

log_info "创建systemd服务..."
cat > /etc/systemd/system/${APP_NAME}.service << EOF
[Unit]
Description=UnblockNeteaseMusic API Server
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=${APP_NAME}
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

log_info "重新加载systemd配置..."
systemctl daemon-reload
systemctl enable ${APP_NAME}

# 配置防火墙
log_step "配置防火墙"

# 检测防火墙类型
if command -v ufw &> /dev/null; then
    log_info "配置UFW防火墙..."
    ufw allow $SERVICE_PORT/tcp
    ufw status
elif command -v firewall-cmd &> /dev/null; then
    log_info "配置Firewalld防火墙..."
    firewall-cmd --permanent --add-port=$SERVICE_PORT/tcp
    firewall-cmd --reload
    firewall-cmd --list-all
else
    log_warn "未检测到支持的防火墙，请手动配置防火墙规则"
fi

# 启动服务
log_step "启动服务"

log_info "启动UnblockNeteaseMusic API服务..."
systemctl start ${APP_NAME}
sleep 3

# 检查服务状态
if systemctl is-active --quiet ${APP_NAME}; then
    log_info "服务启动成功!"
else
    log_error "服务启动失败，请检查日志"
    systemctl status ${APP_NAME}
    exit 1
fi

# 安装Nginx (可选)
log_step "配置反向代理 (可选)"

read -p "是否安装Nginx作为反向代理? (y/n): " install_nginx
if [[ $install_nginx =~ ^[Yy]$ ]]; then
    log_info "安装Nginx..."
    
    case $OS_ID in
        debian|ubuntu)
            apt install -y nginx
            ;;
        centos|rhel|fedora)
            yum install -y nginx
            ;;
    esac
    
    # 创建Nginx配置
    read -p "输入域名 (例如: music.example.com): " domain_name
    
    if [ -z "$domain_name" ]; then
        domain_name="localhost"
        log_warn "未提供域名，使用localhost"
    fi
    
    log_info "创建Nginx配置..."
    cat > /etc/nginx/sites-available/${APP_NAME} << EOF
server {
    listen 80;
    server_name $domain_name;

    location / {
        proxy_pass http://127.0.0.1:$SERVICE_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
    
    # 启用配置
    if [ -d "/etc/nginx/sites-enabled" ]; then
        ln -sf /etc/nginx/sites-available/${APP_NAME} /etc/nginx/sites-enabled/
    fi
    
    # 测试Nginx配置
    nginx -t && {
        log_info "Nginx配置有效"
        
        # 重启Nginx
        systemctl enable nginx
        systemctl restart nginx
        
        log_info "Nginx已配置为反向代理"
        log_info "现在可以通过 http://$domain_name 访问服务"
        
        # 提示配置HTTPS
        log_info "建议配置HTTPS以提高安全性 (使用Let's Encrypt/Certbot)"
    } || {
        log_error "Nginx配置无效，请手动修复"
    }
    
    # 配置防火墙
    if command -v ufw &> /dev/null; then
        ufw allow 'Nginx Full'
    elif command -v firewall-cmd &> /dev/null; then
        firewall-cmd --permanent --add-service=http
        firewall-cmd --permanent --add-service=https
        firewall-cmd --reload
    fi
else
    log_info "跳过Nginx安装"
    log_info "服务已在 http://your-server-ip:$SERVICE_PORT 上运行"
fi

# 日志查看说明
log_step "部署完成"

echo ""
echo -e "${GREEN}UnblockNeteaseMusic API服务部署成功!${NC}"
echo ""
echo "服务信息:"
echo "  - 服务名称: $APP_NAME"
echo "  - 安装目录: $APP_DIR"
echo "  - 服务端口: $SERVICE_PORT"
echo "  - 配置文件: $APP_DIR/.env"
echo ""
echo "常用命令:"
echo "  - 启动服务: sudo systemctl start $APP_NAME"
echo "  - 停止服务: sudo systemctl stop $APP_NAME"
echo "  - 重启服务: sudo systemctl restart $APP_NAME"
echo "  - 查看状态: sudo systemctl status $APP_NAME"
echo "  - 查看日志: sudo journalctl -u $APP_NAME -f"
echo ""
echo "健康检查:"
echo "  - 测试接口: curl http://localhost:$SERVICE_PORT/health"
echo ""
echo -e "${YELLOW}请妥善保管您的API凭据和安全配置${NC}"
echo ""

# 提示Cookies配置
log_info "请记得配置各音乐平台的Cookie以改善服务质量"
log_info "编辑配置文件: nano $APP_DIR/.env"

exit 0 