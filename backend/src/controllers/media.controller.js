'use strict';

const fs = require('fs');
const path = require('path');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/respond');
const { parsePagination, pageMeta } = require('../utils/pagination');
const { escapeRegex, durationLabel } = require('../utils/text');
const { withAbsoluteMedia } = require('../utils/urls');
const { kindFromMime, cleanupFile } = require('../middleware/upload');
const { env } = require('../config');
const logger = require('../utils/logger');
const notificationService = require('../services/notificationService');
const { emitToRole, emitToUser } = require('../realtime/emit');

function serialise(req, doc) {
  const o = withAbsoluteMedia(req, doc);
  if (o._id && !o.id) { o.id = String(o._id); delete o._id; }
  delete o.__v;
  if (o.uploadedBy && typeof o.uploadedBy === 'object') {
    o.uploader = { id: String(o.uploadedBy._id || o.uploadedBy.id), name: o.uploadedBy.name, role: o.uploadedBy.role };
    o.uploadedBy = o.uploader.id;
  }
  if (o.durationSec && !o.durationLabel) o.durationLabel = durationLabel(o.durationSec);
  return o;
}

/* GET /api/media (admin + trainer) */
exports.list = asyncHandler(async (req, res) => {
  const { MediaAsset } = require('../models');
  const { page, limit, skip } = parsePagination(req.query);

  const filter = {};
  if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
  if (req.query.kind && req.query.kind !== 'all') filter.kind = req.query.kind;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ title: rx }, { description: rx }, { originalName: rx }, { tags: rx }];
  }
  // A trainer only ever sees their own uploads through this endpoint.
  if (req.user.role === 'trainer') filter.uploadedBy = req.user._id;
  else if (req.query.uploadedBy) filter.uploadedBy = req.query.uploadedBy;

  const [rows, total] = await Promise.all([
    MediaAsset.find(filter)
      .populate('uploadedBy', 'name role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    MediaAsset.countDocuments(filter),
  ]);

  return ok(res, rows.map((r) => serialise(req, r)), pageMeta({ page, limit }, total));
});

/* GET /api/media/mine (trainer's own uploads) */
exports.mine = asyncHandler(async (req, res) => {
  const { MediaAsset } = require('../models');
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { uploadedBy: req.user._id };
  if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;

  const [rows, total] = await Promise.all([
    MediaAsset.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    MediaAsset.countDocuments(filter),
  ]);
  return ok(res, rows.map((r) => serialise(req, r)), pageMeta({ page, limit }, total));
});

/* GET /api/media/:id */
exports.get = asyncHandler(async (req, res) => {
  const { MediaAsset } = require('../models');
  const doc = await MediaAsset.findById(req.params.id).populate('uploadedBy', 'name role');
  if (!doc) throw new ApiError(404, 'MEDIA_NOT_FOUND', 'That media asset does not exist');

  const isOwner = String(doc.uploadedBy && (doc.uploadedBy._id || doc.uploadedBy)) === String(req.user._id);
  if (req.user.role === 'client' && doc.status !== 'approved') {
    throw new ApiError(403, 'FORBIDDEN', 'That media is not available');
  }
  if (req.user.role === 'trainer' && !isOwner && doc.status !== 'approved') {
    throw new ApiError(403, 'FORBIDDEN', 'That media is not available');
  }
  return ok(res, serialise(req, doc));
});

/**
 * POST /api/media/upload  (multipart, field `file`)
 * trainer -> pending (+ media:pending to role:admin)
 * admin   -> approved immediately
 */
