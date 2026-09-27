# Firon Performance — Database

Mongoose 8 models, connection helper and seed data. Authoritative spec: [`docs/CONTRACT.md`](../../docs/CONTRACT.md) §4, §8, §9.

- **Database:** `firon_performance` on `mongodb://127.0.0.1:27017`
- **Style:** CommonJS, one file per model, PascalCase filenames
- **Every schema:** `{ timestamps: true }` + the shared `toJSON` plugin

```
backend/src/
  config/db.js              connectDB / disconnectDB / dbState / dbName
  models/
    plugins/toJSON.js       _id -> id, strips __v, passwordHash, codeHash; virtuals on
    index.js                barrel — always require models from here
    User.js  Otp.js  Content.js  MediaAsset.js  Category.js  Video.js
    VideoProgress.js  Exercise.js  TrainingPlan.js  DietPlan.js
    MealLog.js  WorkoutLog.js  SessionRecord.js  Notification.js  AuditLog.js
  seed/
    index.js                the runner (full reset / content-only / force-content)
    data/  users.js  content.js  videos.js  exercises.js  plans.js  media.js  categories.js
```

```js
// always go through the barrel so every model is registered before any populate()
const { User, Content, TrainingPlan } = require('../models');
```

---

## ER overview

```
                          ┌──────────────┐
                          │     User     │  role: client | trainer | admin
                          └──────┬───────┘
      clientProfile.trainerId ───┘ (client ──> trainer, self-reference)
                                 │
   ┌──────────────┬──────────────┼──────────────┬──────────────┬─────────────┐
   │              │              │              │              │             │
┌──▼───┐   ┌──────▼──────┐  ┌────▼────────┐ ┌───▼──────────┐ ┌─▼──────────┐ ┌▼──────────┐
│ Otp  │   │ MediaAsset  │  │TrainingPlan │ │  DietPlan    │ │VideoProgres│ │Notificatn │
│(TTL) │   │ uploadedBy  │  │ clientId    │ │ clientId     │ │ userId     │ │ userId    │
└──────┘   │ reviewedBy  │  │ trainerId   │ │ trainerId    │ │ videoId ───┼─┐└───────────┘
           └──┬───┬───┬──┘  │ days[]      │ │ meals[]      │ └────────────┘ │
              │   │   │     │  .exercises[]│└──────┬───────┘                │
              │   │   │     └───┬──────┬──┘       │                        │
     ┌────────▼┐  │   │         │      │          │                   ┌────▼────┐
     │ Content │  │   │  ┌──────▼──┐   │   ┌──────▼────┐              │  Video  │
     │ mediaId │  │   │  │Exercise │   │   │  MealLog  │              │categoryId│
     └─────────┘  │   │  │demoMedia│   │   │ dietPlanId│              └────┬────┘
                  │   └──┴─────────┘   │   └───────────┘                   │
                  │                    │                             ┌─────▼────┐
                  │             ┌──────▼──────┐  ┌───────────────┐   │ Category │
                  └─────────────│ WorkoutLog  │  │ SessionRecord │   └──────────┘
                                │trainingPlanId│  │ clientId      │
                                └─────────────┘  │ trainerId     │   ┌──────────┐
                                                 │ trainingPlanId│   │ AuditLog │
                                                 └───────────────┘   │  userId  │
                                                                     └──────────┘
```

---

## Collections

