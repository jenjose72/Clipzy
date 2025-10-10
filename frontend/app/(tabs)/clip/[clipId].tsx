import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions, Modal, FlatList, TextInput, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
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
  const [progress, setProgress] = useState<number>(0);

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
      const commentsRes = await fetch(`${backendUrl}/features/getComments/?videoId=${vid}`, { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
      if (commentsRes.ok) {
        const cdata = await commentsRes.json();
        setComments(cdata.comments || []);
      }
    } catch (e) {
      console.log('Error loading likes/comments', e);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerOverlay}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.videoContainer}>
        {loading ? (
          <ActivityIndicator size="large" color="#fff" />
        ) : clipUrl || clip ? (
          <View style={{ width: window.width, height: window.height }}>
            <Video
              ref={videoRef}
              source={{ uri: clipUrl || clip?.clipUrl }}
              style={{ width: window.width, height: window.height }}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={isPlaying}
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

        <TouchableOpacity style={styles.featureButton} onPress={async () => { try { await Share.share({ message: clipUrl || clip?.clipUrl }); } catch(e){console.log(e)} }}>
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
                const res = await fetch(`${backendUrl}/features/addComment/`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ video_id: vid, content: newComment }) });
                if (res.ok) {
                  setNewComment('');
                  await fetchLikesAndComments();
                }
              } catch (e) { console.log('Post comment error', e); }
            }} style={{ marginLeft: 8, justifyContent: 'center' }}>
              <Text style={{ color: '#4F8EF7' }}>Post</Text>
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
