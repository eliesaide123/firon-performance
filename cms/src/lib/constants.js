/* Enumerations mirrored from CONTRACT.md §4 / §8. */

export const CONTENT_GROUPS = [
  'auth', 'home', 'train', 'videos', 'nutrition',
  'profile', 'pt', 'common', 'tabs', 'notifications',
];

export const CONTENT_TYPES = [
  'text', 'richtext', 'image', 'video', 'number', 'boolean', 'color', 'json',
];

export const PLATFORMS = ['mobile', 'cms', 'both'];

export const LOCALES = [
  { value: 'en', label: 'English (en)' },
  { value: 'ar', label: 'Arabic (ar)' },
  { value: 'fr', label: 'French (fr)' },
];

export const ROLES = ['client', 'trainer', 'admin'];
export const STAFF_ROLES = ['admin', 'trainer'];

export const MEDIA_STATUSES = ['pending', 'approved', 'rejected'];
export const MEDIA_KINDS = ['image', 'video'];

export const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Glutes', 'Core',
  'Full body', 'Conditioning',
];
export const EQUIPMENT = [
  'Barbell', 'Dumbbell', 'Kettlebell', 'Machine', 'Cable',
  'Bodyweight', 'Bands', 'Sled', 'Bike', 'Treadmill', 'None',
];
export const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const MEAL_SLOTS = ['Breakfast', 'Lunch', 'Snack', 'Dinner', 'Pre-workout', 'Post-workout'];
export const PLAN_STATUSES = ['draft', 'active', 'archived'];

/**
 * Media placeholder gradients come from `@firon/shared` (FP_GRADIENTS /
 * fpGradientCss) so the CMS and the mobile app cannot drift. Re-exported here
 * only so pages have one import for enumerations.
 */
export { fpGradientCss as gradient } from '@firon/shared';
/** Screens per content group — drives the phone preview + the screen filter. */
export const GROUP_SCREENS = {
  auth: ['login', 'register', 'forgot', 'otp', 'onboard'],
  home: ['home'],
  train: ['workouts'],
  videos: ['videos', 'search'],
  nutrition: ['nutrition'],
  profile: ['profile'],
  pt: ['pt-roster', 'pt-builder', 'pt-uploads', 'pt-profile'],
  tabs: ['tabs'],
  common: ['common'],
  notifications: ['notifications'],
};

export const APP_VERSION = '1.0.0';
