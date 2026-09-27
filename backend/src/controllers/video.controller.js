'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/respond');
const { parsePagination, pageMeta } = require('../utils/pagination');
const { escapeRegex, durationLabel, labelToSeconds } = require('../utils/text');
const videoService = require('../services/videoService');
const planService = require('../services/planService');
const { emitAll } = require('../realtime/emit');

const MEDIA_POP = 'kind status url thumbnailUrl durationSec';

/**
 * Non-admin callers only ever see published videos whose attached media is
 * approved (CONTRACT §4.4: "Clients only ever see approved").
 */
async function visibilityFilter(req) {
  const isAdmin = req.user && req.user.role === 'admin';
  if (isAdmin && req.query.includeUnpublished) return {};

  const { MediaAsset } = require('../models');
  const approved = await MediaAsset.find({ status: 'approved' }).select('_id').lean();
  const approvedIds = approved.map((m) => m._id);

  return {
    isPublished: true,
    // A video with no attached media asset is fine (gradient placeholder);
    // one WITH a media asset must have an approved one.
    $or: [
      { videoMediaId: { $in: approvedIds } },
      { videoMediaId: { $exists: false } },
      { videoMediaId: null },
    ],
  };
}

async function buildQuery(req) {
  const filter = { ...(await visibilityFilter(req)) };
  if (req.query.categoryId) filter.categoryId = req.query.categoryId;
  else if (req.query.category && req.query.category !== 'All') {
    // Match the denormalised category name case-insensitively, so ?category=core finds "Core".
    filter.category = new RegExp(`^${escapeRx(req.query.category)}$`, 'i');
  }
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    const search = [{ title: rx }, { description: rx }, { category: rx }, { tags: rx }];
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: search }];
      delete filter.$or;
    } else {
      filter.$or = search;
    }
  }
  return filter;
}

const SORTS = {
  order: { order: 1, createdAt: -1 },
  newest: { publishedAt: -1, createdAt: -1 },
  title: { title: 1 },
};

/* GET /api/videos */
exports.list = asyncHandler(async (req, res) => {
  const { Video } = require('../models');
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50 });
  const filter = await buildQuery(req);

  // ?favorite=true is a per-caller filter, so it has to be applied after the
  // progress rows are merged in.
  const wantFavorites = req.query.favorite === true || req.query.favorite === 'true';

  if (wantFavorites) {
    if (!req.user) throw new ApiError(401, 'NO_TOKEN', 'Sign in to see your favorites');
    const { VideoProgress } = require('../models');
    const favs = await VideoProgress.find({ userId: req.user._id, favorite: true }).select('videoId').lean();
    filter._id = { $in: favs.map((f) => f.videoId) };
  }

  const [rows, total] = await Promise.all([
    Video.find(filter)
      .populate('videoMediaId', MEDIA_POP)
      .populate('thumbnailMediaId', MEDIA_POP)
      .populate('categoryId', 'name slug')
      .sort(SORTS[req.query.sort] || SORTS.order)
      .skip(skip)
      .limit(limit),
    Video.countDocuments(filter),
  ]);

  const progress = await videoService.progressMapFor(
    req.user && req.user._id,
    rows.map((r) => r._id),
  );

  return ok(
    res,
    rows.map((r) => videoService.serialiseVideo(req, r, progress)),
    pageMeta({ page, limit }, total),
  );
});

/**
 * GET /api/videos/suggested
 * Reproduces the prototype's suggested(): videos the caller has NOT started,
 * falling back to the whole library when they've started everything; 3 items,
 * each with the exact `why` reason string.
 */
