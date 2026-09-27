'use strict';

const http = require('http');
const { env } = require('./config');
const logger = require('./utils/logger');
const { buildApp } = require('./app');
const { initSocket, closeSocket } = require('./realtime');
const pushService = require('./services/pushService');

const app = buildApp();
const server = http.createServer(app);

let shuttingDown = false;

async function start() {
  // 1. Mongo first — the DATABASE agent owns config/db.js.
  const { connectDB } = require('./config/db');
  await connectDB(env.MONGO_URI);

  // 2. Socket.IO on the same HTTP server (path /socket.io).
  initSocket(server);

  // 3. Firebase is optional: a missing service account logs once and no-ops.
  pushService.init();

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(env.PORT, () => resolve());
  });

  logger.info(
    { port: env.PORT, env: env.NODE_ENV, mongo: env.MONGO_URI },
    `Firon Performance API listening on http://localhost:${env.PORT} (api /api · socket /socket.io)`,
  );
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, '[shutdown] draining…');

  const force = setTimeout(() => {
    logger.error('[shutdown] forced exit after 10s');
    process.exit(1);
  }, 10000);
  force.unref();

  try {
    await closeSocket();
    await new Promise((resolve) => server.close(() => resolve()));
    logger.info('[shutdown] http server closed');

    const { disconnectDB } = require('./config/db');
    if (typeof disconnectDB === 'function') await disconnectDB();
    else await require('mongoose').disconnect();
    logger.info('[shutdown] mongo disconnected');

    clearTimeout(force);
    process.exit(0);
  } catch (err) {
    logger.error({ err: err.message }, '[shutdown] failed');
    process.exit(1);
  }
}

['SIGINT', 'SIGTERM'].forEach((sig) => process.on(sig, () => shutdown(sig)));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason: reason && (reason.stack || reason.message || reason) }, 'unhandledRejection');
});
process.on('uncaughtException', (err) => {
  logger.error({ err: err.stack || err.message }, 'uncaughtException — shutting down');
  shutdown('uncaughtException');
});

start().catch((err) => {
  logger.error({ err: err.stack || err.message }, 'Failed to start server');
  process.exit(1);
});

module.exports = { app, server, start, shutdown };
