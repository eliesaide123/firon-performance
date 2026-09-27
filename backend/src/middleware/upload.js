'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { env } = require('../config');
const ApiError = require('../utils/ApiError');
const { slugify } = require('../utils/text');

fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/webm'];
const ALLOWED_MIMES = [...IMAGE_MIMES, ...VIDEO_MIMES];

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
};

const kindFromMime = (mime) => (VIDEO_MIMES.includes(mime) ? 'video' : 'image');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, env.UPLOAD_DIR),
  filename: (req, file, cb) => {
    const base = slugify(path.parse(file.originalname || 'upload').name, { max: 40 });
    const ext = (path.extname(file.originalname || '') || EXT_BY_MIME[file.mimetype] || '').toLowerCase();
    // <uuid-ish>-<slug>.<ext>
    cb(null, `${crypto.randomUUID()}-${base}${ext || EXT_BY_MIME[file.mimetype] || ''}`);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    return cb(new ApiError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      `'${file.mimetype}' is not allowed. Accepted: ${ALLOWED_MIMES.join(', ')}`,
    ));
  }
  return cb(null, true);
}

const limits = { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 };

const uploader = multer({ storage, fileFilter, limits });

/** Single file under the field name `file` (CONTRACT §5 /api/media/upload). */
const uploadSingle = (field = 'file') => uploader.single(field);

/** Removes a half-written file when a request fails after multer ran. */
function cleanupFile(file) {
  if (!file || !file.path) return;
  fs.unlink(file.path, () => {});
}

module.exports = {
  uploader,
  uploadSingle,
  cleanupFile,
  kindFromMime,
  ALLOWED_MIMES,
  IMAGE_MIMES,
  VIDEO_MIMES,
};
