'use strict';

/**
 * Training + diet plans (CONTRACT §9).
 *
 * Elie's week is reproduced exactly from the prototype (`week` + `exercises`).
 * The other four roster clients get plans whose `adherencePct` virtual
 * (done days / total days, rounded) lands on the prototype's roster numbers:
 *   Maya 12/13 -> 92 · Omar 7/9 -> 78 · Karim 9/14 -> 64 · Lina 0 days -> 0
 */

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const ex = (name, prescription, extra = {}) => ({ name, prescription, ...extra });

/* ----------------------------- Elie's week ------------------------------ */

const elieTrainingPlan = {
  ref: 'plan-elie',
  clientRef: 'elie',
  trainerRef: 'sara',
  name: 'Fat Loss · Week 4',
  weekNumber: 4,
  status: 'active',
  notes: 'Keep rest under 60s on conditioning days. Log RPE in the notes if a weight felt heavy.',
  days: [
    {
      dayIndex: 0,
      dayLabel: 'Mon',
      title: 'Full Body HIIT',
      durationMin: 40,
      status: 'done',
      locked: false,
      exercises: [
        ex('Burpees', '4 × 15', { sets: 4, reps: 15, done: true }),
        ex('Kettlebell Swing', '4 × 20 · 16kg', { sets: 4, reps: 20, weightKg: 16, done: true }),
        ex('Row Intervals', '5 × 250m', { sets: 5, done: true }),
        ex('Mountain Climbers', '4 × 40s', { sets: 4, done: true }),
      ],
    },
    {
      dayIndex: 1,
      dayLabel: 'Tue',
      title: 'Upper Pull',
      durationMin: 50,
      status: 'done',
      locked: false,
      exercises: [
        ex('Pull-up', '4 × 8', { sets: 4, reps: 8, done: true }),
        ex('Barbell Row', '4 × 10 · 50kg', { sets: 4, reps: 10, weightKg: 50, done: true }),
        ex('Face Pull', '3 × 15', { sets: 3, reps: 15, done: true }),
        ex('Hammer Curl', '3 × 12 · 12kg', { sets: 3, reps: 12, weightKg: 12, done: true }),
      ],
    },
    {
      // today — the exact prescriptions from the prototype's `exercises` array
      dayIndex: 2,
      dayLabel: 'Wed',
      title: 'Lower Body Strength',
      durationMin: 55,
      status: 'now',
      locked: false,
      exercises: [
        ex('Goblet Squat', '4 × 12 · 20kg', { sets: 4, reps: 12, weightKg: 20, done: true }),
        ex('Romanian Deadlift', '4 × 10 · 40kg', { sets: 4, reps: 10, weightKg: 40, done: true }),
        ex('Incline Dumbbell Press', '3 × 12 · 18kg', { sets: 3, reps: 12, weightKg: 18, done: false }),
        ex('Walking Lunge', '3 × 20 steps', { sets: 3, reps: 20, done: false }),
        ex('Plank Hold', '3 × 45s', { sets: 3, done: false }),
      ],
    },
    {
      dayIndex: 3,
      dayLabel: 'Thu',
      title: 'Push & Core',
      durationMin: 45,
      status: 'todo',
      locked: true,
      exercises: [
        ex('Bench Press', '4 × 8 · 60kg', { sets: 4, reps: 8, weightKg: 60 }),
        ex('Overhead Press', '4 × 10 · 35kg', { sets: 4, reps: 10, weightKg: 35 }),
        ex('Cable Fly', '3 × 15', { sets: 3, reps: 15 }),
        ex('Hanging Leg Raise', '3 × 12', { sets: 3, reps: 12 }),
      ],
    },
    {
      dayIndex: 4,
      dayLabel: 'Fri',
      title: 'Conditioning',
      durationMin: 35,
      status: 'todo',
      locked: false,
      exercises: [
        ex('Assault Bike', '6 × 30s sprint', { sets: 6 }),
        ex('Sled Push', '6 × 20m', { sets: 6 }),
        ex('Farmer Carry', '4 × 40m · 24kg', { sets: 4, weightKg: 24 }),
      ],
    },
  ],
};

