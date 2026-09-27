/**
 * The trainer portal's bottom tab bar: Clients · Plans · Uploads · Profile (CONTRACT §3.2).
 *
 * Only ever mounted for `role === 'trainer'`. A guest can never reach a PT screen
 * (CONTRACT §13.5), so the guest banner is still rendered for symmetry but resolves to null.
 */
import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { FP_GuestBanner, FP_TabBar } from '../components';
import { PtTabParamList } from './types';
import {
  PtClientsScreen,
  PtPlansScreen,
  PtProfileScreen,
  PtUploadsScreen,
} from './screens';

const Tab = createBottomTabNavigator<PtTabParamList>();

export const PtTabs: React.FC = () => (
  <Tab.Navigator
    initialRouteName="Clients"
    screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
    tabBar={props => (
      <View>
        <FP_GuestBanner />
        <FP_TabBar {...props} />
      </View>
    )}
  >
    <Tab.Screen name="Clients" component={PtClientsScreen} />
    <Tab.Screen name="Plans" component={PtPlansScreen} />
    <Tab.Screen name="Uploads" component={PtUploadsScreen} />
    <Tab.Screen name="PtProfile" component={PtProfileScreen} />
  </Tab.Navigator>
);

export default PtTabs;
