// screens/org-specific screens/MainOrgTabs.js
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import ScheduleScreen from './schedule';
import ServicesScreen from './services';
import TeamsScreen from './teams';
import PeopleScreen from './people';

const Tab = createBottomTabNavigator();

export default function MainOrgTabs({ route }) {
  const { orgId } = route.params;
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState({
    isOwner: false,
    isOrgAdmin: false,
    isScheduler: false,
    isTeamAdmin: false,
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPermissions() {
      try {
        const userEmailRaw = await AsyncStorage.getItem('userEmail');
        const userEmail = (userEmailRaw || '').toLowerCase().trim();
        if (!orgId || !userEmail) {
          if (!cancelled) setLoading(false);
          return;
        }

        const [orgRes, usersRes, teamsRes] = await Promise.all([
          fetch(`https://api.worshipbuddy.org/schedulebuddy/organizations/${orgId}`),
          fetch(`https://api.worshipbuddy.org/schedulebuddy/organizations/${orgId}/users`),
          fetch(`https://api.worshipbuddy.org/schedulebuddy/organizations/${orgId}/teams`)
        ]);

        if (!orgRes.ok || !usersRes.ok || !teamsRes.ok) {
          throw new Error('Failed to fetch org/user/team data');
        }

        const org = await orgRes.json();
        const allUsers = await usersRes.json();
        const allTeams = await teamsRes.json();

        const currentUser = allUsers.find(u => u.email?.toLowerCase() === userEmail);
        const isOwner = (org.owner?.email?.toLowerCase() === userEmail);
        const isOrgAdmin = !!currentUser?.org_admin;
        const flatPerms = (currentUser?.team_permissions || []).flatMap(tp => tp.permissions || []);
        const isScheduler = flatPerms.includes('Scheduler');
        const isTeamAdmin = flatPerms.includes('Admin');

        if (!cancelled) {
          setPermissions({ isOwner, isOrgAdmin, isScheduler, isTeamAdmin });
        }
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPermissions();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    console.warn('Permission load error:', error);
  }

  const { isOwner, isOrgAdmin, isScheduler, isTeamAdmin } = permissions;

  const showDashboard = true; // web shows dashboard for everyone with org context
  const showServices = true; // likewise
  const showTeams = isOwner || isOrgAdmin || isScheduler || isTeamAdmin;
  const showPeople = isOwner || isOrgAdmin || isTeamAdmin;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName = 'ellipse-outline';
          if (route.name === 'Dashboard') iconName = 'home-outline';
          else if (route.name === 'My Schedule') iconName = 'time-outline';
          else if (route.name === 'Services') iconName = 'calendar-outline';
          else if (route.name === 'Teams') iconName = 'people-outline';
          else if (route.name === 'People') iconName = 'person-outline';
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

      {showServices && (
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
      )}

      {showTeams && (
        <Tab.Screen
          name="Teams"
          options={{
            headerTitle: 'Teams',
            headerLeft: () => (
              <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: 16 }}>
                <Ionicons name="arrow-back-outline" size={24} color="#10245c" />
              </TouchableOpacity>
            ),
          }}
        >
          {() => <TeamsScreen orgId={orgId} />}
        </Tab.Screen>
      )}

      {showPeople && (
        <Tab.Screen
          name="People"
          options={{
            headerTitle: 'People',
            headerLeft: () => (
              <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: 16 }}>
                <Ionicons name="arrow-back-outline" size={24} color="#10245c" />
              </TouchableOpacity>
            ),
          }}
        >
          {() => <PeopleScreen orgId={orgId} />}
        </Tab.Screen>
      )}
    </Tab.Navigator>
  );
}