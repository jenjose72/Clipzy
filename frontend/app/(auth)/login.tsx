import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/components/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { backendUrl } from '@/constants/Urls';

export default function Login() {
  const [username, setUsername] = useState('test');
  const [password, setPassword] = useState('password@123');
  const [error, setError] = useState('');
  const router = useRouter();
  const { login } = useAuth();

  const handleLogin = async () => {
    setError('');
    try {
      const res = await fetch(`${backendUrl}/accounts/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      console.log('Login response:', data);
      if (res.ok) {
        login(username);
        await AsyncStorage.setItem('accessToken', data.access);
        await AsyncStorage.setItem('refreshToken', data.refresh);
        await AsyncStorage.setItem('user', username);
        router.replace('/(tabs)');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message || 'Network error');
      } else {
        setError('Network error');
      }
      console.error('Login error:', e);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text>Login</Text>
      <TextInput placeholder="Username" value={username} onChangeText={setUsername} />
      <TextInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <Button title="Login" onPress={handleLogin} />
      {error ? <Text style={{ color: 'red' }}>{error}</Text> : null}
    </View>
  );
}
