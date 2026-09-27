'use strict';

const mongoose = require('mongoose');
const toJSON = require('./plugins/toJSON');

/** Absolute base for `/uploads/...` paths (CONTRACT §1). */
function publicBaseUrl() {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/+$/, '');
  return `http://localhost:${process.env.PORT || 4000}`;
}

/** '/uploads/x.mp4' -> 'http://localhost:4000/uploads/x.mp4'; absolute URLs pass through. */
function absoluteUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url) || /^data:/i.test(url)) return url;
  return `${publicBaseUrl()}${url.startsWith('/') ? '' : '/'}${url}`;
}

const mediaAssetSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String },
    kind: { type: String, enum: ['image', 'video'], required: true, index: true },
    category: { type: String, index: true },

    filename: { type: String },
    originalName: { type: String },
    mimeType: { type: String },
    sizeBytes: { type: Number },
    durationSec: { type: Number },
    width: { type: Number },
    height: { type: Number },

    url: { type: String }, // '/uploads/<filename>'
    thumbnailUrl: { type: String },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    rejectionReason: { type: String },

    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

mediaAssetSchema.plugin(toJSON);

mediaAssetSchema.index({ status: 1, kind: 1, createdAt: -1 });
mediaAssetSchema.index({ uploadedBy: 1, createdAt: -1 });

/** Absolute URL, ready for a mobile <Image>/<Video> source. */
mediaAssetSchema.virtual('absoluteUrl').get(function abs() {
  return absoluteUrl(this.url);
});

mediaAssetSchema.virtual('absoluteThumbnailUrl').get(function absThumb() {
  return absoluteUrl(this.thumbnailUrl);
});

/** 45 -> '0:45' */
mediaAssetSchema.virtual('durationLabel').get(function durationLabel() {
  if (!this.durationSec) return null;
  const m = Math.floor(this.durationSec / 60);
  const s = Math.floor(this.durationSec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
});

mediaAssetSchema.statics.absoluteUrl = absoluteUrl;
mediaAssetSchema.statics.publicBaseUrl = publicBaseUrl;

module.exports =
  mongoose.models.MediaAsset || mongoose.model('MediaAsset', mediaAssetSchema);
