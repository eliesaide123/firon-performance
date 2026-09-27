'use strict';

const { ok } = require('../utils/respond');
const { env } = require('../config');

/**
 * GET /api/health -> { status, db, uptime, version }
 * `db` comes from the DATABASE agent's config/db.js `dbState()` helper, with a
 * direct mongoose readState fallback so health never 500s.
 */
function dbStatus() {
  try {
    // eslint-disable-next-line global-require
    const { dbState } = require('../config/db');
    if (typeof dbState === 'function') {
      const s = dbState();
      if (typeof s === 'string') return s;
      if (s && typeof s === 'object') return s.status || s.state || 'unknown';
    }
  } catch (_err) { /* fall through to mongoose */ }

  // eslint-disable-next-line global-require
  const mongoose = require('mongoose');
  const MAP = ['disconnected', 'connected', 'connecting', 'disconnecting', 'uninitialized'];
  return MAP[mongoose.connection.readyState] || 'unknown';
}

exports.health = (req, res) => {
  const db = dbStatus();
  return ok(res, {
    status: db === 'connected' ? 'ok' : 'degraded',
    db,
    uptime: Math.round(process.uptime()),
    version: env.VERSION,
    env: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
};

exports.dbStatus = dbStatus;
