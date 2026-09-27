'use strict';

const { z } = require('zod');

const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .optional();

const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Not a valid id')
  .optional();

exports.logsQuery = z.object({
  from: dateKey,
  to: dateKey,
  clientId: objectId,
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

exports.summaryQuery = z.object({
  clientId: objectId,
});