| Model | Purpose | Key indexes |
|---|---|---|
| `User` | clients, trainers, admins in one collection; `clientProfile` / `trainerProfile` sub-docs | `email` unique, `phone` sparse, `role`, `{role, clientProfile.trainerId}`, text on name+email |
| `Otp` | 4-digit email/SMS codes for `verify` + `reset` | **TTL on `expiresAt`**, `{userId,purpose,consumedAt}`, `{destination,purpose,consumedAt}` |
| `Content` | the CMS heart — every mobile label/image/video | **unique `{key, locale}`**, `{platform,locale,isPublished}`, `{group,screen}` |
| `MediaAsset` | uploads; trainer → `pending`, admin approves | `status`, `kind`, `{status,kind,createdAt}`, `{uploadedBy,createdAt}` |
| `Category` | video/exercise chips | `slug` unique, `{kind,order}` |
| `Video` | the video library | `isPublished`, `{category,isPublished}`, text on title+description+tags |
| `VideoProgress` | per-user watch state + favourite | **unique `{userId, videoId}`**, `{userId,favorite}`, `{userId,lastWatchedAt}` |
| `Exercise` | exercise library for the plan builder | `slug`, `{isActive,name}`, text on name+muscleGroup+equipment |
| `TrainingPlan` | weekly plan with embedded `days[].exercises[]` | `{clientId,status}`, `{trainerId,status}` |
| `DietPlan` | macro targets + embedded `meals[]` | `{clientId,status}`, `{trainerId,status}` |
| `MealLog` | nutrition history (`date` is a `YYYY-MM-DD` string) | `{userId,date}` |
| `WorkoutLog` | exercise history | `{userId,date}`, `{trainingPlanId,dayIndex}` |
| `SessionRecord` | scheduled / completed PT sessions | `status`, `{trainerId,scheduledAt}`, `{clientId,status}` |
| `Notification` | in-app + push inbox | `{userId,read,createdAt}`, `type` |
| `AuditLog` | admin/CMS mutation trail | `{entity,entityId,createdAt}`, `action`, `createdAt` |

### Virtuals

| Virtual | Model | Value |
|---|---|---|
| `initials` | `User` | first letters of the first two name words (`Elie Saide` → `ES`) |
| `bmi` | `User` | `weightKg / (heightCm/100)²`, 1 decimal; `null` without both stats |
| `adherencePct` | `TrainingPlan` | `done days / total days × 100`, rounded (`0` for an empty plan) |
| `doneDays` / `totalDays` / `currentDayIndex` | `TrainingPlan` | helpers for the roster + train screen |
| `totalKcal` / `consumedKcal` | `DietPlan` | sum of `meals[].kcal` / of the ticked ones |
| `durationLabel` / `absoluteUrl` / `absoluteThumbnailUrl` | `MediaAsset` | `45` → `'0:45'`; `/uploads/x` → `http://localhost:4000/uploads/x` |
| `url` | `Content` | resolved absolute media URL for `image` / `video` keys |
| `progressPct` | `VideoProgress` | `Math.round(progress × 100)` |

Virtuals are enabled on both `toJSON()` and `toObject()` by the shared plugin, so they
ship in every API response automatically.

### Model methods worth knowing

```js
// User — passwords (bcrypt cost 10). passwordHash is select:false.
user.setPassword('password1');       // stores plaintext; the pre('save') hook hashes it
await user.save();
await user.comparePassword('password1');   // works even on a doc loaded without +passwordHash
User.hashPassword(plain);                  // one-off helper
// The pre('save') hook never double-hashes: it skips values that already look
// like a bcrypt digest unless setPassword() explicitly flagged them as plaintext.

// Otp — issue / verify (CONTRACT §3.6)
const { otp, code } = await Otp.issue({ userId, destination, channel: 'email', purpose: 'verify' });
//  → 4-digit `code` is returned in plaintext ONCE (send it / log it in dev); only its
//    bcrypt hash is stored, expiring at now + OTP_TTL_MINUTES. Any earlier unconsumed
//    OTP for the same (user|destination, purpose) is invalidated first.
const res = await Otp.verify({ userId, purpose: 'verify', code });
//  → { ok: true, otp, devBypass? }  |  { ok: false, reason, otp? }
//    reason ∈ NO_CODE | NOT_FOUND | EXPIRED | TOO_MANY_ATTEMPTS | INVALID_CODE
//    Increments `attempts`, locks out after 5, sets `consumedAt` on success.
//    When NODE_ENV !== 'production', OTP_DEV_CODE (default 1234) always passes.

// Content — the flat map the mobile app consumes (GET /api/content?format=map)
const map = await Content.asMap({ platform: 'mobile', locale: 'en' });
// { 'login.title': { type: 'text', value: 'Welcome back', url: null }, ... }
// `platform: 'mobile'` also matches rows stored as 'both'. `isPublished: true` is implied.
doc.toMapEntry();  // { key, type, value, url, locale, platform } — socket `content:updated`

// Notification
await Notification.unreadCount(userId);
```

