/**
 * The client portal's bottom tab bar: Home · Train · Videos · Profile (CONTRACT §3.2).
 *
 * This is also what a guest sees on a fresh install (CONTRACT §13): the tab bar stays fully
 * live because switching tabs is navigation, not an action — every action *inside* a tab is
 * gated by the `FP_` primitives. The guest banner is pinned directly above the bar.
 */
import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { FP_GuestBanner, FP_TabBar } from '../components';
import { ClientTabParamList } from './types';
import {
  HomeScreen,
  ProfileScreen,
  TrainScreen,
  VideosScreen,
} from './screens';

const Tab = createBottomTabNavigator<ClientTabParamList>();

export const ClientTabs: React.FC = () => (
  <Tab.Navigator
    initialRouteName="Home"
    screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
    tabBar={props => (
      <View>
        <FP_GuestBanner />
        <FP_TabBar {...props} />
      </View>
    )}
  >
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="Train" component={TrainScreen} />
    <Tab.Screen name="Videos" component={VideosScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

export default ClientTabs;
