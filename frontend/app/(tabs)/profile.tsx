import React, { useEffect, useState } from 'react';
import { View, Text, Button, TouchableOpacity, ActivityIndicator, StyleSheet, Image, FlatList, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../components/AuthContext';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { backendUrl } from '@/constants/Urls';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

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

  const screenWidth = Dimensions.get('window').width;
  const gridPadding = 16;
  const colCount = 3;
  const itemSize = Math.floor((screenWidth - gridPadding * 2) / colCount);

  const gridItems = Array.from({ length: 12 }).map((_, i) => ({ id: String(i), type: i === 0 ? 'add' : i % 4 === 0 ? 'video' : 'image' }));

  const renderItem = ({ item }: { item: { id: string; type: string } }) => {
    if (item.type === 'add') {
      return (
        <TouchableOpacity style={[styles.gridItem, { width: itemSize, height: itemSize, justifyContent: 'center', alignItems: 'center' }]} onPress={() => router.push('/(tabs)/upload')}>
          <View style={styles.addCircle}><Text style={{ fontSize: 36, color: '#111' }}>+</Text></View>
        </TouchableOpacity>
      );
    }

    return (
      <View style={[styles.gridItem, { width: itemSize, height: itemSize }]}> 
        <View style={[styles.thumbPlaceholder, item.type === 'video' ? { backgroundColor: '#e6d0d0' } : { backgroundColor: '#e6eef9' }]} />
        {item.type === 'video' && (
          <View style={styles.playOverlay}>
            <MaterialIcons name="play-arrow" size={28} color="white" />
          </View>
        )}
      </View>
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
            <View style={styles.avatarCircle} />
          </View>
          <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/(tabs)/edit-profile')}>
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rightCol}>
          <View style={styles.bioBox}>
            <Text style={{ color: '#111' }}>{profile?.bio || 'the one who chases a million hoes ends up with no \"O\'s\"'}</Text>
          </View>

          <View style={styles.followRow}>
            <View style={styles.followItem}><Text style={styles.followNum}>{profile?.followers ?? 10}</Text><Text style={styles.followLabel}>followers</Text></View>
            <View style={styles.followItem}><Text style={styles.followNum}>{profile?.following ?? 6}</Text><Text style={styles.followLabel}>following</Text></View>
          </View>
        </View>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tabButton, styles.tabActive]}>
          <MaterialIcons name="grid-on" size={20} color="#111" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabButton}>
          <MaterialIcons name="play-circle-outline" size={20} color="#111" />
        </TouchableOpacity>
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
    backgroundColor: '#1E90FF',
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