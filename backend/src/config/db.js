'use strict';

const mongoose = require('mongoose');

/**
 * Mongo connection helper (CONTRACT §1 / §5 health endpoint).
 * Uses the shared pino logger when the backend provides one, otherwise a
 * local pino instance so this module works standalone (e.g. from the seeder).
 */
function makeLogger() {
  try {
    // eslint-disable-next-line global-require, import/no-unresolved
    const shared = require('../utils/logger');
    if (shared && typeof shared.info === 'function') return shared;
    if (shared && shared.logger && typeof shared.logger.info === 'function') return shared.logger;
  } catch (_) {
    /* no shared logger yet — fall through */
  }
  // eslint-disable-next-line global-require
  const pino = require('pino');
  return pino({
    level: process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
        : undefined,
  });
}

const log = makeLogger();

const DEFAULT_URI = 'mongodb://127.0.0.1:27017/firon_performance';

const STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
  99: 'uninitialized',
};

let listenersBound = false;

function bindListeners() {
  if (listenersBound) return;
  listenersBound = true;
  mongoose.connection.on('connected', () => log.info('[db] connected'));
  mongoose.connection.on('disconnected', () => log.warn('[db] disconnected'));
  mongoose.connection.on('reconnected', () => log.info('[db] reconnected'));
  mongoose.connection.on('error', (err) => log.error({ err }, '[db] connection error'));
}

/** 'connected' | 'connecting' | 'disconnecting' | 'disconnected' | 'uninitialized' */
function dbState() {
  return STATES[mongoose.connection.readyState] || 'unknown';
}

/** The database name we are actually talking to (handy in /api/health). */
function dbName() {
  return mongoose.connection && mongoose.connection.name ? mongoose.connection.name : null;
}

/**
 * Connect to Mongo. Retries once after a short delay before giving up.
 * @param {string} [uri] overrides `process.env.MONGO_URI`
 */
async function connectDB(uri = process.env.MONGO_URI || DEFAULT_URI, { retries = 1, delayMs = 2000 } = {}) {
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  bindListeners();
  mongoose.set('strictQuery', true);

  const options = {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 20,
    minPoolSize: 2,
    family: 4,
    autoIndex: process.env.NODE_ENV !== 'production',
  };

  let attempt = 0;
  // attempt 0 = first try, then `retries` more.
  for (;;) {
    try {
      await mongoose.connect(uri, options);
      log.info({ db: dbName() }, `[db] mongo ready (${uri.replace(/\/\/[^@]*@/, '//***@')})`);
      return mongoose.connection;
    } catch (err) {
      if (attempt >= retries) {
        log.error({ err }, '[db] could not connect to mongo');
        throw err;
      }
      attempt += 1;
      log.warn({ err: err.message }, `[db] connect failed — retrying in ${delayMs}ms (${attempt}/${retries})`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function disconnectDB() {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
  log.info('[db] disconnected');
}

module.exports = { connectDB, disconnectDB, dbState, dbName, mongoose, DEFAULT_URI };
