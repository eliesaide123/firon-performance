# Firebase Cloud Messaging — setup, end to end

Push notifications are how Firon reaches a user **while the app is backgrounded or killed**.
While the app is in the foreground the socket already delivers `notification:new` and the in-app
banner shows it — see CONTRACT §6 / §7. This document covers only the background channel.

Everything below is optional. **With no Firebase credentials at all the backend boots, the app
launches, the guest preview works and both portals work** — `pushService` logs one warning and
becomes a no-op, and `mobile/src/push` logs one warning and disables itself. Nothing else changes.
That property is a hard requirement (CONTRACT §7); don't break it.

---

## 0. What you need before you start

| | Needed for | Notes |
|---|---|---|
| A Google account | the Firebase project | free tier is enough |
| An **Apple Developer Program** membership ($99/yr) | iOS push, at all | there is no way around this — APNs keys are only issued to paid accounts |
| A **physical iPhone** | testing iOS push | the iOS **Simulator cannot receive APNs pushes**, ever. See §7 |
| An Android device or emulator | testing Android push | Android emulators with Google Play **can** receive FCM |

Three files are involved. All three are gitignored; commit only the `.example` placeholders that
are already in the repo.

| Real file (gitignored) | Committed placeholder | Used by |
|---|---|---|
| `mobile/ios/GoogleService-Info.plist` | `…/GoogleService-Info.plist.example` | the iOS app |
| `mobile/android/app/google-services.json` | `…/google-services.json.example` | the Android app |
| `backend/firebase-service-account.json` | `…/firebase-service-account.json.example` | the backend sender |

Verify at any time:

```bash
git check-ignore -v mobile/ios/GoogleService-Info.plist \
                    mobile/android/app/google-services.json \
                    backend/firebase-service-account.json
# three lines of output = all three are ignored. No output = STOP, fix .gitignore first.
```

---

## 1. Create the Firebase project

1. <https://console.firebase.google.com> → **Add project**.
2. Name it `firon-performance` (any name works; the *project id* is what ends up in the config
   files).
3. Google Analytics is not needed — disable it.

---

## 2. Add the iOS app

1. Firebase console → **Project settings** (gear) → **Your apps** → the **iOS+** button.
2. **Apple bundle ID**: `com.fironperformance`
   This must match `PRODUCT_BUNDLE_IDENTIFIER` in
   `mobile/ios/FironPerformance.xcodeproj/project.pbxproj`. If you change one, change the other —
   a mismatch produces an FCM token that silently never receives anything.
3. Download **`GoogleService-Info.plist`** and put it at `mobile/ios/GoogleService-Info.plist`.
4. **Add it to the Xcode target** — this step is easy to miss and everything fails without it:

   Open `mobile/ios/FironPerformance.xcworkspace` → drag the plist into the `FironPerformance`
   group → tick *Copy items if needed* → target membership **FironPerformance**. Then confirm it is
   in **Build Phases → Copy Bundle Resources**. The file must end up *inside the .app bundle*;
   having it on disk is not enough.

   Check after a build:
   ```bash
   find ~/Library/Developer/Xcode/DerivedData -name GoogleService-Info.plist -path '*FironPerformance.app*'
   ```

### 2a. APNs authentication key (the part people get wrong)

FCM cannot talk to Apple on your behalf without an APNs key.

1. <https://developer.apple.com/account> → **Certificates, Identifiers & Profiles** → **Keys** →
   **+**.
2. Name it e.g. `Firon FCM`, tick **Apple Push Notifications service (APNs)**, **Continue** →
   **Register**.
3. **Download the `.p8`.** Apple lets you download it exactly once — store it somewhere safe and
   never in this repo.
4. Note the **Key ID** (10 chars, also in the filename `AuthKey_XXXXXXXXXX.p8`) and your
   **Team ID** (top-right of the developer portal, or Membership details).
5. Firebase console → **Project settings** → **Cloud Messaging** → **Apple app configuration** →
   **APNs Authentication Key** → **Upload**: the `.p8`, the Key ID and the Team ID.

