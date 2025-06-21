import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Keyboard } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

export default function Login({ navigation }) {
  const [stage, setStage] = useState('request_otp');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [readonlyEmail, setReadonlyEmail] = useState(false);
  const [showEmailControls, setShowEmailControls] = useState(false);
  const [showOtpGroup, setShowOtpGroup] = useState(false);
  const [showNewUserFields, setShowNewUserFields] = useState(false);
  const [message, setMessage] = useState('');
  const [messageClass, setMessageClass] = useState('');
  const API_BASE = 'https://api.worshipbuddy.org';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [church, setChurch] = useState('');

  const handleRequestOtp = async () => {
    if (!email || !email.includes('@')) {
        setMessage('Please enter a valid email.');
        setMessageClass('error');
        return;
    }

    try {
        const response = await axios.post(`${API_BASE}/auth/request-otp/`, { email });

        setStage('verify_otp');
        setReadonlyEmail(true);
        setShowEmailControls(true);
        setShowOtpGroup(true);
        setMessage(response.data.message || 'OTP sent to your email');
        setMessageClass('success');
    } catch (error) {
        const detail =
        error.response?.data?.detail || 'OTP request failed. Please try again.';
        setMessage(detail);
        console.log(error)
        setMessageClass('error');
    }
    };

  const handleSubmit = async () => {
    if (stage === 'request_otp') {
        await handleRequestOtp();
    }

    else if (stage === 'verify_otp') {
        if (!otp) {
            setMessage('Please enter the OTP.');
            setMessageClass('error');
            return;
        }

        try {
            const response = await axios.post(`${API_BASE}/auth/verify-otp/`, { email, otp });
            const data = response.data;

            if (data.is_new_user) {
            setShowNewUserFields(true);
            setShowOtpGroup(false);
            setShowEmailControls(false);
            setMessage(data.message || 'Complete your profile');
            setMessageClass('success');
            setStage('complete_profile');
            } else {
            const userInfo = await axios.get(`${API_BASE}/users/${encodeURIComponent(email)}`);
            setMessage('Login successful!');
            setMessageClass('success');
            const user = userInfo.data;

            await AsyncStorage.multiSet([
                ['userEmail', email],
                ['firstName', user.first_name || ''],
                ['lastName', user.last_name || ''],
                ['church', user.church || ''],
                ['organizations', JSON.stringify(user.schedulebuddy?.organizations || [])],
            ]);

            navigation.navigate('Dashboard', { user });
            }
        } catch (error) {
            const detail = error.response?.data?.detail || 'OTP verification failed.';
            setMessage(detail);
            setMessageClass('error');
            setShowNewUserFields(true);
        }
        }

    else if (stage === 'complete_profile') {
        if (!firstName || !lastName || !church) {
        setMessage('Please complete all fields.');
        setMessageClass('error');
        return;
        }

        try {
        await axios.put(`${API_BASE}/users/${encodeURIComponent(email)}`, {
            first_name: firstName,
            last_name: lastName,
            church,
            schedulebuddy: { organizations: [] },
        });

        const r2 = await axios.get(`${API_BASE}/users/${encodeURIComponent(email)}`);
        const userInfo = r2.data;
        console.log(userInfo)
        setMessage('Account created and profile updated!');
        setMessageClass('success');

        await AsyncStorage.multiSet([
        ['userEmail', email],
        ['firstName', userInfo.first_name || ''],
        ['lastName', userInfo.last_name || ''],
        ['church', userInfo.church || ''],
        ['organizations', JSON.stringify(userInfo.schedulebuddy?.organizations || [])],
        ]);

        navigation.navigate('Dashboard', { user: userInfo });
        } catch (error) {
        const detail =
            error.response?.data?.detail || 'Failed to complete profile.';
        setMessage(detail);
        setMessageClass('error');
        }
    }
    };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ScheduleBuddy</Text>
      <View style={styles.loginBox}>
        <Text style={styles.loginHeader}>Login</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Enter your email"
          style={[styles.input, readonlyEmail && styles.readonly]}
          editable={!readonlyEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        {showEmailControls && (
          <View style={styles.emailControls}>
            <TouchableOpacity
              onPress={() => {
                setReadonlyEmail(false);
                setShowOtpGroup(false);
                setShowEmailControls(false);
                setOtp('');
                setMessage('');
                setMessageClass('');
                setStage('request_otp');
              }}
              style={styles.smallButton}
            >
              <Text style={styles.smallButtonText}>Edit Email</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setMessage('OTP resent');
                setMessageClass('success');
              }}
              style={styles.smallButton}
            >
              <Text style={styles.smallButtonText}>Resend OTP</Text>
            </TouchableOpacity>
          </View>
        )}

        {showOtpGroup && (
          <>
            <Text style={styles.label}>One-Time Password</Text>
            <TextInput
                value={otp}
                onChangeText={setOtp}
                placeholder="Enter OTP"
                style={styles.input}
                keyboardType="number-pad"
                returnKeyType="done"
                onSubmitEditing={() => {
                    Keyboard.dismiss();
                    handleSubmit(); // Optional: trigger submit on "Done"
                }}
            />
          </>
        )}

        {showNewUserFields && (
          <>
            <Text style={styles.label}>First Name</Text>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First Name"
              style={styles.input}
            />
            <Text style={styles.label}>Last Name</Text>
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last Name"
              style={styles.input}
            />
            <Text style={styles.label}>Church</Text>
            <TextInput
              value={church}
              onChangeText={setChurch}
              placeholder="Church Name"
              style={styles.input}
            />
          </>
        )}

        {message !== '' && (
          <View
            style={[
              styles.messageBox,
              messageClass === 'success' ? styles.success : styles.error,
            ]}
          >
            <Text style={styles.messageText}>{message}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.button} onPress={handleSubmit}>
          <Text style={styles.buttonText}>
            {stage === 'request_otp' ? 'Request One-Time Password' : 'Submit'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f8',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 100
  },
  title: {
    fontFamily: 'Poppins',
    fontSize: 32,
    fontWeight: '600',
    marginBottom: 30,
    color: '#10245c',
  },
  loginBox: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 40,
    elevation: 6,
  },
  loginHeader: {
    fontSize: 26,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
    color: '#1a2433',
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 6,
    color: '#2d3748',
  },
  input: {
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
    backgroundColor: '#fff',
    fontFamily: 'DM Sans',
  },
  button: {
    backgroundColor: '#10245c',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#10245c',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 2,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  readonly: {
    backgroundColor: '#f8fafc',
    color: '#4a5568',
    borderColor: '#e2e8f0',
  },
  emailControls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  smallButton: {
    backgroundColor: '#edf2f7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 12,
  },
  smallButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3748',
  },
  messageBox: {
    padding: 12,
    marginVertical: 12,
    borderRadius: 8,
    textAlign: 'center',
  },
  messageText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
  success: {
    backgroundColor: '#f0fff4',
    borderColor: '#c6f6d5',
    borderWidth: 1,
    color: '#2f855a',
  },
  error: {
    backgroundColor: '#fff5f5',
    borderColor: '#fed7d7',
    borderWidth: 1,
    color: '#c53030',
  },
});