# Firon Performance — API reference

Base URL `http://localhost:4000/api` · **101 routes** across 17 routers.
This one API serves both the React Native app (client + PT portals) and the React/Vite CMS.

Both frontends reach it exclusively through `clientProxy` in `@firon/shared`
(`shared/src/sharedService.ts`), which is generated against this document — so a change to a
response shape here is a breaking change there.

---

## Conventions

### Envelope

Success:
```json
{ "success": true, "data": { }, "meta": { } }
```
Error:
```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [ ] } }
```

Paginated lists put `{ page, limit, total, pages }` in `meta` (plus extras like `unread` on
notifications and `hasPlan` on the plan endpoints).

### Auth column

| Marker | Meaning |
|---|---|
| — | public, no token |
| optional | `optionalAuth` — works without a token, but personalises the response when one is present |
| any | `requireAuth`, any role |
| client | `requireAuth` + the caller must be the owning client |
| trainer | `requireAuth` + `requireRole('trainer','admin')` |
| admin | `requireAuth` + `requireRole('admin')` |

Send `Authorization: Bearer <accessToken>`. Rate limiting applies to all of `/api`, with a
stricter limiter on the OTP-issuing auth routes.

### Objects

All documents are transformed on the way out: `_id` → `id`, `__v` removed, and `passwordHash` /
`codeHash` never serialised. See [`DATABASE.md`](DATABASE.md) for field-level detail.

### Error codes

`error.code` is part of the contract — the clients branch on it and suppress error popups
per-code.

| Status | Codes |
|---|---|
| 400 | `BAD_REQUEST` `INVALID_ID` `INVALID_OTP` `NOT_A_CLIENT` `NO_DESTINATION` `NO_FILE` `OTP_EXPIRED` `OTP_NOT_FOUND` `TRAINER_INACTIVE` |
| 401 | `INVALID_CREDENTIALS` `INVALID_REFRESH_TOKEN` `INVALID_TOKEN` `NO_TOKEN` `TOKEN_EXPIRED` `TOKEN_REVOKED` |
| 403 | `ACCOUNT_DISABLED` `CLIENT_ONLY` `DAY_LOCKED` `FORBIDDEN` `MEDIA_NOT_APPROVED` `NOT_VERIFIED` |
| 404 | `CATEGORY_NOT_FOUND` `CLIENT_NOT_FOUND` `CONTENT_NOT_FOUND` `DAY_NOT_FOUND` `EXERCISE_NOT_FOUND` `LOG_NOT_FOUND` `MEAL_NOT_FOUND` `MEDIA_NOT_FOUND` `NOTIFICATION_NOT_FOUND` `PLAN_NOT_FOUND` `TRAINER_NOT_FOUND` `USER_NOT_FOUND` `VIDEO_NOT_FOUND` |
| 409 | `DUPLICATE_EMAIL` `DUPLICATE_PHONE` `EMAIL_IN_USE` `PHONE_IN_USE` |
| 422 | `VALIDATION_ERROR` — `details` carries per-field messages |
| 429 | `OTP_ATTEMPTS_EXCEEDED` |

Note `NOT_VERIFIED` is **403**, not 401, so it never triggers the clients' token-refresh path.
`TOKEN_EXPIRED` and `TOKEN_REVOKED` are 401 and do: the proxy refreshes once, replays the request,
and forces a logout only if the refresh itself fails.

### Public endpoints

Only four things are reachable with no token. This is what makes the mobile app's guest preview
(`CONTRACT.md` §13) possible:

- `GET /api/health`
- `GET /api/content` and `GET /api/content/groups` and `GET /api/content/:key`
- `GET /api/categories`
- `GET /api/videos` and `GET /api/videos/:id`

---

## Health

| Method | Path | Auth |
|---|---|---|
| GET | `/health` | — |

```json
{ "success": true, "data": { "status": "ok", "db": "connected", "uptime": 31,
  "version": "1.0.0", "env": "development", "timestamp": "2026-09-27T14:13:55.275Z" } }
```

