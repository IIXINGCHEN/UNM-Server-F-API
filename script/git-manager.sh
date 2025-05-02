#!/bin/bash
#
# UnblockNeteaseMusic API服务 Git管理脚本
# 适用于项目版本控制、部署和维护
# 

set -e  # 遇到错误立即退出

# 文字颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # 重置颜色

# 配置变量
APP_NAME="unm-server"
APP_DIR="$(pwd)"
GITHUB_REPO="origin"  # 默认远程仓库名
MAIN_BRANCH="main"    # 主分支名
BACKUP_DIR="${APP_DIR}/backups/git"
DATE_TAG=$(date +"%Y%m%d_%H%M%S")

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

# 检查是否在git仓库中
check_git_repo() {
    if ! git rev-parse --is-inside-work-tree &>/dev/null; then
        log_error "当前目录不是Git仓库，请在有效的Git仓库中运行此脚本"
        exit 1
    fi
}

# 获取当前状态
get_status() {
    log_step "获取Git仓库状态"
    git status -s
    
    # 显示分支信息
    current_branch=$(git branch --show-current)
    log_info "当前分支: ${current_branch}"
    
    # 显示最近提交
    echo -e "\n最近提交记录:"
    git log --oneline -n 5
}

# 保存更改
commit_changes() {
    log_step "提交代码更改"
    
    # 检查是否有修改
    if git diff-index --quiet HEAD --; then
        log_warn "没有发现需要提交的更改"
        return 0
    fi
    
    # 询问提交信息
    echo -e "\n修改文件列表:"
    git status -s
    
    echo ""
    read -p "请输入提交信息: " commit_message
    
    if [ -z "$commit_message" ]; then
        commit_message="更新于 $(date +'%Y-%m-%d %H:%M:%S')"
        log_warn "未提供提交信息，使用默认信息: \"$commit_message\""
    fi
    
    # 添加并提交更改
    git add .
    git commit -m "$commit_message"
    log_info "已提交更改: $commit_message"
}

# 推送到远程仓库
push_changes() {
    log_step "推送更改到远程仓库"
    
    # 获取当前分支
    current_branch=$(git branch --show-current)
    
    # 检查远程分支是否存在
    if ! git ls-remote --heads $GITHUB_REPO $current_branch | grep -q $current_branch; then
        log_warn "远程仓库中不存在分支 '$current_branch'"
        read -p "是否创建远程分支并推送? (y/n): " create_remote
        
        if [[ $create_remote =~ ^[Yy]$ ]]; then
            git push -u $GITHUB_REPO $current_branch
            log_info "已创建远程分支并推送更改"
            return 0
        else
            log_info "已取消推送操作"
            return 1
        fi
    fi
    
    # 推送更改
    git push $GITHUB_REPO $current_branch
    log_info "已推送更改到远程仓库 $GITHUB_REPO 的 $current_branch 分支"
}

# 拉取最新代码
pull_changes() {
    log_step "拉取最新代码"
    
    # 获取当前分支
    current_branch=$(git branch --show-current)
    
    # 检查是否有未提交的更改
    if ! git diff-index --quiet HEAD --; then
        log_warn "有未提交的更改，拉取前请先处理这些更改"
        git status -s
        
        echo ""
        read -p "是否暂存当前更改并继续? (y/n): " stash_changes
        
        if [[ $stash_changes =~ ^[Yy]$ ]]; then
            log_info "暂存当前更改..."
            git stash push -m "自动暂存于 $(date +'%Y-%m-%d %H:%M:%S')"
            
            # 拉取更改
            git pull $GITHUB_REPO $current_branch
            
            # 恢复暂存的更改
            log_info "恢复暂存的更改..."
            git stash pop
            
            # 检查是否有冲突
            if git diff --name-only --diff-filter=U | grep -q .; then
                log_error "恢复暂存时发生冲突，请手动解决"
                git status
                return 1
            fi
            
            log_info "已成功拉取更新并恢复暂存的更改"
            return 0
        else
            log_info "已取消拉取操作"
            return 1
        fi
    fi
    
    # 直接拉取更改
    git pull $GITHUB_REPO $current_branch
    log_info "已拉取最新代码"
}

# 创建新分支
create_branch() {
    log_step "创建新分支"
    
    read -p "请输入新分支名称: " new_branch
    
    if [ -z "$new_branch" ]; then
        log_error "分支名不能为空"
        return 1
    fi
    
    # 检查分支是否已存在
    if git show-ref --verify --quiet refs/heads/$new_branch; then
        log_error "分支 '$new_branch' 已存在"
        return 1
    fi
    
    # 创建新分支
    git checkout -b $new_branch
    log_info "已创建并切换到新分支: $new_branch"
}

