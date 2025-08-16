import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/components/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Signup() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const { login } = useAuth();

  const handleSignup = async () => {
    setError('');
    try {
      const res = await fetch('http://10.0.2.2:8000/accounts/signup/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email, name, dob }),
      });
      const data = await res.json();
      if (res.ok) {
        // Automatically log in after signup
        const loginRes = await fetch('http://10.0.2.2:8000/accounts/token/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        const loginData = await loginRes.json();
        if (loginRes.ok && loginData.access) {
          await AsyncStorage.setItem('accessToken', loginData.access);
          await AsyncStorage.setItem('refreshToken', loginData.refresh);
          login(username);
          router.replace('/(tabs)');
        } else {
          setError('Signup succeeded but login failed');
        }
      } else {
        setError(data.error || 'Signup failed');
      }
    } catch (e) {
      if (typeof e === 'object' && e !== null && 'message' in e && typeof (e as any).message === 'string') {
        setError((e as any).message);
      } else {
        setError('Network error');
      }
      console.error('Signup error:', e);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text>Sign Up</Text>
      <TextInput placeholder="Username" value={username} onChangeText={setUsername} />
      <TextInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} />
      <TextInput placeholder="Name" value={name} onChangeText={setName} />
      <TextInput placeholder="Date of Birth" value={dob} onChangeText={setDob} />
      <Button title="Sign Up" onPress={handleSignup} />
      {error ? <Text style={{ color: 'red' }}>{error}</Text> : null}
    </View>
  );
}