---

## Auth — `/api/auth`

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/register` | — | `{ name, email, phone, password }` |
| POST | `/login` | — | `{ identifier, password, remember? }` |
| POST | `/verify-otp` | — | `{ userId?, destination?, code, purpose }` |
| POST | `/forgot-password` | — | `{ identifier, channel }` |
| POST | `/reset-password` | — | `{ resetToken, password }` |
| POST | `/resend-otp` | — | `{ userId, purpose, channel }` |
| POST | `/refresh` | — | `{ refreshToken }` |
| POST | `/logout` | any | `{ fcmToken? }` |
| GET | `/me` | any | |
| POST | `/fcm-token` | any | `{ token, platform }` |
| DELETE | `/fcm-token` | any | `{ token }` |

### POST `/login`

**There is no `role` field in the request.** The client never declares whether it is a client or a
trainer; the server resolves the user by email *or* phone and returns `user.role`, which is the
only thing the apps route on (`CONTRACT.md` §3).

```bash
curl -X POST localhost:4000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"identifier":"elie@firon.app","password":"password1"}'
```
```json
{ "success": true, "data": {
  "accessToken": "eyJhbGciOiJIUzI1NiIs…",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs…",
  "user": { "id": "…", "name": "Elie Saide", "email": "elie@firon.app",
    "phone": "+961 70 123 456", "role": "client", "isVerified": true, "initials": "ES",
    "bmi": 25.7, "clientProfile": { "gender": "Male", "age": 31, "heightCm": 178,
      "weightKg": 81.4, "goal": "Fat loss", "targetWeightKg": 76, "sessionsPerWeek": 5,
      "level": "Intermediate", "membershipLabel": "Premium plan", "trainerId": "…",
      "onboardingCompleted": true } } } }
```

Failures: `401 INVALID_CREDENTIALS` ("Wrong email/phone or password"), `403 ACCOUNT_DISABLED`,
and `403 NOT_VERIFIED` with `{ userId }` in `details` so the app can jump straight to the OTP
screen.

### GET `/me`

Returns the badge count alongside the user, so the app needs one call at boot:
```json
{ "success": true, "data": { "user": { }, "unreadNotifications": 2 } }
```

### OTP

4 digits, bcrypt-hashed, TTL-indexed, max 5 attempts (`429 OTP_ATTEMPTS_EXCEEDED`). In
non-production the generated code is logged **and** `OTP_DEV_CODE` (`1234`) is accepted.
`purpose: 'verify'` returns tokens + user; `purpose: 'reset'` returns a short-lived `resetToken`.

---

## Content — `/api/content`

The CMS core: **every label, image and video the mobile app renders lives here.** 166 seeded keys.
Writes emit `content:updated` / `content:bulk-updated` / `content:deleted` to the
`content:<locale>` room, which is what makes edits appear in the app with no restart.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | optional | `?format=map\|list&platform=&locale=&group=&screen=&type=&q=&page=&limit=` |
| GET | `/groups` | optional | groups with counts |
| GET | `/:key` | optional | one row by key |
| POST | `/` | admin | create |
| PUT | `/:id` | admin | update |
| PATCH | `/bulk` | admin | `{ items: [{ key?, id?, value }] }` |
| POST | `/seed-defaults` | admin | insert missing default keys; `{ force }` also overwrites edited ones |
| DELETE | `/:id` | admin | |

`format=map` (the default) is what the mobile app consumes — a flat map, no pagination:
```json
{ "success": true, "data": {
  "auth.login.title":    { "type": "text",  "value": "Welcome back" },
  "auth.login.submit":   { "type": "text",  "value": "Sign in" },
  "common.logo":         { "type": "image", "value": null, "url": null },
  "home.promo_video":    { "type": "video", "value": null, "url": null }
} }
```
`format=list` returns the full rows (with `label`, `description`, `group`, `screen`, `version`,
`updatedBy`) plus pagination meta — that's what the CMS editor uses.

`GET /groups`:
```json
{ "success": true, "data": [ { "group": "auth", "count": 31, "published": 31,
  "screens": ["login","register","forgot","otp"] } ] }
