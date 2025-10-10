import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, TextInput, Dimensions } from 'react-native';
import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import ClipzyLogo from '@/components/icons/clipzyLogo';
import { useRouter } from 'expo-router';
import { backendUrl } from '@/constants/Urls';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface VideoAsset {
  uri: string;
  id: string;
  duration: number;
}

const Upload = () => {
  const [selectedVideo, setSelectedVideo] = useState<VideoAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [caption, setCaption] = useState('');
  const [showPostScreen, setShowPostScreen] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const router = useRouter();

  // Simulate upload progress
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (uploading) {
      setUploadProgress(0);
      interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 95) {
            return prev; // Stop at 95% until actual upload completes
          }
          // Simulate realistic progress curve - faster at start, slower at end
          const increment = Math.random() * 8 + 2; // 2-10% increments
          return Math.min(prev + increment, 95);
        });
      }, 300); // Update every 300ms
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [uploading]);

  const pickVideoFromGallery = async () => {
    try {
      // Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Permission to access camera roll is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 1,
        videoMaxDuration: 300, // 5 minutes max
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const newVideo: VideoAsset = {
          uri: asset.uri,
          id: Date.now().toString(),
          duration: Math.floor(asset.duration || 0),
        };
        setSelectedVideo(newVideo);
        setShowPostScreen(true); // Go directly to post screen after selection
      }
    } catch (error) {
      console.error('Error picking video:', error);
      Alert.alert('Error', 'Failed to pick video from gallery');
    }
  };

  const uploadPost = async () => {
    if (!selectedVideo) {
      Alert.alert('No video selected', 'Please select a video first.');
      return;
    }
    setUploading(true);
    const data = new FormData();
    data.append('file', {
      uri: selectedVideo.uri,
      type: 'video/mp4',
      name: 'upload.mp4',
    } as any);
    data.append('upload_preset', 'Clipzy');
    try {
      const res = await fetch(
        'https://api.cloudinary.com/v1_1/dp1tqdgwl/video/upload',
        {
          method: 'POST',
          body: data,
        }
      );
      const result = await res.json();
      
      if (result.secure_url) {
        // Now send to backend
        try {
          const accessToken = await AsyncStorage.getItem('accessToken');
          if (!accessToken) {
            Alert.alert('Authentication Error', 'Please log in again');
            setUploading(false);
            setUploadProgress(0);
            return;
          }

          const backendData = new FormData();
          backendData.append('video_url', result.secure_url);
          backendData.append('description', caption.trim());
          // Also send the original video file
          backendData.append('file', {
            uri: selectedVideo.uri,
            type: 'video/mp4',
            name: 'upload.mp4',
          } as any);

          const backendRes = await fetch(`${backendUrl}/features/postClip/`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
            body: backendData,
          });

          const backendResult = await backendRes.json();
          
          setUploading(false);
          setUploadProgress(100);
          
          if (backendRes.ok) {
            setUploading(false);
            setUploadProgress(100);
            setShowSuccessBanner(true);
            setSelectedVideo(null);
            setCaption('');
            setShowPostScreen(false);
            setUploadProgress(0);
            
            // Auto-hide success banner after 3 seconds
            setTimeout(() => {
              setShowSuccessBanner(false);
            }, 3000);
            console.log('Video posted successfully:', backendResult);
          } else {
            Alert.alert('Upload Failed', backendResult.error || 'Failed to save video to Clipzy');
            setUploadProgress(0);
          }
        } catch (backendError: any) {
          setUploading(false);
          setUploadProgress(0);
          Alert.alert('Backend Error', 'Failed to save video: ' + backendError.message);
        }
      } else {
        setUploading(false);
        setUploadProgress(0);
        Alert.alert('Upload Failed', JSON.stringify(result));
      }
    } catch (error: any) {
      setUploading(false);
      setUploadProgress(0);
      Alert.alert('Upload Error', error.message);
    }
  };

  if (showPostScreen) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowPostScreen(false)} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New post</Text>
          <TouchableOpacity 
            style={[styles.shareButton, uploading && styles.shareButtonDisabled]}
            onPress={uploadPost}
            disabled={uploading}
          >
            <Text style={styles.shareButtonText}>Share</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.postContent}>
          {selectedVideo && (
            <Video
              source={{ uri: selectedVideo.uri }}
              style={styles.previewVideo}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              isLooping
            />
          )}
          <View style={styles.captionSection}>
            <TextInput
              style={styles.captionInput}
              placeholder="Write a caption..."
              placeholderTextColor="#888"
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={2200}
            />
          </View>
        </View>
        {uploading && (
          <View style={styles.loadingOverlay}>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${uploadProgress}%` }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>
                {Math.round(uploadProgress)}%
              </Text>
              <Text style={styles.uploadingText}>
                {uploadProgress < 30 ? 'Preparing video...' : 
                 uploadProgress < 70 ? 'Uploading to Cloudinary...' : 
                 uploadProgress < 95 ? 'Saving to Clipzy...' : 
                 'Almost done...'}
              </Text>
            </View>
          </View>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="close" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upload Video</Text>
        <View style={styles.headerButton} />
      </View>
      
      {/* Success Banner */}
      {showSuccessBanner && (
        <View style={styles.successBanner}>
          <View style={styles.successContent}>
            <Ionicons name="checkmark-circle" size={24} color="#fff" />
            <Text style={styles.successText}>Video posted successfully!</Text>
          </View>
        </View>
      )}
      
      <View style={styles.content}>
        <View style={styles.uploadContainer}>
          <View style={styles.uploadIcon}>
            <ClipzyLogo width={150} height={150} />
          </View>
          <Text style={styles.uploadTitle}>Select a video to upload</Text>
          <Text style={styles.uploadSubtitle}>
            Choose a video from your gallery to share with your followers
          </Text>
          <TouchableOpacity style={styles.selectButton} onPress={pickVideoFromGallery}>
            <Ionicons name="folder-outline" size={24} color="#fff" />
            <Text style={styles.selectButtonText}>Browse Gallery</Text>
          </TouchableOpacity>
          <View style={styles.infoContainer}>
            <View style={styles.infoItem}>
              <Ionicons name="time-outline" size={16} color="#666" />
              <Text style={styles.infoText}>Maximum 5 minutes</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="videocam-outline" size={16} color="#666" />
              <Text style={styles.infoText}>MP4, MOV formats supported</Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  shareButton: {
    backgroundColor: '#4F8EF7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  shareButtonDisabled: {
    backgroundColor: '#ccc',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  uploadContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  uploadIcon: {
    marginBottom: 24,
  },
  uploadTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
    marginBottom: 12,
  },
  uploadSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  selectButton: {
    backgroundColor: '#000000ff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 32,
    gap: 4,
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  infoContainer: {
    alignItems: 'center',
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
  },
  postContent: {
    flex: 1,
  },
  previewVideo: {
    height: height * 0.6,
    backgroundColor: '#000',
  },
  captionSection: {
    flex: 1,
    padding: 16,
  },
  captionInput: {
    fontSize: 16,
    color: '#000',
    textAlignVertical: 'top',
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 24,
    minWidth: width * 0.8,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4F8EF7',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4F8EF7',
    marginBottom: 8,
  },
  uploadingText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  successBanner: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  successContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
});

export default Upload;