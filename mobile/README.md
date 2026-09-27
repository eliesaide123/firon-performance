# Firon Performance — mobile app

React Native **0.87.1 CLI** + TypeScript (**not Expo**). One binary containing **both portals**:
the client app and the PT (trainer) app. Which one you see is decided entirely by `user.role`
from the server — see [Role routing](#role-routing).

- Shared contract: [`../docs/CONTRACT.md`](../docs/CONTRACT.md)
- API reference: [`../backend/docs/API.md`](../backend/docs/API.md)
- Firebase / push setup: [`../docs/FIREBASE.md`](../docs/FIREBASE.md)
- Shared service layer: [`../shared/README.md`](../shared/README.md)

## Running it

### Prerequisites
```bash
# MongoDB + the backend (the app is useless without them)
mongod --dbpath /tmp/firon-mongo --port 27017 &
npm --prefix ../backend run seed        # 382 CMS keys, users, plans, videos
npm --prefix ../backend run dev         # http://localhost:4000

# iOS pods
cd ios && pod install && cd ..
```

### ⚠️ Two local gotchas on this machine

**1. Port 8081 is taken by another project's Metro.** If you run the default `npx react-native run-ios`,
the simulator loads *that other project's bundle* and you get a red box (`RNGestureHandlerModule
could not be found`). Run Metro on 8082 and point the app at it:

```bash
npx react-native start --port 8082
```

```bash
# once per simulator — the preference is stored per bundle id
xcrun simctl spawn booted defaults write com.fironperformance RCT_jsLocation -string "localhost:8082"
```

**2. The bundle id is `com.fironperformance`** (changed from the RN template default so Firebase
and Apple can be registered against something sane; it matches Android's `applicationId`). Older
notes referencing `org.reactjs.native.example.FironPerformance` are stale.

### Launch
```bash
npx react-native run-ios --simulator "iPhone 17 Pro"   # or any from: xcrun simctl list devices available
npx react-native run-android
```

### Demo logins (all `password1`)
| Email | Lands in |
|---|---|
| `elie@firon.app` | client portal — has the Fat Loss Week 4 plan + Cutting Plan |
| `sara@firon.app` | PT portal — 5 clients, 3 media uploads |
| `admin@firon.app` | a "use the web CMS" notice (admins don't get a mobile portal) |

Base URL comes from `src/config.ts`: `localhost:4000` on iOS, `10.0.2.2:4000` on Android.

## Role routing

**The login screen never asks whether you are a client or a trainer.** No role picker — the
prototype's role cards are deliberately absent. `POST /api/auth/login` takes only
`{ identifier, password }`; the server returns `user.role` and `RootNavigator` mounts:

| `user.role` | Tabs |
|---|---|
| `client` | Home · Train · Videos · Profile |
| `trainer` | Clients · Plans · Uploads · PtProfile |
| `admin` | `AdminNotice` (no tabs) |

Role is re-derived from `GET /auth/me` on every cold start, so a restored session always lands in
the right portal. Login and logout use `navigation.reset`, never `goBack` — otherwise a trainer
signing in from the guest preview would land inside the client tabs.

## Guest preview (fresh install)

Before anyone signs in the app opens **straight into the client experience and looks signed-in**:
populated Home, live tab bar, real CMS copy, the real video library. Any tap on anything
interactive opens the Login modal. See `../docs/CONTRACT.md` §13.

- `RootNavigator` keeps the tabs as the **base** screen with the auth screens presented modally on
  top, so the preview is always behind them. Logging out returns to the preview, not a bare form.
- The gate lives **inside the `FP_` primitives** (`useGatedPress` / `useGuestGate`), not in an
  overlay — an overlay would block scrolling. 14 components implement it; each takes
  `guestAllowed` to opt out (the auth screens set it on every control).
- A guest can't even type: `FP_Textbox`, `FP_Textarea` and `FP_SearchInput` go read-only with a
  transparent press target over the field.
- **No authenticated endpoint may be called while `isGuest`** — a 401 would pop an error dialog on
  first launch. Every `useResource` on an authed endpoint is `enabled: !isGuest`. Only three
  endpoints are public and they feed the preview with real data: `/content`, `/categories`,
  `/videos`. Per-user data comes from `src/guest/previewData.ts`.

## Everything visible comes from the CMS

No user-visible string, image or video is hardcoded. All **382** keys live in the `Content`
collection and are editable in the CMS.

```tsx
<FP_CmsText k="home.suggested_title" variant="sectionTitle" />
<FP_CmsText k="home.suggested_sub" vars={{ coach: coachFirstName }} />
<FP_CmsImage k="home.today_banner" height={140} />
<FP_CmsVideo k="home.promo_video" />
const { t } = useContent();  t('train.cta_check_off')
```

`ContentProvider` fetches the flat map at boot, caches it in AsyncStorage for offline use, and
**patches itself live** on `content:updated` / `content:bulk-updated` / `content:deleted` — an
admin editing a label in the CMS changes the app with no restart and no release.
`src/cms/defaults.ts` holds a compiled fallback for every key so a cold offline first launch still
reads correctly. **Those two must stay in sync**: the seed is generated from `defaults.ts`
(`backend/src/seed/data/content.extra.js`), so add a key to both.

## Networking — never call `fetch`

Every request goes through `clientProxy` in `@firon/shared`, via the typed `api.*` wrappers:

```ts
import { api } from '@firon/shared';
const plan = await api.plans.myTraining();
await api.media.upload(formData, pct => setProgress(pct));
```

The proxy owns bearer injection, envelope unwrapping, **one normalised `FPError`**, single-flight
401 refresh + replay, retry/backoff, upload progress, and **raising the `FP_Alert` popup**. So:

- **no `axios`, no `fetch`, no `XMLHttpRequest`** in any screen, hook or provider,
- **no `try/catch` just to show an error** — the popup already happened. Catch only to branch on
  `err.code` or read `err.fieldErrors` for inline validation, and pass `{ showAlert: false }`.

`configureSharedService()` is wired once in `src/bootstrap.ts`, imported at the top of `index.js`
before `AppRegistry`. Metro resolves `@firon/shared` via `watchFolders` + `extraNodeModules` +
`nodeModulesPaths` in `metro.config.js` — don't remove any of the three.

## Components — `FP_` only

51 components in `src/components/`, all prefixed `FP_`, one per file, exported through
`src/components/index.ts`. Screens compose these and **never** use a raw `<Pressable>`,
`<TextInput>` or hand-styled card `<View>`. No hex literals in a component — colours, radii and
spacing come from `src/theme.ts` / `@firon/shared`'s `FP_COLORS` etc.

Two things easily confused:
- **`FP_Toast`** — the prototype's transient confirmation pill ("Added to favorites"), 1.8s.
- **`FP_Alert`** — the failure/confirm popup, rendered by the single `FP_AlertProvider` that
  subscribes to the shared alert bus. Never use React Native's built-in `Alert.alert`.

## Screen map

```
src/screens/
  auth/     Login · Register · ForgotPassword · Otp · ResetPassword · Onboarding · AdminNotice
  client/   Home · Train · Videos · Search · Nutrition · Profile · Notifications
  pt/       Clients · Plans (training + diet builders) · Uploads · PtProfile
```

Notable behaviours carried over from the prototype: the Train check-off + 🎉 completion sheet and
"log an exercise"; the week-overview and per-day sheets with Completed / "You are here" /
Upcoming-locked states; the PT plan builder keeping in-progress edits when you switch client or
tab (`syncBuilderFields`); and the availability editor working on a **draft** so Cancel truly
cancels.

## Providers

Order is fixed and matters (`App.tsx`):

```
SafeAreaProvider
  FP_AlertProvider        the only subscriber to @firon/shared's alert bus
    FP_ToastProvider
      ContentProvider     must sit above anything that reads t()
        AuthProvider      user.role is the only routing input
          GuestGateProvider    isGuest={!signedIn}
            NotificationsProvider  enabled={signedIn} — its unread call is authenticated
              SocketProvider     calls useNotificationsBadge(), so it must be INSIDE
                PushProvider     enabled={signedIn} — no token, no prompt for a guest
                  NavigationContainer + RootNavigator
```

## Notifications

Two channels, one backend call (`notificationService.notify`):

- **In-app**: `notification:new` / `notification:count` over Socket.IO → badge +
  `FP_NotificationBanner`. Works with no Firebase setup at all.
- **Background/killed**: FCM via `@react-native-firebase/messaging` (**v26 — modular API only**,
  no `messaging()` default export). `setBackgroundMessageHandler` is registered in `index.js`
  before `AppRegistry`.

A token is registered only **after** login and removed on logout. Taps deep-link through
`navigateDeepLink()` using the `firon://<target>[/<id>]` grammar in
`src/navigation/navigationRef.ts`.

**The app runs fine with no Firebase credentials** — `GoogleService-Info.plist` and
`google-services.json` are gitignored and absent; push is a logged no-op. See
[`../docs/FIREBASE.md`](../docs/FIREBASE.md) to enable it. With no plist, iOS prints a harmless
`[FirebaseCore][I-COR000003] The default Firebase app has not yet been configured` at launch.

## Checks

```bash
npx tsc --noEmit                       # must be clean
npx eslint .
npx react-native bundle --entry-file index.js --platform ios \
  --dev false --bundle-output /tmp/fp.js --assets-dest /tmp/fp-assets   # proves Metro resolution
npm --prefix .. run test:integration   # 83 assertions against a live backend
```
