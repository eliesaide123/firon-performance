'use strict';

const { z, hhmm } = require('./common.validators');

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const updateTrainerProfile = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  title: z.string().trim().max(120).optional(),
  studio: z.string().trim().max(120).optional(),
  rate: z.string().trim().max(60).optional(),
  since: z.string().trim().max(20).optional(),
  certs: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    verified: z.boolean().optional(),
  })).max(20).optional(),
}).strict();

/**
 * CONTRACT + prototype saveAvailability(): exactly 7 entries and, for every
 * day that is NOT off, `from` must be strictly before `to`.
 */
const availability = z.object({
  availability: z
    .array(z.object({
      day: z.enum(DAYS),
      off: z.boolean().default(false),
      from: hhmm.default('09:00'),
      to: hhmm.default('17:00'),
    }))
    .length(7, 'Provide exactly 7 entries — one per day, Mon through Sun'),
})
  .superRefine((val, ctx) => {
    const seen = new Set();
    val.availability.forEach((d, i) => {
      if (seen.has(d.day)) {
        ctx.addIssue({ code: 'custom', path: ['availability', i, 'day'], message: `Duplicate day '${d.day}'` });
      }
      seen.add(d.day);
      if (!d.off && !(d.from < d.to)) {
        ctx.addIssue({
          code: 'custom',
          path: ['availability', i, 'from'],
          message: `${d.day}: opening time must be before closing time`,
        });
      }
    });
    DAYS.forEach((day) => {
      if (!seen.has(day)) {
        ctx.addIssue({ code: 'custom', path: ['availability'], message: `Missing day '${day}'` });
      }
    });
  });

const prefs = z.object({
  newClientRequests: z.boolean().optional(),
  sessionReminders: z.boolean().optional(),
  weeklyAdherenceReport: z.boolean().optional(),
}).strict().refine((v) => Object.keys(v).length > 0, 'Provide at least one preference');

module.exports = { updateTrainerProfile, availability, prefs, DAYS };