One key covers both the development and production APNs environments and all your apps — you do
this once per Apple team, not once per app.

### 2b. Register the bundle id and enable Push Notifications on it

Apple Developer portal → **Identifiers** → **+** → *App IDs* → *App* → Bundle ID
`com.fironperformance` (explicit) → under **Capabilities** tick **Push Notifications** → Register.

Without this, a device build fails to sign: *"Provisioning profile doesn't support the Push
Notifications capability"*.

### 2c. What is already wired in this repo

You should not have to touch any of this; it is here so you can audit it.

* **`mobile/ios/FironPerformance/FironPerformance.entitlements`** (new) — `aps-environment` =
  `development`. Xcode rewrites it to `production` automatically when you archive for
  TestFlight/App Store, so the value does not need editing. Wired into both the Debug and Release
  build configurations via `CODE_SIGN_ENTITLEMENTS`, and
  `TargetAttributes → SystemCapabilities → com.apple.Push` is set so the *Signing & Capabilities*
  tab shows **Push Notifications**.
* **`mobile/ios/FironPerformance/Info.plist`** —
  `UIBackgroundModes = [remote-notification]` (so a `content-available` push can wake the app), and
  `FirebaseAppDelegateProxyEnabled = true`.
* **`mobile/ios/FironPerformance/AppDelegate.swift`** — calls
  `application.registerForRemoteNotifications()`. That shows **no prompt**; it only obtains an APNs
  device token so FIRMessaging can mint an FCM token. The user-visible prompt happens later, in JS,
  after login.

  Two things AppDelegate deliberately does **not** do, and you should not add them:

  * **`FirebaseApp.configure()`** — `@react-native-firebase/app` configures the default app itself,
    and only when `GoogleService-Info.plist` exists. Calling it from AppDelegate aborts at launch on
    a clone with no plist, which CONTRACT §7 forbids.
  * **`UNUserNotificationCenter.current().delegate = self`** — RNFBMessaging installs
    `RNFBMessagingUNUserNotificationCenter` as the delegate and chains to whatever was already
    there; notifee hooks the same chain. Claiming the delegate here silently breaks notification
    taps and foreground presentation for *both* libraries.

### 2d. Pods / linkage

`mobile/ios/Podfile`:

* `$RNFirebaseDisableSPM = true` — RN Firebase 26 resolves the Firebase iOS SDK through Swift
  Package Manager by default, which collides with RN 0.87's static-library linkage. This opts back
  into the CocoaPods-distributed SDK.
* **No project-wide `use_frameworks!`.** This is the classic trap. Reaching for `use_frameworks!`
  to make Firebase's Swift pods importable turns *every* pod into a dynamic framework, which breaks
  the prebuilt `React-Core` / `hermes-engine` artifacts this project uses and drags you into
  `:linkage => :static` workarounds for Hermes and Flipper. Instead we grant
  `:modular_headers => true` to just the Google/Firebase C pods — `GoogleUtilities`,
  `FirebaseCore`, `FirebaseCoreInternal`, `FirebaseCoreExtension`, `FirebaseInstallations`,
  `GoogleDataTransport`, `nanopb` — which is all that is needed for their umbrella headers to be
  `@import`-able. `USE_FRAMEWORKS=static|dynamic` is still honoured if you want to experiment, but
  **the supported configuration for this repo is with that variable unset.**

After adding the plist:

```bash
cd mobile/ios && pod install          # only needed if pods changed; the plist alone does not
cd .. && npx react-native run-ios --simulator "iPhone 17 Pro"
```

