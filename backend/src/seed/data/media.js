'use strict';

/**
 * Sara's three uploads (CONTRACT §9 / prototype "Your uploads").
 * `uploadedByRef` / `reviewedByRef` are resolved by the seed runner.
 * No real file lands on disk — `url` points at the placeholder path the CMS
 * would have written, and `gradientIndex` drives the prototype's fallback art.
 */

module.exports = [
  {
    ref: 'deadlift-cue',
    title: 'Deadlift form cue',
    description: 'Hip-hinge cue: chest proud, bar over mid-foot, 3-second eccentric.',
    kind: 'video',
    category: 'Strength',
    filename: 'seed-deadlift-form-cue.mp4',
    originalName: 'deadlift-form-cue.mp4',
    mimeType: 'video/mp4',
    sizeBytes: 5_242_880,
    durationSec: 45, // 0:45
    width: 1080,
    height: 1920,
    url: '/uploads/seed-deadlift-form-cue.mp4',
    status: 'approved',
    reviewedByRef: 'admin',
    uploadedByRef: 'sara',
    tags: ['deadlift', 'demo', 'form'],
    gradientIndex: 2,
  },
  {
    ref: 'kb-swing',
    title: 'Kettlebell swing',
    description: 'Russian swing — snap the hips, bell floats to chest height.',
    kind: 'video',
    category: 'HIIT',
    filename: 'seed-kettlebell-swing.mp4',
    originalName: 'kettlebell-swing.mp4',
    mimeType: 'video/mp4',
    sizeBytes: 3_670_016,
    durationSec: 32, // 0:32
    width: 1080,
    height: 1920,
    url: '/uploads/seed-kettlebell-swing.mp4',
    status: 'pending',
    uploadedByRef: 'sara',
    tags: ['kettlebell', 'demo', 'conditioning'],
    gradientIndex: 3,
  },
  {
    ref: 'band-pull-apart',
    title: 'Band pull-apart',
    description: 'Scapular retraction warm-up — straight arms, squeeze for one count.',
    kind: 'image',
    category: 'Mobility',
    filename: 'seed-band-pull-apart.jpg',
    originalName: 'band-pull-apart.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 524_288,
    width: 1600,
    height: 1200,
    url: '/uploads/seed-band-pull-apart.jpg',
    status: 'pending',
    uploadedByRef: 'sara',
    tags: ['band', 'warm-up', 'shoulders'],
    gradientIndex: 4,
  },
];
