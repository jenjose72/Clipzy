import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';


const Upload = () => {
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setVideoUri(result.assets[0].uri);
    }
  };

  const uploadClipz = async () => {
    if (!videoUri) {
      Alert.alert('No video selected', 'Please select a video first.');
      return;
    }
    setUploading(true);
    const data = new FormData();
    data.append('file', {
      uri: videoUri,
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
      setUploading(false);
      if (result.secure_url) {
        Alert.alert('Upload Success', 'Video URL: ' + result.secure_url);
        setVideoUri(null);
      } else {
        Alert.alert('Upload Failed', JSON.stringify(result));
      }
    } catch (error: any) {
      setUploading(false);
      Alert.alert('Upload Error', error.message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Upload Your Clip</Text>
        <View style={styles.card}>
          {videoUri ? (
            <Video
              source={{ uri: videoUri }}
              style={styles.video}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              isLooping
            />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>No video selected</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.button}
            onPress={pickVideo}
            disabled={uploading}
          >
            <Text style={styles.buttonText}>
              {videoUri ? 'Change Video' : 'Select Video from Gallery'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, !videoUri && styles.buttonDisabled]}
            onPress={uploadClipz}
            disabled={!videoUri || uploading}
          >
            <Text style={styles.buttonText}>Upload Clipz</Text>
          </TouchableOpacity>
          {uploading && (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator size="small" color="#4F8EF7" />
              <Text style={styles.uploadingText}>Uploading...</Text>
            </View>
          )}
        </View>
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
    justifyContent: 'center',
    alignItems: 'center',
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
    alignItems: 'center',
  },
  video: {
    width: 280,
    height: 180,
    borderRadius: 12,
    backgroundColor: '#eee',
    marginBottom: 16,
  },
  placeholder: {
    width: 280,
    height: 180,
    borderRadius: 12,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  placeholderText: {
    color: '#888',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#4F8EF7',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#b0c4de',
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  uploadingText: {
    marginLeft: 8,
    color: '#4F8EF7',
    fontSize: 15,
  },
});

export default Upload;