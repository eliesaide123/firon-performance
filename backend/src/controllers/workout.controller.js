'use strict';

/**
 * Workout history — backs the Train screen's "History" chip and the trainer's view of what a
 * client actually did (plan exercises plus anything they logged themselves).
 */

const { WorkoutLog, SessionRecord, User } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok } = require('../utils/respond');
const { parsePagination, pageMeta } = require('../utils/pagination');
const { todayKey } = require('../utils/text');

/**
 * Resolve whose logs the caller may read: their own by default, or a client's when a trainer
 * passes `?clientId=` and that client is actually theirs. Admins may read anyone's.
 */
async function resolveTargetUser(req) {
  const { clientId } = req.query;
  if (!clientId || String(clientId) === String(req.user._id)) return req.user._id;

  if (req.user.role === 'admin') return clientId;

  if (req.user.role === 'trainer') {
    const client = await User.findOne({ _id: clientId, role: 'client' })
      .select('clientProfile.trainerId')
      .lean();
    if (!client) throw new ApiError(404, 'CLIENT_NOT_FOUND', 'That client does not exist');
    if (String(client.clientProfile?.trainerId) !== String(req.user._id)) {
      throw new ApiError(403, 'FORBIDDEN', 'That client is not on your roster');
    }
    return clientId;
  }

  throw new ApiError(403, 'FORBIDDEN', 'You can only read your own workout history');
}

/** GET /api/workouts/logs?from=&to=&clientId=&page=&limit= */
exports.logs = asyncHandler(async (req, res) => {
  const userId = await resolveTargetUser(req);

  const to = req.query.to || todayKey();
  let { from } = req.query;
  if (!from) {
    const d = new Date(to);
    d.setDate(d.getDate() - 29);
    from = todayKey(d);
  }

  const filter = { userId, date: { $gte: from, $lte: to } };
  const pg = parsePagination(req.query);

  const [rows, total] = await Promise.all([
    WorkoutLog.find(filter).sort({ date: -1, createdAt: -1 }).skip(pg.skip).limit(pg.limit).lean(),
    WorkoutLog.countDocuments(filter),
  ]);

  return ok(res, rows, { ...pageMeta(pg, total), from, to });
});

/** GET /api/workouts/sessions?from=&to=&clientId= — completed sessions, newest first. */
exports.sessions = asyncHandler(async (req, res) => {
  const userId = await resolveTargetUser(req);

  const filter = { clientId: userId, status: 'completed' };
  if (req.query.from || req.query.to) {
    filter.completedAt = {};
    if (req.query.from) filter.completedAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.completedAt.$lte = new Date(`${req.query.to}T23:59:59.999Z`);
  }

  const pg = parsePagination(req.query);
  const [rows, total] = await Promise.all([
    SessionRecord.find(filter).sort({ completedAt: -1 }).skip(pg.skip).limit(pg.limit).lean(),
    SessionRecord.countDocuments(filter),
  ]);

  return ok(res, rows, pageMeta(pg, total));
});

/** GET /api/workouts/summary?clientId= — per-day totals for the last 8 weeks. */
exports.summary = asyncHandler(async (req, res) => {
  const userId = await resolveTargetUser(req);

  const to = todayKey();
  const fromDate = new Date(to);
  fromDate.setDate(fromDate.getDate() - 55);
  const from = todayKey(fromDate);

  const rows = await WorkoutLog.find({ userId, date: { $gte: from, $lte: to } })
    .select('date exerciseName sets reps weightKg durationMin completed')
    .lean();

  const byDate = {};
  rows.forEach((r) => {
    if (!byDate[r.date]) byDate[r.date] = { date: r.date, exercises: 0, completed: 0, volumeKg: 0, minutes: 0 };
    const d = byDate[r.date];
    d.exercises += 1;
    if (r.completed) d.completed += 1;
    d.volumeKg += (r.sets || 0) * (r.reps || 0) * (r.weightKg || 0);
    d.minutes += r.durationMin || 0;
  });

  const days = Object.values(byDate).sort((a, b) => (a.date < b.date ? -1 : 1));
  return ok(res, { from, to, days, totalExercises: rows.length });
});
