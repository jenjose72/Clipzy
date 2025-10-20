import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Image, TextInput, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { backendUrl } from '@/constants/Urls';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';

export default function EditProfile() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bioDraft, setBioDraft] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
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
      if (res.ok) {
        const profileData = data?.profile || data || {};
        const normalized = {
          ...profileData,
          name: profileData.name || profileData.username || '',
          username: profileData.username || profileData.name || '',
        };
        setProfile(normalized);
        setBioDraft(normalized?.bio || '');
      }
    } catch (e) {
      console.error('Failed to fetch profile:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const pickAndUpload = async () => {
    if (Constants.platform?.web) {
      Alert.alert('Not Supported', 'Profile upload not supported on web in this demo');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Permission required to pick an image');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ImagePicker.MediaTypeOptions.Images, 
      quality: 0.8 
    });

    if ((res as any).canceled) return;

    const uri = (res as any).assets ? (res as any).assets[0].uri : (res as any).uri;
    const form = new FormData();
    const fileName = uri.split('/').pop() || 'avatar.jpg';
    const fileType = fileName.split('.').pop() || 'jpg';
    // @ts-ignore
    form.append('file', { uri, name: fileName, type: `image/${fileType}` });
    form.append('upload_preset', 'Clipzy');

    try {
      setUploadingAvatar(true);
      const cloudRes = await fetch('https://api.cloudinary.com/v1_1/dp1tqdgwl/image/upload', {
        method: 'POST',
        body: form as any,
      });
      const cloudData = await cloudRes.json();
      
      if (cloudData?.secure_url) {
        const token = await AsyncStorage.getItem('accessToken');
        const saveRes = await fetch(`${backendUrl}/accounts/update_profile_pic/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ profile_pic: cloudData.secure_url }),
        });
        
        if (saveRes.ok) {
          setProfile((prev: any) => ({ ...prev, profile_pic: cloudData.secure_url }));
          Alert.alert('Success', 'Profile picture updated successfully!');
        } else {
          const saveData = await saveRes.json().catch(() => null);
          Alert.alert('Error', saveData?.error || 'Failed to save profile picture');
        }
      } else {
        Alert.alert('Error', 'Upload failed');
      }
    } catch (e) {
      console.error('Upload error:', e);
      Alert.alert('Error', 'Upload error occurred');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const removeProfilePicture = async () => {
    Alert.alert(
      'Remove Profile Picture',
      'Are you sure you want to remove your profile picture?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setRemovingAvatar(true);
              const token = await AsyncStorage.getItem('accessToken');
              const res = await fetch(`${backendUrl}/accounts/update_profile_pic/`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ profile_pic: '' }), // Empty string to remove
              });
              
              if (res.ok) {
                setProfile((prev: any) => ({ ...prev, profile_pic: '' }));
                Alert.alert('Success', 'Profile picture removed successfully!');
              } else {
                const data = await res.json().catch(() => null);
                Alert.alert('Error', data?.error || 'Failed to remove profile picture');
              }
            } catch (e) {
              console.error('Remove avatar error:', e);
              Alert.alert('Error', 'Network error occurred');
            } finally {
              setRemovingAvatar(false);
            }
          },
        },
      ]
    );
  };

  const saveBio = async () => {
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem('accessToken');
      const res = await fetch(`${backendUrl}/accounts/update_bio/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ bio: bioDraft }),
      });
      
      if (res.ok) {
        setProfile((p: any) => ({ ...p, bio: bioDraft }));
        Alert.alert('Success', 'Bio updated successfully!');
      } else {
        const data = await res.json().catch(() => null);
        Alert.alert('Error', data?.error || 'Failed to save bio');
      }
    } catch (e) {
      console.error('Error saving bio:', e);
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/settings')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Picture Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            {profile?.profile_pic && profile.profile_pic.trim() !== '' ? (
              <Image source={{ uri: profile.profile_pic }} style={styles.avatar} />
            ) : (
              <Image source={require('@/assets/images/avatar.png')} style={styles.avatar} />
            )}
            {(uploadingAvatar || removingAvatar) && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator size="large" color="#fff" />
              </View>
            )}
          </View>
          
          <View style={styles.photoButtonsContainer}>
            <TouchableOpacity 
              style={styles.changePhotoButton} 
              onPress={pickAndUpload}
              disabled={uploadingAvatar || removingAvatar}
            >
              <Ionicons name="camera-outline" size={20} color="#4F8EF7" />
              <Text style={styles.changePhotoText}>
                {uploadingAvatar ? 'Uploading...' : 'Change Photo'}
              </Text>
            </TouchableOpacity>

            {profile?.profile_pic && profile.profile_pic.trim() !== '' && (
              <TouchableOpacity 
                style={styles.removePhotoButton} 
                onPress={removeProfilePicture}
                disabled={uploadingAvatar || removingAvatar}
              >
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                <Text style={styles.removePhotoText}>
                  {removingAvatar ? 'Removing...' : 'Remove Photo'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Profile Info */}
        <View style={styles.infoSection}>
          {/* Name */}
          <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
              <Ionicons name="person-outline" size={20} color="#666" />
              <Text style={styles.infoLabel}>Name</Text>
            </View>
            <Text style={styles.infoValue}>{profile?.name || 'Not set'}</Text>
          </View>

          {/* Username */}
          <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
              <Ionicons name="at" size={20} color="#666" />
              <Text style={styles.infoLabel}>Username</Text>
            </View>
            <Text style={styles.infoValue}>@{profile?.username || 'Not set'}</Text>
          </View>

          {/* Email */}
          <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
              <Ionicons name="mail-outline" size={20} color="#666" />
              <Text style={styles.infoLabel}>Email</Text>
            </View>
            <Text style={styles.infoValue}>{profile?.email || 'Not set'}</Text>
          </View>
        </View>

        {/* Bio Section */}
        <View style={styles.bioSection}>
          <View style={styles.bioHeader}>
            <View style={styles.infoLeft}>
              <Ionicons name="document-text-outline" size={20} color="#666" />
              <Text style={styles.sectionTitle}>Bio</Text>
            </View>
          </View>
          
          <TextInput
            value={bioDraft}
            onChangeText={setBioDraft}
            placeholder="Tell us about yourself..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            maxLength={150}
            style={styles.bioInput}
          />
          <Text style={styles.charCount}>{bioDraft.length}/150</Text>

          <TouchableOpacity
            style={[styles.saveBioButton, saving && styles.buttonDisabled]}
            onPress={saveBio}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={styles.saveBioText}>Save Bio</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  avatarSection: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 32,
    marginTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#2d7bf6',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoButtonsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#E8F4FF',
    borderRadius: 8,
  },
  changePhotoText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4F8EF7',
  },
  removePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#FFE8E8',
    borderRadius: 8,
  },
  removePhotoText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF3B30',
  },
  infoSection: {
    backgroundColor: '#fff',
    marginTop: 12,
    paddingHorizontal: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '400',
  },
  infoValue: {
    fontSize: 16,
    color: '#666',
  },
  bioSection: {
    backgroundColor: '#fff',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  bioHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  bioInput: {
    backgroundColor: '#F5F6FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 14,
    fontSize: 15,
    color: '#333',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
    textAlign: 'right',
  },
  saveBioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000ff',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  saveBioText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