### Connection helper

```js
const { connectDB, disconnectDB, dbState, dbName } = require('./config/db');

await connectDB();          // reads MONGO_URI (falls back to the contract default), retries once
dbState();                  // 'connected' | 'connecting' | 'disconnecting' | 'disconnected' | 'uninitialized'
dbName();                   // 'firon_performance'  — for GET /api/health
await disconnectDB();
```

Logs through the shared pino logger (`src/utils/logger`) when it exists, otherwise its own
pino instance, so the seeder can run standalone. `autoIndex` is on outside production.

---

## Seeding

```bash
cd backend
npm run seed                                       # DESTRUCTIVE: drops all 15 collections, then reseeds
npm run seed:content                               # non-destructive: inserts only MISSING Content keys
node src/seed/index.js --content-only              # same thing
node src/seed/index.js --content-only --force-content   # overwrite every key back to its default
```

Requires a running mongod and `backend/.env` (see CONTRACT §1).

**Full reset** drops and repopulates every collection, recreates all declared indexes
(including the `Otp` TTL and the compound uniques), then prints per-collection counts,
the content-key total and the demo logins.

**Content-only** is safe against a live CMS:

| Existing row | Without `--force-content` | With `--force-content` |
|---|---|---|
| missing | inserted | inserted |
| untouched (`version <= 1`, no `updatedBy`) | CMS metadata refreshed (`type`, `group`, `screen`, `label`, `description`, `platform`) — **`value` untouched** | value + metadata overwritten |
| edited (`version > 1` or `updatedBy` set) | **skipped** | value + metadata overwritten |

This is what `POST /api/content/seed-defaults` should call (`seedContentDefaults({ force })`,
exported from `src/seed/index.js`).

### What gets seeded (CONTRACT §9)

| Collection | Count | Notes |
|---|---:|---|
| `User` | 7 | 1 admin, 1 trainer (Sara Khalil), 5 clients — all `password1`, all verified |
| `Content` | **156** | every key in CONTRACT §8; `common.logo`, `auth.login.hero`, `home.today_banner` are `type:'image'` and `home.promo_video` is `type:'video'`, all with `value: null` so an admin attaches media later |
| `MediaAsset` | 3 | Sara's uploads: Deadlift form cue (video 0:45, **approved**), Kettlebell swing (video 0:32, pending), Band pull-apart (image, pending) |
| `Category` | 5 | HIIT, Strength, Core, Mobility, Yoga (order 1..5) |
| `Video` | 6 | prototype titles + durations, published, gradient fallbacks 0..5 |
| `VideoProgress` | 4 | Elie: Full Body HIIT `.62` ♥, Mobility Flow `.30` ♥, Beginner Yoga Reset `.85`, Explosive Legs ♥ |
| `Exercise` | 28 | the full library; Deadlift and Kettlebell Swing link to Sara's demo videos |
| `TrainingPlan` | 5 | Elie's "Fat Loss · Week 4" (5 days, Wed = `now`) + one per roster client |
| `DietPlan` | 5 | Elie "Cutting Plan" 2100/120/140/48, Maya "Cutting Plan", Omar "Lean Bulk", Lina targets-only draft, Karim "Maintenance" |
| `MealLog` | 3 | Elie's three ticked meals for today |
| `WorkoutLog` | 10 | Elie's completed exercises this week |
| `SessionRecord` | 12 | Sara's 12 sessions this week (the PT "Sessions this wk" stat) |
| `Notification` | 4 | 2 for Elie, 2 for Sara (one already read) |
| `AuditLog` | 1 | the seed run itself |
| `Otp` | 0 | issued at runtime |

### Demo logins

| Email | Password | Role |
|---|---|---|
| `admin@firon.app` | `password1` | admin (CMS only) |
| `sara@firon.app` | `password1` | trainer — Sara Khalil, PT portal |
| `elie@firon.app` | `password1` | **client — the demo login** |
| `maya@firon.app` / `omar@firon.app` / `lina@firon.app` / `karim@firon.app` | `password1` | clients |

