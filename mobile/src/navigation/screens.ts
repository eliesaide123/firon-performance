/**
 * One place that resolves the tab screen components.
 *
 * The client/PT screens are owned by other agents and are being written in parallel with this
 * navigator, so we resolve each module tolerantly: the conventional named export first, then a
 * default export. That way a sibling agent renaming `HomeScreen` -> `ClientHomeScreen` (while
 * keeping a default export) cannot red-box the whole app, and there is exactly one file to fix
 * if a path ever moves.
 *
 * Namespace imports stay statically analysable, so Metro still bundles everything eagerly.
 */
import type React from 'react';
import { FP_Screen, FP_Spinner } from '../components';
import { createElement } from 'react';

import * as HomeMod from '../screens/client/HomeScreen';
import * as TrainMod from '../screens/client/TrainScreen';
import * as VideosMod from '../screens/client/VideosScreen';
import * as ProfileMod from '../screens/client/ProfileScreen';
import * as NutritionMod from '../screens/client/NutritionScreen';
import * as SearchMod from '../screens/client/SearchScreen';
import * as NotificationsMod from '../screens/client/NotificationsScreen';

import * as PtClientsMod from '../screens/pt/ClientsScreen';
import * as PtPlansMod from '../screens/pt/PlansScreen';
import * as PtUploadsMod from '../screens/pt/UploadsScreen';
import * as PtProfileMod from '../screens/pt/PtProfileScreen';

/** Rendered if a module somehow exports nothing usable — a spinner, never a crash. */
const FP_MissingScreen: React.ComponentType<any> = () =>
  createElement(FP_Screen, null, createElement(FP_Spinner, null));

function resolve(mod: unknown, exportName: string): React.ComponentType<any> {
  const bag = mod as Record<string, unknown> | undefined;
  const named = bag?.[exportName];
  if (typeof named === 'function' || (named && typeof named === 'object')) {
    return named as React.ComponentType<any>;
  }
  const fallback = bag?.default;
  if (typeof fallback === 'function' || (fallback && typeof fallback === 'object')) {
    return fallback as React.ComponentType<any>;
  }
  return FP_MissingScreen;
}

export const HomeScreen = resolve(HomeMod, 'HomeScreen');
export const TrainScreen = resolve(TrainMod, 'TrainScreen');
export const VideosScreen = resolve(VideosMod, 'VideosScreen');
export const ProfileScreen = resolve(ProfileMod, 'ProfileScreen');
export const NutritionScreen = resolve(NutritionMod, 'NutritionScreen');
export const SearchScreen = resolve(SearchMod, 'SearchScreen');
export const NotificationsScreen = resolve(NotificationsMod, 'NotificationsScreen');

export const PtClientsScreen = resolve(PtClientsMod, 'ClientsScreen');
export const PtPlansScreen = resolve(PtPlansMod, 'PlansScreen');
export const PtUploadsScreen = resolve(PtUploadsMod, 'UploadsScreen');
export const PtProfileScreen = resolve(PtProfileMod, 'PtProfileScreen');
