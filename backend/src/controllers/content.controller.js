'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/respond');
const { parsePagination, pageMeta } = require('../utils/pagination');
const { escapeRegex } = require('../utils/text');
const contentService = require('../services/contentService');
const notificationService = require('../services/notificationService');
const { emitToContent, emitToRole } = require('../realtime/emit');

const MEDIA_SELECT = 'title kind url thumbnailUrl status durationSec';

function buildFilter(query, { isAdmin = false } = {}) {
  const filter = {};
  const locale = query.locale || 'en';
  filter.locale = locale;

  if (query.platform && query.platform !== 'all') {
    // 'both' entries are always included for a specific platform request.
    filter.platform = query.platform === 'both' ? 'both' : { $in: [query.platform, 'both'] };
  }
  if (query.group) filter.group = query.group;
  if (query.screen) filter.screen = query.screen;
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ key: rx }, { label: rx }, { description: rx }];
  }
  // Only the CMS (admin) may ask for unpublished entries.
  const wantUnpublished = isAdmin && query.includeUnpublished === 'true';
  if (!wantUnpublished) filter.isPublished = true;

  return { filter, locale };
}

/* GET /api/content — flat map by default, array with ?format=list */
exports.list = asyncHandler(async (req, res) => {
  const { Content } = require('../models');
  const isAdmin = req.user && req.user.role === 'admin';
  const { filter } = buildFilter(req.query, { isAdmin });

  const format = req.query.format || 'map';

  if (format === 'list') {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 500 });
    const [rows, total] = await Promise.all([
      Content.find(filter)
        .populate('mediaId', MEDIA_SELECT)
        .sort({ group: 1, key: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Content.countDocuments(filter),
    ]);
    return ok(res, rows.map((r) => contentService.toListItem(req, r)), pageMeta({ page, limit }, total));
  }

  const rows = await Content.find(filter).populate('mediaId', MEDIA_SELECT).lean();
  return ok(res, contentService.toMap(req, rows), { count: rows.length, format: 'map' });
});

/* GET /api/content/groups */
exports.groups = asyncHandler(async (req, res) => {
  const { Content } = require('../models');
  const match = { locale: req.query.locale || 'en' };
  if (req.query.platform && req.query.platform !== 'all') {
    match.platform = { $in: [req.query.platform, 'both'] };
  }
  const rows = await Content.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $ifNull: ['$group', 'ungrouped'] },
        count: { $sum: 1 },
        screens: { $addToSet: '$screen' },
        published: { $sum: { $cond: ['$isPublished', 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return ok(res, rows.map((r) => ({
    group: r._id,
    count: r.count,
    published: r.published,
    screens: (r.screens || []).filter(Boolean).sort(),
  })));
});

/* GET /api/content/:key */
exports.getByKey = asyncHandler(async (req, res) => {
  const { Content } = require('../models');
  const locale = req.query.locale || 'en';
  const doc = await Content.findOne({ key: req.params.key, locale }).populate('mediaId', MEDIA_SELECT);
  if (!doc) throw new ApiError(404, 'CONTENT_NOT_FOUND', `No content for key '${req.params.key}'`);
  return ok(res, contentService.toListItem(req, doc));
});

/* POST /api/content (admin) */
exports.create = asyncHandler(async (req, res) => {
  const { Content } = require('../models');
  const payload = { ...req.body, updatedBy: req.user._id };
  const doc = await Content.create(payload);
  await doc.populate('mediaId', MEDIA_SELECT);

  emitToContent(doc.locale, 'content:updated', contentService.socketPayload(req, doc));
  await audit(req, 'content.create', doc, null, doc.toJSON());
  return created(res, contentService.toListItem(req, doc));
});

/* PUT /api/content/:id (admin) -> emits content:updated */
exports.update = asyncHandler(async (req, res) => {
  const { Content } = require('../models');
  const doc = await Content.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'CONTENT_NOT_FOUND', 'That content entry does not exist');

  const before = doc.toJSON();
  Object.entries(req.body).forEach(([k, v]) => { doc[k] = v; });
  doc.updatedBy = req.user._id;
  doc.version = (doc.version || 1) + 1;
  await doc.save();
  await doc.populate('mediaId', MEDIA_SELECT);

  emitToContent(doc.locale, 'content:updated', contentService.socketPayload(req, doc));
  await audit(req, 'content.update', doc, before, doc.toJSON());

  // Publishing a previously unpublished entry is worth telling the admins about.
  if (before.isPublished === false && doc.isPublished === true) {
    await notifyAdminsOfPublish(req, doc);
  }
  return ok(res, contentService.toListItem(req, doc));
});

/* PATCH /api/content/bulk (admin) -> emits content:bulk-updated */
exports.bulkUpdate = asyncHandler(async (req, res) => {
  const { Content } = require('../models');
  const locale = req.body.locale || 'en';
  const results = [];
  const missing = [];

  // Sequential on purpose: the list is small and we want per-key errors.
  for (const item of req.body.items) {
    // eslint-disable-next-line no-await-in-loop
    const doc = item.id
      ? await Content.findById(item.id)
      : await Content.findOne({ key: item.key, locale: item.locale || locale });
    if (!doc) { missing.push(item.key || item.id); continue; }

    if (item.value !== undefined) doc.value = item.value;
    if (item.mediaId !== undefined) doc.mediaId = item.mediaId || undefined;
    if (item.isPublished !== undefined) doc.isPublished = item.isPublished;
    doc.updatedBy = req.user._id;
    doc.version = (doc.version || 1) + 1;
    // eslint-disable-next-line no-await-in-loop
    await doc.save();
    // eslint-disable-next-line no-await-in-loop
    await doc.populate('mediaId', MEDIA_SELECT);
    results.push(contentService.socketPayload(req, doc));
  }

  if (results.length) {
    emitToContent(locale, 'content:bulk-updated', { items: results, count: results.length });
  }
  await audit(req, 'content.bulk', { _id: null }, null, { count: results.length });

  return ok(res, { items: results, count: results.length, missing }, { missing: missing.length });
});

/* DELETE /api/content/:id (admin) -> emits content:deleted */
exports.remove = asyncHandler(async (req, res) => {
  const { Content } = require('../models');
  const doc = await Content.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'CONTENT_NOT_FOUND', 'That content entry does not exist');
  const { key, locale } = doc;
  await doc.deleteOne();

  emitToContent(locale, 'content:deleted', { key, locale });
  await audit(req, 'content.delete', { _id: req.params.id }, doc.toJSON(), null);
  return ok(res, { deleted: true, key, locale });
});

