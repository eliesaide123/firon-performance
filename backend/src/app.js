'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');

const { env } = require('./config');
const logger = require('./utils/logger');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

function buildApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({
    // Media is served cross-origin to the CMS (5173) and the RN app.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  }));

  const corsOptions = {
    origin(origin, cb) {
      // No Origin header = a native app / curl / server-to-server call.
      if (!origin) return cb(null, true);
      if (env.CORS_ORIGINS.includes(origin) || env.CORS_ORIGINS.includes('*')) return cb(null, true);
      // Any localhost port is fine in dev (Vite/Metro pick ports freely).
      if (!env.isProd && /^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?$/.test(origin)) {
        return cb(null, true);
      }
      return cb(new Error('CORS_NOT_ALLOWED'));
    },
    credentials: true,
    exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges'],
  };
  app.use(cors(corsOptions));
  app.options(/.*/, cors(corsOptions));

  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // morgan -> pino (one structured log line per request)
  app.use(morgan(
    env.isProd ? 'combined' : ':method :url :status :response-time[0]ms',
    { stream: { write: (line) => logger.info(line.trim()) }, skip: (req) => req.originalUrl === '/api/health' },
  ));

  // Static uploads: http://localhost:4000/uploads/<filename>
  app.use(
    env.UPLOAD_ROUTE,
    express.static(env.UPLOAD_DIR, {
      maxAge: env.isProd ? '7d' : 0,
      fallthrough: true,
      index: false,
      // Range requests matter for <video> scrubbing.
      acceptRanges: true,
    }),
  );

  app.get('/', (req, res) => res.json({
    success: true,
    data: {
      name: 'Firon Performance API',
      version: env.VERSION,
      api: '/api',
      health: '/api/health',
      socket: '/socket.io',
      uploads: env.UPLOAD_ROUTE,
    },
  }));

  app.use('/api', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  logger.debug({ uploadDir: path.relative(process.cwd(), env.UPLOAD_DIR) }, '[app] built');
  return app;
}

module.exports = { buildApp, app: buildApp() };