exports.suggested = asyncHandler(async (req, res) => {
  const { Video, TrainingPlan, VideoProgress } = require('../models');
  const filter = await visibilityFilter(req);
  const limit = Math.min(parseInt(req.query.limit, 10) || 3, 20);

  const rows = await Video.find(filter)
    .populate('videoMediaId', MEDIA_POP)
    .populate('thumbnailMediaId', MEDIA_POP)
    .populate('categoryId', 'name slug')
    .sort(SORTS.order);

  const progress = await videoService.progressMapFor(req.user && req.user._id, rows.map((r) => r._id));

  const all = rows.map((r) => videoService.serialiseVideo(req, r, progress));
  const fresh = all.filter((v) => !v.progress);
  const pool = fresh.length ? fresh : all;

  // Reason strings are personalised with the caller's coach + current day title.
  let coachName = 'Sara';
  let planTitle = 'Lower Body';
  if (req.user && req.user.role === 'client') {
    const trainerId = req.user.clientProfile && req.user.clientProfile.trainerId;
    if (trainerId) {
      const { User } = require('../models');
      const coach = await User.findById(trainerId).select('name').lean();
      if (coach) [coachName] = String(coach.name || 'Sara').split(' ');
    }
    const plan = await TrainingPlan.findOne({ clientId: req.user._id, status: 'active' }).lean();
    const day = planService.currentDay(plan);
    if (day && day.title) planTitle = day.title.replace(/\s+(strength|hiit)$/i, '');
  }

  // Touch VideoProgress so a client with zero rows still gets a stable order.
  if (req.user && !Object.keys(progress).length) {
    await VideoProgress.countDocuments({ userId: req.user._id });
  }

  const data = pool
    .slice(0, limit)
    .map((v) => ({ ...v, why: videoService.whyFor(v, { coachName, planTitle }) }));

  return ok(res, data, { count: data.length, source: fresh.length ? 'not-started' : 'library' });
});

/* GET /api/videos/continue-watching */
exports.continueWatching = asyncHandler(async (req, res) => {
  const { Video, VideoProgress } = require('../models');
  const rows = await VideoProgress.find({
    userId: req.user._id,
    progress: { $gt: 0, $lt: 1 },
  })
    .sort({ lastWatchedAt: -1, updatedAt: -1 })
    .limit(Math.min(parseInt(req.query.limit, 10) || 10, 50))
    .lean();

  if (!rows.length) return ok(res, [], { count: 0 });

  const ids = rows.map((r) => r.videoId);
  const filter = { _id: { $in: ids }, ...(await visibilityFilter(req)) };
  const videos = await Video.find(filter)
    .populate('videoMediaId', MEDIA_POP)
    .populate('thumbnailMediaId', MEDIA_POP)
    .populate('categoryId', 'name slug');

  const progress = {};
  rows.forEach((r) => { progress[String(r.videoId)] = r; });

  // Preserve the most-recently-watched ordering.
  const byId = {};
  videos.forEach((v) => { byId[String(v._id)] = v; });
  const ordered = ids.map((id) => byId[String(id)]).filter(Boolean);

  return ok(
    res,
    ordered.map((v) => videoService.serialiseVideo(req, v, progress)),
    { count: ordered.length },
  );
});

/* GET /api/videos/:id */
exports.get = asyncHandler(async (req, res) => {
  const { Video } = require('../models');
  const doc = await Video.findById(req.params.id)
    .populate('videoMediaId', MEDIA_POP)
    .populate('thumbnailMediaId', MEDIA_POP)
    .populate('categoryId', 'name slug');
  if (!doc) throw new ApiError(404, 'VIDEO_NOT_FOUND', 'That video does not exist');

  const isAdmin = req.user && req.user.role === 'admin';
  if (!isAdmin) {
    if (!doc.isPublished) throw new ApiError(404, 'VIDEO_NOT_FOUND', 'That video does not exist');
    const media = doc.videoMediaId;
    if (media && media.status && media.status !== 'approved') {
      throw new ApiError(403, 'MEDIA_NOT_APPROVED', 'That video is still under review');
    }
  }

  const progress = await videoService.progressMapFor(req.user && req.user._id, [doc._id]);
  return ok(res, videoService.serialiseVideo(req, doc, progress));
});

