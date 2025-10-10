import React, { useEffect, useState } from 'react';
import { View, Text, Button, TouchableOpacity, ActivityIndicator, StyleSheet, Image, FlatList, Dimensions, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../components/AuthContext';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { backendUrl } from '@/constants/Urls';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import Constants from 'expo-constants';

const Profile = () => {
  const { logout } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [myClips, setMyClips] = useState<Array<any>>([]);
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState('');
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

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
          // normalize backend response shapes: sometimes the profile may be nested or missing name
          const profileData = data?.profile || data || {};
          const normalized = {
            ...profileData,
            name: profileData.name || profileData.username || '',
            username: profileData.username || profileData.name || '',
          };
          setProfile(normalized);
          setBioDraft(normalized?.bio || '');
        } else {
          setError(data.error || 'Failed to fetch profile');
        }
      } catch (e) {
        setError('Network error');
      }
      setLoading(false);
    };
    fetchProfile();
    // fetch user's uploaded clips
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
    fetchMyClips();
  }, []);

  const pickAndUpload = async () => {
    if (Constants.platform?.web) {
      alert('Profile upload not supported on web in this demo');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      alert('Permission required to pick an image');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
  // expo-image-picker v14+ uses `canceled` and `assets`
  if ((res as any).canceled) return;

  const uri = (res as any).assets ? (res as any).assets[0].uri : (res as any).uri;
    const form = new FormData();
    const fileName = uri.split('/').pop() || 'avatar.jpg';
    const fileType = fileName.split('.').pop() || 'jpg';
    // @ts-ignore
    form.append('file', { uri, name: fileName, type: `image/${fileType}` });
  // Use the same unsigned preset the video uploader uses
  form.append('upload_preset', 'Clipzy');
    try {
      setLoading(true);
      console.log('Uploading avatar to Cloudinary, form keys:', Array.from((form as any)._parts || []));
      const cloudRes = await fetch('https://api.cloudinary.com/v1_1/dp1tqdgwl/image/upload', {
        method: 'POST',
        body: form as any,
      });
      let cloudData: any = null;
      try {
        cloudData = await cloudRes.json();
      } catch (err) {
        const text = await cloudRes.text();
        console.log('Cloudinary returned non-JSON response:', text);
        alert('Upload failed: ' + text);
        setLoading(false);
        return;
      }
      console.log('Cloudinary status:', cloudRes.status, cloudRes.statusText, 'response:', cloudData);
      if (cloudData?.secure_url) {
        // POST to backend to save
        const token = await AsyncStorage.getItem('accessToken');
        const saveRes = await fetch(`${backendUrl}/accounts/update_profile_pic/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ profile_pic: cloudData.secure_url }),
        });
        let saveData: any = null;
        try {
          saveData = await saveRes.json();
        } catch (err) {
          // backend might return HTML (error page) or plain text; capture that
          try {
            saveData = await saveRes.text();
          } catch (e) {
            saveData = `Non-JSON response, status ${saveRes.status}`;
          }
        }
        if (saveRes.ok) {
          setProfile((prev: any) => ({ ...prev, profile_pic: cloudData.secure_url }));
        } else {
          console.log('Save profile pic failed:', saveRes.status, saveData);
          // show useful message
          alert(typeof saveData === 'string' ? saveData : (saveData?.error || 'Failed to save profile pic'));
        }
      } else {
        console.log('Cloudinary response (no secure_url):', cloudData);
        alert('Upload failed: ' + JSON.stringify(cloudData));
      }
    } catch (e) {
      console.error(e);
      alert('Upload error');
    }
    setLoading(false);
  };

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  const saveBio = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('accessToken');
      const res = await fetch(`${backendUrl}/accounts/update_bio/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ bio: bioDraft }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setProfile((p: any) => ({ ...p, bio: bioDraft }));
        setEditingBio(false);
      } else {
        console.log('Failed to save bio', data);
        alert('Failed to save bio');
      }
    } catch (e) {
      console.log('Error saving bio', e);
      alert('Network error');
    }
    setLoading(false);
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
      <TouchableOpacity onPress={() => router.push({ pathname: '/(tabs)/clip/[clipId]', params: { clipId: String(item.clip.id), clipUrl: item.clip.clipUrl } })} style={[styles.gridItem, { width: itemSize, height: itemSize }]}> 
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
            {profile?.profile_pic ? (
              <Image source={{ uri: profile.profile_pic }} style={styles.avatarCircle} />
            ) : (
              <View style={styles.avatarCircle} />
            )}
            <TouchableOpacity style={[styles.editBtn, { marginTop: 12 }]} onPress={pickAndUpload}>
              <Text style={styles.editBtnText}>{loading ? 'Fetching...' : 'Change Avatar'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.rightCol}>
          {/* Name and username separated from bio */}
          <View style={{ marginBottom: 6 }}>
            <Text style={{ color: '#111', fontWeight: '700', fontSize: 18 }}>{profile?.name || profile?.username || ''}</Text>
            <View style={{ marginTop: 4 }}>
              <Text style={{ color: '#666' }}>@{profile?.username || ''}</Text>
            </View>
            {/* email intentionally hidden in profile view */}
          </View>

          <View style={styles.bioBox}>
            {editingBio ? (
              <View>
                <TextInput
                  value={bioDraft}
                  onChangeText={setBioDraft}
                  multiline
                  style={{ minHeight: 60, padding: 8, borderColor: '#ddd', borderWidth: 1, borderRadius: 6 }}
                />
                <View style={{ flexDirection: 'row', marginTop: 8 }}>
                  <TouchableOpacity onPress={saveBio} style={{ marginRight: 12 }}>
                    <Text style={{ color: '#0066cc' }}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setEditingBio(false); setBioDraft(profile?.bio || ''); }}>
                    <Text style={{ color: '#666' }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={{ color: '#111', flex: 1 }}>{profile?.bio || 'the one who chases a million hoes ends up with no "O\'s"'}</Text>
                <TouchableOpacity onPress={() => setEditingBio(true)} style={{ marginLeft: 8 }}>
                  <Text style={{ color: '#0066cc' }}>Edit</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.followRow}>
            <View style={styles.followItem}><Text style={styles.followNum}>{postsCount}</Text><Text style={styles.followLabel}>posts</Text></View>
            <View style={styles.followItem}><Text style={styles.followNum}>{profile?.followers ?? 10}</Text><Text style={styles.followLabel}>followers</Text></View>
            <View style={styles.followItem}><Text style={styles.followNum}>{profile?.following ?? 6}</Text><Text style={styles.followLabel}>following</Text></View>
          </View>
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
        contentContainerStyle={{ padding: gridPadding }}
        columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 6 }}
        showsVerticalScrollIndicator={false}
      />
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