```

---

## Media — `/api/media`

Trainer uploads land `pending`; an admin approves before clients ever see them.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/mine` | trainer | the caller's own uploads |
| GET | `/` | trainer | `?status=&kind=&category=&q=&page=&limit=` |
| POST | `/upload` | trainer | multipart, field **`file`**, plus `title`, `category`, `kind` |
| GET | `/:id` | any | |
| PATCH | `/:id/approve` | admin | emits `media:status` to the uploader |
| PATCH | `/:id/reject` | admin | `{ reason }` |
| DELETE | `/:id` | admin | |

Upload limits: `MAX_UPLOAD_MB` (default 200); mimetypes `image/jpeg|png|webp|gif`,
`video/mp4|quicktime|webm`. `400 NO_FILE` when the field is missing. Stored at
`/uploads/<filename>` and served statically. A new upload emits `media:pending` to `role:admin`.

---

## Videos — `/api/videos`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/suggested` | any | not-started videos, each with a `why` reason string |
| GET | `/continue-watching` | any | `progress > 0` |
| GET | `/` | optional | `?category=&favorite=&q=&page=&limit=` |
| GET | `/:id` | optional | |
| POST | `/` | admin | |
| PUT | `/:id` | admin | |
| DELETE | `/:id` | admin | |
| POST | `/:id/progress` | any | `{ progress, secondsWatched? }` |
| POST | `/:id/favorite` | any | toggle |

`?category=` matches the category **name**, case-insensitively (`core`, `Core` and `CORE` all
match "Core"). Pass `All` or omit it for everything, or use `?categoryId=` for an exact id match.

With a token, each video is merged with the caller's `VideoProgress`:
```json
{ "success": true, "data": [ { "id": "…", "title": "Full Body HIIT", "category": "HIIT",
  "durationLabel": "24:10", "gradientIndex": 0, "isPublished": true,
  "progress": 0.62, "favorite": true, "secondsWatched": 901 } ],
  "meta": { "page": 1, "limit": 20, "total": 6, "pages": 1 } }
```
Without a token, `progress` is 0 and `favorite` false — and only published videos whose media is
approved are returned. `/suggested` adds `"why": "Matches your Lower Body plan"`.

---

## Categories — `/api/categories`

| Method | Path | Auth |
|---|---|---|
| GET | `/` | optional |
| POST | `/` | admin |
| PUT | `/:id` | admin |
| DELETE | `/:id` | admin |

Writes emit `category:changed`.

---

## Exercises — `/api/exercises`

| Method | Path | Auth |
|---|---|---|
| GET | `/` | any (`?q=&muscleGroup=&page=&limit=`) |
| GET | `/:id` | any |
| POST | `/` | trainer |
| PUT | `/:id` | trainer |
| DELETE | `/:id` | trainer |

---

## Clients (trainer roster) — `/api/clients`

Whole router is `trainer`. A trainer only ever sees their own clients; an admin sees all.

| Method | Path | Auth |
|---|---|---|
| GET | `/stats` | trainer |
| GET | `/` | trainer |
| GET | `/:id` | trainer |
| POST | `/:id/assign-trainer` | admin |

`GET /` — `status` is `new` when the client has no active plan, `warn` under 70% adherence, else
`ok`, matching the prototype's colour thresholds:
```json
{ "success": true, "data": [ { "id": "…", "name": "Maya Khoury", "initials": "MK",
  "planLabel": "Fat Loss · Wk 4", "trainingPlanId": "…", "adherencePct": 92, "status": "ok",
  "goal": "Fat loss", "membershipLabel": "Premium plan",
  "dietPlanSummary": { "name": "Cutting Plan", "kcal": 1800, "protein": 140, "carbs": 150,
    "fat": 55, "mealCount": 4 } } ],
  "meta": { "page": 1, "limit": 100, "total": 5, "pages": 1 } }
```
`GET /stats` → `{ activeClients, totalClients, sessionsThisWeek, newRequests, avgAdherence }`.
`GET /:id` → `{ client, stats, trainingPlan, dietPlan, recentLogs }`.

