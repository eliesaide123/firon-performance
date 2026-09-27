'use strict';

const { z, objectId, locale } = require('./common.validators');

const CONTENT_TYPES = ['text', 'richtext', 'image', 'video', 'number', 'boolean', 'color', 'json'];
const PLATFORMS = ['mobile', 'cms', 'both'];

const listQuery = z.object({
  platform: z.enum([...PLATFORMS, 'all']).optional(),
  locale: locale.optional(),
  group: z.string().trim().optional(),
  screen: z.string().trim().optional(),
  q: z.string().trim().optional(),
  format: z.enum(['map', 'list']).default('map'),
  includeUnpublished: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional(),
});

const create = z.object({
  key: z.string().trim().min(1).max(200).regex(/^[a-zA-Z0-9_.\-]+$/, 'Keys may contain letters, digits, dots, dashes and underscores'),
  type: z.enum(CONTENT_TYPES),
  value: z.any().optional(),
  locale: locale.optional(),
  platform: z.enum(PLATFORMS).optional(),
  group: z.string().trim().max(60).optional(),
  screen: z.string().trim().max(60).optional(),
  label: z.string().trim().max(160).optional(),
  description: z.string().trim().max(500).optional(),
  mediaId: objectId.nullish(),
  isPublished: z.boolean().optional(),
});

const update = create.partial().extend({
  key: z.string().trim().min(1).max(200).optional(),
});

const bulk = z.object({
  items: z
    .array(z.object({
      key: z.string().trim().min(1).optional(),
      id: objectId.optional(),
      value: z.any().optional(),
      mediaId: objectId.nullish(),
      isPublished: z.boolean().optional(),
      locale: locale.optional(),
    }).refine((v) => v.key || v.id, { message: 'Each item needs a key or an id' }))
    .min(1, 'items must not be empty')
    .max(500),
  locale: locale.optional(),
});

module.exports = { listQuery, create, update, bulk, CONTENT_TYPES, PLATFORMS };
