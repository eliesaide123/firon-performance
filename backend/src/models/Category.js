'use strict';

const mongoose = require('mongoose');
const toJSON = require('./plugins/toJSON');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    order: { type: Number, default: 0 },
    icon: { type: String },
    kind: { type: String, enum: ['video', 'exercise'], default: 'video', index: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categorySchema.plugin(toJSON);

categorySchema.index({ kind: 1, order: 1 });

categorySchema.statics.slugify = (name) =>
  String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

module.exports = mongoose.models.Category || mongoose.model('Category', categorySchema);
