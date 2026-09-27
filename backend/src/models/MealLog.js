'use strict';

const mongoose = require('mongoose');
const toJSON = require('./plugins/toJSON');

const mealLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    dietPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'DietPlan' },
    date: { type: String, required: true, index: true }, // 'YYYY-MM-DD'
    slot: { type: String },
    food: { type: String },
    kcal: { type: Number, default: 0 },
    protein: { type: Number },
    carbs: { type: Number },
    fat: { type: Number },
    consumed: { type: Boolean, default: true },
    source: { type: String, enum: ['plan', 'manual'], default: 'plan' },
  },
  { timestamps: true }
);

mealLogSchema.plugin(toJSON);

mealLogSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.models.MealLog || mongoose.model('MealLog', mealLogSchema);
