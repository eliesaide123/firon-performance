# `@firon/shared`

The shared TypeScript service layer used by **both** the CMS (`cms/`) and the mobile app
(`mobile/`). Built on `fetch` / `XMLHttpRequest` only, so it runs unchanged in React Native and
in the browser — no platform shims, no axios.

## The one rule

> Every network call from either frontend goes through `clientProxy`.

No screen, page, hook, component, context or navigator may call `fetch`, `axios` or
`XMLHttpRequest` directly. In practice you never call `clientProxy` by hand either — you call the
typed wrapper in `endpoints.ts`:

```ts
import { api } from '@firon/shared';

const { user, accessToken, refreshToken } = await api.auth.login({ identifier, password });
const plan   = await api.plans.myTraining();
const { data, meta } = await api.content.list({ group: 'auth', page: 1 });
await api.media.upload(formData, pct => setProgress(pct));
```

## What `clientProxy` does so your screens don't

| Concern | Handled where |
|---|---|
| Build the URL + query string from `baseUrl` | `buildUrl` |
| Attach `Authorization: Bearer <accessToken>` | `buildHeaders` |
| Unwrap the `{ success, data, meta }` envelope | success branch |
| **Normalise every failure into one `FPError`** | `toFPError` |
| Extract `fieldErrors` from a 422 for inline validation | `errors.ts` |
| Refresh the access token on 401, **single-flight**, and replay the request | `refreshTokens` |
| Force logout when the refresh itself fails | `config.onUnauthenticated` |
| Retry transport failures and 5xx with exponential backoff | retry loop |
| Upload progress (0–100) | XHR transport |
| **Raise the alert popup** | `raiseAlert` → `alertBus` → `FP_Alert` |
| Telemetry for every request outcome | `config.onRequest` / `config.onError` |

Then it rethrows the `FPError`, so a screen can still branch on `err.code` or read
`err.fieldErrors` when it wants to.

## Errors

Everything that can go wrong becomes an `FPError`:

```ts
interface FPError {
  code: string;        // 'NETWORK' | 'TIMEOUT' | 'UNAUTHORIZED' | 'VALIDATION_ERROR' | server code
  message: string;     // human-readable, safe to display
  status: number;      // HTTP status, or 0 for transport failures
  details?: unknown;
  fieldErrors?: Record<string, string>;   // from a 422
  request?: { method, path };
  retryable: boolean;
}
```

## The alert popup

`clientProxy` publishes to `alertBus`; each app mounts one `FP_AlertProvider` that subscribes and
renders `FP_Alert`. One implementation of "tell the user it broke", not one per screen.

You can publish directly for non-network messages too:

```ts
import { fpAlert } from '@firon/shared';

fpAlert.success('Plan assigned');
fpAlert.warning('You are over your calorie target');
if (await fpAlert.confirm('Delete this video?', 'This cannot be undone.', { danger: true })) { ... }
```

### Per-call escape hatches

```ts
api.auth.login(body, { showAlert: false })                        // screen renders it inline
api.videos.setProgress(id, { progress }, { showAlert: false })    // fires constantly, stay quiet
api.plans.assignTraining(id, { successMessage: 'Plan assigned' }) // pop a success alert
api.content.update(id, body, { suppressAlertForCodes: ['CONFLICT'] })
api.clients.roster({}, { signal: controller.signal, timeoutMs: 8000 })
```

## Boot wiring

Once per app, before any call:

```ts
import { configureSharedService } from '@firon/shared';

configureSharedService({
  baseUrl: 'http://localhost:4000/api',
  socketUrl: 'http://localhost:4000',
  platform: 'web',                 // 'ios' | 'android' on mobile
  getAccessToken:    () => store.get('accessToken'),
  getRefreshToken:   () => store.get('refreshToken'),
  onTokensRefreshed: t => store.setTokens(t),
  onUnauthenticated: () => auth.forceLogout(),
  debug: true,
});
```

CMS: `cms/src/main.jsx`. Mobile: `mobile/src/bootstrap.ts`, imported from `index.js` before
`AppRegistry.registerComponent`.

## Module resolution

**CMS** — `cms/vite.config.js`:
```js
resolve: { alias: { '@firon/shared': path.resolve(__dirname, '../shared/src') } },
server:  { fs: { allow: ['..'] } },
```

**Mobile** — `mobile/metro.config.js`:
```js
const sharedPath = path.resolve(__dirname, '../shared');
watchFolders: [sharedPath],
resolver: { extraNodeModules: { '@firon/shared': path.resolve(sharedPath, 'src') } },
```
plus `paths` in `mobile/tsconfig.json`.

## Files

| File | Contents |
|---|---|
| `src/sharedService.ts` | `clientProxy` + the `http.*` verb helpers |
| `src/endpoints.ts` | `api.*` — every endpoint in `docs/CONTRACT.md` §5 |
| `src/errors.ts` | `FPError`, `FP_ERROR_CODES`, field-error extraction, default copy |
| `src/alertBus.ts` | `fpAlert.*`, `onAlert`, `publishAlert`, dedupe window |
| `src/config.ts` | `configureSharedService`, `resolveMediaUrl` |
| `src/theme.ts` | `FP_COLORS`, `FP_RADIUS`, `FP_SPACING`, `FP_GRADIENTS`, helpers |
| `src/types.ts` | every DTO from `docs/CONTRACT.md` §4 as it appears over the wire |
| `src/socketEvents.ts` | `FP_SOCKET_EVENTS`, `FP_SOCKET_EMITS`, typed payloads for §6 |

`npm run typecheck` in this folder runs `tsc --noEmit`.
