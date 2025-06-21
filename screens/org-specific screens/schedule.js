import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Calendar } from 'react-native-calendars';

export default function ScheduleScreen({ orgId }) {
  const [userEmail, setUserEmail] = useState('');
  const [services, setServices] = useState([]);
  const [inabilityDates, setInabilityDates] = useState({});
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [allUsers, setAllUsers] = useState([]);

  useEffect(() => {
    const loadEmailAndData = async () => {
      const email = await AsyncStorage.getItem('userEmail');
      setUserEmail(email);
      fetchServices(email);
      fetchInabilityDates(email);
      const res = await fetch(`https://api.worshipbuddy.org/schedulebuddy/organizations/${orgId}/users`);
        const users = await res.json();
        setAllUsers(users);
    };

    loadEmailAndData();
  }, []);

  const fetchServices = async (email) => {
    try {
        const [serviceRes, userRes] = await Promise.all([
        fetch(`https://api.worshipbuddy.org/schedulebuddy/organizations/${orgId}/services`),
        fetch(`https://api.worshipbuddy.org/schedulebuddy/organizations/${orgId}/users`)
        ]);

        const allServices = await serviceRes.json();
        const allUsers = await userRes.json();

        const user = allUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
        const now = new Date();

        const upcomingAssignedServices = allServices
        .filter(service => new Date(service.end_datetime) > now)
        .map(service => {
            const myAssignments = [];

            for (const team of service.teams || []) {
            for (const [positionName, assigned] of Object.entries(team.positions || {})) {
                const assignedNames = Array.isArray(assigned) ? assigned : [assigned];
                const matches = assignedNames.some(e => e?.toLowerCase?.() === email.toLowerCase());

                if (matches) {
                myAssignments.push({ team: team.team_name, position: positionName });
                }
            }
            }

            if (myAssignments.length > 0) {
            return {
                ...service,
                assignments: myAssignments,
            };
            }

            return null;
        })
        .filter(Boolean);

        setServices(upcomingAssignedServices);
    } catch (err) {
        console.error("Failed to fetch services:", err);
    }
    };

  const fetchInabilityDates = async (email) => {
    const res = await fetch(`https://api.worshipbuddy.org/schedulebuddy/organizations/${orgId}/users`);
    const allUsers = await res.json();
    const user = allUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    const dates = {};
    if (user?.inability?.length) {
      user.inability.forEach(date => {
        dates[date] = { selected: true, marked: true, selectedColor: 'red' };
      });
    }
    setInabilityDates(dates);
  };

  const toggleDate = (day) => {
    const dateStr = day.dateString;
    const alreadySelected = inabilityDates[dateStr];

    if (alreadySelected) {
      fetch(`https://api.worshipbuddy.org/schedulebuddy/organizations/${orgId}/users/inability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, date: dateStr, action: 'remove' }),
      });
      const copy = { ...inabilityDates };
      delete copy[dateStr];
      setInabilityDates(copy);
    } else {
      fetch(`https://api.worshipbuddy.org/schedulebuddy/organizations/${orgId}/users/inability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, date: dateStr, action: 'add' }),
      });
      setInabilityDates({
        ...inabilityDates,
        [dateStr]: { selected: true, marked: true, selectedColor: 'red' },
      });
    }
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <TouchableOpacity style={styles.button} onPress={() => setShowCalendar(true)}>
        <Text style={styles.buttonText}>Set Your Availability</Text>
      </TouchableOpacity>

      <FlatList
        data={services}
        keyExtractor={item => item._id}
        renderItem={({ item }) => {
        const groupedAssignments = item.assignments.reduce((acc, { team, position }) => {
            if (!acc[team]) acc[team] = [];
            acc[team].push(position);
            return acc;
        }, {});

        return (
            <TouchableOpacity onPress={() => setSelectedService(item)}>
            <View style={styles.card}>
            <Text style={styles.title}>{item.service_name}</Text>
            <Text>📍 {item.location}</Text>
            <Text>🕒 {new Date(item.start_datetime).toLocaleString()}</Text>

            <View style={{ marginTop: 12 }}>
                {Object.entries(groupedAssignments).map(([team, positions]) => (
                <View key={team} style={{ marginTop: 8 }}>
                    <Text style={{ fontWeight: '600', color: '#2d3748' }}>{team}</Text>
                    {positions.map((pos, i) => (
                    <Text key={i} style={styles.assignmentText}>• {pos}</Text>
                    ))}
                </View>
                ))}
            </View>
            </View>
            </TouchableOpacity>
        );
        }}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No upcoming services.</Text>}
      />

      <Modal visible={showCalendar} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
            <View style={styles.calendarPopup}>
            <Text style={styles.calendarTitle}>Tap dates you're unavailable</Text>
            <Calendar
                markedDates={inabilityDates}
                onDayPress={toggleDate}
                style={styles.calendar}
            />
            <TouchableOpacity onPress={() => setShowCalendar(false)} style={styles.closeButton}>
                <Text style={{ color: 'white', fontWeight: '600' }}>Close</Text>
            </TouchableOpacity>
            </View>
        </View>
        </Modal>
        <Modal
  visible={!!selectedService}
  transparent={true}
  animationType="slide"
  onRequestClose={() => setSelectedService(null)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.serviceModal}>
      <Text style={styles.modalTitle}>{selectedService?.service_name}</Text>
      <Text style={{ marginBottom: 8 }}>📍 {selectedService?.location || '—'}</Text>
      <Text style={{ marginBottom: 16 }}>
        🕒 {new Date(selectedService?.start_datetime).toLocaleString()}
      </Text>

      {selectedService?.teams
        .filter(team =>
            Object.values(team.positions)
            .flat()
            .some(email => email?.toLowerCase?.() === userEmail.toLowerCase())
        )
        .map((team, i) => (
        <View key={i} style={{ marginBottom: 16 }}>
          <Text style={{ fontWeight: '600', fontSize: 16 }}>{team.team_name}</Text>
          {Object.entries(team.positions).map(([pos, assigned], idx) => {
            const emails = Array.isArray(assigned) ? assigned : [assigned];
            return emails.map((email, j) => {
              const user = allUsers.find(u => u.email === email);
              const name = user ? `${user.first_name} ${user.last_name}` : email;
              return (
                <View key={`${idx}-${j}`} style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={styles.assignmentText}>• {pos}: {name}</Text>
                </View>
              );
            });
          })}
        </View>
      ))}

      <TouchableOpacity onPress={() => setSelectedService(null)} style={styles.closeButton}>
        <Text style={{ color: 'white', fontWeight: '600' }}>Close</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 20,
    marginVertical: 10,
    borderRadius: 12,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  button: {
    backgroundColor: '#10245c',
    padding: 14,
    borderRadius: 8,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  buttonText: {
    color: 'white',
    fontWeight: '500',
  },
  assignmentText: {
  fontSize: 14,
  color: '#444',
  marginLeft: 8,
},
modalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.4)',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 20,
},

calendarPopup: {
  backgroundColor: 'white',
  borderRadius: 16,
  padding: 20,
  width: '100%',
  maxWidth: 360,
  elevation: 10,
  alignItems: 'center',
},

calendarTitle: {
  fontSize: 16,
  fontWeight: '600',
  marginBottom: 16,
  color: '#2d3748',
},

calendar: {
  alignSelf: 'stretch',
},

closeButton: {
  marginTop: 20,
  backgroundColor: '#10245c',
  paddingVertical: 10,
  paddingHorizontal: 24,
  borderRadius: 8,
  alignSelf: 'center'
},
serviceModal: {
  backgroundColor: 'white',
  borderRadius: 16,
  padding: 20,
  width: '100%',
  maxWidth: 400,
  maxHeight: '90%',
  elevation: 10,
},

modalTitle: {
  fontSize: 20,
  fontWeight: '700',
  marginBottom: 12,
  color: '#10245c',
},
});