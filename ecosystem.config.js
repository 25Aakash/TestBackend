module.exports = {
  apps: [
    {
      name: 'wholesale-marketplace-api',
      script: 'index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5002,
      },
      // Restart policies
      max_memory_restart: '300M',
      restart_delay: 5000,
      max_restarts: 10,

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/home/ubuntu/logs/wholesale-api-error.log',
      out_file: '/home/ubuntu/logs/wholesale-api-out.log',
      merge_logs: true,

      // Watch (disabled in production)
      watch: false,
    },
  ],
};