> **Port note (dev machines with more than one RN project).** If another project's Metro already
> owns **8081**, this app will silently load the *wrong bundle*; the first symptom is a red box
> about `RNGestureHandlerModule`, a module this project does not even depend on. Run Metro on 8082
> and point the app at it:
>
> ```bash
> npx react-native start --port 8082
> RCT_jsLocation=localhost:8082 npx react-native run-ios --simulator "iPhone 17 Pro"
> ```
>
> That preference is stored **per bundle id** in the simulator's user defaults, so it does not
> survive a bundle-id change (this repo moved from the RN template default to
> `com.fironperformance` in the Firebase work). Set it directly after such a change:
>
> ```bash
> xcrun simctl spawn booted defaults write com.fironperformance RCT_jsLocation -string "localhost:8082"
> xcrun simctl terminate booted com.fironperformance; xcrun simctl launch booted com.fironperformance
> ```

---

## 3. Add the Android app

1. Firebase console → **Project settings** → **Your apps** → the **Android** button.
2. **Android package name**: `com.fironperformance` — must equal `applicationId` in
   `mobile/android/app/build.gradle`.
3. A debug SHA-1 is *not* required for FCM (only for Google Sign-In / Dynamic Links). Skip it.
4. Download **`google-services.json`** → `mobile/android/app/google-services.json`
   (same folder as `build.gradle`, **not** `android/`).

### What is already wired in this repo

* `mobile/android/build.gradle` — `classpath("com.google.gms:google-services:4.4.2")`.
* `mobile/android/app/build.gradle` — applies the plugin **only if `google-services.json` exists**:

  ```gradle
  def googleServicesFile = rootProject.file("app/google-services.json")
  if (googleServicesFile.exists()) {
      apply plugin: "com.google.gms.google-services"
  } else {
      logger.lifecycle("[firon] android/app/google-services.json not found — FCM disabled …")
  }
  ```

  The plugin **fails the build** when the file is missing (`File google-services.json is missing`),
  so guarding it is what keeps a fresh clone buildable. Consequence: dropping the file in and
  rebuilding is the only step needed to switch push on.
* `mobile/android/app/src/main/AndroidManifest.xml` —
  * `POST_NOTIFICATIONS` (Android 13+) and `VIBRATE` permissions;
  * `com.google.firebase.messaging.default_notification_channel_id` →
    `@string/default_notification_channel_id` = **`firon-default`**;
  * `…default_notification_icon` → `@drawable/ic_notification`;
  * `…default_notification_color` → `@color/notification_accent` (`#c7ff3f`, CONTRACT §2).

  Those three meta-data entries are what firebase-messaging uses when a push arrives while the app
  is **killed** — at that moment no JS runs, so the notification is drawn natively from them.
* `res/drawable/ic_notification.xml` — a flat **white** silhouette. Android 5+ renders any coloured
  small icon as a grey blob, so the launcher icon is not usable here.
* `res/values/strings.xml` / `colors.xml` — the channel id and the accent colour.

### The channel id is a three-way contract

`firon-default` must be identical in all three places or notifications vanish without an error:

| Where | What |
|---|---|
| `mobile/src/push/channels.ts` | `DEFAULT_CHANNEL_ID` — the channel notifee creates at startup |
| `mobile/android/.../res/values/strings.xml` | `default_notification_channel_id` — the killed-app fallback |
| `backend/src/services/pushService.js` | `DEFAULT_CHANNEL_ID` — sent as `android.notification.channelId` |

---

## 4. Backend: the service-account key

1. Firebase console → **Project settings** → **Service accounts** → **Generate new private key**.
2. Save the JSON as `backend/firebase-service-account.json` (the default of
   `FIREBASE_SERVICE_ACCOUNT_PATH` in `backend/.env`).
3. Restart the backend. You should see:

   ```
   INFO: [push] Firebase Admin initialised   projectId: "firon-performance"
   ```

   Instead of the disabled-state warning:

   ```
   WARN: [push] no Firebase service account found — push notifications are DISABLED …
   ```

`backend/src/services/pushService.js`:

