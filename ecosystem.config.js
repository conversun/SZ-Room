module.exports = {
  apps: [
    {
      name: 'sz-room-crawler',
      script: './dist/app.js',
      instances: 1,
      exec_mode: 'fork',
      
      // 环境变量
      env: {
        NODE_ENV: 'development',
        LOG_LEVEL: 'debug',
      },
      env_production: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
      },
      
      // 日志配置
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // 重启策略
      autorestart: true,
      max_memory_restart: '500M',
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      
      // 监控
      monitoring: false,
      
      // 其他配置
      kill_timeout: 5000,
      listen_timeout: 5000,
      shutdown_with_message: true,
      
      // 忽略文件监听
      ignore_watch: [
        'node_modules',
        'logs',
        '.git',
        '*.log'
      ],
      
      // 实例配置
      instance_var: 'INSTANCE_ID',
      
      // 合并日志
      merge_logs: true,
      
      // cron 重启（可选，每天凌晨3点重启）
      // cron_restart: '0 3 * * *',
      
      // 时区
      time: true,
    }
  ]
}; 