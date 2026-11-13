module.exports = {
  apps: [{
    name: 'polovnidijelovi',
    script: 'server/index.js',
    node_args: '--no-warnings',
    cwd: __dirname,
    max_memory_restart: '400M',
    env: { NODE_ENV: 'production' },
  }],
};
