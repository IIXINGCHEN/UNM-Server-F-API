/**
 * 备份和恢复脚本
 * 用于在构建过程中备份和恢复重要文件
 */

const fs = require('fs');
const path = require('path');

// 需要备份的文件列表
const filesToBackup = [
    'public/assets/css/styles.css',
    // 添加其他需要保留的文件
];

// 备份目录
const backupDir = path.join(__dirname, '../.backup');

/**
 * 备份文件
 */
function backup() {
    console.log('正在备份文件...');

    // 创建备份目录
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    // 备份文件
    filesToBackup.forEach(file => {
        const filePath = path.join(__dirname, '..', file);
        const backupPath = path.join(backupDir, path.basename(file));

        if (fs.existsSync(filePath)) {
            fs.copyFileSync(filePath, backupPath);
            console.log(`已备份: ${file}`);
        } else {
            console.log(`跳过不存在的文件: ${file}`);
        }
    });

    console.log('备份完成');
}

/**
 * 恢复文件
 */
function restore() {
    console.log('正在恢复文件...');

    // 检查备份目录是否存在
    if (!fs.existsSync(backupDir)) {
        console.log('没有找到备份目录，跳过恢复');
        return;
    }

    // 恢复文件
    filesToBackup.forEach(file => {
        const targetPath = path.join(__dirname, '..', file);
        const backupPath = path.join(backupDir, path.basename(file));

        if (fs.existsSync(backupPath)) {
            // 确保目标目录存在
            const targetDir = path.dirname(targetPath);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            fs.copyFileSync(backupPath, targetPath);
            console.log(`已恢复: ${file}`);
        } else {
            console.log(`跳过不存在的备份: ${path.basename(file)}`);
        }
    });

    console.log('恢复完成');
}

/**
 * 清理备份
 */
function cleanup() {
    console.log('正在清理备份...');

    if (fs.existsSync(backupDir)) {
        fs.rmSync(backupDir, { recursive: true, force: true });
        console.log('备份目录已清理');
    } else {
        console.log('没有找到备份目录，跳过清理');
    }
}

// 根据命令行参数执行操作
const command = process.argv[2];
switch (command) {
    case 'backup':
        backup();
        break;
    case 'restore':
        restore();
        break;
    case 'cleanup':
        cleanup();
        break;
    default:
        console.log('用法: node backup-restore.js [backup|restore|cleanup]');
        break;
}