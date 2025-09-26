import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, View, Dimensions, TouchableWithoutFeedback, FlatList, TouchableOpacity, SafeAreaView, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, Text, Animated, Easing } from 'react-native';
import { useAuth } from '@/components/AuthContext';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons, FontAwesome, Fontisto, Feather } from '@expo/vector-icons';
import { backendUrl } from '@/constants/Urls';

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const videoRefs = useRef<(Video | null)[]>([]);
  const [playingIndex, setPlayingIndex] = useState(0);
  const [clips, setClips] = useState<any[]>([]);
  const [newCreatorsClips, setNewCreatorsClips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPage, setSelectedPage] = useState<'forYou' | 'newCreators'>('forYou');
  const progressAnimations = useRef<Animated.Value[]>([]);
  const progressUpdateIntervals = useRef<NodeJS.Timeout[]>([]);
  const [isPlayingArr, setIsPlayingArr] = useState<boolean[]>([]);
  const [likedArr, setLikedArr] = useState<boolean[]>([]);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    if (!user) {
      router.replace('/(auth)');
    } else {
      fetchClips();
      fetchNewCreatorsClips();
    }

    // Cleanup intervals on unmount
    return () => {
      progressUpdateIntervals.current.forEach(interval => {
        if (interval) clearInterval(interval);
      });
    };
  }, [user, router]);

  const getCurrentClips = () => {
    return selectedPage === 'forYou' ? clips : newCreatorsClips;
  };

  const initializeProgressForPage = (clipsData: any[]) => {
    const clipCount = clipsData.length;
    progressAnimations.current = new Array(clipCount).fill(null).map(() => new Animated.Value(0));
    setIsPlayingArr(new Array(clipCount).fill(false).map((_, i) => i === 0));
    setLikedArr(new Array(clipCount).fill(false));
    setPlayingIndex(0);
  };

  const handlePageSwitch = (page: 'forYou' | 'newCreators') => {
    setSelectedPage(page);
    const currentClips = page === 'forYou' ? clips : newCreatorsClips;
    initializeProgressForPage(currentClips);
    // Stop all current intervals
    progressUpdateIntervals.current.forEach(interval => {
      if (interval) clearInterval(interval);
    });
    progressUpdateIntervals.current = [];
  };

  const fetchClips = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const response = await fetch(`${backendUrl}/features/fetchClips/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setClips(data.clips || []);
        // Initialize arrays based on the number of clips
        const clipCount = data.clips?.length || 0;
        progressAnimations.current = new Array(clipCount).fill(null).map(() => new Animated.Value(0));
        setIsPlayingArr(new Array(clipCount).fill(false).map((_, i) => i === 0));
        setLikedArr(new Array(clipCount).fill(false));
      } else {
        Alert.alert('Error', 'Failed to fetch videos');
      }
    } catch (error) {
      console.error('Error fetching clips:', error);
      Alert.alert('Error', 'Failed to fetch videos');
    } finally {
      setLoading(false);
    }
  };

  const fetchNewCreatorsClips = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      // For now, we'll use the same endpoint but you can modify this to fetch different data
      // You might want to add a separate endpoint for new creators
      const response = await fetch(`${backendUrl}/features/fetchClips/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // For demo purposes, we'll just reverse the order to simulate different content
        // In a real app, you'd have different logic to fetch new creators' content
        const reversedClips = (data.clips || []).reverse();
        setNewCreatorsClips(reversedClips);
      } else {
        Alert.alert('Error', 'Failed to fetch new creators videos');
      }
    } catch (error) {
      console.error('Error fetching new creators clips:', error);
      Alert.alert('Error', 'Failed to fetch new creators videos');
    }
  };

  const startProgressUpdates = (index: number) => {
    // Clear any existing interval for this video
    if (progressUpdateIntervals.current[index]) {
      clearInterval(progressUpdateIntervals.current[index]);
    }

    // Start new interval that updates at ~60fps
    progressUpdateIntervals.current[index] = setInterval(async () => {
      const videoRef = videoRefs.current[index];
      if (videoRef && progressAnimations.current[index]) {
        try {
          const status = await videoRef.getStatusAsync();
          if (status.isLoaded && status.durationMillis && status.durationMillis > 0) {
            const progress = (status.positionMillis || 0) / status.durationMillis;
            progressAnimations.current[index].setValue(progress);
          }
        } catch (error) {
          // Silently handle errors
        }
      }
    }, 16) as any; // ~60fps updates
  };

  const stopProgressUpdates = (index: number) => {
    if (progressUpdateIntervals.current[index]) {
      clearInterval(progressUpdateIntervals.current[index]);
      progressUpdateIntervals.current[index] = null as any;
    }
  };

  const handleVideoTap = async (index: number) => {
    const ref = videoRefs.current[index];
    if (ref) {
      if (isPlayingArr[index]) {
        await ref.pauseAsync();
        stopProgressUpdates(index);
      } else {
        await ref.playAsync();
        startProgressUpdates(index);
      }
      setIsPlayingArr(arr => arr.map((v, i) => (i === index ? !v : v)));
    }
  };

  const handleLike = (index: number) => {
    setLikedArr(arr => arr.map((v, i) => (i === index ? !v : v)));
  };

  const handleCommentPress = (index: number) => {
    setCurrentVideoIndex(index);
    setCommentModalVisible(true);
    fetchComments(index);
  };

  const fetchComments = async (videoIndex: number) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return;

      const videoId = clips[videoIndex]?.id;
      if (!videoId) return;

      const response = await fetch(`${backendUrl}/features/getComments/?videoId=${videoId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return;

      const videoId = clips[currentVideoIndex]?.id;
      if (!videoId) return;

      const response = await fetch(`${backendUrl}/features/addComment/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          video_id: videoId,
          content: newComment.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setComments(prev => [data.comment, ...prev]);
        setNewComment('');
      } else {
        Alert.alert('Error', 'Failed to add comment');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    }
  };

  const onViewableItemsChanged = React.useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const index = viewableItems[0].index;
      setPlayingIndex(index);
      setIsPlayingArr(arr => arr.map((_, i) => i === index));
      // Reset progress for the new video
      if (progressAnimations.current[index]) {
        progressAnimations.current[index].setValue(0);
      }
      // Start progress updates for the visible video
      startProgressUpdates(index);
      // Stop progress updates for all other videos
      progressUpdateIntervals.current.forEach((_, i) => {
        if (i !== index) {
          stopProgressUpdates(i);
        }
      });
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

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const animatedWidth = progressAnimations.current[index]?.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '100%'],
    }) || '0%';

    return (
      <View style={styles.videoContainer}>
        <TouchableWithoutFeedback onPress={() => handleVideoTap(index)}>
          <Video
            ref={ref => { videoRefs.current[index] = ref; }}
            source={{ uri: item.clipUrl }}
            style={styles.video}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={isPlayingArr[index]}
            isLooping
            useNativeControls={false}
            volume={1.0}
          />
        </TouchableWithoutFeedback>
        <View style={styles.progressBarBg}>
          <Animated.View style={[styles.progressBarFill, { width: animatedWidth }]} />
        </View>
        <SafeAreaView style={styles.featureButtonsContainer}>
                  <TouchableOpacity style={styles.featureButton} onPress={() => handleLike(index)}>
            <Ionicons name={likedArr[index] ? "heart" : "heart-outline"} size={32} color={likedArr[index] ? "#E91E63" : "white"} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.featureButton} onPress={() => handleCommentPress(index)}>
            <Fontisto name="comment" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.featureButton}>
            <Feather name="share" size={28} color="white" />
          </TouchableOpacity>
        </SafeAreaView>
        {/* Caption overlay */}
        <View style={styles.captionContainer}>
          <Text style={styles.captionText}>{item.caption}</Text>
        </View>
      </View>
    );
  };

  if (!user) return null;

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: 'white', fontSize: 18 }}>Loading videos...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <FlatList
        data={getCurrentClips()}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewConfigRef.current}
        style={{ flex: 1 }}
      />

      {/* Page Selector Overlay */}
      <View style={styles.pageSelectorOverlay}>
        <TouchableOpacity
          style={[styles.pageButtonOverlay, selectedPage === 'forYou' && styles.pageButtonOverlayActive]}
          onPress={() => handlePageSwitch('forYou')}
        >
          <Text style={[styles.pageButtonTextOverlay, selectedPage === 'forYou' && styles.pageButtonTextOverlayActive]}>
            For You
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pageButtonOverlay, selectedPage === 'newCreators' && styles.pageButtonOverlayActive]}
          onPress={() => handlePageSwitch('newCreators')}
        >
          <Text style={[styles.pageButtonTextOverlay, selectedPage === 'newCreators' && styles.pageButtonTextOverlayActive]}>
            New Creators
          </Text>
        </TouchableOpacity>
      </View>

      {/* Comment Modal */}
      <Modal
        visible={commentModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCommentModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={styles.commentModalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.commentHeader}>
            <TouchableOpacity onPress={() => setCommentModalVisible(false)}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.commentTitle}>Comments</Text>
            <View style={{ width: 24 }} />
          </View>

          <FlatList
            data={comments}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View style={styles.commentItem}>
                <View style={styles.commentAvatar}>
                  <Text style={styles.commentAvatarText}>
                    {item.user.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.commentContent}>
                  <Text style={styles.commentUsername}>{item.user}</Text>
                  <Text style={styles.commentText}>{item.comment}</Text>
                  <Text style={styles.commentTime}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            )}
            style={styles.commentsList}
            contentContainerStyle={comments.length === 0 && styles.emptyComments}
            ListEmptyComponent={
              <Text style={styles.emptyCommentsText}>No comments yet. Be the first to comment!</Text>
            }
          />

          <View style={styles.commentInputContainer}>
            <TextInput
              style={styles.commentInput}
              placeholder="Add a comment..."
              placeholderTextColor="#666"
              value={newComment}
              onChangeText={setNewComment}
              multiline
            />
            <TouchableOpacity 
              style={[styles.postButton, !newComment.trim() && styles.postButtonDisabled]}
              onPress={handleAddComment}
              disabled={!newComment.trim()}
            >
              <Text style={[styles.postButtonText, !newComment.trim() && styles.postButtonTextDisabled]}>
                Post
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
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
    position: 'absolute',
    bottom: 60, // Position above the bottom navbar (50px navbar + 10px padding)
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  featureButtonsContainer: {
    position: 'absolute',
    right: 5,
    bottom: 100,
    alignItems: 'center',
  },
  featureButton: {
    marginBottom: 20,
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
 
  },
  captionContainer: {
    position: 'absolute',
    bottom: 160,
    left: 16,
    right: 80,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 8,
    padding: 8,
  },
  captionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  pageSelector: {
    flexDirection: 'row',
    backgroundColor: '#000',
    paddingHorizontal: 20,
    paddingVertical: 10,
    paddingTop: Platform.OS === 'ios' ? 50 : 20, // Extra top padding for status bar
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  pageButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 20,
  },
  pageButtonActive: {
    backgroundColor: '#fff',
  },
  pageButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  pageButtonTextActive: {
    color: '#000',
  },
  pageSelectorOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 30, // Position below status bar
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  pageButtonOverlay: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  pageButtonOverlayActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  pageButtonTextOverlay: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  pageButtonTextOverlayActive: {
    color: '#000',
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
  commentModalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  commentTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  commentsList: {
    flex: 1,
  },
  emptyComments: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCommentsText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  commentItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  commentAvatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  commentContent: {
    flex: 1,
  },
  commentUsername: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  commentText: {
    color: 'white',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  commentTime: {
    color: '#666',
    fontSize: 12,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
    backgroundColor: '#111',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#222',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: 'white',
    fontSize: 14,
    marginRight: 12,
    maxHeight: 80,
  },
  postButton: {
    backgroundColor: '#E91E63',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  postButtonDisabled: {
    backgroundColor: '#333',
  },
  postButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  postButtonTextDisabled: {
    color: '#666',
  },
});
