# Firon Performance — Shared Contract (v1)

Single source of truth for **all** subagents. Backend, CMS and Mobile MUST conform to this file.
If you need something that is not here, add it here first, then implement it.

## 0. Monorepo layout

```
firon-performance/
  backend/     Node 20 + Express 4 + Mongoose 8 + Socket.IO 4 + JWT + FCM (shared API for CMS & mobile)
  cms/         React 19 + Vite 7 + react-router-dom 7 + React Query 5 (admin/CMS web portal)
  mobile/      React Native 0.87.1 CLI + TypeScript (NOT Expo) — Client portal + PT portal in one app
  docs/        This contract + setup docs
```

## 1. Ports / URLs / env

| Thing | Value |
|---|---|
| Backend HTTP + Socket.IO | `http://localhost:4000` |
| Socket.IO path | `/socket.io` (default) |
| API prefix | `/api` |
| Static uploads | `http://localhost:4000/uploads/<filename>` |
| CMS dev server | `http://localhost:5175` (5173/5174 are used by other projects on this machine; `strictPort` is set) |
| Mongo URI | `mongodb://127.0.0.1:27017/firon_performance` |
| iOS simulator -> backend | `http://localhost:4000` |
| Android emulator -> backend | `http://10.0.2.2:4000` |

`backend/.env` keys (a `.env.example` must be committed; real `.env` is gitignored):
```
PORT=4000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/firon_performance
JWT_ACCESS_SECRET=dev_access_secret_change_me
JWT_REFRESH_SECRET=dev_refresh_secret_change_me
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
UPLOAD_DIR=uploads
MAX_UPLOAD_MB=200
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
OTP_TTL_MINUTES=10
OTP_DEV_CODE=1234
```

`cms/.env` -> `VITE_API_URL=http://[::1]:4000/api`, `VITE_SOCKET_URL=http://[::1]:4000`
(the IPv6 literal is deliberate: an unrelated project holds IPv4 `:4000` on this machine, so
plain `localhost` can resolve to the wrong server — see `backend/README.md`)

## 2. Design tokens (from the approved prototype) — use EVERYWHERE

```
accent    #c7ff3f   (lime)
accent2   #7cf5c4
bg        #0b0f0d
surface   #14191b
surface2  #1c2327
surface3  #242c31
text      #f2f6f4
muted     #8c9a95
line      #242c2e
danger    #ff6b6b
radius    18   (cards) / 15 (buttons) / 13 (inputs) / 999 (chips)
```
Fonts: system (`-apple-system` / `SF Pro Text` on iOS, `Roboto` on Android, `Inter` fallback on web).
Dark theme only. Gradients list for media placeholders lives in `docs/CONTRACT.md#gradients`.

### gradients
```
linear-gradient(135deg,#134e5e,#71b280)
linear-gradient(135deg,#42275a,#734b6d)
linear-gradient(135deg,#0f2027,#2c5364)
linear-gradient(135deg,#603813,#b29f94)
linear-gradient(135deg,#1f4037,#99f2c8)
linear-gradient(135deg,#232526,#414345)
linear-gradient(135deg,#3a1c71,#d76d77)
linear-gradient(135deg,#093028,#237a57)
```

## 3. Auth rules (HARD REQUIREMENTS)

1. **The login screen NEVER asks whether you are a client or a trainer.** No role picker, no
   segmented control, no "I am a…" cards. It has: email-or-phone, password, remember me,
   forgot password, sign in, create account.
2. On `POST /api/auth/login` the server looks the user up and returns `user.role`.
   The **client app routes purely on `user.role`**: `client` -> client tab bar
   (Home / Train / Videos / Profile), `trainer` -> PT tab bar
   (Clients / Plans / Uploads / Profile). `admin` -> may only use the CMS.
3. JWT: short-lived access token (`Authorization: Bearer <token>`) + long-lived refresh token.
   Access token payload: `{ sub: userId, role, email, tokenVersion, iat, exp }`.
