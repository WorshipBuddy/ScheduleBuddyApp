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
  StyleSheet
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

  useEffect(() => {
    const checkStoredUser = async () => {
      const email = await AsyncStorage.getItem('userEmail');
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

  return (
    <>
      <NavigationContainer ref={nav => setNavigationRef(nav)}>
        <Stack.Navigator initialRouteName={initialRoute}>
          <Stack.Screen name="Login" component={Login} options={{ headerShown: false }} />
          <Stack.Screen
            name="Dashboard"
            component={Dashboard}
            options={{
              headerBackVisible: false,
              gestureEnabled: false,
              headerRight: () => (
                <TouchableOpacity onPress={() => setSettingsVisible(true)} style={{ marginRight: 16 }}>
                  <Ionicons name="cog-outline" size={28} color="#10245c" />
                </TouchableOpacity>
              ),
            }}
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
});