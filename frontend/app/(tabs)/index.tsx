import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, View, Dimensions, TouchableWithoutFeedback, FlatList, TouchableOpacity, SafeAreaView } from 'react-native';
import { useAuth } from '@/components/AuthContext';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons, FontAwesome } from '@expo/vector-icons';

const VIDEO_URLS = [
  'https://res.cloudinary.com/dwnhpd6oe/video/upload/v1751370063/myjjzwprprwgjx6zvsuf.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
];

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const videoRefs = useRef<(Video | null)[]>([]);
  const [playingIndex, setPlayingIndex] = useState(0);
  const [progressArr, setProgressArr] = useState<number[]>(VIDEO_URLS.map(() => 0));
  const [isPlayingArr, setIsPlayingArr] = useState<boolean[]>(VIDEO_URLS.map((_, i) => i === 0));

  useEffect(() => {
    if (!user) {
      router.replace('/(auth)');
    }
  }, [user, router]);

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  const handleVideoTap = async (index: number) => {
    const ref = videoRefs.current[index];
    if (ref) {
      if (isPlayingArr[index]) {
        await ref.pauseAsync();
      } else {
        await ref.playAsync();
      }
      setIsPlayingArr(arr => arr.map((v, i) => (i === index ? !v : v)));
    }
  };

  const onViewableItemsChanged = React.useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const index = viewableItems[0].index;
      setPlayingIndex(index);
      setIsPlayingArr(arr => arr.map((_, i) => i === index));
      // Pause all except the one in view
      videoRefs.current.forEach((ref, i) => {
        if (ref) {
          if (i === index) {
            ref.playAsync();
          } else {
            ref.pauseAsync();
          }
        }
      });
    }
  });

  const viewConfigRef = React.useRef({ viewAreaCoveragePercentThreshold: 80 });

  const handlePlaybackStatusUpdate = (index: number) => (status: AVPlaybackStatus) => {
    if (
      status.isLoaded &&
      typeof status.durationMillis === 'number' &&
      status.durationMillis > 0
    ) {
      setProgressArr(arr => arr.map((v, i) => (
        i === index && typeof status.positionMillis === 'number' && typeof status.durationMillis === 'number' && status.durationMillis > 0
          ? status.positionMillis / status.durationMillis
          : v
      )));
    }
  };

  const renderItem = ({ item, index }: { item: string; index: number }) => (
    <View style={styles.videoContainer}>
      <TouchableWithoutFeedback onPress={() => handleVideoTap(index)}>
        <Video
          ref={ref => { videoRefs.current[index] = ref; }}
          source={{ uri: item }}
          style={styles.video}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={isPlayingArr[index]}
          isLooping
          useNativeControls={false}
          volume={1.0}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate(index)}
        />
      </TouchableWithoutFeedback>
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${progressArr[index] * 100}%` }]} />
      </View>
      <SafeAreaView style={styles.featureButtonsContainer}>
        <TouchableOpacity style={styles.featureButton}>
          <Ionicons name="heart" size={28} color="white" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.featureButton}>
          <FontAwesome name="comment" size={28} color="white" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.featureButton}>
          <Ionicons name="share-social" size={28} color="white" />
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );

  if (!user) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <FlatList
        data={VIDEO_URLS}
        renderItem={renderItem}
        keyExtractor={(_, idx) => idx.toString()}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewConfigRef.current}
        style={{ flex: 1 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  videoContainer: {
    width: width,
    height: height - 50, // Adjust height to account for bottom navbar
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  video: {
    width: width,
    height: height - 50, // Adjust height to match container
    backgroundColor: '#000',
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  featureButtonsContainer: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    alignItems: 'center',
  },
  featureButton: {
    marginBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 5,
  },
  logoutContainer: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
  },
  logoutButton: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 10,
  },
  logoutText: {
    width: 40,
    height: 10,
    backgroundColor: '#000',
    borderRadius: 5,
  },
});
