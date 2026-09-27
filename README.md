# Firon Performance

A CMS-driven personal-training platform. **Every label, image and video in the mobile app is
served from the CMS and updates in realtime over Socket.IO** — no app release needed to change copy.

| Piece | Stack | Location |
|---|---|---|
| Shared API (mobile + CMS) | Node 20, Express 4, MongoDB (Mongoose 8), Socket.IO 4, JWT, Firebase Admin | `backend/` |
| CMS / admin portal | React 19 + Vite, React Query, react-router-dom, socket.io-client | `cms/` |
| Mobile app (Client + PT portals) | React Native 0.87 **CLI** + TypeScript (not Expo) | `mobile/` |
| Shared contract | API, socket events, Mongo schemas, design tokens, content keys | `docs/CONTRACT.md` |
| Approved design | The interactive prototype this was built from | `docs/prototype.html` |

## Two portals, one app — routed by role, never by a picker

The login screen asks for **email-or-phone and password only**. There is deliberately no
"are you a client or a trainer?" selector. The server returns `user.role` and the app mounts the
matching navigator:

- `client` → Home · Train · Videos · Profile
- `trainer` → Clients · Plans · Uploads · Profile
- `admin` → web CMS only

Auth is JWT: a short-lived access token plus a refresh token, with a single-flight refresh
interceptor on both clients.

## Quick start

```bash
# 0. MongoDB on :27017
mkdir -p /tmp/firon-mongo
mongod --dbpath /tmp/firon-mongo --port 27017

# 1. install everything
npm run install:all
cd mobile/ios && pod install && cd ../..

# 2. seed the database (users, plans, videos and every CMS content key)
cp backend/.env.example backend/.env
npm run seed

# 3. run
npm run backend     # http://localhost:4000  (API + Socket.IO)
npm run cms         # http://localhost:5173  (CMS)
npm run ios         # iOS simulator
```

### Demo logins (all `password1`)

| Email | Role | Lands in |
|---|---|---|
| `elie@firon.app` | client | mobile client portal |
| `sara@firon.app` | trainer | mobile PT portal |
| `admin@firon.app` | admin | CMS |

## How the CMS drives the app

1. Admin edits a label, image or video in the CMS (`/content`, `/media`, `/videos`).
2. Backend persists it and emits `content:updated` to the `content:<locale>` room.
3. The mobile `ContentProvider` patches its in-memory map and re-renders — **live**.
4. The map is cached in AsyncStorage, so a cold offline launch still reads correctly, falling
   back to compiled-in defaults only when a key has never been fetched.

The full key list lives in `docs/CONTRACT.md` §8.

## Notifications

Two channels, one call. Backend controllers call `notificationService.notify(userId, msg)`, which:

- persists a `Notification` document,
- emits `notification:new` + `notification:count` over Socket.IO → **in-app realtime banner + badge**,
- sends an FCM message via `firebase-admin` → **delivery while backgrounded or killed**.

See `docs/FIREBASE.md` for the Firebase/APNs setup. The backend and app both boot and work
normally when the Firebase credentials are absent.

## Tests

Black-box integration suites that run against a live backend with a seeded database — no mocks.

```bash
npm run test:integration    # all three (81 assertions)
npm run test:proxy          # 37 — the shared clientProxy / sharedService layer
npm run test:realtime       # 23 — Socket.IO events end to end
npm run test:authz          # 21 — cross-user isolation and role guards
```

`test:authz` is the one to keep an eye on: it asserts that every user sees only their own
notifications, that unread counts agree across `/auth/me`, `/notifications/unread-count` and the
list's `meta`, that a client cannot read or mutate another client's plan, and that clients and
trainers are blocked from the surfaces above their role.

## Docs

- `docs/CONTRACT.md` — the shared contract every part is built against
- `backend/docs/API.md` — endpoint reference
- `backend/docs/DATABASE.md` — schema reference
- `backend/README.md`, `cms/README.md`, `mobile/README.md` — per-project setup
