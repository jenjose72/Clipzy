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
  const { user, logout } = useAuth();
  const router = useRouter();
  const videoRefs = useRef<(Video | null)[]>([]);
  const requestedNextIds = useRef<Set<number>>(new Set());
  const currentWatchedTime = useRef(0);
  const currentStartTime = useRef<number | null>(null);
  const playingIndexRef = useRef(0); // Ref to track current playing index for callbacks
  const currentClipsRef = useRef<any[]>([]); // Ref to track current clips array for callbacks
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
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [displayWatchedTime, setDisplayWatchedTime] = useState(0);
  const currentVideoMetric = useRef<any>(null);

  useEffect(() => {
    if (!user) {
      router.replace('/(auth)');
    } else {
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
          currentVideoRef.getStatusAsync().then(async (status) => {
            if (status.isLoaded && status.durationMillis && status.durationMillis > 0) {
              const duration = status.durationMillis / 1000;
              const watchedSeconds = currentWatchedTime.current / 1000;
              const finalProgress = Math.min(watchedSeconds / duration, 1);
              const currentVideoId = currentClips[playingIndex]?.id;
              if (currentVideoId && finalProgress > 0) {
                const metricsToSend = [{
                  videoId: currentVideoId,
                  categories: currentClips[playingIndex]?.categories || [],
                  watchPercentage: Math.round(finalProgress * 100),
                  liked: likedArr[playingIndex] || false,
                  commented: false
                }];
                
                console.log('📤 UNMOUNT: Sending metrics for video:', currentVideoId, 'watch:', Math.round(finalProgress * 100) + '%');
                await sendMetricsDirect(metricsToSend);
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

  // Keep currentClipsRef in sync with the active clips array
  useEffect(() => {
    currentClipsRef.current = getCurrentClips();
  }, [clips, newCreatorsClips, selectedPage]);

  // When the current playing index (video) changes, prefetch the next clip.
  // This ensures we request the next clip as soon as the user navigates to a new video.
  // Only prefetch for "For You" page, not "New Creators"
  useEffect(() => {
    try {
      if (loading) return; // don't prefetch while initial load in progress
      if (selectedPage !== 'forYou') return; // Only prefetch for "For You" page
      
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
    playingIndexRef.current = 0; // Update ref
    setPlayingIndex(0);
    
    // Reset watch tracking
    currentWatchedTime.current = 0;
    currentStartTime.current = null;
    currentVideoMetric.current = null;
    
    // Start tracking the first video after a brief delay
    setTimeout(() => {
      startProgressUpdates(0);
    }, 100);
  };

  const handlePageSwitch = async (page: 'forYou' | 'newCreators') => {
    // Track final watch percentage for current video before switching pages
    if (playingIndex >= 0) {
      const currentVideoRef = videoRefs.current[playingIndex];
      const currentClips = getCurrentClips();
      if (currentVideoRef && currentClips[playingIndex]) {
        try {
          const status = await currentVideoRef.getStatusAsync();
          if (status.isLoaded && status.durationMillis && status.durationMillis > 0) {
            const duration = status.durationMillis / 1000;
            const watchedSeconds = currentWatchedTime.current / 1000;
            const finalProgress = Math.min(watchedSeconds / duration, 1);
            const currentVideoId = currentClips[playingIndex]?.id;
            if (currentVideoId && finalProgress > 0) {
              const metricsToSend = [{
                videoId: currentVideoId,
                categories: currentClips[playingIndex]?.categories || [],
                watchPercentage: Math.round(finalProgress * 100),
                liked: likedArr[playingIndex] || false,
                commented: false
              }];
              
              console.log('� PAGE SWITCH: Sending metrics for video:', currentVideoId, 'watch:', Math.round(finalProgress * 100) + '%');
              await sendMetricsDirect(metricsToSend);
            }
          }
        } catch (error) {
          console.error('Error getting final status on page switch:', error);
        }
      }
    }
    currentWatchedTime.current = 0;
    currentStartTime.current = null;

    setSelectedPage(page);
    const currentClips = page === 'forYou' ? clips : newCreatorsClips;
    initializeProgressForPage(currentClips);
    progressUpdateIntervals.current.forEach(interval => {
      if (interval) clearInterval(interval);
    });
    progressUpdateIntervals.current = [];
    currentVideoMetric.current = null;

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
        requestedNextIds.current = new Set();

        const clipCount = clipsData.length;
        progressAnimations.current = new Array(clipCount).fill(null).map(() => new Animated.Value(0));
        setIsPlayingArr(new Array(clipCount).fill(false).map((_, i) => i === 0));
        setLikedArr(new Array(clipCount).fill(false));

        if (token) await checkLikedStatus(clipsData, 'forYou');
        
        // Start tracking the first video automatically
        setTimeout(() => {
          if (selectedPage === 'forYou') {
            startProgressUpdates(0);
          }
        }, 100);
      } else {
        console.error('Failed to fetch clips:', response.status);
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

      // Filter out any clips that already exist (by ID) to prevent duplicate keys
      const existingIds = new Set(clips.map(c => c.id));
      const uniqueNewClips = newClips.filter((clip: any) => !existingIds.has(clip.id));
      
      if (uniqueNewClips.length === 0) {
        console.log('⚠️ No new unique clips to add');
        return null;
      }

      setClips(prev => [...prev, ...uniqueNewClips]);

      progressAnimations.current = progressAnimations.current.concat(new Array(uniqueNewClips.length).fill(null).map(() => new Animated.Value(0)));
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
      const token = await AsyncStorage.getItem('accessToken');
      const response = await fetch(`${backendUrl}/features/fetchClips/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const reversedClips = (data.clips || []).reverse();
        setNewCreatorsClips(reversedClips);

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
      await Promise.all([fetchClips(true), fetchNewCreatorsClips()]);
    } catch (error) {
      console.error('Error refreshing videos:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const sendMetricsDirect = async (metrics: any[]) => {
    if (metrics.length === 0) return;
    
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const response = await fetch(`${backendUrl}/posts/sendVideoMetrics/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          metrics: metrics
        }),
      });

      if (!response.ok) {
        console.error('Failed to send direct metrics:', response.status);
      }
    } catch (error) {
      console.error('Error sending direct metrics:', error);
    }
  };

  const trackLike = async (videoId: string, liked: boolean) => {
    const currentClips = getCurrentClips();
    const videoIndex = currentClips.findIndex(clip => clip.id === videoId);
    const videoData = currentClips[videoIndex];
    
    if (videoData) {
      const metricsToSend = [{
        videoId: videoId,
        categories: videoData.categories || [],
        watchPercentage: 0,
        liked: liked,
        commented: false
      }];
      
      console.log('❤️ LIKE: Sending metrics for video:', videoId, 'liked:', liked);
      await sendMetricsDirect(metricsToSend);
    }
  };

  const trackComment = async (videoId: string) => {
    const currentClips = getCurrentClips();
    const videoIndex = currentClips.findIndex(clip => clip.id === videoId);
    const videoData = currentClips[videoIndex];
    
    if (videoData) {
      const metricsToSend = [{
        videoId: videoId,
        categories: videoData.categories || [],
        watchPercentage: 0,
        liked: false,
        commented: true
      }];
      
      console.log('💬 COMMENT: Sending metrics for video:', videoId);
      await sendMetricsDirect(metricsToSend);
    }
  };

  const startProgressUpdates = (index: number) => {
    // Clear any existing interval for this video
    if (progressUpdateIntervals.current[index]) {
      clearInterval(progressUpdateIntervals.current[index]);
    }

    // Start watch time if not already started
    if (currentStartTime.current === null) {
      currentStartTime.current = Date.now();
      console.log('⏱️ Started tracking watch time for index:', index);
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

            const liveWatched = currentWatchedTime.current + (currentStartTime.current ? Date.now() - currentStartTime.current : 0);
            setDisplayWatchedTime(liveWatched);

            // Update current video metric reference
            const currentClips = getCurrentClips();
            const videoId = currentClips[index]?.id;
            if (videoId) {
              const watchedSeconds = currentWatchedTime.current / 1000;
              const currentProgress = Math.min(watchedSeconds / (duration / 1000), 1);
              const currentProgressPercent = Math.round(currentProgress * 100);
              
              currentVideoMetric.current = {
                videoId: videoId,
                categories: currentClips[index]?.categories || [],
                watchPercentage: currentProgressPercent,
                liked: likedArr[index] || false,
                commented: false
              };
            }

            try {
              const currentClips = getCurrentClips();
              const videoId = currentClips[index]?.id;
              const nearEnd = duration > 0 && (duration - position) <= 500;
              if (videoId && selectedPage === 'forYou') {
                if (status.didJustFinish || progress >= 0.95 || nearEnd) {
                  if (!requestedNextIds.current.has(videoId)) {
                    requestedNextIds.current.add(videoId);
                    await fetchNextClip(1);
                  }
                }
              }
            } catch (err) {
              console.error('Error checking next clip:', err);
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
    // Stop watch time
    if (currentStartTime.current !== null) {
      currentWatchedTime.current += Date.now() - currentStartTime.current;
      console.log('⏸️ Stopped tracking, total watched:', (currentWatchedTime.current / 1000).toFixed(1) + 's');
      currentStartTime.current = null;
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
        await trackLike(videoId, newLikedState);
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

      const currentClips = getCurrentClips();
      const videoId = currentClips[videoIndex]?.id;
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

      const currentClips = getCurrentClips();
      const videoId = currentClips[currentVideoIndex]?.id;
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
      const data = await response.json();
      
      if (response.ok) {
        if (data.error) {
          setSnackbarMessage(data.error);
          setSnackbarVisible(true);
          return;
        }
        setComments(prev => [data.comment, ...prev]);
        setNewComment('');
        await trackComment(videoId);
      } else {
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
    (async () => {
      if (viewableItems.length > 0) {
        // Find the item with the highest visibility percentage
        const mostVisibleItem = viewableItems.reduce((prev: any, current: any) => {
          return (prev.isViewable && current.isViewable && current.itemVisiblePercent > prev.itemVisiblePercent) ? current : prev;
        });

        const newIndex = mostVisibleItem.index;

        console.log('👁️ Viewable change - newIndex:', newIndex, 'playingIndexRef:', playingIndexRef.current);

        // Only proceed if this is a different video
        if (newIndex !== playingIndexRef.current) {
          console.log('📹 VIDEO CHANGE DETECTED from', playingIndexRef.current, 'to', newIndex);
          
          // FIRST: Stop tracking for the previous video to accumulate watch time
          const prevIndex = playingIndexRef.current;
          if (prevIndex >= 0) {
            stopProgressUpdates(prevIndex);
          }
          
          // NOW: Track final watch percentage for the previous video
          const clipsSnapshot = currentClipsRef.current; // Use ref instead of getCurrentClips()
          console.log('🔍 prevIndex:', prevIndex, 'prevIndex >= 0:', prevIndex >= 0);
          if (prevIndex >= 0) {
            const prevVideoRef = videoRefs.current[prevIndex];
            const prevClip = clipsSnapshot[prevIndex];
            console.log('🔍 prevVideoRef exists:', !!prevVideoRef, 'prevClip exists:', !!prevClip, 'prevClip:', prevClip);
            if (prevVideoRef && prevClip) {
              try {
                console.log('🔍 Getting video status...');
                const status = await prevVideoRef.getStatusAsync();
                console.log('🔍 Status:', {
                  isLoaded: status.isLoaded,
                  durationMillis: 'durationMillis' in status ? status.durationMillis : 'N/A',
                  currentWatchedTime: currentWatchedTime.current
                });
                if (status.isLoaded && 'durationMillis' in status && status.durationMillis && status.durationMillis > 0) {
                  const duration = status.durationMillis / 1000;
                  const watchedSeconds = currentWatchedTime.current / 1000;
                  const finalProgress = Math.min(watchedSeconds / duration, 1);
                  const prevVideoId = clipsSnapshot[prevIndex]?.id;
                  console.log('🔍 Calculated:', {
                    duration,
                    watchedSeconds,
                    finalProgress,
                    prevVideoId,
                    'finalProgress > 0': finalProgress > 0
                  });
                  if (prevVideoId && finalProgress > 0) {
                    const metricsToSend = [{
                      videoId: prevVideoId,
                      categories: clipsSnapshot[prevIndex]?.categories || [],
                      watchPercentage: Math.round(finalProgress * 100),
                      liked: likedArr[prevIndex] || false,
                      commented: false
                    }];
                    
                    console.log('📹 VIDEO CHANGE: Sending metrics for video:', prevVideoId, 'watch:', Math.round(finalProgress * 100) + '%');
                    await sendMetricsDirect(metricsToSend);
                  } else {
                    console.log('❌ Not sending: prevVideoId:', prevVideoId, 'finalProgress:', finalProgress);
                  }
                } else {
                  console.log('❌ Video not loaded or no duration');
                }
              } catch (error) {
                console.error('Error getting status on video change:', error);
              }
            } else {
              console.log('❌ prevVideoRef or prevClip missing');
            }
          } else {
            console.log('❌ prevIndex < 0');
          }

          // Reset tracking for new video
          currentWatchedTime.current = 0;
          currentStartTime.current = null;
          currentVideoMetric.current = null;

          playingIndexRef.current = newIndex; // Update ref immediately
          setPlayingIndex(newIndex);
          setIsPlayingArr(arr => arr.map((_, i) => i === newIndex));
          if (progressAnimations.current[newIndex]) {
            progressAnimations.current[newIndex].setValue(0);
          }
          
          // Stop progress updates for all other videos
          progressUpdateIntervals.current.forEach((_, i) => {
            if (i !== newIndex) {
              stopProgressUpdates(i);
            }
          });
          
          // Ensure all videos are properly paused/played
          videoRefs.current.forEach((ref, i) => {
            if (ref) {
              if (i === newIndex) {
                ref.playAsync().then(() => {
                  console.log('▶️ Started playing video at index:', newIndex);
                  // Start tracking AFTER the video starts playing
                  startProgressUpdates(newIndex);
                });
              } else {
                ref.pauseAsync();
              }
            }
          });
          
          // Only prefetch next clip if on "For You" page
          if (selectedPage === 'forYou') {
            try {
              const newVideoId = clipsSnapshot[newIndex]?.id;
              if (newVideoId && !requestedNextIds.current.has(newVideoId)) {
                requestedNextIds.current.add(newVideoId);
                fetchNextClip(1).catch((err) => console.error('Prefetch failed:', err));
              }
            } catch (err) {
              console.error('Error prefetching:', err);
            }
          }
        }
      }
    })();
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
          {index === playingIndex && (
            <>
              <Text style={[styles.captionText, { fontSize: 12, marginTop: 5 }]}>
                Watched: {(displayWatchedTime / 1000).toFixed(1)}s
              </Text>
              <Text style={[styles.captionText, { fontSize: 11, marginTop: 3, color: '#FFD700' }]}>
                Video ID: {item.id}
              </Text>
              <Text style={[styles.captionText, { fontSize: 11, marginTop: 2, color: '#90EE90' }]}>
                Categories: {item.categories?.join(', ') || 'None'}
              </Text>
              <Text style={[styles.captionText, { fontSize: 11, marginTop: 2, color: '#87CEEB' }]}>
                Page: {selectedPage}
              </Text>
            </>
          )}
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
        keyExtractor={(item, index) => `${item.id}-${index}`}
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
            keyExtractor={(item, index) => `comment-${item.id}-${index}`}
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
