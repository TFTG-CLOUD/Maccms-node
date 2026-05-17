module.exports = {
  apps: [
    {
      name: 'maccms-node',
      cwd: __dirname,
      script: 'app.js',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '768M',
      instance_var: 'NODE_APP_INSTANCE',
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: 'production',
        ENABLE_CRON: 'true',
        CRON_PRIMARY_ONLY: 'true'
      },
      env_development: {
        NODE_ENV: 'development',
        ENABLE_CRON: 'true',
        CRON_PRIMARY_ONLY: 'true'
      },
      env_production: {
        NODE_ENV: 'production',
        ENABLE_CRON: 'true',
        CRON_PRIMARY_ONLY: 'true'
      }
    }
  ]
};
