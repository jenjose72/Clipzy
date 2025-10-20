import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Image, FlatList, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../components/AuthContext';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { backendUrl } from '@/constants/Urls';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as VideoThumbnails from 'expo-video-thumbnails';
import Constants from 'expo-constants';

const Profile = () => {
  const { logout } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [myClips, setMyClips] = useState<Array<any>>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);

  // fetch profile data
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
        // normalize backend response shapes: sometimes the profile may be nested or missing name
        const profileData = data?.profile || data || {};
        const normalized = {
          ...profileData,
          name: profileData.name || profileData.username || '',
          username: profileData.username || profileData.name || '',
        };
        setProfile(normalized);
      } else {
        setError(data.error || 'Failed to fetch profile');
      }
    } catch (e) {
      setError('Network error');
    }
    setLoading(false);
  };

  const generateThumbnails = async (clips: Array<any>) => {
    for (const clip of clips) {
      try {
        if (!clip?.clipUrl || thumbnails[clip.id]) continue;
        // try native thumbnail generation first
        let uri: string | null = null;
        try {
          const result = await VideoThumbnails.getThumbnailAsync(clip.clipUrl, { time: 1000 });
          uri = result?.uri || null;
        } catch (err) {
          console.log('VideoThumbnails failed for', clip.id, err);
          uri = null;
        }

        // fallback: if we have a Cloudinary video URL, derive a JPG frame URL
        if (!uri && clip.clipUrl && typeof clip.clipUrl === 'string' && clip.clipUrl.includes('res.cloudinary.com')) {
          // Replace video extension with .jpg (works for Cloudinary-hosted videos)
          uri = clip.clipUrl.replace(/\.(mp4|mov|webm)(\?.*)?$/i, '.jpg');
        }

        // final fallback: use the clipUrl itself (may render a poster frame depending on server)
        if (!uri) uri = clip.clipUrl;

        setThumbnails(prev => ({ ...prev, [clip.id]: uri }));
      } catch (err) {
        console.log('Thumbnail generation failed for', clip.id, err);
        // fallback to clipUrl
        setThumbnails(prev => ({ ...prev, [clip.id]: clip.clipUrl }));
      }
    }
  };

  // fetch the user's uploaded clips
  const fetchMyClips = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const res = await fetch(`${backendUrl}/features/myClips/`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        const clips = data.clips || [];
        setMyClips(clips);
        // generate thumbnails for clips (skip on web)
        if (!Constants.platform?.web) {
          generateThumbnails(clips);
        }
      } else {
        console.log('Failed to fetch my clips', data);
      }
    } catch (e) {
      console.log('Error fetching my clips', e);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchMyClips();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchProfile();
      await fetchMyClips();
    } catch (e) {
      console.log('Refresh failed', e);
    }
    setRefreshing(false);
  };

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  const screenWidth = Dimensions.get('window').width;
  const gridPadding = 16;
  const colCount = 3;
  const itemSize = Math.floor((screenWidth - gridPadding * 2) / colCount);
  const postsCount = myClips.length;

  // Use the user's uploaded clips to populate the grid. Keep an 'add' slot first.
  const gridItems = [{ id: 'add', type: 'add' }, ...myClips.map((c, idx) => ({ id: String(c.id || idx), type: 'video', clip: c }))];

  const renderItem = ({ item }: { item: any }) => {
    if (item.type === 'add') {
      return (
        <TouchableOpacity style={[styles.gridItem, { width: itemSize, height: itemSize, justifyContent: 'center', alignItems: 'center' }]} onPress={() => router.push('/(tabs)/upload')}>
          <View style={styles.addCircle}><Text style={{ fontSize: 36, color: '#111' }}>+</Text></View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity onPress={() => router.push({ pathname: '/(tabs)/clip/[clipId]', params: { clipId: String(item.clip.id), clipUrl: item.clip.clipUrl, caption: item.clip.caption || '', userId: String(profile?.id || profile?.user_id || '') } })} style={[styles.gridItem, { width: itemSize, height: itemSize }]}> 
        {item.type === 'video' && item.clip ? (
          // prefer generated thumbnail if available
          <Image source={{ uri: thumbnails[item.clip.id] || item.clip.clipUrl }} style={{ width: '100%', height: '100%' }} />
        ) : (
          <View style={[styles.thumbPlaceholder, item.type === 'video' ? { backgroundColor: '#e6d0d0' } : { backgroundColor: '#e6eef9' }]} />
        )}
        {item.type === 'video' && (
          <View style={styles.playOverlay}>
            <MaterialIcons name="play-arrow" size={28} color="white" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/settings')} style={styles.leftIcon}>
          <MaterialIcons name="settings" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CLIPZY</Text>
        <TouchableOpacity style={styles.leftIcon} onPress={handleLogout}>
          <MaterialIcons name="logout" size={22} color="#111" />
        </TouchableOpacity>
      </View>

      <View style={styles.profileRow}>
        <View style={styles.leftCol}>
          <View style={styles.avatarWrap}>
            {profile?.profile_pic && profile.profile_pic.trim() !== '' ? (
              <Image source={{ uri: profile.profile_pic }} style={styles.avatarCircle} />
            ) : (
              <Image source={require('@/assets/images/avatar.png')} style={styles.avatarCircle} />
            )}
          </View>
        </View>

        <View style={styles.rightCol}>
          {/* Name and username */}
          <View style={{ marginBottom: 6 }}>
            <Text style={{ color: '#111', fontWeight: '700', fontSize: 18 }}>{profile?.name || profile?.username || ''}</Text>
            <View style={{ marginTop: 4 }}>
              <Text style={{ color: '#666' }}>@{profile?.username || ''}</Text>
            </View>
          </View>

          {/* Bio Display */}
          <View style={styles.bioBox}>
            <Text style={{ color: '#111' }}>{profile?.bio || 'No bio yet'}</Text>
          </View>
        </View>
      </View>

      {/* Stats - Full Width */}
      <View style={styles.followRow}>
        <View style={styles.followItem}>
          <Text style={styles.followNum}>{postsCount}</Text>
          <Text style={styles.followLabel}>posts</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.followItem}>
          <Text style={styles.followNum}>{profile?.followers ?? 10}</Text>
          <Text style={styles.followLabel}>followers</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.followItem}>
          <Text style={styles.followNum}>{profile?.following ?? 6}</Text>
          <Text style={styles.followLabel}>following</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        <View>
          <Text style={styles.tabTitle}>Your Uploads</Text>
        </View>
      </View>

      <FlatList
        data={gridItems}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        numColumns={colCount}
        contentContainerStyle={{ padding: gridPadding, backgroundColor: '#FFFFFF' }}
        columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 2 }}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  // header
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
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
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
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
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
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
    backgroundColor: '#F8F9FA',
    padding: 12,
    marginTop: 12,
    borderRadius: 10,
    minHeight: 48,
    justifyContent: 'center',
    borderLeftWidth: 3,
    borderLeftColor: '#000000ff',
  },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    justifyContent: 'space-evenly',
  },
  followItem: {
    alignItems: 'center',
    minWidth: 80,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#D0D0D0',
  },
  followNum: {
    fontWeight: '800',
    fontSize: 22,
    color: '#111',
  },
  followLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },

  tabRow: {
    flexDirection: 'row',
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    paddingVertical: 12,
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
    marginBottom: 2,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  addCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#4F8EF7',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  thumbPlaceholder: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
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