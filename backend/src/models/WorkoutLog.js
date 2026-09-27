'use strict';

const mongoose = require('mongoose');
const toJSON = require('./plugins/toJSON');

const workoutLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    trainingPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingPlan' },
    dayIndex: { type: Number },
    date: { type: String, index: true }, // 'YYYY-MM-DD'
    exerciseName: { type: String },
    sets: { type: Number },
    reps: { type: Number },
    weightKg: { type: Number },
    notes: { type: String },
    source: { type: String, enum: ['plan', 'manual'], default: 'plan' },
    completed: { type: Boolean, default: true },
    durationMin: { type: Number },
  },
  { timestamps: true }
);

workoutLogSchema.plugin(toJSON);

workoutLogSchema.index({ userId: 1, date: -1 });
workoutLogSchema.index({ trainingPlanId: 1, dayIndex: 1 });

module.exports = mongoose.models.WorkoutLog || mongoose.model('WorkoutLog', workoutLogSchema);
