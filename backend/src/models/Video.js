'use strict';

const mongoose = require('mongoose');
const toJSON = require('./plugins/toJSON');

const videoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', index: true },
    category: { type: String }, // denormalised category name (chips filter on it)
    durationSec: { type: Number },
    durationLabel: { type: String }, // '24:10'
    videoMediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' },
    thumbnailMediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' },
    gradientIndex: { type: Number, default: 0 }, // fallback visual (CONTRACT §2 gradients)
    isPublished: { type: Boolean, default: true, index: true },
    publishedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tags: { type: [String], default: [] },
    level: { type: String },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

videoSchema.plugin(toJSON);

videoSchema.index({ isPublished: 1, order: 1 });
videoSchema.index({ category: 1, isPublished: 1 });
videoSchema.index({ title: 'text', description: 'text', tags: 'text' });

/** '24:10' from durationSec when a label was not supplied. */
videoSchema.virtual('computedDurationLabel').get(function label() {
  if (this.durationLabel) return this.durationLabel;
  if (!this.durationSec) return null;
  const m = Math.floor(this.durationSec / 60);
  const s = Math.floor(this.durationSec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
});

/** '24:10' -> 1450 */
videoSchema.statics.parseDurationLabel = (label) => {
  if (!label || typeof label !== 'string') return null;
  const parts = label.split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n))) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
};

module.exports = mongoose.models.Video || mongoose.model('Video', videoSchema);
