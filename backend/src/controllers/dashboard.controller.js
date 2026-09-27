'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/respond');

/**
 * Builds the CMS dashboard payload. Also used by the `dashboard:tick`
 * interval in src/realtime/index.js, hence the exported plain function.
 */
async function buildStats() {
  const {
    User, Content, MediaAsset, Video, TrainingPlan, DietPlan, AuditLog, SessionRecord,
  } = require('../models');

  const [
    clients, trainers, admins,
    contentTotal, contentByGroup,
    mediaPending, mediaApproved, mediaRejected,
    videosPublished, videosTotal,
    activeTraining, activeDiet,
    sessionsToday,
  ] = await Promise.all([
    User.countDocuments({ role: 'client' }),
    User.countDocuments({ role: 'trainer' }),
    User.countDocuments({ role: 'admin' }),
    Content.countDocuments({}),
    Content.aggregate([
      { $group: { _id: { $ifNull: ['$group', 'ungrouped'] }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    MediaAsset.countDocuments({ status: 'pending' }),
    MediaAsset.countDocuments({ status: 'approved' }),
    MediaAsset.countDocuments({ status: 'rejected' }),
    Video.countDocuments({ isPublished: true }),
    Video.countDocuments({}),
    TrainingPlan.countDocuments({ status: 'active' }),
    DietPlan.countDocuments({ status: 'active' }),
    SessionRecord.countDocuments({
      status: 'completed',
      completedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    }),
  ]);

  let recentActivity = [];
  try {
    const rows = await AuditLog.find({})
      .populate('userId', 'name role')
      .sort({ createdAt: -1 })
      .limit(15)
      .lean();
    recentActivity = rows.map((r) => ({
      id: String(r._id),
      action: r.action,
      entity: r.entity,
      entityId: r.entityId ? String(r.entityId) : null,
      at: r.createdAt,
      by: r.userId ? { id: String(r.userId._id), name: r.userId.name, role: r.userId.role } : null,
    }));
  } catch (_err) {
    recentActivity = [];
  }

  // Fall back to the newest media as "activity" when the audit log is empty,
  // so the CMS dashboard never renders a blank panel on a fresh install.
  if (!recentActivity.length) {
    const media = await MediaAsset.find({})
      .populate('uploadedBy', 'name role')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    recentActivity = media.map((m) => ({
      id: String(m._id),
      action: `media.${m.status}`,
      entity: 'MediaAsset',
      entityId: String(m._id),
      at: m.updatedAt || m.createdAt,
      by: m.uploadedBy ? { id: String(m.uploadedBy._id), name: m.uploadedBy.name, role: m.uploadedBy.role } : null,
    }));
  }

  const byGroup = {};
  contentByGroup.forEach((g) => { byGroup[g._id] = g.count; });

  return {
    users: { clients, trainers, admins, total: clients + trainers + admins },
    content: { total: contentTotal, byGroup },
    media: { pending: mediaPending, approved: mediaApproved, rejected: mediaRejected },
    videos: { published: videosPublished, total: videosTotal },
    plans: { activeTraining, activeDiet },
    sessions: { today: sessionsToday },
    recentActivity,
    generatedAt: new Date().toISOString(),
  };
}

/* GET /api/dashboard (admin) */
exports.get = asyncHandler(async (req, res) => ok(res, await buildStats()));
exports.buildStats = buildStats;
