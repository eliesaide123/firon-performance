'use strict';

/**
 * The seed inserts MediaAsset rows pointing at /uploads/seed-*.  Without the actual files the CMS
 * media library, the video player and every image/video content key render as broken 404s — which
 * looks like a bug in the app rather than missing fixtures.
 *
 * This generates lightweight placeholder media whose dimensions and durations match the seeded
 * metadata exactly, so previews behave like real assets (portrait 9:16 video, landscape stills).
 * Requires ffmpeg; if it is absent we log and carry on — the seed must never fail over fixtures.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const UPLOAD_DIR = path.resolve(__dirname, '../../', process.env.UPLOAD_DIR || 'uploads');

/** [filename, ffmpeg -i lavfi source, extra args] — kept in step with seed/data/media.js */
const ASSETS = [
  ['seed-deadlift-form-cue.mp4',
   'gradients=s=1080x1920:c0=0x0b0f0d:c1=0x1f3a24:x0=0:y0=0:x1=1080:y1=1920:d=45:speed=0.06',
   ['-r', '24', '-t', '45', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '32']],
  ['seed-kettlebell-swing.mp4',
   'gradients=s=1080x1920:c0=0x14191b:c1=0x12242a:x0=0:y0=0:x1=1080:y1=1920:d=32:speed=0.08',
   ['-r', '24', '-t', '32', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '32']],
  ['seed-band-pull-apart.jpg',
   'gradients=s=1600x1200:c0=0x242c31:c1=0x3a1c71:x0=0:y0=0:x1=1600:y1=1200',
   ['-frames:v', '1', '-q:v', '3']],
];

function hasFfmpeg() {
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; }
}

function generateSeedMedia({ force = false } = {}) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const missing = ASSETS.filter(([name]) => force || !fs.existsSync(path.join(UPLOAD_DIR, name)));
  if (!missing.length) return { created: 0, skipped: ASSETS.length };

  if (!hasFfmpeg()) {
    logger.warn(
      { missing: missing.map(([n]) => n) },
      '[seed] ffmpeg not found — seeded media files were not generated; previews will 404',
    );
    return { created: 0, skipped: 0, ffmpeg: false };
  }

  let created = 0;
  for (const [name, source, args] of missing) {
    const out = path.join(UPLOAD_DIR, name);
    try {
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', source, ...args, out], { stdio: 'ignore' });
      created += 1;
    } catch (err) {
      logger.warn({ name, err: err.message }, '[seed] could not generate a media placeholder');
    }
  }
  return { created, skipped: ASSETS.length - missing.length };
}

module.exports = { generateSeedMedia, UPLOAD_DIR, ASSETS };
