import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import ScheduleScreen from './schedule';
import ServicesScreen from './services';

const Tab = createBottomTabNavigator();

export default function MainOrgTabs({ route }) {
  const { orgId } = route.params;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName;

          if (route.name === 'Schedule') {
            iconName = 'time-outline';
          } else if (route.name === 'Services') {
            iconName = 'calendar-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Schedule">
        {() => <ScheduleScreen orgId={orgId} />}
      </Tab.Screen>
      <Tab.Screen name="Services">
        {() => <ServicesScreen orgId={orgId} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}