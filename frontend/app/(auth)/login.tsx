import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../components/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { backendUrl } from '@/constants/Urls';
import ClipzyLogo from '@/components/icons/clipzyLogo';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Login() {
  const [username, setUsername] = useState('test');
  const [password, setPassword] = useState('password@123');
  const [error, setError] = useState('');
  const router = useRouter();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (loading) return; // prevent double submissions
    setError('');
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#000" />
        </TouchableOpacity>
        <View style={styles.top}>
          <ClipzyLogo xml={null} width={120} height={160} style={{ opacity: 1 }} />
          <Text style={styles.subtitle}>Login to your account</Text>
        </View>

        <View style={styles.form}>
          <TextInput placeholder="Username" value={username} onChangeText={setUsername} style={styles.input} />
          <TextInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />

          <TouchableOpacity
            style={[styles.button, loading ? styles.buttonDisabled : null]}
            onPress={handleLogin}
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.footerText}>Dont have an account? <Text style={styles.link} onPress={() => router.push('/(auth)/signup')}>create one now! </Text></Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, padding: 24, justifyContent: 'flex-start' },
  backBtn: { position: 'absolute', left: 12, top: 12, zIndex: 10, padding: 6 },
  top: { alignItems: 'center', marginTop: 32 },
  title: { fontSize: 28, fontWeight: '700', marginTop: 8, letterSpacing: 2 },
  subtitle: { marginTop: 20, color: '#000', fontWeight: '600',fontSize:20 },
  form: { paddingBottom: 40, marginTop: 60 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, marginBottom: 12 },
  button: { backgroundColor: '#000', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  buttonDisabled: { opacity: 0.7 },
  footerText: { textAlign: 'center', marginTop: 24, color: '#666', fontSize: 13 },
  link: { color: '#000', fontWeight: '600' },
  error: { color: 'red', textAlign: 'center', marginTop: 8 },
});
