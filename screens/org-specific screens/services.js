import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Button,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function ServicesScreen({ orgId, permissions }) {
  const [services, setServices] = useState([]);
  const [teams, setTeams] = useState([]);
  const [orgAddress, setOrgAddress] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [serviceName, setServiceName] = useState('');
  const [location, setLocation] = useState('');
  const [startDatetime, setStartDatetime] = useState(new Date());
  const [endDatetime, setEndDatetime] = useState(new Date());
  const [selectedTeams, setSelectedTeams] = useState([]);

  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatInterval, setRepeatInterval] = useState(1);
  const [endOccurrences, setEndOccurrences] = useState(4);
  const [recurrenceDays, setRecurrenceDays] = useState([]);

  const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  useEffect(() => {
    (async () => {
      const email = await AsyncStorage.getItem('userEmail');
      setUserEmail(email);
    })();
  }, []);

  useEffect(() => {
    if (orgId && userEmail) {
      fetchInitialData();
    }
  }, [orgId, userEmail]);

  const fetchInitialData = async () => {
  try {
    const [servicesRes, teamsRes, orgRes] = await Promise.all([
      fetch(`https://api.worshipbuddy.org/schedulebuddy/organizations/${orgId}/services`),
      fetch(`https://api.worshipbuddy.org/schedulebuddy/organizations/${orgId}/teams`),
      fetch(`https://api.worshipbuddy.org/schedulebuddy/organizations/${orgId}`)
    ]);

    const servicesData = await servicesRes.json();
    const teamsData = await teamsRes.json();
    const orgData = await orgRes.json();

    const now = new Date();
    const upcoming = servicesData
      .filter(svc => new Date(svc.end_datetime) > now)
      .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));
    setServices(upcoming);
    setTeams(teamsData);

    const fullAddress = [orgData.address, orgData.address2, orgData.city, orgData.state, orgData.zip_code].filter(Boolean).join(', ');
    setOrgAddress(fullAddress);
    setLocation(fullAddress);
  } catch (err) {
    console.error('Failed to fetch initial data:', err);
  }
};

  const toggleTeam = (teamName) => {
    setSelectedTeams(prev =>
      prev.includes(teamName)
        ? prev.filter(name => name !== teamName)
        : [...prev, teamName]
    );
  };

  const handleCreateService = async () => {
    const basePayload = {
      service_name: serviceName,
      location,
      start_datetime: startDatetime.toISOString(),
      end_datetime: endDatetime.toISOString(),
      teams: selectedTeams.map(name => ({
        team_name: name,
        positions: {},
        assign_with_other_team: false
      }))
    };

    try {
      if (isRecurring) {
        const meetings = [];
        const start = new Date(startDatetime);
        const end = new Date(endDatetime);
        const days = recurrenceDays;

        for (let i = 0, date = new Date(start); i < endOccurrences * 7; i++) {
          const day = date.getDay();
          if (days.includes(day)) {
            const s = new Date(date);
            s.setHours(start.getHours(), start.getMinutes());
            const e = new Date(s);
            e.setHours(end.getHours(), end.getMinutes());

            meetings.push({
              ...basePayload,
              start_datetime: s.toISOString(),
              end_datetime: e.toISOString()
            });
          }
          date.setDate(date.getDate() + 1);
        }

        const safeMeetings = meetings.slice(0, 20);
        for (let m of safeMeetings) {
          await fetch(`https://api.worshipbuddy.org/schedulebuddy/organizations/${orgId}/services`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(m)
          });
        }
        Alert.alert(`Created ${safeMeetings.length} recurring services`);
      } else {
        const res = await fetch(`https://api.worshipbuddy.org/schedulebuddy/organizations/${orgId}/services`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(basePayload)
        });

        if (!res.ok) throw new Error('Failed to create service');
        Alert.alert('Service created!');
      }

      setShowCreateModal(false);
      fetchInitialData();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const renderService = ({ item }) => {
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

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Services</Text>
      {(permissions.isOwner || permissions.isOrgAdmin) && (
        <TouchableOpacity style={styles.primaryButton} onPress={() => setShowCreateModal(true)}>
          <Text style={styles.primaryButtonText}>+ Create Service</Text>
        </TouchableOpacity>
      )}
      </View>

      {services.length === 0 ? (
        <View style={styles.center}><Text>No upcoming services found.</Text></View>
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item) => item._id}
          renderItem={renderService}
          contentContainerStyle={styles.list}
        />
      )}

      {/* Modal for service creation */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
  <View style={styles.modalOverlay}>
    <View style={styles.modalContainer}>
      <ScrollView contentContainerStyle={styles.modalScroll}>
        <Text style={styles.modalTitle}>Create Service</Text>

        <TextInput
          placeholder="Service Name"
          style={styles.input}
          value={serviceName}
          onChangeText={setServiceName}
        />
        <TextInput
          placeholder="Location"
          style={styles.input}
          value={location}
          onChangeText={setLocation}
        />

        <Text style={styles.label}>Start Date/Time</Text>
<TouchableOpacity
  onPress={() => {
    if (Platform.OS === 'android') {
      setTimeout(() => setShowStartPicker(true), 0); // Helps with Android rendering inside Modal
    } else {
      setShowStartPicker(true);
    }
  }}
  style={styles.input}
>
  <Text>{startDatetime.toLocaleString()}</Text>
</TouchableOpacity>

{showStartPicker && Platform.OS === 'android' && (
  <DateTimePicker
    value={startDatetime}
    mode="datetime"
    display="default"
    onChange={(event, date) => {
      setShowStartPicker(false);
      if (date) setStartDatetime(date);
    }}
  />
)}

{showStartPicker && Platform.OS === 'ios' && (
  <DateTimePicker
    value={startDatetime}
    mode="datetime"a
    display="inline"
    onChange={(event, date) => {
      if (date) setStartDatetime(date);
    }}
  />
)}

<Text style={styles.label}>End Date/Time</Text>
<TouchableOpacity
  onPress={() => {
    if (Platform.OS === 'android') {
      setTimeout(() => setShowEndPicker(true), 0);
    } else {
      setShowEndPicker(true);
    }
  }}
  style={styles.input}
>
  <Text>{endDatetime.toLocaleString()}</Text>
</TouchableOpacity>

{showEndPicker && Platform.OS === 'android' && (
  <DateTimePicker
    value={endDatetime}
    mode="datetime"
    display="default"
    onChange={(event, date) => {
      setShowEndPicker(false);
      if (date) setEndDatetime(date);
    }}
  />
)}

{showEndPicker && Platform.OS === 'ios' && (
  <DateTimePicker
    value={endDatetime}
    mode="datetime"
    display="inline"
    onChange={(event, date) => {
      if (date) setEndDatetime(date);
    }}
  />
)}

        <Text style={styles.sectionTitle}>Assign Teams</Text>
        {teams.map(t => (
          <TouchableOpacity key={t.team_name} onPress={() => toggleTeam(t.team_name)} style={styles.checkbox}>
            <Text>{selectedTeams.includes(t.team_name) ? '☑' : '☐'} {t.team_name}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity onPress={() => setIsRecurring(!isRecurring)} style={{ marginVertical: 12 }}>
          <Text>{isRecurring ? '☑' : '☐'} This service recurs</Text>
        </TouchableOpacity>

        {isRecurring && (
          <View style={styles.recurrenceBox}>
            <TextInput
              placeholder="Repeat Interval (weeks)"
              keyboardType="numeric"
              style={styles.input}
              value={String(repeatInterval)}
              onChangeText={t => setRepeatInterval(Number(t))}
            />
            <TextInput
              placeholder="Occurrences (max 16)"
              keyboardType="numeric"
              style={styles.input}
              value={String(endOccurrences)}
              onChangeText={t => setEndOccurrences(Number(t))}
            />
            <Text style={{ fontWeight: '500', marginVertical: 10 }}>Repeat on:</Text>
            {weekdays.map((day, idx) => (
              <TouchableOpacity key={idx} onPress={() => {
                setRecurrenceDays(prev =>
                  prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]
                );
              }}>
                <Text>{recurrenceDays.includes(idx) ? '☑' : '☐'} {day}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.button, styles.cancelBtn]} onPress={() => setShowCreateModal(false)}>
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.primaryBtn]} onPress={handleCreateService}>
            <Text style={[styles.buttonText, { color: 'white' }]}>Create</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  </View>
</Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center'
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff', padding: 16, marginBottom: 12, borderRadius: 12, elevation: 2,
  },
  title: {
    fontWeight: '600', fontSize: 18, marginBottom: 6,
  },
  datetime: {
    color: '#555', fontSize: 14, marginBottom: 4,
  },
  location: {
    color: '#777', fontSize: 14,
  },
  createButton: {
    backgroundColor: '#10245c', padding: 12, alignItems: 'center',
  },
  createButtonText: {
    color: '#fff', fontWeight: 'bold',
  },
  input: {
    borderColor: '#ccc', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10,
  },
  sectionTitle: {
    fontWeight: '600', fontSize: 18, marginBottom: 10,
  },
  checkbox: {
    marginVertical: 4,
  },

  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10245c',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  primaryButtonText: { color: '#fff', fontWeight: '500', marginLeft: 4 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  root: { flex: 1, padding: 16, backgroundColor: '#f4f6f8' },
  headerTitle: { fontSize: 24, fontWeight: '600', color: '#1a202c' },
  modalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.5)',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 20,
},
modalContainer: {
  backgroundColor: '#fff',
  borderRadius: 16,
  width: '100%',
  maxHeight: '90%',
  padding: 24,
  shadowColor: '#000',
  shadowOpacity: 0.2,
  shadowRadius: 10,
  elevation: 8,
},
modalScroll: {
  paddingBottom: 24,
},
modalTitle: {
  fontSize: 20,
  fontWeight: '600',
  color: '#1a202c',
  marginBottom: 16,
},
label: {
  marginTop: 12,
  fontSize: 14,
  fontWeight: '500',
  color: '#2d3748',
},
input: {
  borderColor: '#e2e8f0',
  borderWidth: 2,
  borderRadius: 10,
  padding: 12,
  fontSize: 16,
  fontWeight: '500',
  color: '#2d3748',
  marginBottom: 12,
},
sectionTitle: {
  fontSize: 16,
  fontWeight: '600',
  color: '#1a202c',
  marginVertical: 12,
},
checkbox: {
  marginVertical: 6,
},
recurrenceBox: {
  backgroundColor: '#f8fafc',
  padding: 16,
  borderRadius: 10,
  borderWidth: 2,
  borderColor: '#e2e8f0',
  marginTop: 12,
},
buttonRow: {
  flexDirection: 'row',
  justifyContent: 'flex-end',
  gap: 12,
  marginTop: 20,
},
button: {
  paddingVertical: 12,
  paddingHorizontal: 20,
  borderRadius: 10,
  fontWeight: '600',
},
primaryBtn: {
  backgroundColor: '#10245c',
},
cancelBtn: {
  backgroundColor: '#edf2f7',
},
buttonText: {
  fontSize: 16,
  fontWeight: '600',
}
});