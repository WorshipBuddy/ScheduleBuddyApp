import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';

export default function ServicesScreen({ orgId }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchServices() {
      try {
        const res = await fetch(`https://api.worshipbuddy.org/schedulebuddy/organizations/${orgId}/services`);
        const data = await res.json();
        const now = new Date();
        const upcoming = data
          .filter(svc => new Date(svc.end_datetime) > now)
          .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));
        setServices(upcoming);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchServices();
  }, [orgId]);

  const renderItem = ({ item }) => {
    const start = new Date(item.start_datetime);
    const end = new Date(item.end_datetime);
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{item.service_name}</Text>
        <Text style={styles.datetime}>
          {start.toLocaleDateString()} — {start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          {' - '}
          {end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </Text>
        <Text style={styles.location}>{item.location || 'No location specified'}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Loading services...</Text>
      </View>
    );
  }

  if (services.length === 0) {
    return (
      <View style={styles.center}>
        <Text>No upcoming services found.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={services}
      keyExtractor={(item) => item._id}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
  },
  title: {
    fontWeight: '600',
    fontSize: 18,
    marginBottom: 6,
  },
  datetime: {
    color: '#555',
    fontSize: 14,
    marginBottom: 4,
  },
  location: {
    color: '#777',
    fontSize: 14,
  },
});