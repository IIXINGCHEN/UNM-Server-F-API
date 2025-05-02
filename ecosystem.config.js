module.exports = {
  apps: [{
    name: 'unm-server',
    script: 'dist/server.js',
    exec_mode: 'cluster',
    instances: process.env.INSTANCES || 'max', // 使用环境变量或默认为max
    autorestart: true,
    watch: false,
    max_memory_restart: process.env.MAX_MEMORY_RESTART || '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 5678
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5678
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    error_file: 'logs/error.log',
    out_file: 'logs/output.log',
    time: true,
    wait_ready: true,
    listen_timeout: 5000,
    kill_timeout: 10000,
    restart_delay: 5000,
    exp_backoff_restart_delay: 1000,
    min_uptime: '30s'
  }]
};