| Export | Does |
|---|---|
| `init()` / `isEnabled()` | lazy init, one warning when the key is absent, then permanent no-op |
| `status()` | `{ enabled, state, projectId, serviceAccountPath, defaultChannelId }` |
| `sendToUser(userId, msg, opts)` | looks up the user's `fcmTokens`, sends, prunes the dead ones |
| `sendToUsers(ids, msg, opts)` | fan-out |
| `sendToTokens(tokens, msg, opts)` | raw tokens; dedupes, chunks at FCM's 500-token limit |
| `sendDryRun(tokens, msg)` | validates credentials + payload **without delivering anything** |

`msg` is `{ title, body, data, badge, channelId, dataOnly }`.

Details worth knowing:

* **`data` values are coerced to strings.** FCM only accepts `string → string`; a number anywhere
  in `data` makes the whole send throw `messaging/invalid-argument`. Numbers and booleans become
  `String(v)`, objects become JSON, `null`/`undefined` are dropped.
* **`android.priority: 'high'`** — without it a dozing device can hold a push for minutes. This is
  the usual cause of "push works but arrives late".
* **`apns-push-type` / `apns-priority`** — `alert`/`10` for a visible push, `background`/`5` for a
  `dataOnly` one. Apple throttles or rejects mismatches.
* **Pruning** — `messaging/registration-token-not-registered`,
  `messaging/invalid-registration-token` and `messaging/invalid-argument` are treated as "this
  token is dead" and `$pull`ed from the user's `fcmTokens`. Transient codes
  (`messaging/internal-error`, `unavailable`) are logged and kept.
* **Nothing throws.** Push is best-effort; a failed send must never fail the HTTP request that
  triggered it.

---

## 5. The mobile side, in one page

`mobile/src/push/`

| File | Responsibility |
|---|---|
| `firebase.ts` | the only module that knows the messaging SDK. Defensively wrapped: no Firebase app → one warning, every function no-ops |
| `backgroundHandler.ts` | `setBackgroundMessageHandler` + notifee's background event handler. Registered from `index.js` **before** `AppRegistry.registerComponent` |
| `channels.ts` | creates the `firon-default` Android channel (idempotent, memoised) |
| `permissions.ts` | Android 13+ `POST_NOTIFICATIONS` runtime request |
| `tokenRegistration.ts` | the token lifecycle: register after login, re-register on rotation, remove on logout |
| `deepLinks.ts` | the three notification-tap paths → `navigateDeepLink` |
| `PushProvider.tsx` | the React glue. `<PushProvider enabled={signedIn} />`, renders nothing |

### messaging v26 is modular-only

There is **no `messaging()` default export and no `FirebaseMessagingTypes` namespace** any more.
Everything is a standalone function taking the instance first:

```ts
import * as m from '@react-native-firebase/messaging';
const messaging = m.getMessaging();
await m.requestPermission(messaging);
await m.registerDeviceForRemoteMessages(messaging);   // iOS
const token = await m.getToken(messaging);
m.onMessage(messaging, async msg => {});
m.onTokenRefresh(messaging, token => {});
m.onNotificationOpenedApp(messaging, msg => {});
await m.getInitialNotification(messaging);
m.setBackgroundMessageHandler(messaging, async msg => {});
```

`Messaging` and `RemoteMessage` are exported as types directly. `src/push/firebase.ts` is the
single place that knows this, so nothing else has to.

### Token lifecycle

```
guest                         nothing registered, NO permission prompt (CONTRACT §7)
login  (signedIn → true)      ensureDefaultChannel()
                              → POST_NOTIFICATIONS (Android 13+)
                              → requestPermission() (iOS prompt)
                              → registerDeviceForRemoteMessages() (iOS)
                              → getToken()
                              → POST /api/auth/fcm-token { token, platform }
FCM rotates the token         onTokenRefresh → POST /api/auth/fcm-token again
logout (signedIn → false)     DELETE /api/auth/fcm-token { token }
```

The last registered token is mirrored in AsyncStorage under `@firon/fcmToken`, because logout can
happen in a session that never registered anything (cold start → restored session → logout) and we
still need to know which token to remove.

