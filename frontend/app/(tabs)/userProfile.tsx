import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { backendUrl } from '@/constants/Urls';
import { useAuth } from '../../components/AuthContext';

const UserProfile = () => {
  const { userId } = useLocalSearchParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null);
  const [followLoading, setFollowLoading] = useState(false);

  const fetchProfile = async () => {
      setLoading(true);
      setError('');
      try {
        const token = await AsyncStorage.getItem('accessToken');
        const res = await fetch(`${backendUrl}/accounts/getOtherProfile/?user_id=${userId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        const data = await res.json();
        //console.log(data);
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

  useEffect(() => { 
    if (userId) fetchProfile();
  }, [userId]);

  useEffect(() => {
    const checkFollowing = async () => {
      
      try {
        const token = await AsyncStorage.getItem('accessToken');
        const res = await fetch(`${backendUrl}/features/isFollowing?user2Id=${userId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        const data = await res.json();
        console.log(data);
        setIsFollowing(data.isFollowing === true || data.isFollowing === 'true');
      } catch {
        setIsFollowing(null);
      }
    };
    checkFollowing();
  }, [userId, user]);

  const handleFollow = async () => {
    setFollowLoading(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const followerId = await AsyncStorage.getItem('user');
      const res = await fetch(`${backendUrl}/features/followUser/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ follower_id: followerId, following_id: userId }),
      });
      await res.json();
      setIsFollowing(true);
      fetchProfile();
    } catch {}
    setFollowLoading(false);
  };

  const handleUnfollow = async () => {
    setFollowLoading(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const followerId = await AsyncStorage.getItem('user');
      const res = await fetch(`${backendUrl}/features/unfollowUser/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ follower_id: followerId, following_id: userId }),
      });
      await res.json();
      setIsFollowing(false);
      fetchProfile();
    } catch {}
    setFollowLoading(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>User Profile</Text>
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
            <Text style={styles.label}>Followers: <Text style={styles.value}>{profile.followers}</Text></Text>
            <Text style={styles.label}>Following: <Text style={styles.value}>{profile.following}</Text></Text>
            {user && userId && user !== profile.username && (
              <TouchableOpacity
                style={[styles.followBtn, isFollowing ? styles.unfollowBtn : styles.followBtn]}
                onPress={isFollowing ? handleUnfollow : handleFollow}
                disabled={followLoading}
              >
                <Text style={styles.followText}>{followLoading ? '...' : isFollowing ? 'Unfollow' : 'Follow'}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
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
  followBtn: {
    backgroundColor: '#4F8EF7',
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginTop: 16,
  },
  unfollowBtn: {
    backgroundColor: '#e53e3e',
  },
  followText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default UserProfile;
