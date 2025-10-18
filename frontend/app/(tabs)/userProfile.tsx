import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { backendUrl } from '@/constants/Urls';
import { useAuth } from '../../components/AuthContext';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const UserProfile = () => {
  const { userId } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
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
      const data = await res.json().catch(() => null);
      if (res.ok) {
        const profileData = data?.profile || data || {};
        const normalized = {
          ...profileData,
          name: profileData.name || profileData.username || '',
          username: profileData.username || profileData.name || '',
        };
        setProfile(normalized);
      } else {
        setError(data?.error || 'Failed to fetch profile');
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
        const data = await res.json().catch(() => null);
        setIsFollowing(data?.isFollowing === true || data?.isFollowing === 'true');
      } catch {
        setIsFollowing(null);
      }
    };
    if (userId) checkFollowing();
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
      await res.json().catch(() => null);
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
      await res.json().catch(() => null);
      setIsFollowing(false);
      fetchProfile();
    } catch {}
    setFollowLoading(false);
  };

  const screenWidth = Dimensions.get('window').width;
  const postsCount = profile?.posts_count || profile?.posts || 0;

  // derive initials for placeholder avatar
  const initials = (() => {
    const name = profile?.name || profile?.username || '';
    if (!name) return '';
    return name
      .split(' ')
      .map((p: string) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  })();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/search')} style={styles.leftIcon}>
          <MaterialIcons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{profile?.username || 'Profile'}</Text>
        <View style={styles.leftIcon} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4F8EF7" style={{ marginTop: 40 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : profile ? (
        <View style={{ paddingHorizontal: 16 }}>
          <View style={styles.profileRow}>
            <View style={styles.leftCol}>
              {profile.profile_pic ? (
                <Image source={{ uri: profile.profile_pic }} style={styles.avatarCircle} />
              ) : (
                <View style={styles.avatarCircle}>
                  <Image
                    source={require('../../assets/images/avatar.png')}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                </View>
              )}
            </View>

            <View style={styles.rightCol}>
              <View style={{ marginBottom: 6 }}>
                <Text style={{ color: '#111', fontWeight: '700', fontSize: 18 }}>{profile?.name || profile?.username || ''}</Text>
                <View style={{ marginTop: 4 }}>
                  <Text style={{ color: '#666' }}>@{profile?.username || ''}</Text>
                </View>
              </View>

              <View style={styles.bioBox}>
                {profile?.bio ? (
                  <Text style={{ color: '#111' }}>{profile.bio}</Text>
                ) : (
                  <Text style={styles.bioPlaceholder}>This user hasn't set a bio.</Text>
                )}
              </View>

              <View style={styles.followRow}>
                <View style={styles.followItem}><Text style={styles.followNum}>{postsCount}</Text><Text style={styles.followLabel}>posts</Text></View>
                <View style={styles.followItem}><Text style={styles.followNum}>{profile?.followers ?? 0}</Text><Text style={styles.followLabel}>followers</Text></View>
                <View style={styles.followItem}><Text style={styles.followNum}>{profile?.following ?? 0}</Text><Text style={styles.followLabel}>following</Text></View>
              </View>
              {/* follow button moved below to span the full width of the layer */}
            </View>
          </View>

          {user && userId && String(user) !== String(profile.username) && (
            <View style={styles.fullWidthFollowContainer}>
              <TouchableOpacity
                style={[styles.followBtn, isFollowing ? styles.unfollowBtn : null]}
                onPress={isFollowing ? handleUnfollow : handleFollow}
                disabled={followLoading}
              >
                <Text style={styles.followText}>{followLoading ? '...' : isFollowing ? 'Unfollow' : 'Follow'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  // header
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  leftIcon: {
    width: 40,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
  },

  profileRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  leftCol: {
    width: 120,
    alignItems: 'center',
  },
  rightCol: {
    flex: 1,
    paddingLeft: 12,
    justifyContent: 'flex-start',
  },
  avatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#2d7bf6',
    borderWidth: 2,
    borderColor: '#000',
  },
  initialsText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  editBtn: {
    marginTop: 8,
    backgroundColor: '#4F8EF7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  editBtnText: {
    color: 'white',
    fontWeight: '700',
  },

  bioBox: {
    backgroundColor: '#dbdadaff',
    padding: 10,
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  bioPlaceholder: {
    color: '#666',
    fontStyle: 'italic',
  },
  followRow: {
    flexDirection: 'row',
    marginTop: 12,
    alignItems: 'center',
  },
  followItem: {
    marginRight: 18,
    alignItems: 'center',
  },
  followNum: {
    fontWeight: '800',
    fontSize: 20,
  },
  followLabel: {
    fontSize: 15,
    color: '#777',
  },

  tabRow: {
    flexDirection: 'row',
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    borderBottomColor: '#eee',
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: 'flex-start',
  },
  tabButton: {
    padding: 8,
    marginRight: 12,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#e9d7d7',
  },

  gridItem: {
    marginBottom: 6,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  addCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  thumbPlaceholder: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 34,
    height: 34,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  tabTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  tabSubtitle: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  uploadBadge: {
    backgroundColor: '#E91E63',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadBadgeText: {
    color: '#fff',
    fontWeight: '700',
  },

  // legacy styles kept
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
    width: '100%',
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
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
  fullWidthFollowContainer: {
    paddingHorizontal: 16,
    marginTop: 12,
    width: '100%',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
});

export default UserProfile;