/* POST /api/videos/:id/progress */
exports.saveProgress = asyncHandler(async (req, res) => {
  const { Video, VideoProgress } = require('../models');
  const video = await Video.findById(req.params.id).select('_id title');
  if (!video) throw new ApiError(404, 'VIDEO_NOT_FOUND', 'That video does not exist');

  const update = {
    progress: req.body.progress,
    lastWatchedAt: new Date(),
  };
  if (req.body.secondsWatched !== undefined) update.secondsWatched = req.body.secondsWatched;

  const row = await VideoProgress.findOneAndUpdate(
    { userId: req.user._id, videoId: video._id },
    { $set: update, $setOnInsert: { favorite: false } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();

  return ok(res, {
    videoId: String(video._id),
    progress: row.progress,
    favorite: !!row.favorite,
    secondsWatched: row.secondsWatched || 0,
  });
});

/* POST /api/videos/:id/favorite — toggles unless { favorite } is given */
exports.toggleFavorite = asyncHandler(async (req, res) => {
  const { Video, VideoProgress } = require('../models');
  const video = await Video.findById(req.params.id).select('_id title');
  if (!video) throw new ApiError(404, 'VIDEO_NOT_FOUND', 'That video does not exist');

  const existing = await VideoProgress.findOne({ userId: req.user._id, videoId: video._id });
  const explicit = req.body && typeof req.body.favorite === 'boolean' ? req.body.favorite : null;
  const favorite = explicit !== null ? explicit : !(existing && existing.favorite);

  const row = await VideoProgress.findOneAndUpdate(
    { userId: req.user._id, videoId: video._id },
    { $set: { favorite }, $setOnInsert: { progress: 0 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();

  return ok(res, { videoId: String(video._id), favorite: !!row.favorite, progress: row.progress || 0 });
});

/* -------------------------------------------------- admin write */

async function syncCategoryName(body) {
  if (!body.categoryId) return body;
  const { Category } = require('../models');
  const cat = await Category.findById(body.categoryId).select('name').lean();
  if (cat) return { ...body, category: cat.name };
  return body;
}

function syncDuration(body) {
  const out = { ...body };
  if (out.durationSec && !out.durationLabel) out.durationLabel = durationLabel(out.durationSec);
  if (out.durationLabel && !out.durationSec) out.durationSec = labelToSeconds(out.durationLabel);
  return out;
}

/* POST /api/videos (admin) -> video:created */
exports.create = asyncHandler(async (req, res) => {
  const { Video } = require('../models');
  const payload = syncDuration(await syncCategoryName(req.body));
  const doc = await Video.create({
    ...payload,
    createdBy: req.user._id,
    publishedAt: payload.isPublished === false ? undefined : new Date(),
  });
  await doc.populate([
    { path: 'videoMediaId', select: MEDIA_POP },
    { path: 'thumbnailMediaId', select: MEDIA_POP },
    { path: 'categoryId', select: 'name slug' },
  ]);

  const video = videoService.serialiseVideo(req, doc, {});
  emitAll('video:created', { video });
  return created(res, video);
});

/* PUT /api/videos/:id (admin) -> video:updated */
exports.update = asyncHandler(async (req, res) => {
  const { Video } = require('../models');
  const doc = await Video.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'VIDEO_NOT_FOUND', 'That video does not exist');

  const payload = syncDuration(await syncCategoryName(req.body));
  const wasPublished = doc.isPublished;
  Object.entries(payload).forEach(([k, v]) => { doc[k] = v; });
  if (!wasPublished && doc.isPublished && !doc.publishedAt) doc.publishedAt = new Date();
  await doc.save();
  await doc.populate([
    { path: 'videoMediaId', select: MEDIA_POP },
    { path: 'thumbnailMediaId', select: MEDIA_POP },
    { path: 'categoryId', select: 'name slug' },
  ]);

  const video = videoService.serialiseVideo(req, doc, {});
  emitAll('video:updated', { video });
  return ok(res, video);
});

/* DELETE /api/videos/:id (admin) -> video:deleted */
exports.remove = asyncHandler(async (req, res) => {
  const { Video, VideoProgress } = require('../models');
  const doc = await Video.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'VIDEO_NOT_FOUND', 'That video does not exist');
  await doc.deleteOne();
  await VideoProgress.deleteMany({ videoId: req.params.id });

  emitAll('video:deleted', { id: String(req.params.id) });
  return ok(res, { deleted: true, id: String(req.params.id) });
});

/** Escape a user-supplied string for safe use inside a RegExp. */
function escapeRx(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
