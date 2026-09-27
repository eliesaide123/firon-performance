'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/respond');
const { parsePagination, pageMeta } = require('../utils/pagination');
const { escapeRegex, slugify } = require('../utils/text');
const { absoluteUrl } = require('../utils/urls');

function serialise(req, doc) {
  const o = typeof doc.toJSON === 'function' ? doc.toJSON() : { ...doc };
  if (o._id && !o.id) { o.id = String(o._id); delete o._id; }
  delete o.__v;
  if (doc.demoMediaId && typeof doc.demoMediaId === 'object') {
    o.demoMediaId = String(doc.demoMediaId._id || doc.demoMediaId.id);
    o.demoUrl = doc.demoMediaId.url ? absoluteUrl(req, doc.demoMediaId.url) : null;
    o.demoThumbnailUrl = doc.demoMediaId.thumbnailUrl ? absoluteUrl(req, doc.demoMediaId.thumbnailUrl) : null;
    o.demoStatus = doc.demoMediaId.status;
  } else {
    o.demoUrl = null;
  }
  return o;
}

/* GET /api/exercises?q= */
exports.list = asyncHandler(async (req, res) => {
  const { Exercise } = require('../models');
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 100 });

  const filter = {};
  const isStaff = req.user && (req.user.role === 'admin' || req.user.role === 'trainer');
  if (!(isStaff && req.query.includeInactive === 'true')) filter.isActive = { $ne: false };
  if (req.query.muscleGroup) filter.muscleGroup = req.query.muscleGroup;
  if (req.query.equipment) filter.equipment = req.query.equipment;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ name: rx }, { muscleGroup: rx }, { equipment: rx }, { type: rx }];
  }

  const [rows, total] = await Promise.all([
    Exercise.find(filter).populate('demoMediaId', 'url thumbnailUrl status kind').sort({ name: 1 }).skip(skip).limit(limit),
    Exercise.countDocuments(filter),
  ]);
  return ok(res, rows.map((r) => serialise(req, r)), pageMeta({ page, limit }, total));
});

/* GET /api/exercises/:id */
exports.get = asyncHandler(async (req, res) => {
  const { Exercise } = require('../models');
  const doc = await Exercise.findById(req.params.id).populate('demoMediaId', 'url thumbnailUrl status kind');
  if (!doc) throw new ApiError(404, 'EXERCISE_NOT_FOUND', 'That exercise does not exist');
  return ok(res, serialise(req, doc));
});

/* POST /api/exercises (trainer/admin) */
exports.create = asyncHandler(async (req, res) => {
  const { Exercise } = require('../models');
  const doc = await Exercise.create({
    ...req.body,
    slug: req.body.slug || slugify(req.body.name),
    createdBy: req.user._id,
  });
  return created(res, serialise(req, doc));
});

/* PUT /api/exercises/:id (trainer/admin) */
exports.update = asyncHandler(async (req, res) => {
  const { Exercise } = require('../models');
  const doc = await Exercise.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'EXERCISE_NOT_FOUND', 'That exercise does not exist');

  // A trainer may only edit an exercise they created; admins edit anything.
  if (req.user.role === 'trainer' && doc.createdBy && String(doc.createdBy) !== String(req.user._id)) {
    throw new ApiError(403, 'FORBIDDEN', 'Only an admin can edit a shared library exercise');
  }

  Object.entries(req.body).forEach(([k, v]) => { doc[k] = v; });
  if (req.body.name && !req.body.slug) doc.slug = slugify(req.body.name);
  await doc.save();
  await doc.populate('demoMediaId', 'url thumbnailUrl status kind');
  return ok(res, serialise(req, doc));
});

/* DELETE /api/exercises/:id (trainer/admin) */
exports.remove = asyncHandler(async (req, res) => {
  const { Exercise } = require('../models');
  const doc = await Exercise.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'EXERCISE_NOT_FOUND', 'That exercise does not exist');
  if (req.user.role === 'trainer' && doc.createdBy && String(doc.createdBy) !== String(req.user._id)) {
    throw new ApiError(403, 'FORBIDDEN', 'Only an admin can delete a shared library exercise');
  }
  // Soft-delete: plans reference exercises by id.
  doc.isActive = false;
  await doc.save();
  return ok(res, { deleted: true, deactivated: true, id: String(doc._id) });
});
