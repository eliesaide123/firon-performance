'use strict';

const mongoose = require('mongoose');
const toJSON = require('./plugins/toJSON');

const planExerciseSchema = new mongoose.Schema(
  {
    exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' },
    name: { type: String, required: true },
    prescription: { type: String }, // '4 × 12 · 20kg'
    sets: { type: Number },
    reps: { type: Number },
    weightKg: { type: Number },
    notes: { type: String },
    done: { type: Boolean, default: false },
    loggedByClient: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { _id: true }
);

const planDaySchema = new mongoose.Schema(
  {
    dayIndex: { type: Number, required: true }, // 0..6
    dayLabel: { type: String }, // 'Mon'
    title: { type: String }, // 'Full Body HIIT'
    durationMin: { type: Number },
    status: { type: String, enum: ['done', 'now', 'todo'], default: 'todo' },
    locked: { type: Boolean, default: false },
    completedAt: { type: Date },
    exercises: { type: [planExerciseSchema], default: [] },
  },
  { _id: true }
);

const trainingPlanSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    name: { type: String, required: true },
    weekNumber: { type: Number },
    startDate: { type: Date },
    endDate: { type: Date },
    status: {
      type: String,
      enum: ['draft', 'active', 'archived'],
      default: 'draft',
      index: true,
    },
    days: { type: [planDaySchema], default: [] },
    notes: { type: String },
    assignedAt: { type: Date },
  },
  { timestamps: true }
);

trainingPlanSchema.plugin(toJSON);

trainingPlanSchema.index({ clientId: 1, status: 1 });
trainingPlanSchema.index({ trainerId: 1, status: 1 });

/** done days / total days * 100, rounded (CONTRACT §4.9). */
trainingPlanSchema.virtual('adherencePct').get(function adherencePct() {
  const days = this.days || [];
  if (!days.length) return 0;
  const done = days.filter((d) => d.status === 'done').length;
  return Math.round((done / days.length) * 100);
});

trainingPlanSchema.virtual('doneDays').get(function doneDays() {
  return (this.days || []).filter((d) => d.status === 'done').length;
});

trainingPlanSchema.virtual('totalDays').get(function totalDays() {
  return (this.days || []).length;
});

/** Index of the day flagged `now`, or -1. */
trainingPlanSchema.virtual('currentDayIndex').get(function currentDayIndex() {
  return (this.days || []).findIndex((d) => d.status === 'now');
});

module.exports =
  mongoose.models.TrainingPlan || mongoose.model('TrainingPlan', trainingPlanSchema);
