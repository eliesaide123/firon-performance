'use strict';

const { absoluteUrl } = require('../utils/urls');

/**
 * Builds the flat map the mobile app consumes:
 *   { "auth.login.title": { type, value, url }, ... }
 * `url` is the absolute media URL for image/video entries (null otherwise).
 */
function mediaUrlOf(doc) {
  const media = doc.mediaId && typeof doc.mediaId === 'object' ? doc.mediaId : null;
  if (media && media.url) return media.url;
  // image/video entries may also store an absolute URL directly in `value`
  if ((doc.type === 'image' || doc.type === 'video') && typeof doc.value === 'string' && doc.value) {
    return doc.value;
  }
  return null;
}

function toMapEntry(req, doc) {
  const raw = mediaUrlOf(doc);
  return {
    type: doc.type,
    value: doc.value === undefined ? null : doc.value,
    url: raw ? absoluteUrl(req, raw) : null,
  };
}

function toMap(req, docs = []) {
  const map = {};
  docs.forEach((doc) => { map[doc.key] = toMapEntry(req, doc); });
  return map;
}

/** Full shape for the CMS list/editor view. */
function toListItem(req, doc) {
  const o = typeof doc.toJSON === 'function' ? doc.toJSON() : { ...doc };
  if (o._id && !o.id) { o.id = String(o._id); delete o._id; }
  delete o.__v;
  const raw = mediaUrlOf(doc);
  o.url = raw ? absoluteUrl(req, raw) : null;
  if (o.mediaId && typeof o.mediaId === 'object') {
    o.media = {
      id: String(o.mediaId._id || o.mediaId.id),
      title: o.mediaId.title,
      kind: o.mediaId.kind,
      status: o.mediaId.status,
      url: o.mediaId.url ? absoluteUrl(req, o.mediaId.url) : null,
      thumbnailUrl: o.mediaId.thumbnailUrl ? absoluteUrl(req, o.mediaId.thumbnailUrl) : null,
    };
    o.mediaId = o.media.id;
  }
  return o;
}

/** The `content:updated` socket payload (CONTRACT §6). */
function socketPayload(req, doc) {
  const raw = mediaUrlOf(doc);
  return {
    key: doc.key,
    type: doc.type,
    value: doc.value === undefined ? null : doc.value,
    url: raw ? absoluteUrl(req, raw) : null,
    locale: doc.locale || 'en',
    platform: doc.platform || 'mobile',
  };
}

module.exports = { toMap, toMapEntry, toListItem, socketPayload, mediaUrlOf };