OTP dev code: **`1234`** (accepted for any prompt while `NODE_ENV !== 'production'`).

### Roster adherence

The PT roster numbers from the prototype come out of the `adherencePct` virtual, so the
seeded plans carry the day counts that produce them exactly:

| Client | Plan | done / total days | `adherencePct` |
|---|---|---|---|
| Elie Saide | Fat Loss · Week 4 | 2 / 5 | 40 |
| Maya Khoury | Fat Loss · Wk 4 | 12 / 13 | 92 |
| Omar Haddad | Hypertrophy · Wk 2 | 7 / 9 | 78 |
| Karim Nasr | Strength · Wk 7 | 9 / 14 | 64 |
| Lina Aoun | Onboarding (draft) | 0 / 0 | 0 |

Roster `status` (`ok` / `warn` / `new`) is **derived by the API**, not stored: `new` when
`clientProfile.onboardingCompleted === false` (Lina), `warn` under 70 % adherence (Karim),
otherwise `ok`.

---

## Interpretation notes

Places where CONTRACT §4/§8/§9 left room, and the call that was made:

1. **`Content.key` uniqueness.** §4.3 marks `key` as `unique` *and* declares a compound
   unique `{key, locale}`. A standalone unique on `key` would make multi-locale content
   impossible, so `key` carries a plain index and `{key, locale}` carries the unique one.
2. **`Content.group` enum.** The §4.3 list omits groups that §8 needs (`search.*`,
   `onboard.*`), so `search` and `onboard` were added to the model's `GROUPS` list.
   `group` stays a free-form indexed `String` as specified — `GROUPS` is exported for the CMS.
3. **Shorthand content keys.** §8 lists some keys without defaults
   (`auth.register.name_label / .email_label / …`). Those were expanded one key per entry and
   their default values lifted verbatim from the matching prototype screen — e.g.
   `auth.register.submit = "Create account & verify"`, `auth.otp.resend_q = "Didn't get it?"`,
   `search.placeholder = "Try 'core', 'yoga', 'plan'…"`. `search.no_results` has no prototype
   counterpart and defaults to `"No results found"`.
4. **`(image)` / `(video)` keys** are seeded with their real `type` and `value: null`
   (`mediaId` unset) so the CMS shows a media picker rather than a text field.
5. **Login role picker.** The prototype's login screen has an "I am a…" role picker; CONTRACT
   §3.1 forbids it, so no content keys were seeded for it. The contract wins.
6. **Roster adherence day counts.** §9 gives adherence as a percentage while §4.9 defines it
   as a virtual over `days[]`, so plan lengths were chosen to hit those exact percentages
   (table above). Only Elie's week is prescribed day-by-day in §9; the other clients' days
   are generated from per-goal rotations of the seeded exercise library.
7. **Exercise prescriptions outside Wednesday.** §9 names the exercises for Mon/Tue/Thu/Fri
   but not their sets/reps/loads; plausible prescriptions were filled in so every row renders
   with the sub-line the prototype shows. Wednesday's five prescriptions are exact.
8. **Non-§9 collections.** `MealLog`, `WorkoutLog`, `SessionRecord`, `Notification` and
   `AuditLog` are not covered by §9, but the roster/dashboard stats the prototype displays
   ("Sessions this wk 12") read from them, so a small consistent set is seeded.
9. **Client body stats.** §9 gives full stats only for Elie. The other clients got plausible
   stats consistent with their goals; Lina has none (she has not finished onboarding).
10. **`Otp.codeHash`** is stripped by the shared `toJSON` transform alongside `passwordHash` —
    a hashed OTP should never reach a response body either.
11. **`MediaAsset` gradient.** `Video` has a `gradientIndex` field but `MediaAsset` does not,
    so the prototype's per-upload gradient is preserved as a `gradient:<n>` tag.
12. **Seed file placeholders.** The three seeded `MediaAsset` rows describe files that are not
    on disk (`/uploads/seed-*`). They exist so the approval workflow and the CMS media picker
    have realistic rows; replace them with real uploads when available.
