'use strict';

const mongoose = require('mongoose');
const toJSON = require('./plugins/toJSON');

const mealSchema = new mongoose.Schema(
  {
    slot: { type: String, required: true }, // 'Breakfast'
    food: { type: String },
    kcal: { type: Number, default: 0 },
    protein: { type: Number },
    carbs: { type: Number },
    fat: { type: Number },
    consumed: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { _id: true }
);

const dietPlanSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    name: { type: String, default: '' },
    kcal: { type: Number },
    protein: { type: Number },
    carbs: { type: Number },
    fat: { type: Number },
    status: {
      type: String,
      enum: ['draft', 'active', 'archived'],
      default: 'draft',
      index: true,
    },
    meals: { type: [mealSchema], default: [] },
    startDate: { type: Date },
    assignedAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

dietPlanSchema.plugin(toJSON);

dietPlanSchema.index({ clientId: 1, status: 1 });
dietPlanSchema.index({ trainerId: 1, status: 1 });

/** Sum of meal kcal (CONTRACT §4.10). */
dietPlanSchema.virtual('totalKcal').get(function totalKcal() {
  return (this.meals || []).reduce((acc, m) => acc + (Number(m.kcal) || 0), 0);
});

/** kcal already ticked off today, straight off the embedded meals. */
dietPlanSchema.virtual('consumedKcal').get(function consumedKcal() {
  return (this.meals || []).reduce((acc, m) => acc + (m.consumed ? Number(m.kcal) || 0 : 0), 0);
});

module.exports = mongoose.models.DietPlan || mongoose.model('DietPlan', dietPlanSchema);
