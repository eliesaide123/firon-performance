# Firon Performance — backend

The **single shared API** for both clients: the React Native mobile app (client + PT portals) and
the React + Vite CMS. Express 4 · MongoDB (Mongoose 8) · Socket.IO 4 · JWT · Firebase Admin.

- Endpoint reference: [`docs/API.md`](docs/API.md)
- Schema reference: [`docs/DATABASE.md`](docs/DATABASE.md)
- The contract every part of the system is built against: [`../docs/CONTRACT.md`](../docs/CONTRACT.md)

## Quick start

```bash
# 1. MongoDB on :27017
mkdir -p /tmp/firon-mongo && mongod --dbpath /tmp/firon-mongo --port 27017

# 2. env + deps
cp .env.example .env
npm install

# 3. seed users, plans, videos and all 166 CMS content keys
npm run seed

# 4. run
npm run dev          # http://localhost:4000  (API + Socket.IO, nodemon)
npm start            # production
```

`GET /api/health` → `{"success":true,"data":{"status":"ok","db":"connected","uptime":31,...}}`

### ⚠️ Port 4000 is contested on this machine

An unrelated project (`node src/index.js`, running since early September) also listens on **:4000
over IPv4**. Because it holds the IPv4 socket first, this server's dual-stack bind falls back to
**IPv6-only** — it still starts, with no error.

The consequence is that tools disagree about what `localhost:4000` means:

| Client | Prefers | Reaches |
|---|---|---|
| `curl` | IPv4 | the **other** project |
| Node `fetch` / the integration suites | IPv6 | **this** server |

So `curl localhost:4000/api/health` can return `{"ok":true,"uptime":2174230}` — that is *not* this
API. Diagnose and disambiguate with:

```bash
lsof -nP -iTCP:4000 -sTCP:LISTEN          # two listeners = the conflict is present
curl http://[::1]:4000/api/health          # explicitly this server
curl http://127.0.0.1:4000/api/health      # explicitly the other one
```

The permanent fixes are to stop the other process, or run this server on a free port
(`PORT=4100 npm run dev`) and update `cms/.env` + `mobile/src/config.ts` to match.

All three integration suites now **fail fast with an explanatory message** if they find a
non-Firon server on the port, so a run can never silently pass against the wrong application.

### Seed logins (all `password1`)

| Email | Role | Used by |
|---|---|---|
| `elie@firon.app` | client | mobile client portal (has the Fat Loss Week 4 plan + Cutting Plan) |
| `sara@firon.app` | trainer | mobile PT portal (5 clients, 3 media uploads) |
| `admin@firon.app` | admin | the CMS |

## Environment

