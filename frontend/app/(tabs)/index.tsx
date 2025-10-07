import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, View, Dimensions, TouchableWithoutFeedback, FlatList, TouchableOpacity, SafeAreaView, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, Text, Animated, Easing, RefreshControl } from 'react-native';
import { useAuth } from '../../components/AuthContext';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons, FontAwesome, Fontisto, Feather } from '@expo/vector-icons';
import { backendUrl } from '@/constants/Urls';
import { Snackbar } from 'react-native-paper';

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  console.log('HomeScreen component rendered');

  const { user, logout } = useAuth();
  const router = useRouter();
  const videoRefs = useRef<(Video | null)[]>([]);
  const requestedNextIds = useRef<Set<number>>(new Set());
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
  const [refreshing, setRefreshing] = useState(false);
  const [videoMetrics, setVideoMetrics] = useState<any[]>([]);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  useEffect(() => {
    console.log('useEffect: user value =', user);
    console.log('useEffect: backendUrl =', backendUrl);
    if (!user) {
      console.log('User not logged in, redirecting to auth');
      router.replace('/(auth)');
    } else {
      console.log('User present, fetching clips');
      fetchClips(false);
      fetchNewCreatorsClips();
    }

    // Cleanup intervals on unmount
    return () => {
      // Track final watch percentage for current video before unmounting
      if (playingIndex >= 0) {
        const currentVideoRef = videoRefs.current[playingIndex];
        const currentClips = getCurrentClips();
        if (currentVideoRef && currentClips[playingIndex]) {
          currentVideoRef.getStatusAsync().then(status => {
            if (status.isLoaded && status.durationMillis && status.durationMillis > 0) {
              const finalProgress = (status.positionMillis || 0) / status.durationMillis;
              const currentVideoId = currentClips[playingIndex]?.id;
              if (currentVideoId && finalProgress > 0) {
                console.log(`🎬 Final watch percentage on unmount for video ${currentVideoId}: ${Math.round(finalProgress * 100)}%`);
                trackWatchPercentage(currentVideoId, finalProgress);
              }
            }
          }).catch(error => {
            console.error('Error getting final status on unmount:', error);
          });
        }
      }

      progressUpdateIntervals.current.forEach(interval => {
        if (interval) clearInterval(interval);
      });
    };
  }, [user, router]);

  // Debug: Log when videoMetrics changes
  useEffect(() => {
    if (videoMetrics.length > 0) {
      console.log('📈 VideoMetrics state updated:', videoMetrics);
    }
  }, [videoMetrics]);

  // When the current playing index (video) changes, prefetch the next clip.
  // This ensures we request the next clip as soon as the user navigates to a new video.
  useEffect(() => {
    try {
      if (loading) return; // don't prefetch while initial load in progress
      const currentClips = getCurrentClips();
      const currentVideoId = currentClips[playingIndex]?.id;
      if (!currentVideoId) return;

      // Avoid duplicate fetches for the same video
      if (!requestedNextIds.current.has(currentVideoId)) {
        requestedNextIds.current.add(currentVideoId);
        // fire-and-forget; fetchNextClip logs errors internally
        fetchNextClip(1).catch(err => console.error('Prefetch next clip (useEffect) failed:', err));
      }
    } catch (err) {
      console.error('Error in playingIndex useEffect prefetch:', err);
    }
  }, [playingIndex, selectedPage, clips, loading]);

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

  const handlePageSwitch = async (page: 'forYou' | 'newCreators') => {
    // Track final watch percentage for current video before switching pages
    if (playingIndex >= 0) {
      const currentVideoRef = videoRefs.current[playingIndex];
      const currentClips = getCurrentClips();
      if (currentVideoRef && currentClips[playingIndex]) {
        currentVideoRef.getStatusAsync().then(status => {
          if (status.isLoaded && status.durationMillis && status.durationMillis > 0) {
            const finalProgress = (status.positionMillis || 0) / status.durationMillis;
            const currentVideoId = currentClips[playingIndex]?.id;
            if (currentVideoId && finalProgress > 0) {
              console.log(`🎬 Final watch percentage on page switch for video ${currentVideoId}: ${Math.round(finalProgress * 100)}%`);
              trackWatchPercentage(currentVideoId, finalProgress);
            }
          }
        }).catch(error => {
          console.error('Error getting final status on page switch:', error);
        });
      }
    }

    setSelectedPage(page);
    const currentClips = page === 'forYou' ? clips : newCreatorsClips;
    initializeProgressForPage(currentClips);
    // Stop all current intervals
    progressUpdateIntervals.current.forEach(interval => {
      if (interval) clearInterval(interval);
    });
    progressUpdateIntervals.current = [];

    // Update liked status for the new page
    const token = await AsyncStorage.getItem('accessToken');
    if (token) {
      await checkLikedStatus(currentClips, page);
    }
  };

  const checkLikedStatus = async (videos: any[], page: 'forYou' | 'newCreators') => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`${backendUrl}/features/getLikedVideos/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const likedVideoIds = data.liked_videos?.map((video: any) => video.id) || [];
        
        // Update likedArr based on which videos are liked
        const updateLikedArr = (arr: boolean[], videos: any[]) => 
          arr.map((_, index) => {
            const videoId = videos[index]?.id;
            return likedVideoIds.includes(videoId);
          });

        if (page === 'forYou') {
          setLikedArr(prev => updateLikedArr(prev, videos));
        } else if (page === 'newCreators') {
          // For newCreators, we need to handle the reversed order
          // Since newCreatorsClips is just reversed clips, we can use the same logic
          setLikedArr(prev => updateLikedArr(prev, videos));
        }
      }
    } catch (error) {
      console.error('Error checking liked status:', error);
    }
  };

  const fetchClips = async (isRefresh = false) => {
    try {
      console.log('fetchClips: requesting initial recommended clips');
      const token = await AsyncStorage.getItem('accessToken');

      const response = await fetch(`${backendUrl}/posts/next_clip/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ count: 5 }),
      });

      if (response.ok) {
        const data = await response.json();
        const clipsData = data.clips || data.clip || [];
        setClips(clipsData);
        // reset requested-next tracker when we load a fresh batch
        requestedNextIds.current = new Set();

        // Initialize metrics / UI arrays
        clipsData.forEach((clip: any) => updateVideoMetrics(clip.id, { categories: clip.categories || [] }));
        const clipCount = clipsData.length;
        progressAnimations.current = new Array(clipCount).fill(null).map(() => new Animated.Value(0));
        setIsPlayingArr(new Array(clipCount).fill(false).map((_, i) => i === 0));
        setLikedArr(new Array(clipCount).fill(false));

        // Check liked status
        if (token) await checkLikedStatus(clipsData, 'forYou');
      } else {
        console.error('fetchClips: posts/next_clip/ returned', response.status);
        Alert.alert('Error', 'Failed to fetch recommended videos');
      }
    } catch (error) {
      console.error('Error fetching clips:', error);
      Alert.alert('Error', 'Failed to fetch videos');
    } finally {
      if (!isRefresh) setLoading(false);
    }
  };

  const fetchNextClip = async (count = 1) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      // Resolve user id similar to fetchClips
      let userId: any = null;
      const excludeIds = (clips || []).map(c => c.id);
      const body = { count, exclude_ids: excludeIds } as any;

      const response = await fetch(`${backendUrl}/posts/next_clip/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        console.error('Failed to fetch next clip:', response.status);
        return null;
      }

      const data = await response.json();
      const newClips = data.clips || (data.clip ? [data.clip] : []);
      if (!newClips || newClips.length === 0) return null;

      // Append new clips and initialize their metrics/animation state
      setClips(prev => {
        const updated = [...prev, ...newClips];
        newClips.forEach((clip: any) => updateVideoMetrics(clip.id, { categories: clip.categories || [] }));
        return updated;
      });

      // Extend progress animations, isPlayingArr, likedArr
      progressAnimations.current = progressAnimations.current.concat(new Array(newClips.length).fill(null).map(() => new Animated.Value(0)));
      setIsPlayingArr(prev => prev.concat(new Array(newClips.length).fill(false)));
      setLikedArr(prev => prev.concat(new Array(newClips.length).fill(false)));

      return newClips;
    } catch (error) {
      console.error('Error fetching next clip:', error);
      return null;
    }
  };

  const fetchNewCreatorsClips = async () => {
    try {
      console.log('fetchNewCreatorsClips: starting');
      const token = await AsyncStorage.getItem('accessToken');
      console.log('fetchNewCreatorsClips: token present?', !!token);
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
        
        // Initialize metrics for new creator videos
        reversedClips.forEach((clip: any) => {
          console.log('🎬 Initializing metrics for new creator video:', clip.id, 'categories:', clip.categories);
          updateVideoMetrics(clip.id, { categories: clip.categories || [] });
        });

        // Check liked status for new creator videos
        if (token) {
          await checkLikedStatus(reversedClips, 'newCreators');
        }
      } else {
        Alert.alert('Error', 'Failed to fetch new creators videos');
      }
    } catch (error) {
      console.error('Error fetching new creators clips:', error);
      Alert.alert('Error', 'Failed to fetch new creators videos');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Send video metrics to backend before refreshing
      if (videoMetrics.length > 0) {
        console.log('📤 Sending video metrics to backend...');
        const token = await AsyncStorage.getItem('accessToken');
        const response = await fetch(`${backendUrl}/posts/sendVideoMetrics/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            metrics: videoMetrics
          }),
        });

        if (response.ok) {
          console.log('✅ Video metrics sent successfully');
          // Clear metrics after successful send
          setVideoMetrics([]);
        } else {
          console.error('❌ Failed to send video metrics');
        }
      }

      await Promise.all([fetchClips(true), fetchNewCreatorsClips()]);
    } catch (error) {
      console.error('Error refreshing videos:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Video Metrics Tracking
  const updateVideoMetrics = (videoId: string, updates: any) => {
    console.log('🔄 Updating metrics for video:', videoId, 'with updates:', updates);
    setVideoMetrics(prev => {
      const existingIndex = prev.findIndex(metric => metric.videoId === videoId);
      const currentClips = getCurrentClips();
      const videoData = currentClips.find(clip => clip.id === videoId);

      const metricData = {
        videoId,
        categories: videoData?.categories || [],
        watchPercentage: 0,
        liked: false,
        commented: false,
        ...updates
      };

      let newMetrics;
      if (existingIndex >= 0) {
        // Update existing metric
        newMetrics = [...prev];
        newMetrics[existingIndex] = { ...newMetrics[existingIndex], ...updates };
      } else {
        // Add new metric, keep only last 5
        newMetrics = [...prev, metricData].slice(-5);
      }

      console.log('📊 Video Metrics (last 5 videos):', JSON.stringify(newMetrics, null, 2));
      return newMetrics;
    });
  };

  const trackWatchPercentage = (videoId: string, percentage: number) => {
    console.log('👀 Tracking watch percentage:', videoId, Math.round(percentage * 100) + '%');
    updateVideoMetrics(videoId, { watchPercentage: Math.round(percentage * 100) });
  };

  const trackLike = (videoId: string, liked: boolean) => {
    console.log('❤️ Tracking like:', videoId, liked ? 'liked' : 'unliked');
    updateVideoMetrics(videoId, { liked });
  };

  const trackComment = (videoId: string) => {
    console.log('💬 Tracking comment:', videoId);
    updateVideoMetrics(videoId, { commented: true });
  };

  const startProgressUpdates = (index: number) => {
    // Clear any existing interval for this video
    if (progressUpdateIntervals.current[index]) {
      clearInterval(progressUpdateIntervals.current[index]);
    }

    let lastTrackedPercentage = 0;

    // Start new interval that updates every second (instead of 60fps)
    progressUpdateIntervals.current[index] = setInterval(async () => {
      const videoRef = videoRefs.current[index];
      if (videoRef && progressAnimations.current[index]) {
        try {
          const status = await videoRef.getStatusAsync();
          if (status.isLoaded && status.durationMillis && status.durationMillis > 0) {
            const position = status.positionMillis || 0;
            const duration = status.durationMillis || 0;
            const progress = position / duration;
            progressAnimations.current[index].setValue(progress);

            // Track watch percentage only when it changes significantly (every 5% or more)
            const currentPercentage = Math.round(progress * 100);
            if (Math.abs(currentPercentage - lastTrackedPercentage) >= 5) {
              const currentClips = getCurrentClips();
              const videoId = currentClips[index]?.id;
              if (videoId) {
                trackWatchPercentage(videoId, progress);
                lastTrackedPercentage = currentPercentage;
              }
            }

            // Additionally, trigger next-clip fetch more reliably:
            // - if progress >= 95%
            // - or if playback reports didJustFinish
            // - or if within 500ms of the end
            try {
              const currentClips = getCurrentClips();
              const videoId = currentClips[index]?.id;
              const nearEnd = duration > 0 && (duration - position) <= 500;
              if (videoId) {
                if (status.didJustFinish || progress >= 0.95 || nearEnd) {
                  console.log(`Requesting next clip for video ${videoId} (progress=${(progress*100).toFixed(1)}%, didJustFinish=${!!status.didJustFinish}, nearEnd=${nearEnd})`);
                  if (!requestedNextIds.current.has(videoId)) {
                    requestedNextIds.current.add(videoId);
                    await fetchNextClip(1);
                  }
                }
              }
            } catch (err) {
              console.error('Error while checking/ requesting next clip:', err);
            }
          }
        } catch (error) {
          console.error('Error updating progress:', error);
        }
      }
    }, 1000) as any; // Update every second instead of every 16ms
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

  const handleLike = async (index: number) => {
    const currentClips = getCurrentClips();
    const videoId = currentClips[index]?.id;
    const newLikedState = !likedArr[index];

    if (!videoId) return;

    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return;

      const endpoint = newLikedState ? `${backendUrl}/features/addLikes/` : `${backendUrl}/features/unlikeVideo/`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          video_id: videoId,
        }),
      });

      if (response.ok) {
        // Update local state only after successful API call
        setLikedArr(arr => arr.map((v, i) => (i === index ? newLikedState : v)));
        
        // Track like action for metrics
        trackLike(videoId, newLikedState);
      } else {
        console.error('Failed to update like status');
      }
    } catch (error) {
      console.error('Error updating like:', error);
    }
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

      const response = await fetch(`${backendUrl}/comments/getComments/?videoId=${videoId}`, {
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

      const response = await fetch(`${backendUrl}/comments/addComment/`, {
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
      const data= await response.json();
      console.log(data);
      if (response.ok) {
        if (data.error) {
          setSnackbarMessage(data.error);
          setSnackbarVisible(true);
          return;
        }
        setComments(prev => [data.comment, ...prev]);
        setNewComment('');

        // Track comment action
        const videoId = clips[currentVideoIndex]?.id;
        if (videoId) {
          trackComment(videoId);
        }
      } else {
        // Parse error message from response
        const errorMessage = data.error || data.message || 'Failed to add comment';
        setSnackbarMessage(errorMessage);
        setSnackbarVisible(true);
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      setSnackbarMessage('Network error: Failed to add comment');
      setSnackbarVisible(true);
    }
  };

  const onViewableItemsChanged = React.useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      // Find the item with the highest visibility percentage
      const mostVisibleItem = viewableItems.reduce((prev: any, current: any) => {
        return (prev.isViewable && current.isViewable && current.itemVisiblePercent > prev.itemVisiblePercent) ? current : prev;
      });

      const newIndex = mostVisibleItem.index;
      const currentClips = getCurrentClips();

      // Only proceed if this is a different video
      if (newIndex !== playingIndex) {
        // Track final watch percentage for the previous video before switching
        if (playingIndex >= 0) {
          const prevVideoRef = videoRefs.current[playingIndex];
          if (prevVideoRef) {
            prevVideoRef.getStatusAsync().then(status => {
              if (status.isLoaded && status.durationMillis && status.durationMillis > 0) {
                const finalProgress = (status.positionMillis || 0) / status.durationMillis;
                const prevVideoId = currentClips[playingIndex]?.id;
                if (prevVideoId && finalProgress > 0) {
                  console.log(`🎬 Final watch percentage for video ${prevVideoId}: ${Math.round(finalProgress * 100)}%`);
                  trackWatchPercentage(prevVideoId, finalProgress);
                }
              }
            }).catch(error => {
              console.error('Error getting final status:', error);
            });
          }
        }

        setPlayingIndex(newIndex);
        setIsPlayingArr(arr => arr.map((_, i) => i === newIndex));
        // Reset progress for the new video
        if (progressAnimations.current[newIndex]) {
          progressAnimations.current[newIndex].setValue(0);
        }
        // Start progress updates for the visible video
        startProgressUpdates(newIndex);
        // Prefetch next clip when user navigates to a new video (swipe)
        try {
          const newVideoId = currentClips[newIndex]?.id;
          if (newVideoId && !requestedNextIds.current.has(newVideoId)) {
            // mark as requested so we don't duplicate requests
            requestedNextIds.current.add(newVideoId);
            // fire-and-forget; errors logged inside fetchNextClip
            fetchNextClip(1).catch((err) => console.error('Prefetch next clip failed:', err));
          }
        } catch (err) {
          console.error('Error during prefetch next clip on swipe:', err);
        }
        // Stop progress updates for all other videos
        progressUpdateIntervals.current.forEach((_, i) => {
          if (i !== newIndex) {
            stopProgressUpdates(i);
          }
        });
        // Pause all except the one in view
        videoRefs.current.forEach((ref, i) => {
          if (ref) {
            if (i === newIndex) {
              ref.playAsync();
            } else {
              ref.pauseAsync();
            }
          }
        });
      }
    }
  });

  const viewConfigRef = React.useRef({ 
    viewAreaCoveragePercentThreshold: 50, // Lower threshold for better detection
    minimumViewTime: 100 // Minimum time before considering viewable
  });

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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <FlatList
        data={getCurrentClips()}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewConfigRef.current}
        style={{ flex: 1 }}
        snapToAlignment="start"
        snapToInterval={height} // Snap to full screen height
        decelerationRate="fast" // Faster deceleration for snappier feel
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
            colors={['#fff']}
            progressBackgroundColor="#333"
          />
        }
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

          <Snackbar
            visible={snackbarVisible}
            onDismiss={() => setSnackbarVisible(false)}
            duration={3000}
            style={{ backgroundColor: '#E91E63', position: 'absolute', bottom: 100, zIndex: 1000 }}
          >
            {snackbarMessage}
          </Snackbar>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  videoContainer: {
    width: width,
    height: height, // Use full screen height for proper paging
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  video: {
    width: width,
    height: height, // Use full screen height
    backgroundColor: '#000',
  },
  progressBarBg: {
    position: 'absolute',
    bottom: 110, // Position above the bottom safe area and navbar
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
    bottom: 150, // Adjust for full screen height
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
    bottom: 210, // Adjust for full screen height
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
    top: 10, // Adjust for SafeAreaView
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
