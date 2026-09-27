/**
 * PREVIEW-ONLY placeholder data for guest mode (CONTRACT §13.3).
 *
 * ⚠️  Never use any of this once a session exists. Per-user data (plan, nutrition, profile) cannot
 * be fetched without a token, so guest mode renders these compiled-in stand-ins instead. They
 * mirror docs/prototype.html exactly so the preview is pixel-faithful to the approved design.
 *
 * Labels are NOT here — every string still comes from the CMS via `t()`. These are numbers,
 * names and the structural shape of a plan.
 */
import type { DietPlan, PlanDay, PlanExercise, TrainingPlan, User } from '@firon/shared';

/** The 3/5 · 62% · 1,480 stat row on Home. */
export const PREVIEW_HOME_STATS = {
  sessionsDone: 3,
  sessionsTarget: 5,
  planProgressPct: 62,
  kcalToday: 1480,
} as const;

/** "Lower Body Strength · 6:00 PM · With coach Sara · Studio 2 · 60 min". */
export const PREVIEW_TODAY_SESSION = {
  title: 'Lower Body Strength',
  timeLabel: '6:00 PM',
  studio: 'Studio 2',
  durationMin: 60,
  dayIndex: 2,
} as const;

const PREVIEW_EXERCISES: PlanExercise[] = [
  { name: 'Goblet Squat', prescription: '4 × 12 · 20kg', done: true, loggedByClient: false, order: 0 },
  { name: 'Romanian Deadlift', prescription: '4 × 10 · 40kg', done: true, loggedByClient: false, order: 1 },
  { name: 'Incline Dumbbell Press', prescription: '3 × 12 · 18kg', done: false, loggedByClient: false, order: 2 },
  { name: 'Walking Lunge', prescription: '3 × 20 steps', done: false, loggedByClient: false, order: 3 },
  { name: 'Plank Hold', prescription: '3 × 45s', done: false, loggedByClient: false, order: 4 },
];

const PREVIEW_DAYS: PlanDay[] = [
  {
    dayIndex: 0,
    dayLabel: 'Mon',
    title: 'Full Body HIIT',
    durationMin: 40,
    status: 'done',
    locked: false,
    exercises: ['Burpees', 'Kettlebell Swing', 'Row Intervals', 'Mountain Climbers'].map(
      (name, order) => ({ name, prescription: '', done: true, loggedByClient: false, order }),
    ),
  },
  {
    dayIndex: 1,
    dayLabel: 'Tue',
    title: 'Upper Pull',
    durationMin: 50,
    status: 'done',
    locked: false,
    exercises: ['Pull-up', 'Barbell Row', 'Face Pull', 'Hammer Curl'].map((name, order) => ({
      name,
      prescription: '',
      done: true,
      loggedByClient: false,
      order,
    })),
  },
  {
    dayIndex: 2,
    dayLabel: 'Wed',
    title: 'Lower Body Strength',
    durationMin: 55,
    status: 'now',
    locked: false,
    exercises: PREVIEW_EXERCISES,
  },
  {
    dayIndex: 3,
    dayLabel: 'Thu',
    title: 'Push & Core',
    durationMin: 45,
    status: 'todo',
    locked: true,
    exercises: ['Bench Press', 'Overhead Press', 'Cable Fly', 'Hanging Leg Raise'].map(
      (name, order) => ({ name, prescription: '', done: false, loggedByClient: false, order }),
    ),
  },
  {
    dayIndex: 4,
    dayLabel: 'Fri',
    title: 'Conditioning',
    durationMin: 35,
    status: 'todo',
    locked: false,
    exercises: ['Assault Bike', 'Sled Push', 'Farmer Carry'].map((name, order) => ({
      name,
      prescription: '',
      done: false,
      loggedByClient: false,
      order,
    })),
  },
];

const NOW_ISO = '1970-01-01T00:00:00.000Z';

/** "Fat Loss · Week 4", day 3 of 5. */
export const PREVIEW_TRAINING_PLAN: TrainingPlan = {
  id: 'preview-training',
  clientId: 'preview',
  trainerId: 'preview-coach',
  name: 'Fat Loss · Week 4',
  weekNumber: 4,
  status: 'active',
  days: PREVIEW_DAYS,
  adherencePct: 40,
  doneDays: 2,
  totalDays: 5,
  currentDayIndex: 2,
  createdAt: NOW_ISO,
  updatedAt: NOW_ISO,
};

/** "Cutting Plan" — 1,480 of 2,100 kcal, P 120 / C 140 / F 48. */
export const PREVIEW_DIET_PLAN: DietPlan = {
  id: 'preview-diet',
  clientId: 'preview',
  trainerId: 'preview-coach',
  name: 'Cutting Plan',
  kcal: 2100,
  protein: 120,
  carbs: 140,
  fat: 48,
  status: 'active',
  meals: [
    { slot: 'Breakfast', food: 'Oats, berries & whey', kcal: 420, order: 0, consumed: true },
    { slot: 'Lunch', food: 'Grilled chicken & rice', kcal: 640, order: 1, consumed: true },
    { slot: 'Snack', food: 'Greek yogurt & almonds', kcal: 220, order: 2, consumed: true },
    { slot: 'Dinner', food: 'Salmon & greens', kcal: 200, order: 3, consumed: false },
  ],
  totalKcal: 1480,
  consumedKcal: 1480,
  createdAt: NOW_ISO,
  updatedAt: NOW_ISO,
};

/** The prototype's `me` body stats. `name` is intentionally blank — it comes from `guest.display_name`. */
export const PREVIEW_CLIENT_PROFILE: NonNullable<User['clientProfile']> = {
  gender: 'Male',
  age: 31,
  heightCm: 178,
  weightKg: 81.4,
  bodyFatPct: 18.2,
  waistCm: 84,
  goal: 'Fat loss',
  targetWeightKg: 76,
  sessionsPerWeek: 5,
  level: 'Intermediate',
  onboardingCompleted: true,
};

/** 81.4 / 1.78² = 25.7 */
export const PREVIEW_BMI = Number(
  (PREVIEW_CLIENT_PROFILE.weightKg! / (PREVIEW_CLIENT_PROFILE.heightCm! / 100) ** 2).toFixed(1),
);

/** "Day 3" on the Home nutrition card. */
export const PREVIEW_DIET_DAY_NUMBER = 3;