| Var | Default | Notes |
|---|---|---|
| `PORT` | `4000` | |
| `NODE_ENV` | `development` | `production` hides stack traces and disables the OTP dev code |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/firon_performance` | |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | dev values | **change for production** |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | `15m` / `30d` | |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | comma-separated; also gates Socket.IO |
| `UPLOAD_DIR` | `uploads` | served at `/uploads/<filename>` |
| `MAX_UPLOAD_MB` | `200` | |
| `OTP_TTL_MINUTES` | `10` | |
| `OTP_DEV_CODE` | `1234` | accepted in non-production only |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | `./firebase-service-account.json` | optional — see below |

## Seeding

```bash
npm run seed            # destructive: wipe + reseed everything
npm run seed:content    # non-destructive: insert only missing CMS content keys
node src/seed/index.js --content-only --force-content   # also overwrite edited keys
```

`seed:content` is safe to run against a live database — it inserts new keys and leaves
admin-edited ones alone. `POST /api/content/seed-defaults` calls the same code path.

## Auth model

JWT, short-lived access token + long-lived refresh token.

- Access token payload: `{ sub, role, email, tokenVersion, iat, exp }`. Bumping a user's
  `tokenVersion` (deactivate, password reset) invalidates every outstanding access token.
- **`POST /api/auth/login` takes `{ identifier, password }` only.** There is deliberately no
  `role` in the request — the server resolves the user and returns `user.role`, and the clients
  route on that. See `CONTRACT.md` §3.
- OTP is 4 digits, bcrypt-hashed, TTL-indexed, max 5 attempts. In non-production the generated
  code is logged **and** `OTP_DEV_CODE` (`1234`) is always accepted.
- `mailService` / `smsService` are dev stubs that log the OTP. Swap in a real provider there —
  nothing else needs to change.

## Realtime (Socket.IO)

Clients connect with `io(origin, { auth: { token: accessToken } })`. A bad token is rejected at the
handshake with `UNAUTHORIZED`. On connect a socket joins `user:<id>`, `role:<role>`,
`content:<locale>`, plus `trainer:<trainerId>` (clients) or `coach:<trainerId>` (trainers).

| Event | To | Emitted when |
|---|---|---|
| `connected` | the socket | on connect, with `{ userId, role, rooms }` |
| `content:updated` | `content:<locale>` | a CMS content row changes — **drives live label/image/video updates in the app** |
| `content:bulk-updated` | `content:<locale>` | `PATCH /content/bulk` |
| `content:deleted` | `content:<locale>` | a content row is deleted |
| `category:changed` | all | category CRUD |
| `video:created` / `video:updated` / `video:deleted` | all | video CRUD |
| `media:pending` | `role:admin` | a trainer uploads media |
| `media:status` | uploader + `role:admin` | admin approves/rejects |
| `plan:assigned` | `user:<clientId>` | a plan is assigned |
| `plan:updated` | client + coach | a plan changes |
| `plan:progress` | `coach:<trainerId>` | the client checks off an exercise |
| `session:completed` | `coach:<trainerId>` | the client finishes a session |
| `client:log` | `coach:<trainerId>` | the client logs an extra exercise or meal |
| `roster:updated` | `coach:<trainerId>` | a client is assigned/unassigned |
| `notification:new` / `notification:count` / `notification:read` | `user:<id>` | in-app notifications, all devices in sync |
| `presence:update` | `coach:<trainerId>` | a client connects/disconnects |
| `dashboard:tick` | `role:admin` | every 30s while an admin is connected |

Client→server: `content:subscribe`, `notification:read`, `notification:read-all`,
`progress:video`, `ping:presence`.

**Controllers never touch `io`.** They call the helpers in `src/realtime/emit.js`
(`emitToUser`, `emitToRole`, `emitToCoach`, `emitToContent`, `emitAll`), which no-op safely with a
warning if the socket server isn't up — so a controller stays unit-testable.

## Notifications — one call, two channels

```js
await notify(userId, { type: 'plan_assigned', title: '…', body: '…', data: { planId } });
```

`src/services/notificationService.js#notify` does all three things:

1. persists a `Notification` document,
2. emits `notification:new` + `notification:count` over Socket.IO → **in-app realtime**,
3. calls `pushService.sendToUser` → **FCM delivery while backgrounded or killed**.

Controllers only ever call `notify` — never the socket or FCM directly for user-facing messages.

### Firebase

Drop a service-account JSON at `FIREBASE_SERVICE_ACCOUNT_PATH` (default
`backend/firebase-service-account.json`, gitignored):

1. Firebase console → Project settings → Service accounts → *Generate new private key*.
2. Save it to that path and restart.

**If the file is absent the service logs one warning and becomes a no-op.** The server boots and
every other feature — including in-app socket notifications — works normally. Invalid device
tokens are pruned automatically on `messaging/registration-token-not-registered`.

## Layout

```
src/
  app.js          express app: helmet, cors, compression, /uploads, /api, error handler
  server.js       http server + socket.io + mongo connect + graceful shutdown
  config/         env, db (connectDB / dbState)
  models/         15 Mongoose models + the shared toJSON plugin
  controllers/    16 controllers
  routes/         16 routers, mounted in routes/index.js
  middleware/     auth (requireAuth / optionalAuth / requireRole), validate (zod),
                  upload (multer), rateLimit, errorHandler
  services/       token, otp, mail, sms, push, notification, content, plan, video, access
  realtime/       socket server, room joins, handlers, emit helpers
  validators/     one zod file per resource
  seed/           seed runner + data modules
  utils/          ApiError, asyncHandler, respond, logger, pagination, urls, ids, text
```

## Conventions

- CommonJS. Controllers wrapped in `asyncHandler`; failures thrown as
  `ApiError(status, code, message)` and formatted by one central error handler.
- Every response uses the envelope in `CONTRACT.md` §5:
  `{ success: true, data, meta? }` / `{ success: false, error: { code, message, details? } }`.
  The frontends' shared `clientProxy` depends on this — don't return a bare object.
- `error.code` is a contract: the clients branch on it and suppress error popups per-code.
  The full vocabulary is in `docs/API.md`.
- Validation is zod, applied by `validate(schema, source)`; failures are `422 VALIDATION_ERROR`
  with per-field `details`.
- Authorisation is enforced **in controllers**, not only by route guards: a trainer can only reach
  their own clients' data, a client only their own.

## Tests

Integration suites live at the repo root and run against a live server:

```bash
npm --prefix .. run test:integration    # 37 HTTP + 23 Socket.IO assertions
```