/**
 * POST /api/content/seed-defaults (admin)
 * Re-inserts any DEFAULT key that is missing, never overwriting edited ones.
 * The defaults live in the DATABASE agent's seed module; if it is not present
 * we say so rather than silently doing nothing.
 */
exports.seedDefaults = asyncHandler(async (req, res) => {
  const { Content } = require('../models');
  let defaults = null;
  const candidates = ['../seed/contentDefaults', '../seed/content', '../seed/data/content'];
  for (const p of candidates) {
    try {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      const mod = require(p);
      defaults = mod.contentDefaults || mod.defaults || mod.CONTENT_DEFAULTS || (Array.isArray(mod) ? mod : null);
      if (defaults) break;
    } catch (_err) { /* try the next candidate */ }
  }
  if (!defaults || !defaults.length) {
    throw new ApiError(
      501,
      'NO_CONTENT_DEFAULTS',
      'No default content set is available on the server (expected src/seed/contentDefaults.js exporting an array)',
    );
  }

  const locale = req.body.locale || 'en';
  const existing = new Set(
    (await Content.find({ locale }).select('key').lean()).map((r) => r.key),
  );
  const toInsert = defaults
    .filter((d) => !existing.has(d.key))
    .map((d) => ({ ...d, locale, updatedBy: req.user._id }));

  if (toInsert.length) await Content.insertMany(toInsert, { ordered: false });

  if (toInsert.length) {
    const docs = await Content.find({ locale, key: { $in: toInsert.map((d) => d.key) } }).lean();
    emitToContent(locale, 'content:bulk-updated', {
      items: docs.map((d) => contentService.socketPayload(req, d)),
      count: docs.length,
    });
  }

  return ok(res, {
    inserted: toInsert.length,
    skipped: defaults.length - toInsert.length,
    keys: toInsert.map((d) => d.key),
  });
});

/* -------------------------------------------------------- helpers */

async function notifyAdminsOfPublish(req, doc) {
  const { User } = require('../models');
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id').lean();
  emitToRole('admin', 'content:updated', contentService.socketPayload(req, doc));
  await notificationService.notifyMany(admins.map((a) => a._id), {
    type: 'content_updated',
    title: 'Content published',
    body: `'${doc.label || doc.key}' is now live on ${doc.platform}.`,
    data: { key: doc.key, locale: doc.locale },
    deepLink: `/content?key=${encodeURIComponent(doc.key)}`,
  });
}

/** Best-effort audit trail; never fails the request. */
async function audit(req, action, doc, before, after) {
  try {
    const { AuditLog } = require('../models');
    if (!AuditLog) return;
    await AuditLog.create({
      userId: req.user && req.user._id,
      action,
      entity: 'Content',
      entityId: doc && doc._id ? String(doc._id) : undefined,
      before,
      after,
      ip: req.ip,
    });
  } catch (_err) { /* auditing must never break a request */ }
}

exports._audit = audit;
