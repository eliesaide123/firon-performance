'use strict';

const logger = require('../utils/logger');
const notificationService = require('../services/notificationService');
const { rooms } = require('./emit');

/**
 * The client -> server handler table (CONTRACT §6).
 * Each entry is `(socket, payload, ack) => Promise<void>`; `ack` is always
 * called exactly once, with `{ ok: false, error }` on failure so a buggy
 * client never hangs waiting.
 */
const handlers = {
  /* { locale, platform } -> { ok, count } */
  'content:subscribe': async (socket, payload = {}, ack) => {
    const locale = payload.locale || 'en';
    const platform = payload.platform || 'mobile';

    // Leave any previously-joined content room so a locale switch is clean.
    [...socket.rooms]
      .filter((r) => r.startsWith('content:') && r !== rooms.content(locale))
      .forEach((r) => socket.leave(r));
    socket.join(rooms.content(locale));

    const { Content } = require('../models');
    const count = await Content.countDocuments({
      locale,
      isPublished: true,
      ...(platform === 'all' ? {} : { platform: { $in: [platform, 'both'] } }),
    });
    ack({ ok: true, count, room: rooms.content(locale) });
  },

  /* { id } -> { ok, unread } */
  'notification:read': async (socket, payload = {}, ack) => {
    const result = await notificationService.markRead(socket.data.userId, payload.id);
    if (!result) return ack({ ok: false, error: 'NOTIFICATION_NOT_FOUND' });
    return ack({ ok: true, unread: result.unread });
  },

  /* -> { ok, unread: 0 } */
  'notification:read-all': async (socket, payload, ack) => {
    const result = await notificationService.markAllRead(socket.data.userId);
    ack({ ok: true, unread: result.unread });
  },

  /* { videoId, progress } -> { ok } */
  'progress:video': async (socket, payload = {}, ack) => {
    const progress = Math.max(0, Math.min(1, Number(payload.progress) || 0));
    if (!payload.videoId) return ack({ ok: false, error: 'VIDEO_ID_REQUIRED' });

    const { VideoProgress } = require('../models');
    await VideoProgress.findOneAndUpdate(
      { userId: socket.data.userId, videoId: payload.videoId },
      { $set: { progress, lastWatchedAt: new Date() }, $setOnInsert: { favorite: false } },
      { upsert: true, setDefaultsOnInsert: true },
    );
    return ack({ ok: true, videoId: String(payload.videoId), progress });
  },

  /* -> { ok, ts } */
  'ping:presence': async (socket, payload, ack) => {
    socket.data.lastSeen = Date.now();
    ack({ ok: true, ts: socket.data.lastSeen });
  },
};

/** Wires every handler onto a freshly-connected socket. */
function attach(socket) {
  Object.entries(handlers).forEach(([event, fn]) => {
    socket.on(event, async (payload, cb) => {
      const ack = typeof payload === 'function' ? payload : cb;
      const body = typeof payload === 'function' ? {} : payload;
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        await fn(socket, body || {}, reply);
      } catch (err) {
        logger.warn({ event, err: err.message, userId: socket.data.userId }, '[socket] handler failed');
        reply({ ok: false, error: err.code || 'HANDLER_ERROR', message: err.message });
      }
    });
  });
}

module.exports = { handlers, attach };
