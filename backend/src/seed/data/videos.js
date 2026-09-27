'use strict';

/**
 * Video library (CONTRACT §9) — titles, categories and durations straight from
 * the prototype `videos` array. `gradientIndex` mirrors the prototype's
 * `grads[i % grads.length]` fallback art.
 *
 * `progressFor` lists the per-user VideoProgress rows to seed.
 */

const videos = [
  {
    ref: 'full-body-hiit',
    title: 'Full Body HIIT',
    description: '24 minutes of full-body intervals — 40s work, 20s rest. Bring water.',
    category: 'HIIT',
    durationLabel: '24:10',
    durationSec: 24 * 60 + 10,
    gradientIndex: 0,
    level: 'Intermediate',
    order: 1,
    tags: ['hiit', 'conditioning', 'full body'],
  },
  {
    ref: 'deep-core-stability',
    title: 'Deep Core Stability',
    description: 'Anti-rotation and bracing work for a bulletproof midsection.',
    category: 'Core',
    durationLabel: '18:45',
    durationSec: 18 * 60 + 45,
    gradientIndex: 1,
    level: 'Beginner',
    order: 2,
    tags: ['core', 'stability'],
  },
  {
    ref: 'mobility-flow',
    title: 'Mobility Flow',
    description: 'A 12-minute flow to open hips, ankles and thoracic spine.',
    category: 'Mobility',
    durationLabel: '12:30',
    durationSec: 12 * 60 + 30,
    gradientIndex: 2,
    level: 'Beginner',
    order: 3,
    tags: ['mobility', 'recovery'],
  },
  {
    ref: 'upper-push-strength',
    title: 'Upper Push Strength',
    description: 'Bench, overhead press and accessory pushing for upper-body strength.',
    category: 'Strength',
    durationLabel: '32:00',
    durationSec: 32 * 60,
    gradientIndex: 3,
    level: 'Intermediate',
    order: 4,
    tags: ['strength', 'push', 'upper body'],
  },
  {
    ref: 'beginner-yoga-reset',
    title: 'Beginner Yoga Reset',
    description: 'Gentle reset session for rest days — breathe and lengthen.',
    category: 'Yoga',
    durationLabel: '21:15',
    durationSec: 21 * 60 + 15,
    gradientIndex: 4,
    level: 'Beginner',
    order: 5,
    tags: ['yoga', 'recovery', 'rest day'],
  },
  {
    ref: 'explosive-legs',
    title: 'Explosive Legs',
    description: 'Jumps, sled and squat variations for lower-body power.',
    category: 'Strength',
    durationLabel: '28:40',
    durationSec: 28 * 60 + 40,
    gradientIndex: 5,
    level: 'Advanced',
    order: 6,
    tags: ['strength', 'legs', 'power'],
  },
];

/** Elie's watch state from the prototype. */
const progress = [
  { userRef: 'elie', videoRef: 'full-body-hiit', progress: 0.62, favorite: true },
  { userRef: 'elie', videoRef: 'mobility-flow', progress: 0.3, favorite: true },
  { userRef: 'elie', videoRef: 'beginner-yoga-reset', progress: 0.85, favorite: false },
  { userRef: 'elie', videoRef: 'explosive-legs', progress: 0, favorite: true },
];

module.exports = { videos, progress };
