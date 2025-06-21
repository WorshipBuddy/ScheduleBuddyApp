import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

export default function Dashboard({ route, navigation }) {
  const [user, setUser] = useState(route?.params?.user || null);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const API_BASE = 'https://api.worshipbuddy.org';

  useEffect(() => {
    const loadUser = async () => {
      if (!user) {
        const email = await AsyncStorage.getItem('userEmail');
        if (email) {
          try {
            const res = await axios.get(`${API_BASE}/users/${encodeURIComponent(email)}`);
            setUser(res.data);
          } catch (err) {
            console.error('Failed to fetch user:', err);
          }
        }
      }
    };

    loadUser();
  }, []);

  useEffect(() => {
    const fetchOrgs = async () => {
      if (!user) return;
      try {
        const res = await axios.get(`${API_BASE}/users/${encodeURIComponent(user.email)}`);
        const orgIds = res.data.schedulebuddy?.organizations || [];

        const orgPromises = orgIds.map(async (orgId) => {
          const orgRes = await axios.get(`${API_BASE}/schedulebuddy/organizations/${orgId}`);
          return { id: orgId, name: orgRes.data.name || 'Unnamed Org' };
        });

        const detailedOrgs = await Promise.all(orgPromises);
        setOrgs(detailedOrgs);
      } catch (err) {
        console.error('Failed to load orgs', err);
        Alert.alert('Error', 'Failed to load organizations');
      } finally {
        setLoading(false);
      }
    };

    fetchOrgs();
  }, [user]);

  const handlePress = (orgId) => {
    navigation.navigate('MainOrg', { orgId });
  };

  const renderOrgCard = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => handlePress(item.id)}>
      <Text style={styles.orgName}>{item.name}</Text>
      <Text style={styles.orgId}>ID: {item.id}</Text>
    </TouchableOpacity>
  );

  if (!user || loading) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#10245c" />
    </View>
  );
}

  return (
    <View style={styles.container}>
        <Text style={styles.header}>Welcome, {user.first_name}!</Text>
        {orgs.length > 0 ? (
        <FlatList
            data={orgs}
            keyExtractor={(item) => item.id}
            renderItem={renderOrgCard}
            numColumns={1}
            contentContainerStyle={styles.grid}
        />
        ) : (
        <Text style={styles.message}>
            You aren't in any organizations yet. Join or create one.
        </Text>
        )}
    </View>
    );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f8',
    padding: 16,
  },
  header: {
    fontSize: 22,
    fontWeight: '600',
    color: '#10245c',
    marginBottom: 20,
    textAlign: 'center',
  },
  grid: {
    paddingBottom: 40,
  },
  card: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    margin: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  orgName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 8,
  },
  orgId: {
    color: '#4a5568',
    fontSize: 14,
    fontWeight: '500',
  },
  message: {
    marginTop: 80,
    fontSize: 16,
    color: '#4a5568',
    textAlign: 'center',
  },
});