# 切换分支
switch_branch() {
    log_step "切换分支"
    
    # 列出所有本地分支
    echo -e "本地分支列表:"
    git branch
    
    echo ""
    read -p "请输入要切换的分支名称: " target_branch
    
    if [ -z "$target_branch" ]; then
        log_error "分支名不能为空"
        return 1
    fi
    
    # 检查分支是否存在
    if ! git show-ref --verify --quiet refs/heads/$target_branch; then
        log_warn "本地不存在分支 '$target_branch'"
        
        # 检查远程分支
        if git ls-remote --heads $GITHUB_REPO $target_branch | grep -q $target_branch; then
            log_info "在远程仓库中找到分支 '$target_branch'"
            read -p "是否从远程仓库拉取该分支? (y/n): " pull_remote
            
            if [[ $pull_remote =~ ^[Yy]$ ]]; then
                git checkout -b $target_branch --track $GITHUB_REPO/$target_branch
                log_info "已创建本地分支 '$target_branch' 并跟踪远程分支"
                return 0
            else
                log_info "已取消切换操作"
                return 1
            fi
        else
            log_error "分支 '$target_branch' 在本地和远程仓库中均不存在"
            return 1
        fi
    fi
    
    # 检查是否有未提交的更改
    if ! git diff-index --quiet HEAD --; then
        log_warn "有未提交的更改，切换前请先处理这些更改"
        git status -s
        
        echo ""
        read -p "是否暂存当前更改并继续? (y/n): " stash_changes
        
        if [[ $stash_changes =~ ^[Yy]$ ]]; then
            log_info "暂存当前更改..."
            git stash push -m "自动暂存于 $(date +'%Y-%m-%d %H:%M:%S')"
            
            # 切换分支
            git checkout $target_branch
            
            # 询问是否恢复暂存
            read -p "是否在新分支上恢复暂存的更改? (y/n): " pop_stash
            
            if [[ $pop_stash =~ ^[Yy]$ ]]; then
                log_info "恢复暂存的更改..."
                git stash pop
                
                # 检查是否有冲突
                if git diff --name-only --diff-filter=U | grep -q .; then
                    log_error "恢复暂存时发生冲突，请手动解决"
                    git status
                    return 1
                fi
            fi
            
            log_info "已切换到分支: $target_branch"
            return 0
        else
            log_info "已取消切换操作"
            return 1
        fi
    fi
    
    # 直接切换分支
    git checkout $target_branch
    log_info "已切换到分支: $target_branch"
}

# 合并分支
merge_branch() {
    log_step "合并分支"
    
    # 列出所有本地分支
    echo -e "本地分支列表:"
    git branch
    
    # 获取当前分支
    current_branch=$(git branch --show-current)
    
    echo ""
    read -p "请输入要合并的源分支名称: " source_branch
    
    if [ -z "$source_branch" ]; then
        log_error "源分支名不能为空"
        return 1
    fi
    
    # 检查源分支是否存在
    if ! git show-ref --verify --quiet refs/heads/$source_branch; then
        log_error "源分支 '$source_branch' 不存在"
        return 1
    fi
    
    # 检查是否是当前分支
    if [ "$source_branch" = "$current_branch" ]; then
        log_error "不能将分支合并到自身"
        return 1
    fi
    
    # 检查是否有未提交的更改
    if ! git diff-index --quiet HEAD --; then
        log_warn "有未提交的更改，合并前请先处理这些更改"
        git status -s
        return 1
    fi
    
    # 执行合并
    log_info "正在将 '$source_branch' 合并到 '$current_branch'..."
    
    if git merge $source_branch; then
        log_info "合并成功完成"
    else
        log_error "合并过程中发生冲突，请手动解决"
        git status
        return 1
    fi
}

# 创建标签
create_tag() {
    log_step "创建版本标签"
    
    read -p "请输入标签名称 (如v1.0.0): " tag_name
    
    if [ -z "$tag_name" ]; then
        # 自动生成版本标签
        tag_name="v$(date +%Y.%m.%d)-${DATE_TAG}"
        log_warn "未提供标签名称，自动生成: $tag_name"
    fi
    
    # 检查标签是否已存在
    if git rev-parse "$tag_name" >/dev/null 2>&1; then
        log_error "标签 '$tag_name' 已存在"
        return 1
    fi
    
    read -p "请输入标签描述: " tag_message
    
    if [ -z "$tag_message" ]; then
        tag_message="版本发布于 $(date +'%Y-%m-%d %H:%M:%S')"
        log_warn "未提供标签描述，使用默认描述: \"$tag_message\""
    fi
    
    # 创建标签
    git tag -a "$tag_name" -m "$tag_message"
    log_info "已创建标签: $tag_name"
    
    # 询问是否推送标签
    read -p "是否推送标签到远程仓库? (y/n): " push_tag
    
    if [[ $push_tag =~ ^[Yy]$ ]]; then
        git push $GITHUB_REPO "$tag_name"
        log_info "已推送标签 '$tag_name' 到远程仓库"
    fi
}

