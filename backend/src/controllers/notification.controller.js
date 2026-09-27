'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/respond');
const { parsePagination, pageMeta } = require('../utils/pagination');
const notificationService = require('../services/notificationService');
const pushService = require('../services/pushService');

const clean = (doc) => {
  const o = typeof doc.toJSON === 'function' ? doc.toJSON() : { ...doc };
  if (o._id && !o.id) { o.id = String(o._id); delete o._id; }
  delete o.__v;
  return o;
};

/* GET /api/notifications?unread= */
exports.list = asyncHandler(async (req, res) => {
  const { Notification } = require('../models');
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 30 });

  const filter = { userId: req.user._id };
  if (req.query.unread === true || req.query.unread === 'true') filter.read = false;
  if (req.query.type) filter.type = req.query.type;

  const [rows, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    notificationService.unreadCount(req.user._id),
  ]);

  return ok(res, rows.map(clean), { ...pageMeta({ page, limit }, total), unread });
});

/* GET /api/notifications/unread-count */
exports.unreadCount = asyncHandler(async (req, res) => ok(res, {
  unread: await notificationService.unreadCount(req.user._id),
}));

/* PATCH /api/notifications/:id/read */
exports.markRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markRead(req.user._id, req.params.id);
  if (!result) throw new ApiError(404, 'NOTIFICATION_NOT_FOUND', 'That notification does not exist');
  return ok(res, result);
});

/* PATCH /api/notifications/read-all */
exports.markAllRead = asyncHandler(async (req, res) => ok(
  res,
  await notificationService.markAllRead(req.user._id),
));

/* DELETE /api/notifications/:id — the service emits `notification:count` (CONTRACT §6) */
exports.remove = asyncHandler(async (req, res) => {
  const result = await notificationService.remove(req.user._id, req.params.id);
  if (!result) throw new ApiError(404, 'NOTIFICATION_NOT_FOUND', 'That notification does not exist');
  return ok(res, { deleted: true, id: result.id, unread: result.unread });
});

/* POST /api/notifications/test (admin) — fires a real socket + push */
exports.test = asyncHandler(async (req, res) => {
  const { User } = require('../models');
  const targetId = req.body.userId || String(req.user._id);

  // The CMS form picks a user, so a bad/stale id must read as a 404, not a silent no-op.
  const target = await User.findById(targetId).select('_id name email role').lean();
  if (!target) throw new ApiError(404, 'USER_NOT_FOUND', 'That user does not exist');

  const notification = await notificationService.notify(target._id, {
    type: req.body.type || 'generic',
    title: req.body.title || 'Test notification',
    body: req.body.body || 'If you can read this, sockets and push are wired up.',
    data: req.body.data || { test: true },
    // Must be navigable by mobile/src/navigation/navigationRef.ts (CONTRACT §7).
    // Top-level wins; `data.deepLink` still accepted for older callers.
    deepLink: req.body.deepLink || (req.body.data && req.body.data.deepLink) || 'firon://notifications',
  });

  const { getIO, rooms } = require('../realtime/emit');
  const io = getIO();
  const room = io && io.sockets.adapter.rooms.get(rooms.user(target._id));

  return created(res, {
    notification,
    socketEmitted: true,
    /** How many of the target's devices were live on a socket when this was sent. */
    socketsReached: room ? room.size : 0,
    target: { id: String(target._id), name: target.name, email: target.email, role: target.role },
    pushEnabled: pushService.isEnabled(),
  });
});