exports.upload = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'NO_FILE', "Attach a file under the field name 'file'");

  const { MediaAsset } = require('../models');
  const isAdmin = req.user.role === 'admin';
  const kind = req.body.kind || kindFromMime(req.file.mimetype);

  let tags = req.body.tags || [];
  if (typeof tags === 'string') tags = tags.split(',').map((t) => t.trim()).filter(Boolean);

  try {
    const doc = await MediaAsset.create({
      title: req.body.title,
      description: req.body.description,
      kind,
      category: req.body.category,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      durationSec: req.body.durationSec,
      width: req.body.width,
      height: req.body.height,
      url: `${env.UPLOAD_ROUTE}/${req.file.filename}`,
      status: isAdmin ? 'approved' : 'pending',
      reviewedBy: isAdmin ? req.user._id : undefined,
      reviewedAt: isAdmin ? new Date() : undefined,
      uploadedBy: req.user._id,
      tags,
    });

    if (!isAdmin) {
      // CONTRACT §6: notify every admin there is something to review.
      emitToRole('admin', 'media:pending', {
        id: String(doc._id),
        title: doc.title,
        uploadedBy: { id: String(req.user._id), name: req.user.name },
      });
      const { User } = require('../models');
      const admins = await User.find({ role: 'admin', isActive: true }).select('_id').lean();
      await notificationService.notifyMany(admins.map((a) => a._id), {
        type: 'generic',
        title: 'New media awaiting review',
        body: `${req.user.name} uploaded '${doc.title}'.`,
        data: { mediaId: String(doc._id) },
        deepLink: `/media?status=pending&id=${doc._id}`,
      });
    } else {
      emitToRole('admin', 'media:status', {
        id: String(doc._id), status: doc.status, title: doc.title,
      });
    }

    logger.info({ mediaId: String(doc._id), status: doc.status, by: String(req.user._id) }, '[media] uploaded');
    return created(res, serialise(req, doc));
  } catch (err) {
    cleanupFile(req.file);
    throw err;
  }
});

/* PATCH /api/media/:id/approve (admin) */
exports.approve = asyncHandler(async (req, res) => {
  const { MediaAsset } = require('../models');
  const doc = await MediaAsset.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'MEDIA_NOT_FOUND', 'That media asset does not exist');

  doc.status = 'approved';
  doc.reviewedBy = req.user._id;
  doc.reviewedAt = new Date();
  doc.rejectionReason = undefined;
  await doc.save();

  const payload = { id: String(doc._id), status: 'approved', title: doc.title };
  emitToUser(doc.uploadedBy, 'media:status', payload);
  emitToRole('admin', 'media:status', payload);

  await notificationService.notify(doc.uploadedBy, {
    type: 'media_approved',
    title: 'Upload approved',
    body: `'${doc.title}' is approved and live.`,
    data: { mediaId: String(doc._id) },
    deepLink: `firon://uploads/${doc._id}`,
  });

  return ok(res, serialise(req, doc));
});

/* PATCH /api/media/:id/reject (admin, { reason }) */
exports.reject = asyncHandler(async (req, res) => {
  const { MediaAsset } = require('../models');
  const doc = await MediaAsset.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'MEDIA_NOT_FOUND', 'That media asset does not exist');

  doc.status = 'rejected';
  doc.reviewedBy = req.user._id;
  doc.reviewedAt = new Date();
  doc.rejectionReason = req.body.reason;
  await doc.save();

  const payload = { id: String(doc._id), status: 'rejected', title: doc.title, reason: doc.rejectionReason };
  emitToUser(doc.uploadedBy, 'media:status', payload);
  emitToRole('admin', 'media:status', payload);

  await notificationService.notify(doc.uploadedBy, {
    type: 'media_rejected',
    title: 'Upload needs changes',
    body: `'${doc.title}' was rejected: ${doc.rejectionReason}`,
    data: { mediaId: String(doc._id), reason: doc.rejectionReason },
    deepLink: `firon://uploads/${doc._id}`,
  });

  return ok(res, serialise(req, doc));
});

/* DELETE /api/media/:id (admin) */
exports.remove = asyncHandler(async (req, res) => {
  const { MediaAsset } = require('../models');
  const doc = await MediaAsset.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'MEDIA_NOT_FOUND', 'That media asset does not exist');

  const uploader = doc.uploadedBy;
  const { filename, title } = doc;
  await doc.deleteOne();

  if (filename) {
    fs.unlink(path.join(env.UPLOAD_DIR, filename), (err) => {
      if (err && err.code !== 'ENOENT') logger.warn({ err: err.message, filename }, '[media] file unlink failed');
    });
  }

  const payload = { id: String(req.params.id), status: 'deleted', title };
  emitToUser(uploader, 'media:status', payload);
  emitToRole('admin', 'media:status', payload);

  return ok(res, { deleted: true, id: String(req.params.id) });
});

exports.serialise = serialise;
