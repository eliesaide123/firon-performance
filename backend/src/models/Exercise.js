'use strict';

const mongoose = require('mongoose');
const toJSON = require('./plugins/toJSON');

const exerciseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, lowercase: true, trim: true, index: true },
    description: { type: String },
    muscleGroup: { type: String, index: true },
    equipment: { type: String },
    type: { type: String }, // 'Compound · barbell'
    demoMediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' },
    demoDurationLabel: { type: String }, // '0:45'
    cues: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

exerciseSchema.plugin(toJSON);

exerciseSchema.index({ name: 'text', muscleGroup: 'text', equipment: 'text' });
exerciseSchema.index({ isActive: 1, name: 1 });

exerciseSchema.statics.slugify = (name) =>
  String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

module.exports = mongoose.models.Exercise || mongoose.model('Exercise', exerciseSchema);
