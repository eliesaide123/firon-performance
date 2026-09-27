'use strict';

const { Server } = require('socket.io');
const { env } = require('../config');
const logger = require('../utils/logger');
const tokenService = require('../services/tokenService');
const { setIO, rooms, emitToCoach, emitToRole, roomSize } = require('./emit');
const { attach } = require('./handlers');

/**
 * Presence map: userId -> number of open sockets.
 * A user is "online" on the first socket and "offline" when the last closes,
 * so multiple devices never flip the coach's roster dot.
 */
const presence = new Map();
let dashboardTimer = null;

function markOnline(userId) {
  const next = (presence.get(userId) || 0) + 1;
  presence.set(userId, next);
  return next === 1; // first connection
}

function markOffline(userId) {
  const next = (presence.get(userId) || 1) - 1;
  if (next <= 0) { presence.delete(userId); return true; }
  presence.set(userId, next);
  return false;
}

const isOnline = (userId) => presence.has(String(userId));

/** JWT handshake middleware: socket.handshake.auth.token. */
async function authenticate(socket, next) {
  try {
    const token = (socket.handshake.auth && socket.handshake.auth.token)
      || (socket.handshake.headers && String(socket.handshake.headers.authorization || '').replace(/^Bearer\s+/i, ''))
      || (socket.handshake.query && socket.handshake.query.token);

    if (!token) return next(new Error('UNAUTHORIZED'));

    const payload = tokenService.verifyAccessToken(token);
    const { User } = require('../models');
    const user = await User.findById(payload.sub).select('name role locale isActive tokenVersion clientProfile.trainerId');

    if (!user || !user.isActive) return next(new Error('UNAUTHORIZED'));
    if ((user.tokenVersion || 0) !== (payload.tokenVersion || 0)) return next(new Error('UNAUTHORIZED'));

    socket.data.userId = String(user._id);
    socket.data.role = user.role;
    socket.data.name = user.name;
    socket.data.locale = user.locale || 'en';
    socket.data.trainerId = user.role === 'client' && user.clientProfile && user.clientProfile.trainerId
      ? String(user.clientProfile.trainerId)
      : null;
    return next();
  } catch (err) {
    logger.debug({ err: err.message }, '[socket] handshake rejected');
    return next(new Error('UNAUTHORIZED'));
  }
}

/** The rooms listed in CONTRACT §6. */
function roomsFor(data) {
  const list = [rooms.user(data.userId), rooms.role(data.role), rooms.content(data.locale)];
  if (data.role === 'client' && data.trainerId) list.push(rooms.trainer(data.trainerId));
  if (data.role === 'trainer') list.push(rooms.coach(data.userId));
  return list;
}

/**
 * Pushes `dashboard:tick` to role:admin every DASHBOARD_TICK_MS, but only
 * while at least one admin socket is actually connected.
 */
function startDashboardTicker() {
  if (dashboardTimer) return;
  dashboardTimer = setInterval(async () => {
    try {
      const admins = await roomSize(rooms.role('admin'));
      if (admins === 0) return;
      const { buildStats } = require('../controllers/dashboard.controller');
      const stats = await buildStats();
      emitToRole('admin', 'dashboard:tick', { stats });
    } catch (err) {
      logger.warn({ err: err.message }, '[socket] dashboard:tick failed');
    }
  }, env.DASHBOARD_TICK_MS);
  dashboardTimer.unref();
}

function stopDashboardTicker() {
  if (dashboardTimer) {
    clearInterval(dashboardTimer);
    dashboardTimer = null;
  }
}

/** Creates the Socket.IO server, wires auth + rooms + handlers, returns io. */
function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGINS, credentials: true },
    // Default path '/socket.io' per the contract.
    pingTimeout: 25000,
    pingInterval: 20000,
    maxHttpBufferSize: 1e6,
  });

  setIO(io);
  io.use(authenticate);

  io.on('connection', (socket) => {
    const { userId, role, trainerId, name } = socket.data;
    const joined = roomsFor(socket.data);
    joined.forEach((r) => socket.join(r));

    socket.emit('connected', { userId, role, rooms: joined });
    attach(socket);

    // Presence: tell the client's coach they came online.
    if (markOnline(userId) && role === 'client' && trainerId) {
      emitToCoach(trainerId, 'presence:update', { userId, online: true, name });
    }

    logger.info({ userId, role, sid: socket.id, rooms: joined.length }, '[socket] connected');

    socket.on('disconnect', (reason) => {
      if (markOffline(userId) && role === 'client' && trainerId) {
        emitToCoach(trainerId, 'presence:update', { userId, online: false, name });
      }
      logger.info({ userId, sid: socket.id, reason }, '[socket] disconnected');
    });

    socket.on('error', (err) => {
      logger.warn({ userId, sid: socket.id, err: err && err.message }, '[socket] error');
    });
  });

  startDashboardTicker();
  logger.info({ origins: env.CORS_ORIGINS }, '[socket] Socket.IO ready on /socket.io');
  return io;
}

/** Closes every socket and stops the ticker (graceful shutdown). */
async function closeSocket() {
  stopDashboardTicker();
  const { getIO } = require('./emit');
  const io = getIO();
  if (!io) return;
  await new Promise((resolve) => {
    io.close(() => resolve());
  });
  presence.clear();
  logger.info('[socket] closed');
}

module.exports = { initSocket, closeSocket, isOnline, presence, roomsFor, startDashboardTicker, stopDashboardTicker };
