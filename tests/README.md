# Integration tests

Black-box tests that run against a **live backend on `http://localhost:4000`** with a seeded
database. They exercise the real HTTP and Socket.IO surfaces — no mocks.

```bash
# prerequisites
mongod --dbpath /tmp/firon-mongo --port 27017 &
npm --prefix backend run seed
npm --prefix backend run dev &

# run
npm run test:integration        # both suites
npm run test:proxy              # shared clientProxy / sharedService
npm run test:realtime           # Socket.IO events
```

All three suites **abort with an explanatory message** if the server on :4000 is not the Firon
backend — an unrelated project holds IPv4 on that port on this machine, which would otherwise make
a run fail (or appear to pass) against a different application. See `backend/README.md`.

## `clientProxy.test.ts` — the shared service layer (37 assertions)

Drives `@firon/shared` exactly as the CMS and the mobile app do, asserting:

- `/api/health` unauthenticated
- **Role comes from the server, never the request** — `elie@` → `client`, `sara@` → `trainer`,
  `admin@` → `admin`, from a body containing only `{ identifier, password }`
- `{ success, data, meta }` envelope unwrapping, including `withMeta` for paginated lists
- The CMS content map is flat and carries all 156 seeded keys
- `/videos` merges the caller's `progress` + `favorite`; `/videos/suggested` carries `why`
- **Every failure normalises to one `FPError`** with the right `code` / `status` / `message`
- **The alert popup is raised by the proxy**, once, with a technical line — and suppressed by
  `showAlert: false` and by `suppressAlertForCodes`
- Transport failure against a dead port → `NETWORK`, status 0, retryable, "No connection"
- **Single-flight refresh**: 5 parallel calls on an expired access token all recover from one
  refresh, with no spurious logout
- A dead refresh token fires `onUnauthenticated` exactly once
- The alert bus dedupes identical alerts inside its window

## `realtime.test.js` — Socket.IO (25 assertions)

Connects three real sockets (admin, client, trainer) and asserts:

- A socket with a garbage JWT is **rejected** at the handshake
- The `connected` payload carries `userId`, `role` and the joined rooms
- `PUT /api/content/:id` → **`content:updated` reaches both the mobile client and the CMS**,
  with the new value, type and locale
- `PATCH /api/content/bulk` → `content:bulk-updated` with `items` + `count`
- A client checking off an exercise → **`plan:progress` reaches that client's trainer** with
  `doneCount` / `total` / `adherencePct`
- `POST /api/notifications/test` → **`notification:new` reaches the client in-app**, persisted
  with an id (the channel that works independently of FCM)
- `PUT /api/videos/:id` → `video:updated` broadcast
- **Room isolation**: trainer-only events never leak to a client socket
- Both content probes restore the exact value they read, and assert the restore — an earlier
  version restored a hardcoded string and silently corrupted one row's copy

## `authorization.test.js` — cross-user isolation (21 assertions)

- Every user sees **only their own** notifications
- Unread counts agree across `/auth/me`, `/notifications/unread-count` and the list's `meta.unread`
- A client cannot read *or mutate* another client's training plan
- Clients are blocked from `/clients`, `/clients/stats`, `/trainer/profile`, `/users`,
  `/dashboard`, `/media`; trainers are blocked from `/users`, `/dashboard` and CMS content writes
- A trainer sees exactly their own roster

Both suites are idempotent — they restore any value they mutate.
