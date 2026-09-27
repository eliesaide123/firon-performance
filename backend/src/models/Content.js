'use strict';

const mongoose = require('mongoose');
const toJSON = require('./plugins/toJSON');
const MediaAsset = require('./MediaAsset');

const TYPES = ['text', 'richtext', 'image', 'video', 'number', 'boolean', 'color', 'json'];
const GROUPS = [
  'auth',
  'home',
  'train',
  'videos',
  'nutrition',
  'profile',
  'pt',
  'common',
  'tabs',
  'notifications',
  'search',
  'onboard',
];

const contentSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, index: true },
    type: { type: String, enum: TYPES, required: true },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
    locale: { type: String, default: 'en', index: true },
    platform: {
      type: String,
      enum: ['mobile', 'cms', 'both'],
      default: 'mobile',
      index: true,
    },
    group: { type: String, index: true },
    screen: { type: String },
    label: { type: String },
    description: { type: String },
    mediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' },
    isPublished: { type: Boolean, default: true },
    version: { type: Number, default: 1 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

contentSchema.plugin(toJSON);

// CONTRACT §4.3 — a key is unique per locale.
contentSchema.index({ key: 1, locale: 1 }, { unique: true });
contentSchema.index({ platform: 1, locale: 1, isPublished: 1 });
contentSchema.index({ group: 1, screen: 1 });

/** Resolved absolute media URL for image/video entries. */
contentSchema.virtual('url').get(function url() {
  if (this.populated && this.populated('mediaId') && this.mediaId && this.mediaId.url) {
    return MediaAsset.absoluteUrl(this.mediaId.url);
  }
  if (typeof this.value === 'string' && /^(https?:\/\/|\/uploads\/)/i.test(this.value)) {
    return MediaAsset.absoluteUrl(this.value);
  }
  return null;
});

/**
 * Flat map the mobile app consumes: `{ 'login.title': { type, value, url } }`.
 * (CONTRACT §5 `GET /api/content?format=map`.)
 *
 * @param {object} filter extra mongo filter — e.g. `{ platform:'mobile', locale:'en' }`.
 *        `platform:'mobile'` automatically also matches `both`.
 */
contentSchema.statics.asMap = async function asMap(filter = {}) {
  const query = { isPublished: true, ...filter };

  if (query.platform && query.platform !== 'both') {
    query.platform = { $in: [query.platform, 'both'] };
  }

  const docs = await this.find(query)
    .populate({ path: 'mediaId', select: 'url thumbnailUrl kind status durationSec' })
    .lean();

  const map = {};
  for (const doc of docs) {
    let url = null;
    if (doc.mediaId && doc.mediaId.url) {
      url = MediaAsset.absoluteUrl(doc.mediaId.url);
    } else if (typeof doc.value === 'string' && /^(https?:\/\/|\/uploads\/)/i.test(doc.value)) {
      url = MediaAsset.absoluteUrl(doc.value);
    }
    map[doc.key] = {
      type: doc.type,
      value: doc.value === undefined ? null : doc.value,
      url,
    };
  }
  return map;
};

/** Single-doc version of the map entry, used by socket `content:updated`. */
contentSchema.methods.toMapEntry = function toMapEntry() {
  return {
    key: this.key,
    type: this.type,
    value: this.value === undefined ? null : this.value,
    url: this.url,
    locale: this.locale,
    platform: this.platform,
  };
};

contentSchema.statics.TYPES = TYPES;
contentSchema.statics.GROUPS = GROUPS;

module.exports = mongoose.models.Content || mongoose.model('Content', contentSchema);
