/**
 * @format
 */

// Must come first: configures @firon/shared (base URL, token accessors) before any module
// can make an API call. CONTRACT §11.2.
import './src/bootstrap';

import { AppRegistry } from 'react-native';
import { registerBackgroundMessageHandler } from './src/push/backgroundHandler';
import App from './App';
import { name as appName } from './app.json';

// Registered BEFORE AppRegistry.registerComponent, per CONTRACT §7. Guarded so the app still
// boots when GoogleService-Info.plist / google-services.json are absent.
registerBackgroundMessageHandler();

AppRegistry.registerComponent(appName, () => App);