> **Open item.** `AuthProvider.logout()` clears the tokens *before* `signedIn` flips, so by the
> time `PushProvider` sees the transition the DELETE would go out unauthenticated. `PushProvider`
> therefore only attempts it when an access token still exists. The clean fix is two lines in
> `mobile/src/auth/AuthProvider.tsx`:
>
> ```ts
> const logout = useCallback(async () => {
>   await unregisterPushToken();          // from '../push' — before the session is cleared
>   try { await api.auth.logout(); } catch (err) { … }
>   await clearSession();
> }, [clearSession]);
> ```
>
> Until that lands, a stale token on a shared device is cleaned up the slow way: the first send to
> it fails with `registration-token-not-registered` and `pushService` prunes it.

### Notification tap → navigation

Every push carries `{ type, deepLink, notificationId }` in its **data** payload (CONTRACT §7).
`deepLink` uses the `firon://<target>[/<id>]` grammar understood by
`mobile/src/navigation/navigationRef.ts`. Three separate paths, all wired in `deepLinks.ts`:

| App state when tapped | API | Handling |
|---|---|---|
| **killed** | `getInitialNotification()` | the navigator does not exist yet → `setPendingDeepLink()`, then `NavigationContainer`'s `onReady` calls `flushPendingDeepLink()` |
| **backgrounded** | `onNotificationOpenedApp()` | navigator is mounted → `navigateDeepLink()` immediately |
| **foregrounded**, notification drawn by notifee | `notifee.onForegroundEvent` `EventType.PRESS` | firebase-messaging never sees these taps |

### Foreground behaviour

`PushProvider` attaches `onMessage` but **does not** draw an OS heads-up by default: while
foregrounded the socket has already delivered `notification:new` and the in-app banner is showing
it, so a notifee banner too would double-notify. Pass
`<PushProvider enabled={signedIn} showForegroundHeadsUp />` if you ever want the OS banner instead.

---

## 6. Sending a test push

As an **admin**:

```bash
TOKEN=$(curl -s localhost:4000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"identifier":"admin@firon.app","password":"<password>"}' | jq -r .data.accessToken)

curl -s localhost:4000/api/notifications/test \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"userId":"<target user id>","title":"Hello","body":"From the backend","data":{"deepLink":"firon://notifications"}}' | jq
```

The response tells you which channel did what:

```json
{
  "notification":    { "...": "the persisted doc" },
  "socketEmitted":   true,
  "socketsReached":  1,        // devices live on a socket right now (in-app channel)
  "pushEnabled":     true      // false => no service-account key, push was skipped
}
```

`socketsReached: 0` with `pushEnabled: true` is the interesting case — that is exactly the
"backgrounded or killed" path this document is about.

### Validating credentials with no device (dry run)

```bash
cd backend && node -e "
require('./src/services/pushService').sendDryRun(['<an fcm token>']).then(r => console.log(r));
"
```

`sendDryRun` asks FCM to validate the message and the tokens and deliver nothing — no tray entry
anywhere. With no token argument it just reports whether firebase-admin initialised, which is the
first question to answer when push "does nothing".

### Testing on a real device

1. iOS: select your device in Xcode, set your team under **Signing & Capabilities**, run.
   Android: `npx react-native run-android` with the device connected.
2. Point the app at your machine: `mobile/src/config.ts` → `HOST_OVERRIDE =
   'http://192.168.x.y:4000'` (a device cannot reach `localhost`).
3. Log in. You should see `[firon] fcm token registered abcdef123456…` in the logs, and a
   `fcmTokens` entry appear on the user document.
4. **Background the app** (home button — do not just cover it) or swipe it away to kill it, then
   fire the test push.

---

## 7. What can and cannot be tested on a simulator

| | iOS Simulator | Android emulator (with Play Services) | Real device |
|---|---|---|---|
| App launches with no Firebase config | yes | yes | yes |
| Permission prompt / token retrieval code path runs | wiring only — no APNs token is ever issued | yes | yes |
| **Receives a real FCM/APNs push** | **no** | yes | yes |
| notifee local notification display | yes | yes | yes |

