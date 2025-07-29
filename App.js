import React, { useEffect, useState } from 'react';
import {
  NavigationContainer
} from '@react-navigation/native';
import {
  createNativeStackNavigator
} from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  View,
  TouchableOpacity,
  Modal,
  Text,
  StyleSheet,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Login from './screens/login';
import Dashboard from './screens/dashboard';
import MainOrgTabs from './screens/org-specific screens/MainOrgTabs';

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [navigationRef, setNavigationRef] = useState(null);
  const [joinOrgVisible, setJoinOrgVisible] = useState(false);
  const [orgId, setOrgId] = useState('');
  const [isDemoUser, setIsDemoUser] = useState(false);


useEffect(() => {
  const clearIfDemo = async () => {
    const isDemo = await AsyncStorage.getItem('isDemoUser');
    if (isDemo === 'true') {
      await AsyncStorage.clear();
    }
  };
  clearIfDemo();
}, []);

useEffect(() => {
  const unsubscribe = navigationRef?.addListener('state', async () => {
    const isDemo = await AsyncStorage.getItem('isDemoUser');
    setIsDemoUser(isDemo === 'true');
  });
  return unsubscribe;
}, [navigationRef]);

  useEffect(() => {
    const checkStoredUser = async () => {
      const email = await AsyncStorage.getItem('userEmail');
      const isDemo = await AsyncStorage.getItem('isDemoUser');
      setIsDemoUser(isDemo === 'true');
      setInitialRoute(email ? 'Dashboard' : 'Login');
    };

    checkStoredUser();
  }, []);

  const handleSignOut = async () => {
    await AsyncStorage.clear();
    setSettingsVisible(false);
    navigationRef?.navigate('Login');
  };

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#10245c" />
      </View>
    );
  }

  const handleJoinOrg = async () => {
  const email = await AsyncStorage.getItem('userEmail');
  const first = await AsyncStorage.getItem('firstName');
  const last = await AsyncStorage.getItem('lastName');

  try {
    const res = await fetch(`https://api.worshipbuddy.org/schedulebuddy/organizations/${orgId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        first_name: first,
        last_name: last,
        positions: []
      })
    });

    const data = await res.json();
    console.log(data)

    if (!res.ok) throw new Error(data.detail || 'Join failed');

    setJoinOrgVisible(false);
    navigationRef?.navigate('Dashboard', { refresh: true });
  } catch (err) {
    console.log(err)
  const errorMessage =
    typeof err === 'string'
      ? err
      : err?.message || JSON.stringify(err);
  alert(errorMessage);
}
};

  return (
    <>
      <NavigationContainer ref={nav => setNavigationRef(nav)}>
        <Stack.Navigator initialRouteName={initialRoute}>
          <Stack.Screen name="Login" component={Login} options={{ headerShown: false }} />
          <Stack.Screen
  name="Dashboard"
  component={Dashboard}
  options={() => ({
    headerBackVisible: false,
    gestureEnabled: false,
    headerLeft: () => (
      <TouchableOpacity onPress={() => setSettingsVisible(true)} style={{ marginRight: 16 }}>
        <Ionicons name="cog-outline" size={28} color="#10245c" />
      </TouchableOpacity>
    ),
    headerRight: () =>
      !isDemoUser ? (
        <TouchableOpacity onPress={() => setJoinOrgVisible(true)} style={{ marginLeft: 16 }}>
          <Ionicons name="add" size={28} color="#10245c" />
        </TouchableOpacity>
      ) : null,
  })}
/>
          <Stack.Screen name="MainOrg" component={MainOrgTabs} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>

      {/* Settings Modal */}
      <Modal visible={settingsVisible} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={styles.popup}>
            <TouchableOpacity
              onPress={handleSignOut}
              style={styles.optionButton}
            >
              <Text style={styles.optionText}>Sign Out</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSignOut}
              style={[styles.optionButton, { marginTop: 8 }]}
            >
              <Text style={[styles.optionText, { color: 'red' }]}>Delete Account</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSettingsVisible(false)} style={styles.cancelButton}>
              <Text style={{ fontWeight: '600', color: '#10245c' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal visible={joinOrgVisible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.popup}>
          <Text style={styles.optionText}>Enter Organization ID</Text>
          <View style={{ marginVertical: 12 }}>
            <TextInput
              style={styles.input}
              placeholder="Organization ID"
              value={orgId}
              onChangeText={setOrgId}
            />
          </View>
          <TouchableOpacity
            onPress={handleJoinOrg}
            style={styles.optionButton}
          >
            <Text style={styles.optionText}>Join</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setJoinOrgVisible(false)}
            style={styles.cancelButton}
          >
            <Text style={{ fontWeight: '600', color: '#10245c' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popup: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    width: 280,
    alignItems: 'stretch',
    elevation: 10,
  },
  optionButton: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#f4f4f4',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#10245c',
  },
  cancelButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  input: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#f4f4f4',
    borderRadius: 8,
    fontSize: 16,
    color: '#333',
  }
});