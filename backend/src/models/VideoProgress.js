'use strict';

const mongoose = require('mongoose');
const toJSON = require('./plugins/toJSON');

const videoProgressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    videoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true, index: true },
    progress: { type: Number, min: 0, max: 1, default: 0 },
    favorite: { type: Boolean, default: false },
    lastWatchedAt: { type: Date },
    secondsWatched: { type: Number, default: 0 },
  },
  { timestamps: true }
);

videoProgressSchema.plugin(toJSON);

videoProgressSchema.index({ userId: 1, videoId: 1 }, { unique: true });
videoProgressSchema.index({ userId: 1, favorite: 1 });
videoProgressSchema.index({ userId: 1, lastWatchedAt: -1 });

videoProgressSchema.virtual('progressPct').get(function pct() {
  return Math.round((this.progress || 0) * 100);
});

module.exports =
  mongoose.models.VideoProgress || mongoose.model('VideoProgress', videoProgressSchema);