---

## Users (CMS admin) — `/api/users`

Whole router is `admin`.

| Method | Path | Body |
|---|---|---|
| GET | `/` | `?role=&q=&isActive=&page=&limit=` |
| POST | `/` | `{ name, email, phone?, password, role }` — created verified & active |
| GET | `/:id` | |
| PUT | `/:id` | profile fields + `clientProfile` / `trainerProfile` patches |
| PATCH | `/:id/active` | `{ isActive }` — bumps `tokenVersion`, killing live tokens |
| POST | `/:id/reset-password` | `{ password }` — also bumps `tokenVersion` |
| DELETE | `/:id` | soft delete; refuses the last admin and self |

Reassigning a client's trainer emits `roster:updated` and notifies the new trainer.

---

## Client profile — `/api/profile`

Whole router is `any` (acts on the caller).

| Method | Path | Notes |
|---|---|---|
| GET | `/` | the caller, with `initials` and `bmi` virtuals |
| PUT | `/` | `{ name?, email?, phone?, avatarUrl? }` |
| PUT | `/client-details` | the onboarding payload; **height 100–250 cm, weight 30–300 kg**; sets `onboardingCompleted: true` |
| PUT | `/password` | `{ currentPassword, password }` |
| GET | `/progress` | weight + sessions series |

---

## Trainer — `/api/trainer`

Whole router is `trainer`.

| Method | Path | Notes |
|---|---|---|
| GET | `/profile` | flattened, plus `availabilitySummary` and `openDays` |
| PUT | `/profile` | name/title/email/phone/studio/rate/certs |
| GET | `/availability` | `{ availability, summary, openDays }` |
| PUT | `/availability` | `{ availability: [7] }`; every open day must have `from < to` |
| PUT | `/prefs` | notification preferences |
| GET | `/dashboard` | stats + upcoming sessions |

`availabilitySummary` is already collapsed into ranges, so clients don't reimplement it:
```json
{ "availabilitySummary": ["Mon–Fri · 07:00 – 19:00", "Sat · 09:00 – 13:00", "Sun · Off"],
  "openDays": 6 }
```

---

## Plans — `/api/plans`

Whole router is `any`; writes are `trainer`. Clients may only read their own plans and may only
toggle their own check-offs; trainers only their own clients'. Enforced in the controllers.

### Training

| Method | Path | Auth |
|---|---|---|
| GET | `/training/me` | client |
| GET | `/training?clientId=` | any |
| GET | `/training/:id` | any |
| POST | `/training` | trainer |
| PUT | `/training/:id` | trainer |
| POST | `/training/:id/assign` | trainer |
| DELETE | `/training/:id` | trainer |
| PATCH | `/training/:id/day/:dayIndex/exercise/:exIndex/toggle` | client |
| POST | `/training/:id/day/:dayIndex/complete` | client |
| POST | `/training/:id/day/:dayIndex/log-exercise` | client |

`GET /training/me` — note the precomputed day counters, so the app doesn't recompute the ring:
```json
{ "success": true, "data": { "id": "…", "name": "Fat Loss · Week 4", "weekNumber": 4,
  "status": "active", "adherencePct": 40, "doneDays": 2, "totalDays": 5, "currentDayIndex": 2,
  "days": [ { "dayIndex": 2, "dayLabel": "Wed", "title": "Lower Body Strength",
    "durationMin": 55, "status": "now", "locked": false,
    "exercises": [ { "name": "Goblet Squat", "prescription": "4 × 12 · 20kg", "sets": 4,
      "reps": 12, "weightKg": 20, "done": true, "loggedByClient": false, "order": 0 } ] } ] },
  "meta": { "hasPlan": true } }
```
`…/complete` marks every exercise done, writes a `SessionRecord` + `WorkoutLog`, advances the next
day from `todo` to `now`, and emits `session:completed` + `plan:progress` to the coach.
`403 DAY_LOCKED` when the day isn't unlocked yet.

