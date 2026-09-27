'use strict';

const pino = require('pino');
const { env } = require('../config');

const logger = pino(
  env.isProd
    ? { level: env.LOG_LEVEL }
    : {
      level: env.LOG_LEVEL,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
    },
);

module.exports = logger;