4. Refresh flow: `POST /api/auth/refresh { refreshToken }` -> new access+refresh pair.
5. Passwords: bcrypt, cost 10, minimum 6 chars (matches prototype validation).
6. OTP is 4 digits. In `NODE_ENV!=='production'` the code `1234` is always accepted
   (matches the prototype's "Demo code: 1 2 3 4") and the generated code is logged.
7. Role guards: `requireAuth`, `requireRole('trainer')`, `requireRole('admin')`,
   `requireRole('trainer','admin')`.
8. CMS login uses the SAME `/api/auth/login`, but rejects non-`admin`/non-`trainer` roles with 403.

## 4. Mongo collections (Mongoose models, owned by the DATABASE agent)

All models: `timestamps: true`, `toJSON` transform that maps `_id` -> `id` and strips `__v`
and `passwordHash`.

### 4.1 `User`
```
name           String  required
email          String  required unique lowercase index
phone          String  index sparse
passwordHash   String  required select:false
role           String  enum ['client','trainer','admin'] default 'client' index
avatarUrl      String
isVerified     Boolean default false
isActive       Boolean default true
tokenVersion   Number  default 0
locale         String  default 'en'
fcmTokens      [{ token, platform ('ios'|'android'|'web'), createdAt }]
lastLoginAt    Date
// client sub-doc (only meaningful when role==='client')
clientProfile {
  gender ('Male'|'Female'|'Other'), age Number, heightCm Number, weightKg Number,
  bodyFatPct Number, waistCm Number,
  goal ('Fat loss'|'Muscle gain'|'Strength'|'General fitness'),
  targetWeightKg Number, sessionsPerWeek Number,
  level ('Beginner'|'Intermediate'|'Advanced'),
  membershipLabel String default 'Premium plan',
  trainerId ObjectId ref User index,
  onboardingCompleted Boolean default false,
  startWeightKg Number
}
// trainer sub-doc (only meaningful when role==='trainer')
trainerProfile {
  title String, studio String, rate String, since String,
  certs [{ name, verified Boolean }],
  availability [{ day ('Mon'..'Sun'), off Boolean, from 'HH:mm', to 'HH:mm' }],   // 7 entries
  prefs { newClientRequests Bool, sessionReminders Bool, weeklyAdherenceReport Bool }
}
```
Virtuals: `initials`, `bmi` (weight / (h/100)^2, 1 decimal).

### 4.2 `Otp`
`userId ref User`, `destination String`, `channel ('email'|'sms')`,
`purpose ('verify'|'reset')`, `codeHash String`, `attempts Number default 0`,
`consumedAt Date`, `expiresAt Date` + TTL index on `expiresAt`.

### 4.3 `Content`  ← the CMS heart: **every label, image and video reference lives here**
```
key         String required unique index     // e.g. 'login.title', 'home.greeting', 'tab.train'
type        String enum ['text','richtext','image','video','number','boolean','color','json'] required
value       Mixed                            // text -> String; image/video -> MediaAsset id or absolute URL
locale      String default 'en' index
platform    String enum ['mobile','cms','both'] default 'mobile' index
group       String index                      // 'auth' | 'home' | 'train' | 'videos' | 'nutrition' | 'profile' | 'pt' | 'common' | 'tabs' | 'notifications'
screen      String                            // 'login','register','home','workouts',...
label       String                            // human name shown in the CMS editor
description String
mediaId     ObjectId ref MediaAsset           // set when type is image/video
isPublished Boolean default true
version     Number default 1
updatedBy   ObjectId ref User
```
Compound unique index: `{ key: 1, locale: 1 }`.

### 4.4 `MediaAsset`
```
title, description, kind ('image'|'video'), category String,
filename, originalName, mimeType, sizeBytes, durationSec, width, height,
url String,                                  // '/uploads/<filename>' (serve absolute via helper)
thumbnailUrl String,
status ('pending'|'approved'|'rejected') default 'pending' index,
reviewedBy ref User, reviewedAt Date, rejectionReason String,
uploadedBy ref User index, tags [String]
```
Trainer uploads land as `pending`; admin approves in the CMS. Clients only ever see `approved`.

### 4.5 `Category` (video categories / chips)
`name`, `slug unique`, `order Number`, `icon String`, `kind ('video'|'exercise') default 'video'`, `isActive Boolean`.

### 4.6 `Video`
```
title, description, categoryId ref Category index, category String (denormalised name),
durationSec Number, durationLabel String ('24:10'),
videoMediaId ref MediaAsset, thumbnailMediaId ref MediaAsset,
gradientIndex Number,                        // fallback visual when no thumbnail
isPublished Boolean default true index, publishedAt Date,
createdBy ref User, tags [String], level String, order Number
```

### 4.7 `VideoProgress`
`userId ref User index`, `videoId ref Video index`, `progress Number 0..1 default 0`,
`favorite Boolean default false`, `lastWatchedAt Date`, `secondsWatched Number`.
Compound unique index `{ userId, videoId }`.

### 4.8 `Exercise`
`name`, `slug`, `description`, `muscleGroup`, `equipment`, `type String ('Compound · barbell')`,
`demoMediaId ref MediaAsset`, `demoDurationLabel String`, `cues [String]`, `isActive Boolean`,
`createdBy ref User`.

### 4.9 `TrainingPlan`
```
clientId ref User index, trainerId ref User index,
name String, weekNumber Number, startDate Date, endDate Date,
status ('draft'|'active'|'archived') default 'draft' index,
days [{
  dayIndex Number,           // 0..6
  dayLabel String,           // 'Mon'
  title String,              // 'Full Body HIIT'
  durationMin Number,
  status ('done'|'now'|'todo') default 'todo',
  locked Boolean default false,
  completedAt Date,
  exercises [{
    exerciseId ref Exercise, name String, prescription String ('4 × 12 · 20kg'),
    sets Number, reps Number, weightKg Number, notes String,
    done Boolean default false, loggedByClient Boolean default false, order Number
  }]
}],
notes String, assignedAt Date
```
Virtual `adherencePct` = done days / total days * 100 (rounded).

### 4.10 `DietPlan`
```
clientId ref User index, trainerId ref User index,
name String, kcal Number, protein Number, carbs Number, fat Number,
status ('draft'|'active'|'archived') default 'draft',
meals [{ slot String ('Breakfast'), food String, kcal Number, protein, carbs, fat, order Number }],
startDate Date, assignedAt Date, notes String
```
Virtual `totalKcal` = sum of meals.

### 4.11 `MealLog`
`userId`, `dietPlanId`, `date (YYYY-MM-DD String, index)`, `slot`, `food`, `kcal`,
`protein`, `carbs`, `fat`, `consumed Boolean`, `source ('plan'|'manual')`.

### 4.12 `WorkoutLog`
`userId`, `trainingPlanId`, `dayIndex`, `date String`, `exerciseName`, `sets`, `reps`,
`weightKg`, `notes`, `source ('plan'|'manual')`, `completed Boolean`, `durationMin`.

### 4.13 `SessionRecord`
`clientId`, `trainerId`, `trainingPlanId`, `dayIndex`, `title`, `scheduledAt Date`,
`completedAt Date`, `durationMin`, `location String`,
`status ('scheduled'|'completed'|'missed'|'cancelled') index`.

### 4.14 `Notification`
```
userId ref User index, title String, body String,
type String enum ['plan_assigned','plan_updated','session_reminder','media_approved',
                  'media_rejected','client_progress','new_client','content_updated',
                  'message','generic'],
data Mixed, read Boolean default false index, readAt Date,
deliveredPush Boolean default false, icon String, deepLink String
```

### 4.15 `AuditLog`
`userId`, `action`, `entity`, `entityId`, `before Mixed`, `after Mixed`, `ip`.

## 5. REST API

Envelope: success -> `{ success: true, data, meta? }`; error -> `{ success: false, error: { code, message, details? } }`.
Paginated list meta: `{ page, limit, total, pages }`.

### Auth  `/api/auth`
| Method | Path | Auth | Body / notes |
|---|---|---|---|
| POST | `/register` | – | `{name,email,phone,password}` -> creates `role:'client'`, unverified, sends OTP. Returns `{ userId, otpSent:true, destination }` |
| POST | `/login` | – | `{ identifier, password, remember? }` (identifier = email OR phone) -> `{ accessToken, refreshToken, user }`. **No role in the request.** 403 if `!isVerified`, with `error.code='NOT_VERIFIED'` + userId so the app can jump to OTP |
| POST | `/verify-otp` | – | `{ userId? , destination?, code, purpose }` -> for `verify`: marks verified + returns tokens; for `reset`: returns a short-lived `resetToken` |
| POST | `/forgot-password` | – | `{ identifier, channel }` -> sends OTP (purpose `reset`) |
| POST | `/reset-password` | – | `{ resetToken, password }` |
| POST | `/resend-otp` | – | `{ userId, purpose, channel }` |
| POST | `/refresh` | – | `{ refreshToken }` |
| POST | `/logout` | Bearer | revokes refresh + removes fcm token |
| GET | `/me` | Bearer | full user (with populated trainer for clients) |
| POST | `/fcm-token` | Bearer | `{ token, platform }` |
| DELETE | `/fcm-token` | Bearer | `{ token }` |

### Content (CMS core) `/api/content`
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | – | `?platform=mobile&locale=en&group=&screen=` -> **flat map** `{ "login.title": {type,value,url}, ... }` when `?format=map` (default), or array when `?format=list` |
| GET | `/groups` | – | distinct groups + counts |
| GET | `/:key` | – | single |
| POST | `/` | admin | create |
| PUT | `/:id` | admin | update -> emits `content:updated` |
| PATCH | `/bulk` | admin | `{ items:[{key,value}] }` -> emits `content:bulk-updated` |
| DELETE | `/:id` | admin | |
| POST | `/seed-defaults` | admin | re-seeds any missing default key without overwriting edited ones |

### Media `/api/media`
`GET /` (admin/trainer; `?status=&kind=&category=&page=`), `POST /upload` (multipart field `file`
+ `title,category,kind`; trainer->pending, admin->approved), `GET /:id`,
`PATCH /:id/approve` (admin), `PATCH /:id/reject` (admin, `{reason}`), `DELETE /:id` (admin),
`GET /mine` (trainer's own uploads).

### Videos `/api/videos`
`GET /` (`?category=&favorite=true&q=&page=` — clients see only published + approved media;
each item is merged with the caller's `VideoProgress` as `progress` + `favorite`),
`GET /suggested` (client: not-started videos + a `why` reason string),
`GET /continue-watching`, `GET /:id`,
`POST /:id/progress` `{progress, secondsWatched}`, `POST /:id/favorite` (toggle),
`POST /` `PUT /:id` `DELETE /:id` (admin).

### Categories `/api/categories` — `GET /`, `POST /`, `PUT /:id`, `DELETE /:id` (admin write).

### Exercises `/api/exercises` — `GET /?q=`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` (trainer/admin write).

### Clients (trainer) `/api/clients`
`GET /` -> roster `[{ id, name, initials, planLabel, adherencePct, status ('ok'|'warn'|'new'), avatarUrl, dietPlanSummary }]`,
`GET /:id` -> detail (`stats`, `trainingPlan`, `dietPlan`, `recentLogs`),
`GET /stats` -> `{ activeClients, sessionsThisWeek, newRequests, avgAdherence }`,
`POST /:id/assign-trainer` (admin).

### Profile `/api/profile`
`GET /` , `PUT /` (name/email/phone/avatar), `PUT /client-details` (the onboarding body-stats
+ goals payload; sets `onboardingCompleted:true`), `GET /progress`.

### Trainer `/api/trainer`
`GET /profile`, `PUT /profile` (title/studio/rate/certs), `GET /availability`,
`PUT /availability` (`{ availability:[7] }`, validated `from < to` for open days),
`PUT /prefs`, `GET /dashboard`.

### Plans `/api/plans`
`GET /training/me` (client's active plan), `GET /training?clientId=`, `POST /training`,
`PUT /training/:id`, `POST /training/:id/assign`, `DELETE /training/:id`,
`PATCH /training/:id/day/:dayIndex/exercise/:exIndex/toggle` (client check-off),
`POST /training/:id/day/:dayIndex/complete` (finish session),
`POST /training/:id/day/:dayIndex/log-exercise` (client logs an extra exercise),
and the same shape for `/diet`: `GET /diet/me`, `GET /diet?clientId=`, `POST /diet`,
`PUT /diet/:id`, `POST /diet/:id/assign`, `DELETE /diet/:id`,
`PATCH /diet/:id/meal/:index/toggle`, `POST /diet/log-meal`.

### Nutrition `/api/nutrition` — `GET /today`, `POST /log`, `PATCH /log/:id/toggle`, `GET /history?from=&to=`.

### Workouts `/api/workouts` — `GET /logs?from=&to=&clientId=`, `GET /sessions`, `GET /summary`.
`clientId` is authorisation-sensitive: a trainer may only pass a client on their own roster, a
client may only read their own history.

### Notifications `/api/notifications` — `GET /?unread=`, `GET /unread-count`,
`PATCH /:id/read`, `PATCH /read-all`, `DELETE /:id`, `POST /test` (admin, fires a push+socket).

### Search `/api/search?q=` -> `{ videos:[], plans:[], exercises:[] }`.

### Dashboard (CMS) `/api/dashboard` -> `{ users:{clients,trainers,admins}, content:{total,byGroup},
media:{pending,approved}, videos:{published}, plans:{activeTraining,activeDiet}, recentActivity:[] }`.

### Health `GET /api/health` -> `{ success:true, data:{ status:'ok', db:'connected', uptime, version } }`.

## 6. Socket.IO contract

Connect with `io(SOCKET_URL, { auth: { token: accessToken }, transports:['websocket'] })`.
Middleware verifies the JWT; on failure emit `connect_error` with message `UNAUTHORIZED`.

On connect the server joins the socket to:
`user:<userId>`, `role:<role>`, `content:<locale>`, and for clients `trainer:<trainerId>`,
for trainers `coach:<trainerId>`.

### Server -> client
| Event | Payload | Who |
|---|---|---|
| `connected` | `{ userId, role, rooms }` | the socket |
| `content:updated` | `{ key, type, value, url, locale, platform }` | `content:<locale>` |
| `content:bulk-updated` | `{ items:[...], count }` | `content:<locale>` |
| `content:deleted` | `{ key, locale }` | `content:<locale>` |
| `category:changed` | `{ action, category }` | all |
| `video:created` / `video:updated` / `video:deleted` | `{ video }` / `{ id }` | all |
| `media:status` | `{ id, status, title, reason? }` | uploader `user:<id>` + `role:admin` |
| `media:pending` | `{ id, title, uploadedBy }` | `role:admin` |
| `plan:assigned` | `{ kind:'training'\|'diet', plan }` | `user:<clientId>` |
| `plan:updated` | `{ kind, plan }` | `user:<clientId>` + `coach:<trainerId>` |
| `plan:progress` | `{ clientId, planId, dayIndex, doneCount, total, adherencePct }` | `coach:<trainerId>` |
| `session:completed` | `{ clientId, clientName, title, durationMin }` | `coach:<trainerId>` |
| `client:log` | `{ clientId, kind:'exercise'\|'meal', payload }` | `coach:<trainerId>` |
| `roster:updated` | `{ trainerId }` | `coach:<trainerId>` |
| `notification:new` | `{ notification }` | `user:<id>` |
| `notification:count` | `{ unread }` | `user:<id>` |
| `notification:read` | `{ id, unread }` | `user:<id>` (all that user's devices stay in sync) |
| `presence:update` | `{ userId, online }` | `coach:<trainerId>` |
| `dashboard:tick` | `{ stats }` | `role:admin` |

### Client -> server
| Event | Payload | Ack |
|---|---|---|
| `content:subscribe` | `{ locale, platform }` | `{ ok, count }` |
| `notification:read` | `{ id }` | `{ ok, unread }` |
| `notification:read-all` | – | `{ ok, unread:0 }` |
| `progress:video` | `{ videoId, progress }` | `{ ok }` |
| `ping:presence` | – | `{ ok, ts }` |

Emission helper (backend): `src/realtime/emit.js` exporting
`emitToUser(userId, event, payload)`, `emitToRole(role, ...)`, `emitToCoach(trainerId, ...)`,
`emitToContent(locale, ...)`, `emitAll(...)`. **Every mutating controller must call these.**
Nothing else may touch `io` directly.

## 7. Push notifications (Firebase)

- Backend uses `firebase-admin`. Service account JSON path from `FIREBASE_SERVICE_ACCOUNT_PATH`.
  If the file is missing, the service logs a warning once and becomes a no-op — the app must
  still boot and all other features must work.
- `src/services/pushService.js` -> `sendToUser(userId, { title, body, data })`,
  `sendToTokens(tokens, msg)`; prunes invalid tokens (`messaging/registration-token-not-registered`).
- `src/services/notificationService.js` -> `notify(userId, {type,title,body,data})` which
  (1) writes a `Notification` doc, (2) emits `notification:new` + `notification:count` via socket
  (in-app realtime), (3) calls `pushService.sendToUser` (background/killed delivery). One call,
  both channels — controllers only ever call `notify`.
- Mobile uses `@react-native-firebase/app` + `@react-native-firebase/messaging` +
  `notifee` (or `@notifee/react-native`) for heads-up display while foregrounded.
  `index.js` registers `messaging().setBackgroundMessageHandler` **before** `AppRegistry`.
- Android: `mobile/android/app/google-services.json`. iOS: `mobile/ios/GoogleService-Info.plist`
  + APNs key + `Push Notifications` & `Background Modes > Remote notifications` capabilities.
  Commit `*.example` placeholders, gitignore the real ones, document in `docs/FIREBASE.md`.
- Data payload always carries `{ type, deepLink, notificationId }` so taps can navigate.

## 8. Content keys the mobile app MUST read from the CMS

Nothing user-visible may be hardcoded in the mobile app. Every string/image/video below is a
`Content` doc seeded by the database agent and consumed through the mobile
`useContent()` hook / `<CmsText k="..."/>` component. `t('key','fallback')` returns the seeded
default while offline.

```
common.app_name                = "Firon Performance"
common.app_tagline             = "Train. Track. Transform."
common.logo                    = (image)
common.cta_save                = "Save changes"
common.cta_close               = "Close"
common.toast_saved             = "Details updated ✓"
common.empty_generic           = "Nothing here yet"

auth.login.title               = "Welcome back"
auth.login.subtitle            = "Sign in with email or phone"
auth.login.identifier_label    = "Email or phone"
auth.login.identifier_ph       = "you@email.com"
auth.login.password_label      = "Password"
auth.login.password_ph         = "••••••••"
auth.login.remember            = "Remember me"
auth.login.forgot              = "Forgot password?"
auth.login.submit              = "Sign in"
auth.login.new_here            = "New here?"
auth.login.create_account      = "Create account"
auth.login.hero                = (image)
auth.login.err_identifier      = "Enter a valid email or phone number"
auth.login.err_password        = "Password must be at least 6 characters"
auth.register.title            = "Create account"
auth.register.subtitle         = "Join Firon Performance in under a minute"
auth.register.name_label / .email_label / .phone_label / .password_label / .submit / .otp_hint
auth.forgot.title              = "Reset password"
auth.forgot.subtitle           = "Enter your email or phone and we'll send a one-time verification code."
auth.forgot.via_email / .via_sms / .submit
auth.otp.title                 = "Verify code"
auth.otp.subtitle              = "We sent a 4-digit code to {dest}."
auth.otp.resend_q / .resend / .submit / .demo_hint

onboard.title_signup           = "A bit about you"
onboard.title_edit             = "My details"
onboard.subtitle_signup        = "Coach {coach} uses this to build your training & diet plan"
onboard.subtitle_edit          = "Keep these current so coach {coach} can adjust your plans"
onboard.gender / .age / .height / .weight / .bodyfat / .waist / .goal / .target
onboard.sessions / .level / .cta_signup / .cta_edit / .err_body / .footnote

tabs.client.home = "Home" | tabs.client.train = "Train" | tabs.client.videos = "Videos" | tabs.client.profile = "Profile"
tabs.pt.clients = "Clients" | tabs.pt.plans = "Plans" | tabs.pt.uploads = "Uploads" | tabs.pt.profile = "Profile"

home.greeting_morning          = "Good morning"
home.greeting_afternoon / .greeting_evening
home.stat_sessions_label       = "Sessions this wk"
home.stat_progress_label       = "Plan progress"
home.stat_kcal_label           = "kcal today"
home.today_badge               = "TODAY'S SESSION"
home.today_cta                 = "Start workout"
home.today_banner              = (image)
home.suggested_title           = "Suggested for you"
home.suggested_sub             = "Based on your plan & coach {coach}'s library"
home.continue_title            = "Continue watching"
home.nutrition_title           = "Your nutrition"
home.view_all                  = "View all"
home.promo_video               = (video)

train.title                    = "Train"
train.subtitle                 = "Assigned by coach {coach} · updated {when}"
train.filter_week / .filter_program / .filter_history
train.session_progress         = "Session progress"
train.cta_check_off            = "Check off session ✓"
train.cta_log_exercise         = "+ Log an exercise"
train.up_next                  = "Up next"
train.locked_badge             = "Locked"
train.complete_title           = "Session complete!"
train.demo_cue_default         = "Keep your chest up, brace your core, and control the descent."

videos.title                   = "Videos"
videos.empty_category          = "No videos in this category"
videos.favorites_chip          = "♥ Favorites"
videos.sheet_blurb             = "Coach-approved session from your library. Follow along at your own pace — it counts toward your weekly target."
videos.cta_start / .cta_resume / .cta_fav_add / .cta_fav_remove

search.title = "Search" | search.subtitle | search.placeholder | search.empty | search.no_results

nutrition.title                = "Nutrition"
nutrition.subtitle             = "{plan} · assigned by coach {coach}"
nutrition.protein / .carbs / .fat / .todays_meals / .cta_log_meal

profile.title                  = "Profile"
profile.body_measurements      = "Body measurements"
profile.my_goals               = "My goals"
profile.cta_edit / .cta_logout / .badge_client

pt.roster.portal_label         = "Trainer portal"
pt.roster.stat_clients / .stat_sessions / .stat_requests / .roster_title / .badge_new
pt.builder.title               = "Plans"
pt.builder.subtitle            = "Build a training or diet plan for your client"
pt.builder.tab_train / .tab_diet / .start_from / .library_title / .search_ph
pt.builder.cta_assign_train    = "Assign training plan to {first}"
pt.builder.cta_assign_diet     = "Assign diet plan to {first}"
pt.builder.daily_targets / .meals / .add_meal / .no_meals
pt.uploads.title               = "Media uploads"
pt.uploads.subtitle            = "Exercise demos · reviewed by admin before publishing"
pt.uploads.dropzone_title      = "Upload demo video or image"
pt.uploads.dropzone_sub        = "MP4 or JPG · routed through admin approval"
pt.uploads.mine_title / .badge_pending / .badge_approved / .cta_submit
pt.profile.coaching_details / .certifications / .notifications / .availability
pt.profile.availability_hint   = "Clients can only book sessions inside these hours"
pt.profile.cta_copy_weekdays / .cta_weekend_off / .cta_save_availability

notifications.title            = "Notifications"
notifications.empty            = "You're all caught up"
```
`{coach}`, `{dest}`, `{first}`, `{plan}`, `{when}` are runtime interpolations — the mobile
`t()` helper must support `t('key', {coach:'Sara'})`.

## 9. Seed data (database agent)

Mirror the prototype exactly so the app looks like the mockup on first run.

- Admin: `admin@firon.app` / `password1` (role admin, verified)
- Trainer: `sara@firon.app` / `password1` — Sara Khalil, "Head Coach · Strength & Conditioning",
  Studio 2 · Beirut, `$45 / session`, since 2021,
  certs NASM-CPT / Precision Nutrition L1 / Kettlebell L2,
  availability Mon–Fri 07:00–19:00, Sat 09:00–13:00, Sun off,
  prefs newClientRequests:true, sessionReminders:true, weeklyAdherenceReport:false
- Clients (all `password1`, verified, trainer = Sara):
  - `elie@firon.app` Elie Saide, +961 70 123 456, Male 31, 178cm, 81.4kg, bf 18.2, waist 84,
    goal Fat loss, target 76, 5 sessions, Intermediate — **the demo login**
  - `maya@firon.app` Maya Khoury — plan "Fat Loss · Wk 4", adherence 92, diet "Cutting Plan"
    1800/140/150/55 with the 4 prototype meals
  - `omar@firon.app` Omar Haddad — "Hypertrophy · Wk 2", 78, "Lean Bulk" 3100/190/340/90, 4 meals
  - `lina@firon.app` Lina Aoun — "Onboarding", 0, status new, empty diet plan 2000/120/200/65
  - `karim@firon.app` Karim Nasr — "Strength · Wk 7", 64 (warn), "Maintenance" 2600/170/260/80, 3 meals
- Categories: HIIT, Strength, Core, Mobility, Yoga (order 1..5)
- Videos (durations + progress + favourites from the prototype):
  Full Body HIIT (HIIT, 24:10), Deep Core Stability (Core, 18:45), Mobility Flow (Mobility, 12:30),
  Upper Push Strength (Strength, 32:00), Beginner Yoga Reset (Yoga, 21:15), Explosive Legs (Strength, 28:40)
  Progress for Elie: Full Body HIIT .62 fav, Mobility Flow .30 fav, Beginner Yoga Reset .85,
  Explosive Legs fav.
- Exercises: Back Squat, Bench Press, Deadlift, Pull-up, Overhead Press, Bulgarian Split Squat,
  Goblet Squat, Romanian Deadlift, Incline Dumbbell Press, Walking Lunge, Plank Hold,
  Lat Pulldown, Leg Press, Bicep Curl, Seated Row, Treadmill Run, Burpees, Kettlebell Swing,
  Row Intervals, Mountain Climbers, Barbell Row, Face Pull, Hammer Curl, Cable Fly,
  Hanging Leg Raise, Assault Bike, Sled Push, Farmer Carry
- Elie's training plan "Fat Loss · Week 4" — 5 days:
  Mon Full Body HIIT done 40min [Burpees, Kettlebell Swing, Row Intervals, Mountain Climbers];
  Tue Upper Pull done 50min [Pull-up, Barbell Row, Face Pull, Hammer Curl];
  Wed Lower Body Strength **now** 55min [Goblet Squat 4×12·20kg done, Romanian Deadlift 4×10·40kg done,
  Incline Dumbbell Press 3×12·18kg, Walking Lunge 3×20 steps, Plank Hold 3×45s];
  Thu Push & Core todo locked 45min [Bench Press, Overhead Press, Cable Fly, Hanging Leg Raise];
  Fri Conditioning todo 35min [Assault Bike, Sled Push, Farmer Carry]
- Elie's diet plan "Cutting Plan" 2100 kcal / P120 C140 F48, meals
  Breakfast "Oats, berries & whey" 420 ✓, Lunch "Grilled chicken & rice" 640 ✓,
  Snack "Greek yogurt & almonds" 220 ✓, Dinner "Salmon & greens" 200
- Media assets: 3 for Sara — "Deadlift form cue" (video 0:45, approved),
  "Kettlebell swing" (video 0:32, pending), "Band pull-apart" (image, pending)
- Every `Content` key in §8 with the exact default values shown.

`npm run seed` = wipe + seed. `npm run seed:content` = content only, non-destructive.

## 10. Conventions

- CommonJS in `backend` (`require`). ESM in `cms` and `mobile`.
- Backend folders: `src/config`, `src/models`, `src/controllers`, `src/routes`, `src/middleware`,
  `src/services`, `src/realtime`, `src/utils`, `src/seed`, `src/validators` (zod).
- Validation with `zod` in `src/validators`, applied by a `validate(schema)` middleware.
- Errors: throw `ApiError(status, code, message)` from `src/utils/ApiError.js`; one central
  error handler formats the envelope.
- Async controllers wrapped in `asyncHandler`.
- CMS state: React Query (`@tanstack/react-query`) + a `SocketProvider` that invalidates the
  matching query keys when a socket event arrives. Routing: `react-router-dom` v6.
- Mobile nav: `@react-navigation/native` + `native-stack` + `bottom-tabs`. Storage:
  `@react-native-async-storage/async-storage`. HTTP: `axios` with an interceptor that refreshes
  the access token on a 401 exactly once.
- No `any`-style silent failures: log with `pino` (backend) and a tiny `log.js` elsewhere.
- Do NOT commit `node_modules`, `ios/Pods`, `.env`, `uploads/*`, `google-services.json`,
  `GoogleService-Info.plist`, `firebase-service-account.json`.

---

# 11. `shared/` — sharedService.ts + clientProxy (MANDATORY for CMS and mobile)

A real shared TypeScript package lives at the repo root and is consumed by **both** frontends.
It is already written, typechecks clean, and must not be rewritten — consume it.

```
shared/
  package.json          name: "@firon/shared", main/types -> src/index.ts
  tsconfig.json
  src/
    sharedService.ts    clientProxy + the http.* verb helpers   <-- the heart
    endpoints.ts        `api.*` — EVERY endpoint in §5, all routed through clientProxy
    errors.ts           FPError, FP_ERROR_CODES, field-error extraction
    alertBus.ts         fpAlert.error/success/warning/info/confirm + onAlert subscription
    config.ts           configureSharedService() adapter injection, resolveMediaUrl()
    theme.ts            FP_COLORS, FP_RADIUS, FP_SPACING, FP_GRADIENTS, fpAdherenceColor()
    types.ts            every DTO from §4 as it appears over the wire
    socketEvents.ts     FP_SOCKET_EVENTS / FP_SOCKET_EMITS + typed payloads for §6
    index.ts            barrel — import everything from '@firon/shared'
```

## 11.1 The rule

**Every** network call from the CMS and the mobile app goes through `clientProxy`.
No screen, hook, component or context may call `fetch`, `axios` or `XMLHttpRequest` directly.
In practice screens call the typed wrappers in `endpoints.ts`:

```ts
import { api } from '@firon/shared';
const { user, accessToken, refreshToken } = await api.auth.login({ identifier, password });
```

`clientProxy` is the one place that:
- builds the URL and query string from `baseUrl`,
- attaches `Authorization: Bearer <accessToken>`,
- unwraps the `{ success, data, meta }` envelope (§5),
- **normalises every failure into an `FPError`** — transport, timeout, abort, non-2xx, malformed
  envelope — with `code`, `message`, `status`, `details` and `fieldErrors`,
- refreshes the access token on a 401 **once**, single-flight, and replays the original request;
  calls `onUnauthenticated` when the refresh itself fails,
- retries transport failures and 5xx with exponential backoff,
- **raises the alert popup** by publishing to the alert bus, which `FP_AlertProvider` renders
  with `FP_Alert`,
- then rethrows the `FPError` so a screen can still branch on `code` or read `fieldErrors`.

Per-call escape hatches (pass as the last argument to any `api.*` method):
`showAlert: false` (screen renders the error itself), `alertTitle`, `suppressAlertForCodes`,
`successMessage` (pops a success alert), `signal`, `timeoutMs`.

## 11.2 Boot wiring — do this once per app

```ts
import { configureSharedService } from '@firon/shared';

configureSharedService({
  baseUrl: API_URL,            // http://localhost:4000/api
  socketUrl: SOCKET_URL,       // http://localhost:4000
  platform: 'web' | 'ios' | 'android',
  getAccessToken:   () => tokenStore.get('accessToken'),   // localStorage / AsyncStorage
  getRefreshToken:  () => tokenStore.get('refreshToken'),
  onTokensRefreshed: t => tokenStore.setTokens(t),
  onUnauthenticated: () => authStore.forceLogout(),
  debug: __DEV__,
});
```

CMS: `cms/src/main.jsx` (or a `cms/src/bootstrap.ts` it imports first).
Mobile: `mobile/src/bootstrap.ts`, imported at the top of `index.js` before `AppRegistry`.

## 11.3 Module resolution — wire `@firon/shared` in both apps

**CMS (`cms/vite.config.js`)** — alias plus `fs.allow` so Vite may read outside its root:
```js
resolve: { alias: { '@firon/shared': path.resolve(__dirname, '../shared/src') } },
server: { fs: { allow: ['..'] } },
```
Also add the path to `cms/jsconfig.json` (or `tsconfig.json`) so editors resolve it.

**Mobile (`mobile/metro.config.js`)** — Metro must watch the folder outside the project root:
```js
const sharedPath = path.resolve(__dirname, '../shared');
module.exports = mergeConfig(getDefaultConfig(__dirname), {
  watchFolders: [sharedPath],
  resolver: {
    extraNodeModules: { '@firon/shared': path.resolve(sharedPath, 'src') },
  },
});
```
And in `mobile/tsconfig.json`:
```json
"baseUrl": ".",
"paths": { "@firon/shared": ["../shared/src/index.ts"], "@firon/shared/*": ["../shared/src/*"] }
```
Verify resolution actually works — `npx tsc --noEmit` AND a real Metro bundle, not just the
typecheck. If Metro cannot resolve it, fix the config; do **not** copy the files into `mobile/`.

## 11.4 The alert popup

`clientProxy` publishes to `alertBus`; each app mounts exactly one `FP_AlertProvider` at the root
that subscribes via `onAlert()` and renders `FP_Alert`. Neither provider may contain business
logic — it is a pure presenter.

- **Variants**: `error` (danger border, never auto-dismisses), `success` (lime, 2.6s),
  `warning` (amber, 4s), `info` (3.2s), `confirm` (two buttons, resolves a promise).
- Shows `title`, `message`, an optional small monospaced `technical` line
  (`POST /api/auth/login · 422 · VALIDATION_ERROR`), and the `actions`.
- Stacks multiple alerts; the bus already dedupes identical alerts inside 1.5s.
- CMS: a centred modal with a backdrop, `Esc` to close, focus trapped, `role="alertdialog"`.
- Mobile: an `FP_BottomSheet`-style card or centred modal over a `rgba(0,0,0,.55)` backdrop,
  safe-area aware, **never** React Native's built-in `Alert.alert`.
- `fpAlert.success/error/warning/info/confirm` are also callable directly from any screen for
  non-network messages — the prototype's toasts stay as `FP_Toast`, which is a different thing.

## 12. `FP_` component naming (MANDATORY for CMS and mobile)

**Every UI element is a component and every component name starts with `FP_`.** No raw `<button>`,
`<input>`, `<div class="card">` on web and no raw `<Pressable>`/`<TextInput>`/styled `<View>` card
in a screen — screens compose `FP_*` components only. Layout-only wrappers are the sole exception,
and even those should be `FP_Row`, `FP_Column`, `FP_Screen`.

- One component per file, filename = component name: `FP_Button.tsx`, `FP_Textbox.tsx`.
- Location: `cms/src/components/FP_*.tsx` and `mobile/src/components/FP_*.tsx`, each with an
  `index.ts` barrel re-exporting all of them.
- Props interfaces are named `FP_ButtonProps` etc. and exported.
- Every component pulls its colours/radii/spacing from `@firon/shared`'s `FP_COLORS` / `FP_RADIUS`
  / `FP_SPACING` — no hex literals inside components.
- Web components are `.tsx` (Vite compiles TSX with no extra config); the rest of the CMS may stay
  `.jsx`.

### Required inventory — both apps

| Component | Purpose |
|---|---|
| `FP_Button` | variants `primary` \| `secondary` \| `ghost` \| `danger`; `loading`, `disabled`, `icon`, `fullWidth`; 0.98 press scale |
| `FP_Textbox` | single-line text/email/phone/password/numeric input: `label`, `placeholder`, `error`, `hint`, `leftIcon`, `rightIcon`, `secure` toggle |
| `FP_Textarea` | multi-line, autogrow, char counter |
| `FP_Label` | field label / section label |
| `FP_Card` | surface + 1px line + radius 18 |
| `FP_Chip` | pill; `active`, `onPress`, `icon` |
| `FP_ChipScroll` | horizontal scroller of chips, edge-bleeding like the prototype |
| `FP_Segmented` | segmented control, lime active pill |
| `FP_Badge` | `ok` \| `warn` \| `pt` \| `danger` |
| `FP_Checkbox` | 26px, lime when checked, strike-through label |
| `FP_Switch` | on/off |
| `FP_Select` | dropdown / picker |
| `FP_Avatar` | lime→mint gradient with initials, sizes `sm`/`md`/`lg`/`xl` |
| `FP_StatCard` | big number + small label |
| `FP_KeyValueRow` | the prototype's `.kv` row |
| `FP_ListItem` | icon/avatar + title + subtitle + trailing slot, bottom hairline |
| `FP_Divider` | 1px line |
| `FP_Thumb` | gradient media tile: play button, duration pill, favourite heart, progress bar |
| `FP_ProgressRing` | conic-style ring with inner label |
| `FP_ProgressBar` | linear progress |
| `FP_SearchInput` | magnifier + input |
| `FP_Modal` | backdrop + centred panel, Esc/back to close |
| `FP_BottomSheet` | slide-up sheet, grab handle, 82% max height, backdrop tap to close |
| `FP_Alert` | the popup rendered for `clientProxy` failures and `fpAlert.*` |
| `FP_AlertProvider` | mounts once at the root, subscribes to the alert bus |
| `FP_Toast` | floating pill, auto-hides after 1.8s (the prototype's `toast()`) |
| `FP_ToastProvider` | `useToast()` |
| `FP_Spinner` | activity indicator |
| `FP_Skeleton` | shimmer placeholder |
| `FP_EmptyState` | icon + title + message + optional CTA |
| `FP_ErrorState` | for a failed query, with a retry button |
| `FP_Screen` | safe-area + background + scroll wrapper |
| `FP_Row` / `FP_Column` | flex layout primitives with `gap` |
| `FP_Icon` | the prototype's SVG paths (`react-native-svg` on mobile, inline `<svg>` on web) |
| `FP_Tabs` | in-page tabs |
| `FP_Fab` | floating action button |
| `FP_OtpInput` | the 4-box OTP row with auto-advance and backspace-to-previous |
| `FP_TimePicker` | `HH:mm` picker for trainer availability |
| `FP_ConfirmDialog` | thin wrapper over `fpAlert.confirm` |

### CMS-only, additionally
`FP_Table` (sortable, paginated), `FP_Pagination`, `FP_Drawer`, `FP_Sidebar`, `FP_Topbar`,
`FP_FileDrop` (drag-and-drop upload with progress), `FP_MediaPicker` (browse/upload approved
assets — used by every image/video content row), `FP_JsonEditor`, `FP_ColorPicker`,
`FP_Breadcrumbs`, `FP_Tooltip`, `FP_PhonePreview` (the phone-shaped live content preview),
`FP_StatusDot` (socket connection indicator).

### Mobile-only, additionally
`FP_TabBar` (the bottom bar), `FP_AppHeader`, `FP_MealRing`, `FP_VideoPlayer`
(`react-native-video` wrapper), `FP_CmsText` / `FP_CmsImage` / `FP_CmsVideo`
(the CMS-driven content components — these replace the earlier `CmsText`/`CmsImage`/`CmsVideo`
names), `FP_NotificationBanner` (the in-app heads-up banner), `FP_PullToRefresh`.

### Anti-patterns that will be rejected
- A screen importing `axios`, `fetch` or `socket.io-client` directly.
- A component named without the `FP_` prefix (except providers' internal helpers not exported).
- A hex colour literal inside a component.
- A `try/catch` in a screen that shows its own error dialog — the proxy already did.
- Duplicating a DTO type locally instead of importing it from `@firon/shared`.

---

# 13. Guest preview mode (MOBILE — MANDATORY)

**On a fresh install, before anyone signs in, the app opens straight into the client experience
and looks signed-in. Any tap on anything interactive opens the login screen.**

This is not a marketing splash and not a "skip" button — the app boots into a populated Home tab
with the real design, the real bottom tab bar, real CMS copy and a real video library. It simply
cannot be used until the user authenticates.

Applies to the mobile app only. The CMS has no guest mode — it is a staff portal and its
unauthenticated route is the login page, full stop.

## 13.1 Navigation shape

`RootNavigator` is a native stack:

```
RootStack
  ├── AppTabs      (base screen — ClientTabs when guest or role==='client', PtTabs when trainer)
  ├── Login        \
  ├── Register      |  presented modally ON TOP of AppTabs
  ├── Forgot        |  (presentation: 'modal', gestureEnabled so it can be dismissed
  ├── Otp           |   back to the preview)
  └── Onboarding   /
```

Boot logic in `RootNavigator`:

| Stored session | Mount |
|---|---|
| none | `AppTabs` in **guest** mode (`ClientTabs`), no modal on top |
| valid, `role: 'client'` | `AppTabs` → `ClientTabs`, authenticated |
| valid, `role: 'trainer'` | `AppTabs` → `PtTabs`, authenticated |
| valid, `role: 'admin'` | the "use the web CMS" screen |
| valid but `onboardingCompleted === false` | `Onboarding` |

After a successful login, `navigation.reset` to `AppTabs` for the real role — never `goBack`, or a
trainer would land in the client tabs. After logout, reset to `AppTabs` in guest mode again, so
logging out returns to the preview rather than a bare login form.

## 13.2 The gate

`src/guest/GuestGateProvider.tsx` exposes:

```ts
interface GuestGate {
  isGuest: boolean;
  /** Opens the Login modal. Returns true when the tap was intercepted. */
  gate: (reason?: string) => boolean;
}
export function useGuestGate(): GuestGate;
```

`gate()` navigates to `Login`. It must be idempotent — rapid double taps must not stack two
Login modals.

**The interception lives inside the `FP_` components, not in the screens.** Because §12 already
requires that every interactive element is an `FP_` component, wiring the gate into the
primitives makes the behaviour airtight by construction and leaves scrolling untouched:

```tsx
// inside FP_Button, and every other pressable FP_ component
const { isGuest, gate } = useGuestGate();
const handlePress = (e) => {
  if (isGuest && !guestAllowed) { gate(); return; }
  onPress?.(e);
};
```

Components that must implement the gate: `FP_Button`, `FP_IconButton`, `FP_Chip`, `FP_Checkbox`,
`FP_Switch`, `FP_Segmented`, `FP_ListItem`, `FP_Thumb`, `FP_Select`, `FP_Fab`, `FP_Tabs`,
`FP_SearchInput` (on focus), `FP_Textbox` / `FP_Textarea` (on focus — a guest must not be able to
type into a field), `FP_TimePicker`, `FP_VideoPlayer` (tapping play), and `FP_TabBar` (see below).

Every gated component takes a `guestAllowed?: boolean` prop that opts out. Use it for:
- everything rendered by the Login / Register / Forgot / Otp screens themselves,
- the guest banner's own "Sign in" button,
- `FP_Alert` and `FP_Toast` controls (dismissing a popup must always work),
- pull-to-refresh and scrolling, which are never gated.

**Do NOT gate with a full-screen transparent overlay** — it would block scrolling, and a guest
should be able to scroll the preview.

### The tab bar
The bottom tab bar stays visible and correct. In guest mode, switching to **Train**, **Videos** or
**Profile** is allowed so the preview is explorable, but every action *inside* those tabs is gated
by the rule above. Rationale: the tab bar is navigation, not an action, and a dead tab bar makes
the app look broken rather than signed-in.

## 13.3 What the preview shows

Real data wherever the API allows it — these endpoints need no token and must be used:

| Endpoint | Feeds |
|---|---|
| `GET /api/content?format=map&platform=mobile&locale=en` | **every label, image and video** — same as an authenticated session |
| `GET /api/categories` | the Videos tab category chips |
| `GET /api/videos` | the Videos tab grid and the Home rails, with real thumbnails and durations |

Per-user data cannot be fetched without a token, so it comes from
`src/guest/previewData.ts` — compiled-in placeholders that mirror the prototype exactly, so the
preview is pixel-faithful to the approved design:

- Home stats `3/5` sessions · `62%` plan progress · `1,480` kcal
- Today's session: **Lower Body Strength**, 6:00 PM, "With coach Sara · Studio 2 · 60 min"
- Train: "Fat Loss · Week 4", day 3 of 5, the five Wednesday exercises with their prescriptions
  (Goblet Squat 4 × 12 · 20kg, Romanian Deadlift 4 × 10 · 40kg, Incline Dumbbell Press
  3 × 12 · 18kg, Walking Lunge 3 × 20 steps, Plank Hold 3 × 45s), first two shown done
- Nutrition: "Cutting Plan", 1,480 / 2,100 kcal, P 120g · C 140g · F 48g, the four meals
- Profile: the `me` body stats from the prototype (178 cm, 81.4 kg, BMI, 18.2% bf, waist 84,
  Fat loss, target 76, 5 sessions, Intermediate)

`previewData.ts` must be clearly marked as preview-only and must never be used once authenticated.

## 13.4 Guest copy — CMS-driven like everything else

Ten keys are seeded in group `guest` (all public):

```
guest.banner_title    = "Preview mode"
guest.banner_body     = "Sign in to start training with your coach"
guest.banner_cta      = "Sign in"
guest.gate_title      = "Sign in to continue"
guest.gate_body       = "Create an account or sign in to use this."
guest.greeting        = "Welcome"                       // replaces the time-of-day greeting
guest.display_name    = "Athlete"                       // stand-in for the client's name
guest.coach_name      = "Sara"                          // fills {coach} interpolations
guest.profile_badge   = "Preview · Not signed in"       // replaces "Client · Premium plan"
guest.profile_cta     = "Sign in to see your real plan"
```

Render a small, dismissible `FP_GuestBanner` pinned above the tab bar using
`guest.banner_title` / `guest.banner_body` / `guest.banner_cta`. Keep it subtle — the brief is that
the app *looks signed in* — and make it dismissible for the session. Because the copy is CMS-driven
the banner can be emptied from the CMS without an app release.

`gate()` may optionally surface `guest.gate_title` / `guest.gate_body` via `fpAlert.info` on the
first interception only; after that it should navigate silently, so repeated taps aren't naggy.

## 13.5 Non-negotiables

- A guest must never be able to type into an input, toggle a checkbox, favourite a video, check
  off an exercise, log a meal, or reach a PT screen.
- No authenticated endpoint may be called while `isGuest` — the shared `clientProxy` would 401
  and pop an error dialog, which must not happen on first launch. Guard the guest-mode data
  hooks so they simply don't fire.
- `ContentProvider` and `SocketProvider` must both tolerate having no token: content still loads
  from the public endpoint, and the socket simply does not connect until a session exists.
- Logging out returns to the guest preview, not to a bare login screen.
