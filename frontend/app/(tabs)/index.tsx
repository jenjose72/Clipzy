import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, View, Dimensions, TouchableWithoutFeedback, FlatList, TouchableOpacity, SafeAreaView, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, Text } from 'react-native';
import { useAuth } from '@/components/AuthContext';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons, FontAwesome, Fontisto, Feather } from '@expo/vector-icons';
import { backendUrl } from '@/constants/Urls';

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
  const [likedArr, setLikedArr] = useState<boolean[]>(VIDEO_URLS.map(() => false));
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');

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

      // For now, we'll use a dummy video ID since we don't have real video IDs
      // In a real app, you'd have video IDs from your backend
      const videoId = videoIndex + 1; // Dummy ID

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

      const videoId = currentVideoIndex + 1; // Dummy ID

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
