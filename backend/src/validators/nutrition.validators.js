'use strict';

const { z, dateKey, objectId } = require('./common.validators');

const todayQuery = z.object({ date: dateKey.optional() });

const historyQuery = z.object({
  from: dateKey.optional(),
  to: dateKey.optional(),
});

const logMeal = z.object({
  slot: z.string().trim().min(1, 'Which meal is this?').max(40),
  food: z.string().trim().min(1, 'What did you eat?').max(160),
  kcal: z.coerce.number().min(0).max(10000).optional(),
  protein: z.coerce.number().min(0).max(1000).optional(),
  carbs: z.coerce.number().min(0).max(2000).optional(),
  fat: z.coerce.number().min(0).max(1000).optional(),
  date: dateKey.optional(),
  dietPlanId: objectId.nullish(),
  consumed: z.boolean().optional(),
});

module.exports = { todayQuery, historyQuery, logMeal };