The iOS Simulator has no APNs connection, so `getToken()` cannot return an FCM token there and no
push will ever arrive — regardless of configuration. Xcode's *Device → Send Notification* / a
`.apns` file drop can simulate a **local** delivery to test tap handling, but it does not go
through FCM and will not exercise the backend. For anything end-to-end on iOS you need a physical
device and a paid Apple Developer account.

---

## 8. Troubleshooting

**"the app builds but no `aps-environment`"** — the entitlements file is not attached. Check
`CODE_SIGN_ENTITLEMENTS = FironPerformance/FironPerformance.entitlements` in *both* the Debug and
Release configs of the `FironPerformance` target, then:
```bash
codesign -d --entitlements - <path to built FironPerformance.app> 2>/dev/null | grep aps-environment
```

**`No APNS token specified before fetching FCM Token` / `getToken()` rejects on iOS** — either you
are on the Simulator (expected, see §7), or `registerDeviceForRemoteMessages()` has not run, or
the APNs key was never uploaded to Firebase (§2a).

**Pushes silently never arrive on iOS, everything else is fine** — almost always the APNs
authentication key. Firebase console → Cloud Messaging → *Apple app configuration* must show a key
with the right Key ID and Team ID. A wrong Team ID fails with no visible error.

**`use_frameworks!` pod conflicts** — symptoms are `Swift pod X depends upon Y which does not
define modules`, duplicate-symbol link errors, or Hermes failing to load. Do not add a
project-wide `use_frameworks!`; use the scoped `:modular_headers => true` list already in the
Podfile (§2d). If you inherited a broken state:
```bash
cd mobile/ios && rm -rf Pods Podfile.lock build && pod install
```

**Android: nothing in the tray, but the token registered and the backend reports `sent: 1`** — in
order of likelihood: (1) Android 13+ `POST_NOTIFICATIONS` was denied — check
Settings → Apps → FironPerformance → Notifications; (2) the channel id does not match (see §3);
(3) `google-services.json` has the wrong `package_name`.

**Android build fails: `File google-services.json is missing`** — the guard in
`app/build.gradle` was removed, or the file is in `android/` instead of `android/app/`.

**Android: grey square instead of an icon** — the small icon must be a flat white silhouette;
`@mipmap/ic_launcher` will not do. Use `@drawable/ic_notification`.

**Killed vs backgrounded behave differently** — expected, and the usual source of "it works
sometimes":

* A push **with** a `notification` block is drawn by the OS before JS runs. Killed or
  backgrounded, the tray entry appears either way; `setBackgroundMessageHandler` runs afterwards
  for bookkeeping only.
* A **data-only** push is drawn by nobody. Backgrounded, `setBackgroundMessageHandler` gets a
  moment to display something; killed, iOS may not wake the app at all unless the payload sets
  `content-available: 1` *and* `UIBackgroundModes` includes `remote-notification` (both are
  configured here).
* On Android, force-stopping an app from Settings (as opposed to swiping it away) stops FCM
  delivery entirely until the app is launched again. Some OEM skins (Xiaomi, Huawei, Oppo) also
  need the app whitelisted from battery optimisation. Test on a stock device before believing a
  bug.

**iOS console: `[FirebaseCore][I-COR000003] The default Firebase app has not yet been
configured`** — expected and harmless when no `GoogleService-Info.plist` is present. It is a
console line from the Firebase pods, not a crash and not a user-visible alert; the app carries on
and `src/push` disables itself. It disappears once the plist is in the bundle. Do **not** silence
it by adding `FirebaseApp.configure()` to AppDelegate — see §2c for why that breaks the
no-credentials case.

**No warning, no push, nothing in the logs on the backend** — `pushService` is in its disabled
state and said so exactly once, at first use, possibly long before you looked. Ask it directly:
```bash
cd backend && node -e "console.log(require('./src/services/pushService').status())"
```
