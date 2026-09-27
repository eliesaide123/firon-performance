'use strict';

const { z, objectId, isoDate, dateKey } = require('./common.validators');

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const planExercise = z.object({
  exerciseId: objectId.nullish(),
  name: z.string().trim().min(1, 'Exercise name is required').max(120),
  prescription: z.string().trim().max(120).optional(),
  sets: z.coerce.number().int().min(0).max(50).optional(),
  reps: z.coerce.number().int().min(0).max(1000).optional(),
  weightKg: z.coerce.number().min(0).max(1000).optional(),
  notes: z.string().trim().max(500).optional(),
  done: z.boolean().optional(),
  loggedByClient: z.boolean().optional(),
  order: z.coerce.number().int().optional(),
});

const planDay = z.object({
  dayIndex: z.coerce.number().int().min(0).max(6),
  dayLabel: z.enum(DAY_LABELS).optional(),
  title: z.string().trim().min(1, 'Every day needs a title').max(120),
  durationMin: z.coerce.number().int().min(0).max(600).optional(),
  status: z.enum(['done', 'now', 'todo']).optional(),
  locked: z.boolean().optional(),
  exercises: z.array(planExercise).max(40).default([]),
});

const createTraining = z.object({
  clientId: objectId,
  name: z.string().trim().min(1, 'Plan name is required').max(120),
  weekNumber: z.coerce.number().int().min(0).max(520).optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  days: z.array(planDay).min(1, 'A plan needs at least one day').max(7),
  notes: z.string().trim().max(2000).optional(),
});

const updateTraining = createTraining.partial().omit({ clientId: true }).extend({
  clientId: objectId.optional(),
});

const meal = z.object({
  slot: z.string().trim().min(1, 'Every meal needs a slot').max(40),
  food: z.string().trim().min(1, 'Every meal needs a food').max(160),
  kcal: z.coerce.number().min(0).max(10000).optional(),
  protein: z.coerce.number().min(0).max(1000).optional(),
  carbs: z.coerce.number().min(0).max(2000).optional(),
  fat: z.coerce.number().min(0).max(1000).optional(),
  order: z.coerce.number().int().optional(),
});

const createDiet = z.object({
  clientId: objectId,
  name: z.string().trim().min(1, 'Plan name is required').max(120),
  kcal: z.coerce.number().min(0).max(20000).optional(),
  protein: z.coerce.number().min(0).max(2000).optional(),
  carbs: z.coerce.number().min(0).max(3000).optional(),
  fat: z.coerce.number().min(0).max(2000).optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  meals: z.array(meal).max(20).default([]),
  startDate: isoDate.optional(),
  notes: z.string().trim().max(2000).optional(),
});

const updateDiet = createDiet.partial().omit({ clientId: true }).extend({
  clientId: objectId.optional(),
});

const toggleBody = z.object({
  done: z.boolean().optional(),
}).optional();

const completeDay = z.object({
  durationMin: z.coerce.number().int().min(0).max(600).optional(),
  notes: z.string().trim().max(1000).optional(),
}).optional();

const logExercise = z.object({
  name: z.string().trim().min(1, 'Enter an exercise name').max(120),
  exerciseId: objectId.nullish(),
  sets: z.coerce.number().int().min(0).max(50).nullish(),
  reps: z.coerce.number().int().min(0).max(1000).nullish(),
  weightKg: z.coerce.number().min(0).max(1000).nullish(),
  notes: z.string().trim().max(500).optional(),
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

const clientIdQuery = z.object({
  clientId: objectId.optional(),
  status: z.enum(['draft', 'active', 'archived', 'all']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const dayParams = z.object({
  id: objectId,
  dayIndex: z.coerce.number().int().min(0).max(6),
});

const exerciseToggleParams = z.object({
  id: objectId,
  dayIndex: z.coerce.number().int().min(0).max(6),
  exIndex: z.coerce.number().int().min(0).max(100),
});

const mealToggleParams = z.object({
  id: objectId,
  index: z.coerce.number().int().min(0).max(100),
});

module.exports = {
  createTraining,
  updateTraining,
  createDiet,
  updateDiet,
  toggleBody,
  completeDay,
  logExercise,
  logMeal,
  clientIdQuery,
  dayParams,
  exerciseToggleParams,
  mealToggleParams,
  DAY_LABELS,
};
