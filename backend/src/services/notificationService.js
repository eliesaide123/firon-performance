'use strict';

const logger = require('../utils/logger');
const pushService = require('./pushService');
const { emitToUser, idOf } = require('../realtime/emit');

/**
 * The ONLY entry point controllers use for user-facing notifications.
 * One call fans out to all three channels (CONTRACT §7):
 *   1. persists a `Notification` document
 *   2. emits `notification:new` + `notification:count` over the socket (in-app)
 *   3. fires an FCM push (background / killed app) — fire-and-forget
 */
async function unreadCount(target) {
  const { Notification } = require('../models');
  return Notification.countDocuments({ userId: idOf(target), read: false });
}

/**
 * CONTRACT §6: `notification:count` must follow EVERY change to the unread total
 * (create, read, read-all, delete) so a second device never shows a stale badge.
 * Returns the count it emitted.
 */
async function emitCount(target) {
  const userId = idOf(target);
  if (!userId) return 0;
  const unread = await unreadCount(userId);
  emitToUser(userId, 'notification:count', { unread });
  return unread;
}

async function notify(target, { type = 'generic', title, body = '', data = {}, icon, deepLink } = {}) {
  // `target` may be an id, or a populated User doc handed straight from a query.
  const userId = idOf(target);
  if (!userId) return null;
  const { Notification } = require('../models');

  const doc = await Notification.create({
    userId,
    type,
    title,
    body,
    data,
    icon,
    deepLink: deepLink || (data && data.deepLink) || undefined,
  });

  const notification = doc.toJSON ? doc.toJSON() : doc;
  const unread = await unreadCount(userId);

  // (2) in-app realtime
  emitToUser(userId, 'notification:new', { notification });
  emitToUser(userId, 'notification:count', { unread });

  // (3) background push — never blocks or fails the request
  pushService
    .sendToUser(userId, {
      title,
      body,
      // §7: data always carries { type, deepLink, notificationId }
      data: { ...data, type, deepLink: notification.deepLink || '', notificationId: String(notification.id) },
      badge: unread,
    })
    .then((res) => {
      if (res && res.sent > 0) {
        Notification.updateOne({ _id: doc._id }, { deliveredPush: true }).catch(() => {});
      }
    })
    .catch((err) => logger.warn({ err: err.message, userId }, '[notify] push failed'));

  logger.debug({ userId, type, title }, '[notify] sent');
  return notification;
}

async function notifyMany(userIds = [], msg = {}) {
  const unique = [...new Set(userIds.map(idOf).filter(Boolean))];
  return Promise.all(unique.map((id) => notify(id, msg)));
}

/** Marks one notification read and re-syncs every device of that user. */
async function markRead(userId, notificationId) {
  const { Notification } = require('../models');
  const doc = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { read: true, readAt: new Date() },
    { new: true },
  );
  if (!doc) return null;
  const unread = await unreadCount(userId);
  emitToUser(userId, 'notification:read', { id: String(doc._id), unread });
  emitToUser(userId, 'notification:count', { unread });
  return { notification: doc.toJSON ? doc.toJSON() : doc, unread };
}

/** Deletes one notification and re-syncs the badge on every device of that user. */
async function remove(userId, notificationId) {
  const { Notification } = require('../models');
  const doc = await Notification.findOneAndDelete({ _id: notificationId, userId });
  if (!doc) return null;
  const unread = await emitCount(userId);
  return { id: String(doc._id), wasUnread: !doc.read, unread };
}

async function markAllRead(userId) {
  const { Notification } = require('../models');
  const res = await Notification.updateMany(
    { userId, read: false },
    { read: true, readAt: new Date() },
  );
  emitToUser(userId, 'notification:read', { id: null, unread: 0 });
  emitToUser(userId, 'notification:count', { unread: 0 });
  return { updated: res.modifiedCount || 0, unread: 0 };
}

module.exports = { notify, notifyMany, unreadCount, emitCount, markRead, markAllRead, remove };
