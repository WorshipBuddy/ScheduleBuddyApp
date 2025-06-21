import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ScheduleScreen from './schedule';
import ServicesScreen from './services';

const Tab = createBottomTabNavigator();

export default function MainOrgTabs({ route }) {
  const { orgId } = route.params;
  const navigation = useNavigation();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName;

          if (route.name === 'My Schedule') {
            iconName = 'time-outline';
          } else if (route.name === 'Services') {
            iconName = 'calendar-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        headerShown: true,
        headerTitleAlign: 'center',
      })}
    >
      <Tab.Screen
        name="My Schedule"
        options={{
          headerTitle: 'My Schedule',
          headerLeft: () => (
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: 16 }}>
              <Ionicons name="arrow-back-outline" size={24} color="#10245c" />
            </TouchableOpacity>
          ),
        }}
      >
        {() => <ScheduleScreen orgId={orgId} />}
      </Tab.Screen>

      <Tab.Screen
        name="Services"
        options={{
          headerTitle: 'Services',
          headerLeft: () => (
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: 16 }}>
              <Ionicons name="arrow-back-outline" size={24} color="#10245c" />
            </TouchableOpacity>
          ),
        }}
      >
        {() => <ServicesScreen orgId={orgId} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}