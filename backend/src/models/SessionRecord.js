'use strict';

const mongoose = require('mongoose');
const toJSON = require('./plugins/toJSON');

const sessionRecordSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    trainingPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingPlan' },
    dayIndex: { type: Number },
    title: { type: String },
    scheduledAt: { type: Date, index: true },
    completedAt: { type: Date },
    durationMin: { type: Number },
    location: { type: String },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'missed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
  },
  { timestamps: true }
);

sessionRecordSchema.plugin(toJSON);

sessionRecordSchema.index({ trainerId: 1, scheduledAt: -1 });
sessionRecordSchema.index({ clientId: 1, status: 1 });

module.exports =
  mongoose.models.SessionRecord || mongoose.model('SessionRecord', sessionRecordSchema);
