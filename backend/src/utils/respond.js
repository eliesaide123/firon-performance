'use strict';

/**
 * The single response envelope used by the whole API (CONTRACT §5):
 *   success -> { success: true, data, meta? }
 *   error   -> { success: false, error: { code, message, details? } }
 */
function ok(res, data = null, meta) {
  const body = { success: true, data };
  if (meta !== undefined) body.meta = meta;
  return res.json(body);
}

function created(res, data = null, meta) {
  res.status(201);
  return ok(res, data, meta);
}

function noContent(res) {
  return ok(res, { deleted: true });
}

function fail(res, status, code, message, details) {
  const error = { code, message };
  if (details !== undefined) error.details = details;
  return res.status(status).json({ success: false, error });
}

module.exports = { ok, created, noContent, fail };
