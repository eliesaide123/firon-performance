'use strict';

const { absoluteUrl } = require('../utils/urls');
const { durationLabel } = require('../utils/text');

/**
 * Serialises a Video, merging in the caller's VideoProgress as `progress` +
 * `favorite` (CONTRACT §5 /api/videos) and resolving media to absolute URLs.
 */
function serialiseVideo(req, video, progressByVideoId = {}) {
  const v = typeof video.toJSON === 'function' ? video.toJSON() : { ...video };
  if (v._id && !v.id) { v.id = String(v._id); delete v._id; }
  delete v.__v;

  const pickMedia = (m) => {
    if (!m || typeof m !== 'object') return null;
    return {
      id: String(m._id || m.id),
      kind: m.kind,
      status: m.status,
      url: m.url ? absoluteUrl(req, m.url) : null,
      thumbnailUrl: m.thumbnailUrl ? absoluteUrl(req, m.thumbnailUrl) : null,
      durationSec: m.durationSec,
    };
  };

  const videoMedia = pickMedia(video.videoMediaId);
  const thumbMedia = pickMedia(video.thumbnailMediaId);

  v.videoMediaId = videoMedia ? videoMedia.id : (video.videoMediaId ? String(video.videoMediaId) : null);
  v.thumbnailMediaId = thumbMedia ? thumbMedia.id : (video.thumbnailMediaId ? String(video.thumbnailMediaId) : null);
  v.videoUrl = videoMedia ? videoMedia.url : null;
  v.thumbnailUrl = (thumbMedia && (thumbMedia.url || thumbMedia.thumbnailUrl))
    || (videoMedia && videoMedia.thumbnailUrl)
    || null;

  if (video.categoryId && typeof video.categoryId === 'object') {
    v.category = v.category || video.categoryId.name;
    v.categoryId = String(video.categoryId._id || video.categoryId.id);
  } else if (video.categoryId) {
    v.categoryId = String(video.categoryId);
  }

  v.durationLabel = v.durationLabel || durationLabel(v.durationSec || 0);
  // gradientIndex is the prototype's fallback visual when there is no thumbnail.
  if (typeof v.gradientIndex !== 'number') v.gradientIndex = 0;

  const p = progressByVideoId[String(v.id)];
  v.progress = p ? (p.progress || 0) : 0;
  v.favorite = p ? !!p.favorite : false;
  v.secondsWatched = p ? (p.secondsWatched || 0) : 0;
  v.lastWatchedAt = p ? p.lastWatchedAt || null : null;

  return v;
}

/** Loads the caller's progress rows keyed by videoId. */
async function progressMapFor(userId, videoIds) {
  if (!userId || !videoIds || !videoIds.length) return {};
  const { VideoProgress } = require('../models');
  const rows = await VideoProgress.find({ userId, videoId: { $in: videoIds } }).lean();
  const map = {};
  rows.forEach((r) => { map[String(r.videoId)] = r; });
  return map;
}

/**
 * The prototype's suggested() reason strings, verbatim.
 * Strength -> plan match, Core -> coach pick, Mobility/Yoga -> recovery,
 * anything else -> popular.
 */
function whyFor(video, { coachName = 'Sara', planTitle = 'Lower Body' } = {}) {
  const cat = String((video && video.category) || '').toLowerCase();
  if (cat === 'strength') return `Matches your ${planTitle} plan`;
  if (cat === 'core') return `Coach ${coachName} added this for you`;
  if (cat === 'mobility' || cat === 'yoga') return 'Good recovery after today';
  return 'Popular with clients this week';
}

module.exports = { serialiseVideo, progressMapFor, whyFor };
