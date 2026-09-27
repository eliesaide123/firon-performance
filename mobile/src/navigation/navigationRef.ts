import { createNavigationContainerRef } from '@react-navigation/native';
import log from '../log';
import { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Notification payloads carry a `deepLink` (CONTRACT §7). We keep the grammar
 * deliberately small: `firon://<target>[/<id>]`, or just `<target>`.
 *
 *   home | train | videos | nutrition | profile | notifications | search
 *   video/<id> | clients | plans | uploads
 */
export function navigateDeepLink(deepLink: string | undefined | null): void {
  if (!deepLink) {
    return;
  }
  const path = deepLink.replace(/^firon:\/\//, '').replace(/^\//, '');
  const [target, id] = path.split('/');
  if (!navigationRef.isReady()) {
    pending = deepLink;
    return;
  }

  try {
    switch (target) {
      case 'home':
      case 'train':
      case 'videos':
      case 'profile':
        navigationRef.navigate('ClientTabs', { screen: capitalise(target) } as never);
        break;
      case 'nutrition':
        navigationRef.navigate('Nutrition');
        break;
      case 'search':
        navigationRef.navigate('Search');
        break;
      case 'notifications':
        navigationRef.navigate('Notifications');
        break;
      case 'video':
        navigationRef.navigate('ClientTabs', {
          screen: 'Videos',
          params: { videoId: id },
        } as never);
        break;
      case 'clients':
      case 'plans':
      case 'uploads':
        navigationRef.navigate('PtTabs', { screen: capitalise(target) } as never);
        break;
      default:
        log.info('unhandled deepLink', deepLink);
    }
  } catch (err) {
    log.warn('deepLink navigation failed', deepLink, err);
  }
}

let pending: string | null = null;

/** Called once the navigator is mounted, to flush a tap that arrived too early. */
export function flushPendingDeepLink(): void {
  if (pending) {
    const next = pending;
    pending = null;
    navigateDeepLink(next);
  }
}

export function setPendingDeepLink(deepLink: string): void {
  pending = deepLink;
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
