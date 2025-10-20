import React, { useEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions, Modal, FlatList, TextInput, Share, Switch, TouchableWithoutFeedback, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { Snackbar } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, Fontisto, Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { backendUrl } from '@/constants/Urls';

export default function ClipScreen() {
  const params: any = useLocalSearchParams();
  const clipId = params.clipId;
  const clipUrl = params.clipUrl;
  const caption = params.caption || ''; // Get caption from params
  const router = useRouter();
  const videoRef = useRef<any>(null);
  const isFocused = useIsFocused();
  const [clip, setClip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const window = Dimensions.get('window');
  const [likesCount, setLikesCount] = useState<number>(0);
  const [liked, setLiked] = useState<boolean>(false);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [progress, setProgress] = useState<number>(0);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [followersList, setFollowersList] = useState<any[]>([]);
  const [selectedFollowers, setSelectedFollowers] = useState<Record<string, boolean>>({});
  const [sharing, setSharing] = useState(false);
  const [shareStep, setShareStep] = useState<'menu'|'followers'>('menu');

  const loadFollowers = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const res = await fetch(`${backendUrl}/chat/getChats/`, { method: 'GET', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
      const data = await res.json();
      const following = data.following || [];
      setFollowersList(following);
      const sel: Record<string, boolean> = {};
      following.forEach((f: any) => { sel[String(f.user_id || f.id || f.username)] = false; });
      setSelectedFollowers(sel);
    } catch (e) { console.log('Error fetching following', e); }
  };

  useEffect(() => {
    // Always fetch clip data to get caption and other metadata
    const fetchClip = async () => {
      try {
        const res = await fetch(`${backendUrl}/features/getClip/?id=${clipId}`);
        const data = await res.json();
        if (res.ok && data.clip) {
          setClip(data.clip);
          console.log('Clip data loaded:', data.clip);
          console.log('Caption from API:', data.clip.caption);
        }
      } catch (e) {
        console.log('Error fetching clip', e);
      }
      setLoading(false);
    };
    
    if (clipId) {
      console.log('Fetching clip with ID:', clipId);
      console.log('Caption from params:', caption);
      fetchClip().then(() => fetchLikesAndComments());
    } else {
      setLoading(false);
    }
  }, [clipId]);

  // Ensure video is paused/unloaded when leaving the screen or when component unmounts
  useEffect(() => {
    return () => {
      (async () => {
        try {
          if (videoRef?.current) {
            // pause but keep loaded so user can return and resume
            await videoRef.current.pauseAsync().catch(() => {});
          }
        } catch (e) {
          // swallow errors
        }
      })();
    };
  }, []);

  // Pause/unload when screen loses focus (handles navigation that keeps component mounted)
  useEffect(() => {
    (async () => {
      try {
        if (!isFocused && videoRef?.current) {
          await videoRef.current.pauseAsync().catch(() => {});
          setIsPlaying(false);
        } else if (isFocused && videoRef?.current) {
          // try to resume playback when regaining focus
          try {
            await videoRef.current.playAsync().catch(() => {});
            setIsPlaying(true);
          } catch (e) {
            // ignore
          }
        }
      } catch (e) {
        // ignore
      }
    })();
  }, [isFocused]);

  // Attempt autoplay when the clip/URL is ready and the screen is focused
  useEffect(() => {
    (async () => {
      try {
        if (!loading && isFocused && videoRef?.current) {
          await videoRef.current.playAsync().catch(() => {});
          setIsPlaying(true);
        }
      } catch (e) {
        // ignore
      }
    })();
  }, [loading, isFocused]);

  const fetchLikesAndComments = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const vid = clipId || clip?.id;
      if (!vid) return;

      // likes
      const likesRes = await fetch(`${backendUrl}/features/getLikes/?videoId=${vid}`, { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
      if (likesRes.ok) {
        const data = await likesRes.json();
        setLikesCount(data.likesCount || 0);
      }

      // whether current user liked
      if (token) {
        const likedRes = await fetch(`${backendUrl}/features/getLikedVideos/`, { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
        if (likedRes.ok) {
          const likedData = await likedRes.json();
          const likedIds = (likedData.liked_videos || []).map((v: any) => v.id);
          setLiked(likedIds.includes(Number(vid)));
        }
      }

      // comments
      const commentsRes = await fetch(`${backendUrl}/comments/getComments/?videoId=${vid}`, { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
      if (commentsRes.ok) {
        const cdata = await commentsRes.json();
        setComments(cdata.comments || []);
      }
    } catch (e) {
      console.log('Error loading likes/comments', e);
    }
  };

  const goBackToProfile = async () => {
    // Pause/unload video before navigating away to ensure playback stops
    try {
      if (videoRef?.current) {
        await videoRef.current.pauseAsync().catch(() => {});
      }
    } catch (e) {}
    // Prefer an explicit uploader/user id passed via params (when navigated from profile)
    router.push(`/(tabs)/profile`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerOverlay}>
        <TouchableOpacity onPress={goBackToProfile} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.videoContainer}>
        {loading ? (
          <ActivityIndicator size="large" color="#fff" />
        ) : clipUrl || clip ? (
          <View style={{ width: window.width, height: window.height }}>
            <TouchableWithoutFeedback onPress={async () => {
              try {
                // toggle play state
                const newState = !isPlaying;
                setIsPlaying(newState);
                // also control the player directly for immediate response
                if (videoRef?.current) {
                  if (newState) await videoRef.current.playAsync().catch(() => {});
                  else await videoRef.current.pauseAsync().catch(() => {});
                }
              } catch (e) {}
            }}>
              <Video
                ref={videoRef}
                source={{ uri: clipUrl || clip?.clipUrl }}
                style={{ width: window.width, height: window.height }}
                useNativeControls={false}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={isPlaying}
                isLooping
                onPlaybackStatusUpdate={(status) => {
                  try {
                    if (status && status.isLoaded) {
                      // @ts-ignore
                      setIsPlaying(!!status.isPlaying);
                    }
                  } catch (e) {}
                }}
              />
            </TouchableWithoutFeedback>
          </View>
        ) : (
          <Text style={{ color: 'white' }}>Clip not found</Text>
        )}
      </View>

      {/* caption / info bar (matching home) */}
      <View style={styles.captionContainer}>
        <Text numberOfLines={2} style={styles.captionText}>
          {caption || clip?.caption || 'No caption available'}
        </Text>
      </View>

      {/* action column (match home screen styles) */}
      <SafeAreaView style={styles.featureButtonsContainer} pointerEvents="box-none">
        <TouchableOpacity style={styles.featureButton} onPress={async () => {
          try {
            const token = await AsyncStorage.getItem('accessToken');
            if (!token) return;
            
            const vid = clipId || clip?.id;
            const newLikedState = !liked;
            
            console.log(`[ClipDetail] Toggling like for video ${vid}: ${liked} -> ${newLikedState}`);
            
            // Optimistically update UI immediately
            setLiked(newLikedState);
            setLikesCount(c => newLikedState ? c + 1 : Math.max(0, c - 1));
            
            // Then make API call
            if (newLikedState) {
              const res = await fetch(`${backendUrl}/features/addLikes/`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
                body: JSON.stringify({ video_id: vid }) 
              });
              if (!res.ok) {
                console.log('[ClipDetail] Like API failed, reverting');
                setLiked(!newLikedState);
                setLikesCount(c => Math.max(0, c - 1));
              }
            } else {
              const res = await fetch(`${backendUrl}/features/unlikeVideo/`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
                body: JSON.stringify({ video_id: vid }) 
              });
              if (!res.ok) {
                console.log('[ClipDetail] Unlike API failed, reverting');
                setLiked(!newLikedState);
                setLikesCount(c => c + 1);
              }
            }
          } catch (e) { 
            console.log('Like error', e);
            // Revert on error
            setLiked(!liked);
            setLikesCount(c => liked ? c + 1 : Math.max(0, c - 1));
          }
        }}>
          <Ionicons name={liked ? "heart" : "heart-outline"} size={32} color={liked ? '#E91E63' : 'white'} />
          <Text style={{ color: 'white', marginTop: 6 }}>{likesCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.featureButton} onPress={async () => { await fetchLikesAndComments(); setCommentsVisible(true); }}>
          <Fontisto name="comment" size={24} color="white" />
          <Text style={{ color: 'white', marginTop: 6 }}>{comments.length}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.featureButton} onPress={async () => { await loadFollowers(); setShareModalVisible(true); }}>
          <Feather name="share" size={28} color="white" />
          <Text style={{ color: 'white', marginTop: 6 }}>Share</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* comments modal (basic) */}
      <Modal visible={commentsVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomColor: '#222', borderBottomWidth: 1 }}>
            <TouchableOpacity onPress={() => setCommentsVisible(false)} style={{ padding: 8 }}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: 'white', fontSize: 18, marginLeft: 8 }}>Comments</Text>
          </View>
          <FlatList data={comments} keyExtractor={(it) => String(it.id)} renderItem={({ item }) => (
            <View style={{ padding: 12, borderBottomColor: '#222', borderBottomWidth: 1 }}>
              <Text style={{ color: 'white', fontWeight: '600' }}>{item.user}</Text>
              <Text style={{ color: 'white', marginTop: 6 }}>{item.comment}</Text>
            </View>
          )} />
          <View style={{ flexDirection: 'row', padding: 12, borderTopColor: '#222', borderTopWidth: 1 }}>
            <TextInput value={newComment} onChangeText={setNewComment} placeholderTextColor="#888" placeholder="Write a comment..." style={{ flex: 1, color: 'white', backgroundColor: '#111', padding: 8, borderRadius: 8 }} />
            <TouchableOpacity onPress={async () => {
              try {
                const token = await AsyncStorage.getItem('accessToken');
                const vid = clipId || clip?.id;
                const res = await fetch(`${backendUrl}/comments/addComment/`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ video_id: vid, content: newComment }) });
                const data = await res.json().catch(() => null);
                if (res.ok) {
                  if (data?.error) {
                    // backend may classify and reject the comment
                    const msg = data.error || 'Comment rejected';
                    setSnackbarMessage(msg);
                    setSnackbarVisible(true);
                    return;
                  }
                  setNewComment('');
                  await fetchLikesAndComments();
                } else {
                  const errMsg = data?.error || data?.message || 'Failed to post comment';
                  setSnackbarMessage(errMsg);
                  setSnackbarVisible(true);
                }
              } catch (e) { console.log('Post comment error', e); setSnackbarMessage('Network error: failed to post comment'); setSnackbarVisible(true); }
            }} style={{ marginLeft: 8, justifyContent: 'center' }}>
              <Text style={{ color: '#4F8EF7' }}>Post</Text>
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
        </SafeAreaView>
      </Modal>

      {/* share modal */}
      <Modal visible={shareModalVisible} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: Dimensions.get('window').height * 0.6 }}>
            <SafeAreaView>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomColor: '#333', borderBottomWidth: 1 }}>
                <TouchableOpacity onPress={() => { setShareModalVisible(false); setShareStep('menu'); }} style={{ padding: 8 }}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>Send to followers</Text>
                <View style={{ width: 40 }} />
              </View>

              <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
                <Text style={{ fontSize: 14, color: '#aaa', marginBottom: 16 }}>Select followers to share this clip:</Text>
                <FlatList 
                  data={followersList} 
                  keyExtractor={(it) => String(it.user_id || it.id || it.username)} 
                  numColumns={2}
                  columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 20 }}
                  scrollEnabled={followersList.length > 4}
                  renderItem={({ item }) => {
                    const id = String(item.user_id || item.id || item.username);
                    const isSelected = !!selectedFollowers[id];
                    const profilePicUrl = item.profile_picture_url || item.profile_pic || item.profilePic;
                    const fullProfilePicUrl = profilePicUrl ? (profilePicUrl.startsWith('http') ? profilePicUrl : `${backendUrl}${profilePicUrl}`) : null;
                    console.log('[ClipDetail] Profile pic for', item.username, ':', fullProfilePicUrl);
                    
                    return (
                      <TouchableOpacity 
                        onPress={() => setSelectedFollowers(prev => ({ ...prev, [id]: !prev[id] }))}
                        style={{ 
                          alignItems: 'center',
                          width: '48%',
                          opacity: isSelected ? 1 : 0.6
                        }}
                      >
                        <View style={{ position: 'relative' }}>
                          {fullProfilePicUrl ? (
                            <Image 
                              source={{ uri: fullProfilePicUrl }} 
                              style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: isSelected ? '#4F8EF7' : '#444' }}
                            />
                          ) : (
                            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: isSelected ? '#4F8EF7' : '#444' }}>
                              <Text style={{ fontSize: 28, fontWeight: '700', color: '#fff' }}>
                                {(item.name || item.username).charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                          {isSelected && (
                            <View style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: '#4F8EF7', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#1a1a1a' }}>
                              <Ionicons name="checkmark" size={14} color="#fff" />
                            </View>
                          )}
                        </View>
                        <Text style={{ fontWeight: '600', fontSize: 14, color: '#fff', marginTop: 8, textAlign: 'center' }} numberOfLines={1}>
                          {item.name || item.username}
                        </Text>
                      </TouchableOpacity>
                    );
                  }} 
                />
              </View>

              <View style={{ paddingHorizontal: 16, paddingBottom: 20, paddingTop: 12, borderTopColor: '#333', borderTopWidth: 1, flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity 
                  style={{ flex: 1, backgroundColor: '#2a2a2a', paddingVertical: 13, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center' }} 
                  onPress={() => { setShareModalVisible(false); setShareStep('menu'); }}
                >
                  <Text style={{ fontWeight: '700', color: '#fff', fontSize: 15 }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={{ 
                    flex: 1, 
                    backgroundColor: '#4F8EF7', 
                    paddingVertical: 13, 
                    paddingHorizontal: 16, 
                    borderRadius: 10, 
                    alignItems: 'center',
                    opacity: sharing ? 0.6 : 1
                  }} 
                  disabled={sharing || Object.values(selectedFollowers).every(v => !v)}
                  onPress={async () => {
                    try {
                      setSharing(true);
                      const token = await AsyncStorage.getItem('accessToken');
                      const selectedIds = Object.keys(selectedFollowers).filter(k => selectedFollowers[k]);
                      for (const sid of selectedIds) {
                        try {
                          const cr = await fetch(`${backendUrl}/chat/createRoom/`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ participant_id: sid }) });
                          const crd = await cr.json().catch(() => null);
                          const roomId = crd?.room_id;
                          if (roomId) {
                            await fetch(`${backendUrl}/chat/sendMessage/`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`,
                              },
                              body: JSON.stringify({
                                room_id: roomId,
                                content: '',
                                video_id: clipId || clip?.id,
                              }),
                            });
                          }
                        } catch (e) {
                          console.log('Error creating room/sending', e);
                        }
                      }
                    } catch (e) {
                      console.log('Share to followers error', e);
                    }
                    setSharing(false);
                    setShareModalVisible(false);
                    setSelectedFollowers({});
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                    {sharing ? 'Sending...' : 'Send'}
                  </Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  headerOverlay: { position: 'absolute', top: 12, left: 12, zIndex: 20 },
  backBtn: { padding: 8 },
  videoContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  featureButtonsContainer: {
    position: 'absolute',
    right: 5,
    bottom: 50,
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
    bottom: 30,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 8,
    padding: 8,
  },
  captionText: { color: 'white', fontSize: 14 },
});
