import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "FironPerformance",
      in: window,
      launchOptions: launchOptions
    )

    // ---------------------------------------------------------------------------------------
    // Push notifications (CONTRACT §7 — full walkthrough in docs/FIREBASE.md).
    //
    // Asking UIKit for an APNs device token shows NO prompt; it just gets us a device token so
    // FIRMessaging can mint an FCM token later. The user-visible permission prompt happens only
    // when JS calls requestPermission(), which src/push only does AFTER login.
    //
    // Two things are deliberately NOT done here:
    //
    //  * `FirebaseApp.configure()` — @react-native-firebase/app configures the default app from
    //    its own module init, and only when GoogleService-Info.plist is actually present.
    //    Calling it here would abort at launch on a fresh clone that has no plist, which §7
    //    forbids ("the app must launch and every non-push feature must work").
    //
    //  * `UNUserNotificationCenter.current().delegate = self` — RNFBMessaging installs
    //    `RNFBMessagingUNUserNotificationCenter` as the notification-centre delegate and chains
    //    to whatever delegate was already there; notifee hooks the same chain. Claiming the
    //    delegate from AppDelegate silently breaks notification taps and foreground
    //    presentation for both libraries. Leave it to them.
    //
    // `FirebaseAppDelegateProxyEnabled` is <true/> in Info.plist, so Firebase swizzles
    // `didRegisterForRemoteNotificationsWithDeviceToken` / `didReceiveRemoteNotification` and
    // no manual forwarding is needed in this file.
    // ---------------------------------------------------------------------------------------
    application.registerForRemoteNotifications()

    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
