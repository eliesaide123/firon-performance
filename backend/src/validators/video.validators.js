'use strict';

const { z, objectId, pagination, boolFromQuery } = require('./common.validators');

const listQuery = pagination.extend({
  category: z.string().trim().optional(),
  categoryId: objectId.optional(),
  favorite: boolFromQuery.optional(),
  q: z.string().trim().optional(),
  includeUnpublished: boolFromQuery.optional(),
  sort: z.enum(['order', 'newest', 'title']).optional(),
});

const create = z.object({
  title: z.string().trim().min(1, 'Title is required').max(160),
  description: z.string().trim().max(2000).optional(),
  categoryId: objectId.nullish(),
  category: z.string().trim().max(60).optional(),
  durationSec: z.coerce.number().min(0).optional(),
  durationLabel: z.string().trim().regex(/^(\d+:)?\d{1,2}:\d{2}$/, "Use 'mm:ss' or 'h:mm:ss'").optional(),
  videoMediaId: objectId.nullish(),
  thumbnailMediaId: objectId.nullish(),
  gradientIndex: z.coerce.number().int().min(0).max(7).optional(),
  isPublished: z.boolean().optional(),
  tags: z.array(z.string().trim()).optional(),
  level: z.string().trim().max(40).optional(),
  order: z.coerce.number().int().optional(),
});

const update = create.partial();

const progress = z.object({
  progress: z.coerce.number().min(0, 'progress must be between 0 and 1').max(1, 'progress must be between 0 and 1'),
  secondsWatched: z.coerce.number().min(0).optional(),
}).strict();

const favorite = z.object({
  favorite: z.boolean().optional(),
}).optional();

module.exports = { listQuery, create, update, progress, favorite };
