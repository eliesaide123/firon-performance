#!/usr/bin/env node
'use strict';

/**
 * Firon Performance seeder (CONTRACT §9).
 *
 *   npm run seed                      wipe + seed everything
 *   npm run seed:content              upsert MISSING Content keys only (non-destructive)
 *   node src/seed/index.js --content-only
 *   node src/seed/index.js --content-only --force-content   overwrite existing values too
 *
 * The content-only pass never clobbers a key an admin has edited
 * (`version > 1` or `updatedBy` set) unless `--force-content` is given.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { connectDB, disconnectDB } = require('../config/db');
const {
  User,
  Otp,
  Content,
  MediaAsset,
  Category,
  Video,
  VideoProgress,
  Exercise,
  TrainingPlan,
  DietPlan,
  MealLog,
  WorkoutLog,
  SessionRecord,
  Notification,
  AuditLog,
} = require('../models');

const userData = require('./data/users');
const contentDefaults = require('./data/content');
const categoryData = require('./data/categories');
const mediaData = require('./data/media');
const { videos: videoData, progress: progressData } = require('./data/videos');
const exerciseData = require('./data/exercises');
const { trainingPlans, dietPlans } = require('./data/plans');

/* ------------------------------ tiny console ---------------------------- */

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};
const say = (...a) => console.log(...a);
const step = (msg) => say(`${C.cyan('›')} ${msg}`);

/* --------------------------------- args --------------------------------- */

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const CONTENT_ONLY = has('--content-only') || has('--content');
const FORCE_CONTENT = has('--force-content') || has('--force');

/* -------------------------------- helpers ------------------------------- */

