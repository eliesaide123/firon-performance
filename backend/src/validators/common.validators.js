'use strict';

const { z } = require('zod');

const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Must be a 24-character hex id');

/** Accepts '3' from a query string and hands back a number. */
const numeric = (opts = {}) => z.coerce.number({ invalid_type_error: 'Must be a number' })
  .refine((v) => Number.isFinite(v), 'Must be a number')
  .pipe(z.number().min(opts.min ?? -Infinity).max(opts.max ?? Infinity));

const intFromQuery = z.coerce.number().int();

/** '?favorite=true' / '?favorite=1' -> boolean */
const boolFromQuery = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0', 'yes', 'no', ''])])
  .transform((v) => v === true || v === 'true' || v === '1' || v === 'yes');

const pagination = z.object({
  page: intFromQuery.min(1).optional(),
  limit: intFromQuery.min(1).max(200).optional(),
});

const locale = z.string().trim().min(2).max(8).default('en');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Must be HH:mm');
const isoDate = z.coerce.date();
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');
const trimmed = (max = 500) => z.string().trim().max(max);

const idParam = z.object({ id: objectId });
const keyParam = z.object({ key: z.string().trim().min(1).max(200) });

module.exports = {
  z,
  objectId,
  numeric,
  intFromQuery,
  boolFromQuery,
  pagination,
  locale,
  hhmm,
  isoDate,
  dateKey,
  trimmed,
  idParam,
  keyParam,
};