# 备份仓库
backup_repo() {
    log_step "备份Git仓库"
    
    # 确保备份目录存在
    mkdir -p "$BACKUP_DIR"
    
    # 创建备份文件
    backup_file="${BACKUP_DIR}/${APP_NAME}_git_backup_${DATE_TAG}.tar.gz"
    
    log_info "创建备份文件: $(basename $backup_file)"
    
    # 使用git-archive导出仓库
    git archive --format=tar.gz --output="$backup_file" HEAD
    
    # 添加未跟踪的文件
    untracked_files=$(git ls-files --others --exclude-standard)
    if [ -n "$untracked_files" ]; then
        log_info "同时备份未跟踪的文件..."
        
        # 创建临时目录
        temp_dir=$(mktemp -d)
        
        # 复制未跟踪文件到临时目录
        echo "$untracked_files" | while read file; do
            mkdir -p "$temp_dir/$(dirname "$file")"
            cp "$file" "$temp_dir/$file"
        done
        
        # 添加未跟踪文件到备份
        tar -rf "${backup_file%.gz}" -C "$temp_dir" .
        gzip -f "${backup_file%.gz}"
        
        # 清理临时目录
        rm -rf "$temp_dir"
    fi
    
    log_info "备份完成: $backup_file"
    log_info "备份大小: $(du -h "$backup_file" | cut -f1)"
}

# 同步环境配置文件
sync_env_files() {
    log_step "同步环境配置文件"
    
    if [ ! -f ".env" ]; then
        log_error ".env 文件不存在"
        return 1
    fi
    
    # 确保 deploy.sh 中的 .env 内容和 .env 文件内容一致
    if [ -f "deploy.sh" ]; then
        log_info "更新 deploy.sh 中的 .env 内容..."
        
        # 备份原始 deploy.sh
        cp deploy.sh deploy.sh.bak
        
        # 提取 deploy.sh 中 .env 文件创建的部分并替换内容
        env_content=$(cat .env)
        
        # 使用 sed 替换 .env 内容部分
        # 查找从 "cat > \"$APP_DIR/.env\" << EOF" 到下一个 EOF 的部分
        awk -v env_content="$env_content" '
        /cat > "\$APP_DIR\/\.env" << EOF/ {
            print;
            print env_content;
            in_env_block = 1;
            next;
        }
        /^EOF$/ {
            if (in_env_block) {
                in_env_block = 0;
                print;
                next;
            }
        }
        !in_env_block {
            print;
        }
        ' deploy.sh.bak > deploy.sh
        
        # 确保脚本可执行
        chmod +x deploy.sh
        
        log_info "deploy.sh 中的 .env 内容已更新"
    else
        log_warn "deploy.sh 文件不存在，无法更新"
    fi
}

# 显示帮助信息
show_help() {
    echo -e "${BLUE}UnblockNeteaseMusic API服务 Git管理脚本${NC}"
    echo -e "使用方法: $(basename $0) [命令]"
    echo ""
    echo -e "可用命令:"
    echo -e "  ${GREEN}status${NC}        - 显示仓库状态和最近提交"
    echo -e "  ${GREEN}commit${NC}        - 提交代码更改"
    echo -e "  ${GREEN}push${NC}          - 推送更改到远程仓库"
    echo -e "  ${GREEN}pull${NC}          - 拉取最新代码"
    echo -e "  ${GREEN}branch${NC}        - 创建新分支"
    echo -e "  ${GREEN}switch${NC}        - 切换分支"
    echo -e "  ${GREEN}merge${NC}         - 合并分支"
    echo -e "  ${GREEN}tag${NC}           - 创建版本标签"
    echo -e "  ${GREEN}backup${NC}        - 备份当前仓库"
    echo -e "  ${GREEN}sync-env${NC}      - 同步环境配置文件"
    echo -e "  ${GREEN}help${NC}          - 显示此帮助信息"
    echo ""
    echo -e "示例:"
    echo -e "  $(basename $0) status"
    echo -e "  $(basename $0) commit"
    echo -e "  $(basename $0) push"
}

# 主函数
main() {
    # 检查是否为Git仓库
    check_git_repo
    
    # 如果没有提供命令，显示帮助
    if [ $# -eq 0 ]; then
        show_help
        exit 0
    fi
    
    # 处理命令
    case "$1" in
        status)
            get_status
            ;;
        commit)
            commit_changes
            ;;
        push)
            push_changes
            ;;
        pull)
            pull_changes
            ;;
        branch)
            create_branch
            ;;
        switch)
            switch_branch
            ;;
        merge)
            merge_branch
            ;;
        tag)
            create_tag
            ;;
        backup)
            backup_repo
            ;;
        sync-env)
            sync_env_files
            ;;
        help)
            show_help
            ;;
        *)
            log_error "未知命令: $1"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@" 