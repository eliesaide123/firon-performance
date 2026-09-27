'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/respond');
const { slugify } = require('../utils/text');
const { emitAll } = require('../realtime/emit');

const clean = (doc) => {
  const o = typeof doc.toJSON === 'function' ? doc.toJSON() : { ...doc };
  if (o._id && !o.id) { o.id = String(o._id); delete o._id; }
  delete o.__v;
  return o;
};

/* GET /api/categories */
exports.list = asyncHandler(async (req, res) => {
  const { Category } = require('../models');
  const filter = {};
  if (req.query.kind && req.query.kind !== 'all') filter.kind = req.query.kind;
  const isAdmin = req.user && req.user.role === 'admin';
  if (!(isAdmin && req.query.includeInactive === 'true')) filter.isActive = true;

  const rows = await Category.find(filter).sort({ order: 1, name: 1 }).lean();
  return ok(res, rows.map(clean));
});

/* POST /api/categories (admin) */
exports.create = asyncHandler(async (req, res) => {
  const { Category } = require('../models');
  const doc = await Category.create({ ...req.body, slug: req.body.slug || slugify(req.body.name) });
  emitAll('category:changed', { action: 'created', category: clean(doc) });
  return created(res, clean(doc));
});

/* PUT /api/categories/:id (admin) */
exports.update = asyncHandler(async (req, res) => {
  const { Category } = require('../models');
  const doc = await Category.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'That category does not exist');

  const previousName = doc.name;
  Object.entries(req.body).forEach(([k, v]) => { doc[k] = v; });
  if (req.body.name && !req.body.slug) doc.slug = slugify(req.body.name);
  await doc.save();

  // Keep the denormalised Video.category in sync with a rename.
  if (req.body.name && req.body.name !== previousName) {
    const { Video } = require('../models');
    await Video.updateMany({ categoryId: doc._id }, { category: doc.name });
  }

  emitAll('category:changed', { action: 'updated', category: clean(doc) });
  return ok(res, clean(doc));
});

/* DELETE /api/categories/:id (admin) */
exports.remove = asyncHandler(async (req, res) => {
  const { Category, Video } = require('../models');
  const doc = await Category.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'That category does not exist');

  const inUse = await Video.countDocuments({ categoryId: doc._id });
  if (inUse > 0) {
    // Soft-delete: keeps existing videos renderable while hiding the chip.
    doc.isActive = false;
    await doc.save();
    emitAll('category:changed', { action: 'deactivated', category: clean(doc) });
    return ok(res, { deleted: false, deactivated: true, videosUsing: inUse, ...clean(doc) });
  }

  await doc.deleteOne();
  emitAll('category:changed', { action: 'deleted', category: { id: String(req.params.id) } });
  return ok(res, { deleted: true, id: String(req.params.id) });
});