### Diet

| Method | Path | Auth |
|---|---|---|
| GET | `/diet/me` | client |
| GET | `/diet?clientId=` | any |
| GET | `/diet/:id` | any |
| POST | `/diet` | trainer |
| PUT | `/diet/:id` | trainer |
| POST | `/diet/:id/assign` | trainer |
| DELETE | `/diet/:id` | trainer |
| PATCH | `/diet/:id/meal/:index/toggle` | client |
| POST | `/diet/log-meal` | client |

`GET /diet/me` adds `totalKcal` and `consumedKcal`. Assigning emits `plan:assigned` to the client
and calls `notify()`, so the phone gets both an in-app banner and a push.

---

## Nutrition — `/api/nutrition`

| Method | Path | Notes |
|---|---|---|
| GET | `/today` | `{ date, plan, targets, consumed, remainingKcal, progressPct, meals }` |
| GET | `/history?from=&to=` | |
| POST | `/log` | `{ slot, food, kcal, protein?, carbs?, fat? }` |
| PATCH | `/log/:id/toggle` | |

---

## Workouts — `/api/workouts`

Workout history — backs the Train screen's "History" view and the trainer's view of what a client
actually did (plan exercises plus anything they logged themselves).

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/logs` | any | `?from=&to=&clientId=&page=&limit=` — defaults to the last 30 days |
| GET | `/sessions` | any | completed `SessionRecord`s, newest first |
| GET | `/summary` | any | per-day totals for the last 8 weeks |

`clientId` is the authorisation-sensitive parameter: omitted (or equal to the caller) reads the
caller's own history; a **trainer** may pass a client on their own roster; an **admin** may pass
anyone. A trainer asking for someone else's client gets `403 FORBIDDEN`, and a client asking for
another client gets `403 FORBIDDEN`.

`GET /logs`:
```json
{ "success": true, "data": [ { "id": "…", "date": "2026-09-25", "exerciseName": "Goblet Squat",
  "sets": 4, "reps": 12, "weightKg": 20, "source": "plan", "completed": true } ],
  "meta": { "page": 1, "limit": 20, "total": 8, "pages": 1,
            "from": "2026-08-29", "to": "2026-09-27" } }
```

`GET /summary`:
```json
{ "success": true, "data": { "from": "2026-08-03", "to": "2026-09-27", "totalExercises": 8,
  "days": [ { "date": "2026-09-21", "exercises": 4, "completed": 4,
              "volumeKg": 1280, "minutes": 160 } ] } }
```

---

## Notifications — `/api/notifications`

| Method | Path | Auth |
|---|---|---|
| GET | `/` | any (`?unread=&page=&limit=`) |
| GET | `/unread-count` | any |
| PATCH | `/read-all` | any |
| PATCH | `/:id/read` | any |
| DELETE | `/:id` | any |
| POST | `/test` | admin |

`meta` carries `unread` alongside the pagination. Every notification is created by
`notificationService.notify()`, which persists it, emits `notification:new` +
`notification:count` over the socket, **and** sends an FCM push — one call, both channels.

---

## Search — `/api/search`

| Method | Path | Auth |
|---|---|---|
| GET | `/?q=` | any |

`{ videos, plans, exercises }`, with `meta.counts`.

---

## Dashboard — `/api/dashboard`

| Method | Path | Auth |
|---|---|---|
| GET | `/` | admin |

`{ users, content, media, videos, plans, sessions, recentActivity, generatedAt }`. Also pushed to
connected admins every 30s as `dashboard:tick`.

---

## Socket.IO

Not REST, but part of the same contract — see the event table in [`../README.md`](../README.md)
and `CONTRACT.md` §6. Connect with `io(origin, { auth: { token: accessToken } })`; a bad token is
rejected at the handshake with `UNAUTHORIZED`.
