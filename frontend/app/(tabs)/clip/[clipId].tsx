import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions, Modal, FlatList, TextInput, Share, Switch, TouchableWithoutFeedback } from 'react-native';
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
  const router = useRouter();
  const videoRef = useRef<any>(null);
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
    // clipUrl may be passed via params from the grid; if missing, fetch it by id
    if (clipUrl) {
      setLoading(false);
      // load likes and comments for this clip
      fetchLikesAndComments();
      return;
    }
    const fetchClip = async () => {
      try {
        const res = await fetch(`${backendUrl}/features/getClip/?id=${clipId}`);
        const data = await res.json();
        if (res.ok && data.clip) {
          setClip(data.clip);
        }
      } catch (e) {
        console.log('Error fetching clip', e);
      }
      setLoading(false);
    };
    fetchClip().then(() => fetchLikesAndComments());
  }, [clipId]);

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

  const goBackToProfile = () => {
    // Prefer an explicit uploader/user id passed via params (when navigated from profile    
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
                      const position = status.positionMillis || 0;
                      const duration = status.durationMillis || 0;
                      const p = duration > 0 ? position / duration : 0;
                      setProgress(p);
                    }
                  } catch (e) {}
                }}
              />
            </TouchableWithoutFeedback>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${Math.round((progress || 0) * 100)}%` }]} />
            </View>
          </View>
        ) : (
          <Text style={{ color: 'white' }}>Clip not found</Text>
        )}
      </View>

      {/* caption / info bar (matching home) */}
      <View style={styles.captionContainer}>
        <Text numberOfLines={2} style={styles.captionText}>{clip?.caption || ''}</Text>
      </View>

      {/* action column (match home screen styles) */}
      <SafeAreaView style={styles.featureButtonsContainer} pointerEvents="box-none">
        <TouchableOpacity style={styles.featureButton} onPress={async () => {
          try {
            const token = await AsyncStorage.getItem('accessToken');
            if (!token) return;
            if (!liked) {
              const res = await fetch(`${backendUrl}/features/likeVideo/`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ video_id: clipId || clip?.id }) });
              if (res.ok) { setLiked(true); setLikesCount(c => c + 1); }
            } else {
              const res = await fetch(`${backendUrl}/features/unlikeVideo/`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ video_id: clipId || clip?.id }) });
              if (res.ok) { setLiked(false); setLikesCount(c => Math.max(0, c - 1)); }
            }
          } catch (e) { console.log('Like error', e); }
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
      <Modal visible={shareModalVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9fa' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomColor: '#e0e0e0', borderBottomWidth: 1, backgroundColor: '#fff' }}>
            <TouchableOpacity onPress={() => { setShareModalVisible(false); setShareStep('menu'); }} style={{ padding: 8 }}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111' }}>Send to followers</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 12 }}>
            <Text style={{ fontSize: 14, color: '#666', marginBottom: 12, paddingHorizontal: 4 }}>Select followers to share this clip:</Text>
            <FlatList 
              data={followersList} 
              keyExtractor={(it) => String(it.user_id || it.id || it.username)} 
              onEndReachedThreshold={0.1}
              scrollEnabled={followersList.length > 4}
              renderItem={({ item }) => {
                const id = String(item.user_id || item.id || item.username);
                const isSelected = !!selectedFollowers[id];
                return (
                  <TouchableOpacity 
                    onPress={() => setSelectedFollowers(prev => ({ ...prev, [id]: !prev[id] }))}
                    style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      paddingVertical: 12, 
                      paddingHorizontal: 12, 
                      marginBottom: 8, 
                      backgroundColor: isSelected ? '#e3f2fd' : '#fff',
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: isSelected ? '#4F8EF7' : '#e0e0e0'
                    }}
                  >
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#ddd', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: '#666' }}>
                        {(item.name || item.username).charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '600', fontSize: 15, color: '#111' }}>{item.name || item.username}</Text>
                      <Text style={{ fontSize: 13, color: '#999', marginTop: 2 }}>@{item.username}</Text>
                    </View>
                    <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: isSelected ? '#4F8EF7' : '#ddd', backgroundColor: isSelected ? '#4F8EF7' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              }} 
            />
          </View>

          <View style={{ paddingHorizontal: 16, paddingBottom: 20, paddingTop: 12, borderTopColor: '#e0e0e0', borderTopWidth: 1, backgroundColor: '#fff', flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity 
              style={{ flex: 1, backgroundColor: '#f0f0f0', paddingVertical: 13, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center' }} 
              onPress={() => { setShareModalVisible(false); setShareStep('menu'); }}
            >
              <Text style={{ fontWeight: '700', color: '#333', fontSize: 15 }}>Cancel</Text>
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
                        await fetch(`${backendUrl}/chat/sendMessage/`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ room_id: roomId, content: '', video_id: clipId || clip?.id }) });
                      }
                    } catch (e) { console.log('Error creating room/sending', e); }
                  }
                } catch (e) { console.log('Share to followers error', e); }
                setSharing(false);
                setShareModalVisible(false);
                setSelectedFollowers({});
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{sharing ? 'Sending...' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { height: 56, justifyContent: 'center', paddingHorizontal: 12 },
  headerOverlay: { position: 'absolute', top: 12, left: 12, zIndex: 20 },
  backBtn: { padding: 8 },
  videoContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  video: { width: '100%', height: '100%' },
  captionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, backgroundColor: 'rgba(0,0,0,0.6)' },
  captionText: { color: 'white', fontSize: 14 },
  actionColumn: { position: 'absolute', right: 12, bottom: 120, alignItems: 'center' },
  actionItem: { marginBottom: 18, alignItems: 'center' },
  progressBarBg: {
    position: 'absolute',
    bottom: 110,
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
    bottom: 150,
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
    bottom: 210,
    left: 16,
    right: 80,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 8,
    padding: 8,
  },
});