/* -------------------- roster plans (adherence targets) ------------------ */

/**
 * Build a multi-week plan with `total` days of which `done` are completed.
 * The day right after the last completed one becomes `now`.
 */
function buildDays(total, done, rotation) {
  const days = [];
  for (let i = 0; i < total; i += 1) {
    const template = rotation[i % rotation.length];
    let status = 'todo';
    if (i < done) status = 'done';
    else if (i === done) status = 'now';
    days.push({
      dayIndex: i % 7,
      dayLabel: DAY_LABELS[i % 7],
      title: template.title,
      durationMin: template.durationMin,
      status,
      locked: status === 'todo' && i > done + 1,
      exercises: template.exercises.map((e, order) => ({
        name: e[0],
        prescription: e[1],
        done: status === 'done',
        order,
      })),
    });
  }
  return days;
}

const FAT_LOSS_ROTATION = [
  { title: 'Full Body HIIT', durationMin: 40, exercises: [['Burpees', '4 × 15'], ['Kettlebell Swing', '4 × 20 · 12kg'], ['Mountain Climbers', '4 × 40s'], ['Row Intervals', '5 × 200m']] },
  { title: 'Lower Body Strength', durationMin: 50, exercises: [['Goblet Squat', '4 × 12 · 16kg'], ['Romanian Deadlift', '4 × 10 · 35kg'], ['Walking Lunge', '3 × 20 steps'], ['Plank Hold', '3 × 40s']] },
  { title: 'Upper Pull', durationMin: 45, exercises: [['Lat Pulldown', '4 × 12'], ['Seated Row', '4 × 12'], ['Face Pull', '3 × 15'], ['Bicep Curl', '3 × 12 · 8kg']] },
  { title: 'Conditioning', durationMin: 35, exercises: [['Treadmill Run', '20 min steady'], ['Assault Bike', '6 × 30s'], ['Farmer Carry', '4 × 30m · 16kg']] },
];

const HYPERTROPHY_ROTATION = [
  { title: 'Push Volume', durationMin: 60, exercises: [['Bench Press', '4 × 10 · 55kg'], ['Incline Dumbbell Press', '4 × 12 · 20kg'], ['Overhead Press', '3 × 10 · 30kg'], ['Cable Fly', '3 × 15']] },
  { title: 'Pull Volume', durationMin: 60, exercises: [['Barbell Row', '4 × 10 · 55kg'], ['Lat Pulldown', '4 × 12'], ['Seated Row', '3 × 12'], ['Hammer Curl', '3 × 12 · 14kg']] },
  { title: 'Leg Volume', durationMin: 65, exercises: [['Back Squat', '4 × 10 · 80kg'], ['Leg Press', '4 × 12 · 120kg'], ['Bulgarian Split Squat', '3 × 10 each'], ['Hanging Leg Raise', '3 × 12']] },
];

const STRENGTH_ROTATION = [
  { title: 'Squat Focus', durationMin: 70, exercises: [['Back Squat', '5 × 5 · 110kg'], ['Leg Press', '3 × 8 · 160kg'], ['Plank Hold', '3 × 60s']] },
  { title: 'Bench Focus', durationMin: 65, exercises: [['Bench Press', '5 × 5 · 90kg'], ['Overhead Press', '3 × 6 · 50kg'], ['Cable Fly', '3 × 12']] },
  { title: 'Deadlift Focus', durationMin: 70, exercises: [['Deadlift', '5 × 3 · 150kg'], ['Barbell Row', '4 × 8 · 70kg'], ['Farmer Carry', '4 × 40m · 32kg']] },
  { title: 'Accessory & Carries', durationMin: 45, exercises: [['Pull-up', '4 × 8'], ['Face Pull', '3 × 15'], ['Sled Push', '6 × 20m']] },
];