/** YYYY-MM-DD in local time. */
function ymd(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Monday 00:00 of the week containing `d`. */
function startOfWeek(d = new Date()) {
  const out = new Date(d);
  const dow = (out.getDay() + 6) % 7; // Mon = 0
  out.setDate(out.getDate() - dow);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(date, days) {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

/* ----------------------------- content upsert --------------------------- */

const CONTENT_META = ['type', 'group', 'screen', 'label', 'description', 'platform', 'locale'];

async function seedContentDefaults({ force = false, fresh = false } = {}) {
  const stats = { inserted: 0, refreshed: 0, overwritten: 0, skipped: 0, total: contentDefaults.length };

  if (fresh) {
    await Content.insertMany(contentDefaults);
    stats.inserted = contentDefaults.length;
    return stats;
  }

  for (const def of contentDefaults) {
    // eslint-disable-next-line no-await-in-loop
    const existing = await Content.findOne({ key: def.key, locale: def.locale });

    if (!existing) {
      // eslint-disable-next-line no-await-in-loop
      await Content.create(def);
      stats.inserted += 1;
      continue;
    }

    const edited = (existing.version || 1) > 1 || !!existing.updatedBy;

    if (force) {
      Object.assign(existing, def, { version: existing.version || 1 });
      // eslint-disable-next-line no-await-in-loop
      await existing.save();
      stats.overwritten += 1;
      continue;
    }

    if (edited) {
      stats.skipped += 1;
      continue;
    }

    // Untouched key: safe to refresh CMS metadata, but never the value.
    let dirty = false;
    for (const field of CONTENT_META) {
      if (def[field] !== undefined && existing[field] !== def[field]) {
        existing[field] = def[field];
        dirty = true;
      }
    }
    if (dirty) {
      // eslint-disable-next-line no-await-in-loop
      await existing.save();
      stats.refreshed += 1;
    } else {
      stats.skipped += 1;
    }
  }

  return stats;
}

/* --------------------------------- wipe --------------------------------- */

const OWNED_MODELS = [
  ['User', User],
  ['Otp', Otp],
  ['Content', Content],
  ['MediaAsset', MediaAsset],
  ['Category', Category],
  ['Video', Video],
  ['VideoProgress', VideoProgress],
  ['Exercise', Exercise],
  ['TrainingPlan', TrainingPlan],
  ['DietPlan', DietPlan],
  ['MealLog', MealLog],
  ['WorkoutLog', WorkoutLog],
  ['SessionRecord', SessionRecord],
  ['Notification', Notification],
  ['AuditLog', AuditLog],
];

async function wipe() {
  for (const [name, Model] of OWNED_MODELS) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await Model.collection.drop();
    } catch (err) {
      if (err.codeName !== 'NamespaceNotFound' && err.code !== 26) {
        throw new Error(`failed to drop ${name}: ${err.message}`);
      }
    }
  }
  // Recreate declared indexes (incl. the Otp TTL + compound uniques).
  for (const [, Model] of OWNED_MODELS) {
    // eslint-disable-next-line no-await-in-loop
    await Model.createIndexes();
  }
}

/* --------------------------------- seed --------------------------------- */

async function seedAll() {
  step('Dropping owned collections…');
  await wipe();

  /* ---- users ---- */
  step('Seeding users…');
  const usersByRef = {};
  for (const spec of userData.all) {
    const { ref, password, clientProfile, ...rest } = spec;
    const doc = new User({ ...rest, passwordHash: 'placeholder' });
    if (clientProfile) {
      const { trainerRef, ...profile } = clientProfile;
      doc.clientProfile = profile;
      doc.$locals.trainerRef = trainerRef;
    }
    doc.setPassword(password);
    // eslint-disable-next-line no-await-in-loop
    await doc.save();
    usersByRef[ref] = doc;
  }
  // wire trainers now that every user exists
  for (const spec of userData.clients) {
    const doc = usersByRef[spec.ref];
    const trainerRef = spec.clientProfile && spec.clientProfile.trainerRef;
    if (trainerRef && usersByRef[trainerRef]) {
      doc.clientProfile.trainerId = usersByRef[trainerRef]._id;
      // eslint-disable-next-line no-await-in-loop
      await doc.save();
    }
  }

  /* ---- media ---- */
  step('Seeding media assets…');
  const mediaByRef = {};
  for (const spec of mediaData) {
    const { ref, uploadedByRef, reviewedByRef, gradientIndex, ...rest } = spec;
    const doc = await MediaAsset.create({
      ...rest,
      uploadedBy: uploadedByRef ? usersByRef[uploadedByRef]._id : undefined,
      reviewedBy: reviewedByRef ? usersByRef[reviewedByRef]._id : undefined,
      reviewedAt: rest.status === 'approved' || rest.status === 'rejected' ? new Date() : undefined,
      tags: [...(rest.tags || []), `gradient:${gradientIndex}`],
    });
    mediaByRef[ref] = doc;
  }

  /* ---- categories ---- */
  step('Seeding categories…');
  const categories = await Category.insertMany(categoryData);
  const categoryByName = Object.fromEntries(categories.map((c) => [c.name, c]));

  /* ---- videos + progress ---- */
  step('Seeding videos…');
  const videosByRef = {};
  for (const spec of videoData) {
    const { ref, category, ...rest } = spec;
    const cat = categoryByName[category];
    // eslint-disable-next-line no-await-in-loop
    const doc = await Video.create({
      ...rest,
      category,
      categoryId: cat ? cat._id : undefined,
      isPublished: true,
      publishedAt: new Date(),
      createdBy: usersByRef.sara._id,
    });
    videosByRef[ref] = doc;
  }

  const progressDocs = progressData.map((p) => ({
    userId: usersByRef[p.userRef]._id,
    videoId: videosByRef[p.videoRef]._id,
    progress: p.progress,
    favorite: p.favorite,
    secondsWatched: Math.round((videosByRef[p.videoRef].durationSec || 0) * p.progress),
    lastWatchedAt: p.progress > 0 ? new Date() : undefined,
  }));
  await VideoProgress.insertMany(progressDocs);

  /* ---- exercises ---- */
  step('Seeding exercises…');
  const exerciseDocs = exerciseData.map((e) => {
    const { demoMediaRef, ...rest } = e;
    return {
      ...rest,
      demoMediaId: demoMediaRef ? mediaByRef[demoMediaRef]._id : undefined,
      createdBy: usersByRef.sara._id,
    };
  });
  const exercises = await Exercise.insertMany(exerciseDocs);
  const exerciseByName = Object.fromEntries(exercises.map((e) => [e.name, e]));

  /* ---- training plans ---- */
  step('Seeding training plans…');
  const weekStart = startOfWeek();
  const trainingByRef = {};
  for (const spec of trainingPlans) {
    const { ref, clientRef, trainerRef, days, ...rest } = spec;
    const doc = await TrainingPlan.create({
      ...rest,
      clientId: usersByRef[clientRef]._id,
      trainerId: usersByRef[trainerRef]._id,
      startDate: weekStart,
      endDate: addDays(weekStart, 6),
      assignedAt: addDays(weekStart, -1),
      days: days.map((d) => ({
        ...d,
        completedAt: d.status === 'done' ? addDays(weekStart, d.dayIndex) : undefined,
        exercises: (d.exercises || []).map((e, i) => ({
          ...e,
          order: e.order === undefined ? i : e.order,
          exerciseId: exerciseByName[e.name] ? exerciseByName[e.name]._id : undefined,
        })),
      })),
    });
    trainingByRef[ref] = doc;
  }

  /* ---- diet plans ---- */
  step('Seeding diet plans…');
  const dietByRef = {};
  for (const spec of dietPlans) {
    const { ref, clientRef, trainerRef, ...rest } = spec;
    // eslint-disable-next-line no-await-in-loop
    const doc = await DietPlan.create({
      ...rest,
      clientId: usersByRef[clientRef]._id,
      trainerId: usersByRef[trainerRef]._id,
      startDate: weekStart,
      assignedAt: addDays(weekStart, -1),
    });
    dietByRef[ref] = doc;
  }

  /* ---- logs so the dashboards are not empty ---- */
  step('Seeding logs & sessions…');
  const today = ymd();
  const elie = usersByRef.elie;

  const elieDiet = dietByRef['diet-elie'];
  await MealLog.insertMany(
    elieDiet.meals
      .filter((m) => m.consumed)
      .map((m) => ({
        userId: elie._id,
        dietPlanId: elieDiet._id,
        date: today,
        slot: m.slot,
        food: m.food,
        kcal: m.kcal,
        consumed: true,
        source: 'plan',
      }))
  );

  const eliePlan = trainingByRef['plan-elie'];
  const workoutLogs = [];
  for (const day of eliePlan.days) {
    for (const e of day.exercises) {
      if (!e.done) continue;
      workoutLogs.push({
        userId: elie._id,
        trainingPlanId: eliePlan._id,
        dayIndex: day.dayIndex,
        date: ymd(addDays(weekStart, day.dayIndex)),
        exerciseName: e.name,
        sets: e.sets,
        reps: e.reps,
        weightKg: e.weightKg,
        source: 'plan',
        completed: true,
        durationMin: day.durationMin,
      });
    }
  }
  await WorkoutLog.insertMany(workoutLogs);

  // Sara's week: 12 sessions (the prototype's "Sessions this wk" stat).
  const sessionClients = ['elie', 'maya', 'omar', 'karim'];
  const sessionRecords = [];
  for (let i = 0; i < 12; i += 1) {
    const clientRef = sessionClients[i % sessionClients.length];
    const dayOffset = Math.floor(i / 2); // 2 per day, Mon..Sat
    const scheduledAt = addDays(weekStart, dayOffset);
    scheduledAt.setHours(i % 2 === 0 ? 8 : 18, 0, 0, 0);
    const completed = scheduledAt.getTime() < Date.now();
    sessionRecords.push({
      clientId: usersByRef[clientRef]._id,
      trainerId: usersByRef.sara._id,
      trainingPlanId: trainingByRef[`plan-${clientRef}`]
        ? trainingByRef[`plan-${clientRef}`]._id
        : undefined,
      dayIndex: dayOffset,
      title: 'PT session',
      scheduledAt,
      completedAt: completed ? scheduledAt : undefined,
      durationMin: 60,
      location: 'Studio 2 · Beirut',
      status: completed ? 'completed' : 'scheduled',
    });
  }
  await SessionRecord.insertMany(sessionRecords);

  await Notification.insertMany([
    {
      userId: elie._id,
      title: 'New training plan',
      body: 'Coach Sara assigned "Fat Loss · Week 4".',
      type: 'plan_assigned',
      data: { planId: String(eliePlan._id), kind: 'training' },
      read: false,
      deepLink: 'firon://train',
    },
    {
      userId: elie._id,
      title: 'Nutrition updated',
      body: 'Your Cutting Plan targets were adjusted to 2,100 kcal.',
      type: 'plan_updated',
      data: { planId: String(elieDiet._id), kind: 'diet' },
      read: false,
      deepLink: 'firon://nutrition',
    },
    {
      userId: usersByRef.sara._id,
      title: 'New client request',
      body: 'Lina Aoun is waiting for her first plan.',
      type: 'new_client',
      data: { clientId: String(usersByRef.lina._id) },
      read: false,
      deepLink: 'firon://pt/clients',
    },
    {
      userId: usersByRef.sara._id,
      title: 'Upload approved',
      body: '"Deadlift form cue" was approved by admin.',
      type: 'media_approved',
      data: { mediaId: String(mediaByRef['deadlift-cue']._id) },
      read: true,
      readAt: new Date(),
      deepLink: 'firon://pt/uploads',
    },
  ]);

  await AuditLog.create({
    userId: usersByRef.admin._id,
    action: 'seed',
    entity: 'database',
    entityId: 'all',
    after: { seededAt: new Date().toISOString() },
  });

  /* ---- content ---- */
  step('Seeding CMS content keys…');
  const contentStats = await seedContentDefaults({ fresh: true });

  return { usersByRef, contentStats, trainingByRef, dietByRef };
}

/* -------------------------------- summary ------------------------------- */

async function printSummary({ contentStats, contentOnly }) {
  const rows = [];
  for (const [name, Model] of OWNED_MODELS) {
    // eslint-disable-next-line no-await-in-loop
    rows.push([name, await Model.countDocuments()]);
  }

  const width = Math.max(...rows.map(([n]) => n.length));
  say('');
  say(C.bold('  ── Firon Performance · seed summary ──────────────────────────'));
  say('');
  for (const [name, count] of rows) {
    const flag = count === 0 ? C.dim('0') : C.green(String(count));
    say(`   ${name.padEnd(width)}  ${flag}`);
  }
  say('');
  if (contentStats) {
    say(
      `   ${C.bold('Content keys')}: ${C.green(contentStats.total)} defined ` +
        `(${contentStats.inserted} inserted` +
        (contentStats.refreshed ? `, ${contentStats.refreshed} metadata-refreshed` : '') +
        (contentStats.overwritten ? `, ${contentStats.overwritten} overwritten` : '') +
        (contentStats.skipped ? `, ${contentStats.skipped} left untouched` : '') +
        ')'
    );
    say('');
  }

  if (!contentOnly) {
    say(C.bold('  ── Demo logins (password for every account: password1) ───────'));
    say('');
    say(`   ${C.yellow('admin@firon.app')}   password1   ${C.dim('admin   · CMS only')}`);
    say(`   ${C.yellow('sara@firon.app')}    password1   ${C.dim('trainer · PT portal (Sara Khalil)')}`);
    say(`   ${C.yellow('elie@firon.app')}    password1   ${C.dim('client  · ← the demo login')}`);
    say(`   ${C.yellow('maya@firon.app')}    password1   ${C.dim('client')}`);
    say(`   ${C.yellow('omar@firon.app')}    password1   ${C.dim('client')}`);
    say(`   ${C.yellow('lina@firon.app')}    password1   ${C.dim('client  · still onboarding')}`);
    say(`   ${C.yellow('karim@firon.app')}   password1   ${C.dim('client')}`);
    say('');
    say(`   OTP dev code: ${C.yellow(process.env.OTP_DEV_CODE || '1234')} (any 4-digit prompt, non-production)`);
    say('');
  }
}

/* --------------------------------- main --------------------------------- */

async function main() {
  const started = Date.now();
  await connectDB();

  let contentStats;
  if (CONTENT_ONLY) {
    say(C.bold(`\n  Firon seed · content only${FORCE_CONTENT ? ' (FORCE)' : ''}\n`));
    step(`Upserting ${contentDefaults.length} content keys…`);
    contentStats = await seedContentDefaults({ force: FORCE_CONTENT });
  } else {
    say(C.bold('\n  Firon seed · full reset\n'));
    const res = await seedAll();
    contentStats = res.contentStats;
  }

  await printSummary({ contentStats, contentOnly: CONTENT_ONLY });
  say(C.dim(`  done in ${((Date.now() - started) / 1000).toFixed(2)}s\n`));

  await disconnectDB();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error(C.red('\n  seed failed:'), err);
      try {
        await disconnectDB();
      } catch (_) {
        /* ignore */
      }
      process.exit(1);
    });
}

module.exports = { seedAll, seedContentDefaults, contentDefaults, wipe };
