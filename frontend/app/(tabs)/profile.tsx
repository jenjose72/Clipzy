import React, { useEffect, useState } from 'react';
import { View, Text, Button, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/components/AuthContext';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { backendUrl } from '@/constants/Urls';

const Profile = () => {
  const { logout } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError('');
      try {
        const token = await AsyncStorage.getItem('accessToken');
        const res = await fetch(`${backendUrl}/accounts/profile/`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        const data = await res.json();
        console.log(data);
        if (res.ok) {
          setProfile(data);
        } else {
          setError(data.error || 'Failed to fetch profile');
        }
      } catch (e) {
        setError('Network error');
      }
      setLoading(false);
    };
    fetchProfile();
  }, []);

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Profile</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#4F8EF7" />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : profile ? (
          <View style={styles.card}>
            <Text style={styles.label}>Username: <Text style={styles.value}>{profile.username}</Text></Text>
            <Text style={styles.label}>Name: <Text style={styles.value}>{profile.name}</Text></Text>
            <Text style={styles.label}>Email: <Text style={styles.value}>{profile.email}</Text></Text>
            <Text style={styles.label}>Date of Birth: <Text style={styles.value}>{profile.dob}</Text></Text>
            <Text style={styles.label}>Followers <Text style={styles.value}>{profile.followers}</Text></Text>
            <Text style={styles.label}>Following: <Text style={styles.value}>{profile.following}</Text></Text>
          </View>
        ) : null}
        <Button title="Logout" onPress={handleLogout} />
        <TouchableOpacity style={styles.uploadBtn} onPress={() => router.push('/(tabs)/upload')}>
          <Text style={styles.uploadText}>Go to Upload</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    width: 320,
    marginBottom: 24,
  },
  label: {
    fontSize: 18,
    color: '#333',
    marginBottom: 8,
    fontWeight: '600',
  },
  value: {
    fontWeight: '400',
    color: '#4F8EF7',
  },
  error: {
    color: 'red',
    fontSize: 16,
    marginBottom: 16,
  },
  uploadBtn: {
    marginTop: 16,
    backgroundColor: '#4F8EF7',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  uploadText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default Profile;