const rosterTrainingPlans = [
  {
    ref: 'plan-maya',
    clientRef: 'maya',
    trainerRef: 'sara',
    name: 'Fat Loss · Wk 4',
    weekNumber: 4,
    status: 'active',
    notes: 'Excellent consistency — hold the deficit for one more week.',
    days: buildDays(13, 12, FAT_LOSS_ROTATION), // -> 92%
  },
  {
    ref: 'plan-omar',
    clientRef: 'omar',
    trainerRef: 'sara',
    name: 'Hypertrophy · Wk 2',
    weekNumber: 2,
    status: 'active',
    notes: 'Add 2.5kg to the main lift whenever all sets hit the top of the rep range.',
    days: buildDays(9, 7, HYPERTROPHY_ROTATION), // -> 78%
  },
  {
    ref: 'plan-karim',
    clientRef: 'karim',
    trainerRef: 'sara',
    name: 'Strength · Wk 7',
    weekNumber: 7,
    status: 'active',
    notes: 'Adherence slipping — check in about the Thursday sessions.',
    days: buildDays(14, 9, STRENGTH_ROTATION), // -> 64%
  },
  {
    ref: 'plan-lina',
    clientRef: 'lina',
    trainerRef: 'sara',
    name: 'Onboarding',
    weekNumber: 1,
    status: 'draft',
    notes: 'Awaiting body stats + goals from the onboarding form.',
    days: [], // -> 0%
  },
];

const trainingPlans = [elieTrainingPlan, ...rosterTrainingPlans];

/* ------------------------------ diet plans ------------------------------ */

const meal = (slot, food, kcal, consumed = false, order = 0) => ({
  slot,
  food,
  kcal,
  consumed,
  order,
});

const dietPlans = [
  {
    ref: 'diet-elie',
    clientRef: 'elie',
    trainerRef: 'sara',
    name: 'Cutting Plan',
    kcal: 2100,
    protein: 120,
    carbs: 140,
    fat: 48,
    status: 'active',
    notes: '2 litres of water minimum. Move the snack to pre-workout on training days.',
    meals: [
      meal('Breakfast', 'Oats, berries & whey', 420, true, 0),
      meal('Lunch', 'Grilled chicken & rice', 640, true, 1),
      meal('Snack', 'Greek yogurt & almonds', 220, true, 2),
      meal('Dinner', 'Salmon & greens', 200, false, 3),
    ],
  },
  {
    ref: 'diet-maya',
    clientRef: 'maya',
    trainerRef: 'sara',
    name: 'Cutting Plan',
    kcal: 1800,
    protein: 140,
    carbs: 150,
    fat: 55,
    status: 'active',
    meals: [
      meal('Breakfast', 'Oats, berries & whey', 380, false, 0),
      meal('Lunch', 'Grilled chicken & quinoa', 560, false, 1),
      meal('Snack', 'Greek yogurt & almonds', 220, false, 2),
      meal('Dinner', 'Salmon & greens', 520, false, 3),
    ],
  },
  {
    ref: 'diet-omar',
    clientRef: 'omar',
    trainerRef: 'sara',
    name: 'Lean Bulk',
    kcal: 3100,
    protein: 190,
    carbs: 340,
    fat: 90,
    status: 'active',
    meals: [
      meal('Breakfast', 'Eggs, avocado toast & fruit', 720, false, 0),
      meal('Lunch', 'Beef, rice & veg', 900, false, 1),
      meal('Pre-workout', 'Banana & rice cakes', 280, false, 2),
      meal('Dinner', 'Chicken pasta', 820, false, 3),
    ],
  },
  {
    ref: 'diet-lina',
    clientRef: 'lina',
    trainerRef: 'sara',
    name: '',
    kcal: 2000,
    protein: 120,
    carbs: 200,
    fat: 65,
    status: 'draft',
    notes: 'Targets set — meals to be written after the first consultation.',
    meals: [],
  },
  {
    ref: 'diet-karim',
    clientRef: 'karim',
    trainerRef: 'sara',
    name: 'Maintenance',
    kcal: 2600,
    protein: 170,
    carbs: 260,
    fat: 80,
    status: 'active',
    meals: [
      meal('Breakfast', 'Omelette & oats', 600, false, 0),
      meal('Lunch', 'Turkey wrap & salad', 700, false, 1),
      meal('Dinner', 'Steak & sweet potato', 850, false, 2),
    ],
  },
];

module.exports = { trainingPlans, dietPlans, DAY_LABELS };
