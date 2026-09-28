'use strict';

const logger = require('../utils/logger');

/**
 * The ONLY module allowed to touch the Socket.IO instance.
 * Controllers/services import these helpers; nothing else requires 'socket.io'.
 * Every helper is a safe no-op (with a warning) before initSocket() runs, so
 * unit-testing a controller without a server never crashes.
 */
let io = null;
let warned = false;

function setIO(instance) {
  io = instance;
  warned = false;
}

function getIO() {
  return io;
}

function emit(room, event, payload) {
  if (!io) {
    if (!warned) {
      warned = true;
      logger.warn('[socket] emit before initSocket() — realtime events are being dropped');
    }
    logger.debug({ room, event }, '[socket] dropped emit (io not initialised)');
    return false;
  }
  if (room === null) io.emit(event, payload);
  else io.to(room).emit(event, payload);
  logger.debug({ room: room || '*', event }, '[socket] emit');
  return true;
}

/**
 * Normalises whatever a caller hands us into a plain id string.
 * Callers frequently pass a mongoose field that has been `populate()`d, which
 * would otherwise stringify to the whole document and produce a room nobody
 * is in — so unwrap `_id`/`id` here rather than relying on every call site.
 */
function idOf(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value !== 'object') return String(value);
  // A mongoose ObjectId exposes a self-returning `_id` getter, so it has to be
  // recognised BEFORE any `_id` unwrapping or idOf() recurses forever.
  if (typeof value.toHexString === 'function') return value.toHexString();
  const inner = value._id !== undefined ? value._id : value.id;
  if (inner === undefined || inner === null || inner === value) return String(value);
  return idOf(inner);
}

const rooms = {
  user: (userId) => `user:${idOf(userId)}`,
  role: (role) => `role:${role}`,
  coach: (trainerId) => `coach:${idOf(trainerId)}`,
  trainer: (trainerId) => `trainer:${idOf(trainerId)}`,
  content: (locale) => `content:${locale || 'en'}`,
};

/** -> `user:<id>` */
const emitToUser = (userId, event, payload) => (idOf(userId) ? emit(rooms.user(userId), event, payload) : false);
/** -> `role:<role>` ('client' | 'trainer' | 'admin') */
const emitToRole = (role, event, payload) => (role ? emit(rooms.role(role), event, payload) : false);
/** -> `coach:<trainerId>` (the trainer's own feed) */
const emitToCoach = (trainerId, event, payload) => (idOf(trainerId) ? emit(rooms.coach(trainerId), event, payload) : false);
/** -> `trainer:<trainerId>` (that trainer's clients) */
const emitToTrainerClients = (trainerId, event, payload) => (idOf(trainerId) ? emit(rooms.trainer(trainerId), event, payload) : false);
/** -> `content:<locale>` */
const emitToContent = (locale, event, payload) => emit(rooms.content(locale), event, payload);
/** -> every connected socket */
const emitAll = (event, payload) => emit(null, event, payload);

/** How many sockets are currently in a room (0 when io is not up). */
async function roomSize(room) {
  if (!io) return 0;
  try {
    const sockets = await io.in(room).fetchSockets();
    return sockets.length;
  } catch (err) {
    logger.warn({ err: err.message, room }, '[socket] roomSize failed');
    return 0;
  }
}

/**
 * Force every live socket belonging to a user off the server.
 *
 * Bumping `tokenVersion` stops the NEXT request, but a signed-in client would otherwise sit there
 * unaware until it happens to call the API. Deactivation needs to be felt immediately, so we emit
 * the reason first, give the clients a beat to render it, then cut the connections.
 */
async function disconnectUser(userId, event, payload) {
  if (!io) {
    if (!warned) {
      warned = true;
      logger.warn('[socket] io not initialised — disconnectUser is a no-op');
    }
    return 0;
  }
  const room = `user:${String(userId)}`;
  const sockets = await io.in(room).fetchSockets();
  if (event) io.to(room).emit(event, payload || {});
  // Let the event flush before tearing the sockets down.
  setTimeout(() => {
    sockets.forEach(s => {
      try { s.disconnect(true); } catch { /* already gone */ }
    });
  }, 400);
  return sockets.length;
}

module.exports = {
  disconnectUser,
  setIO,
  idOf,
  getIO,
  rooms,
  emitToUser,
  emitToRole,
  emitToCoach,
  emitToTrainerClients,
  emitToContent,
  emitAll,
  roomSize,
};
