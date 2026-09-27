'use strict';

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const int = (v, d) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
};

const NODE_ENV = process.env.NODE_ENV || 'development';

const env = {
  NODE_ENV,
  isProd: NODE_ENV === 'production',
  isDev: NODE_ENV !== 'production',
  PORT: int(process.env.PORT, 4000),

  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/firon_performance',

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'dev_access_secret_change_me',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_me',
  JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL || '15m',
  JWT_REFRESH_TTL: process.env.JWT_REFRESH_TTL || '30d',
  JWT_RESET_TTL: process.env.JWT_RESET_TTL || '15m',
  // `remember me` on login gets a longer refresh lifetime
  JWT_REFRESH_TTL_REMEMBER: process.env.JWT_REFRESH_TTL_REMEMBER || '90d',

  CORS_ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  UPLOAD_DIR: path.isAbsolute(process.env.UPLOAD_DIR || '')
    ? process.env.UPLOAD_DIR
    : path.resolve(__dirname, '../../', process.env.UPLOAD_DIR || 'uploads'),
  UPLOAD_ROUTE: '/uploads',
  MAX_UPLOAD_MB: int(process.env.MAX_UPLOAD_MB, 200),

  PUBLIC_URL: process.env.PUBLIC_URL || '',

  FIREBASE_SERVICE_ACCOUNT_PATH: path.isAbsolute(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '')
    ? process.env.FIREBASE_SERVICE_ACCOUNT_PATH
    : path.resolve(
      __dirname,
      '../../',
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json',
    ),

  OTP_TTL_MINUTES: int(process.env.OTP_TTL_MINUTES, 10),
  OTP_DEV_CODE: process.env.OTP_DEV_CODE || '1234',
  OTP_MAX_ATTEMPTS: int(process.env.OTP_MAX_ATTEMPTS, 5),

  LOG_LEVEL: process.env.LOG_LEVEL || (NODE_ENV === 'production' ? 'info' : 'debug'),
  VERSION: require('../../package.json').version,

  DASHBOARD_TICK_MS: int(process.env.DASHBOARD_TICK_MS, 30000),
};

module.exports = env;
