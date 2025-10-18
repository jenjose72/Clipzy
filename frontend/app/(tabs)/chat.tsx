import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { backendUrl } from '@/constants/Urls';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

const Chat = () => {
  const [chatRooms, setChatRooms] = useState<any[]>([]);
  const [followingUsers, setFollowingUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [failedAvatar, setFailedAvatar] = useState<Record<string, boolean>>({});
  const [avatarCache, setAvatarCache] = useState<Record<string, string | null>>({});
  const fetchingAvatars = React.useRef<Record<string, boolean>>({});
  const router = useRouter();

  const getChats = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const current = await AsyncStorage.getItem('user');
      // try to parse stored user and extract an id; AsyncStorage may store a JSON object
      let parsedCurrent: any = current;
      try {
        parsedCurrent = current ? JSON.parse(current) : current;
      } catch (e) {
        parsedCurrent = current;
      }
      const resolvedCurrentId = parsedCurrent && typeof parsedCurrent === 'object' ? (parsedCurrent.id || parsedCurrent.userId || parsedCurrent.user_id || parsedCurrent.pk || parsedCurrent) : parsedCurrent;
      setCurrentUserId(resolvedCurrentId ? String(resolvedCurrentId) : String(parsedCurrent || ''));
      const res = await fetch(`${backendUrl}/chat/getChats/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      // debug: log raw response to help diagnose duplicate rooms
      console.log('getChats response:', data);
      if (data.chat_rooms && data.chat_rooms.length > 0) {
        // attempt to enrich rooms if participants include ids
        const rooms = data.chat_rooms || [];
        const enrichedRooms = await Promise.all(rooms.map(async (room: any) => {
          const participants = room.participants || room.users || [];
          // if participants are objects with user_id, enrich them
          if (Array.isArray(participants) && participants.length > 0 && typeof participants[0] === 'object') {
            const others = await Promise.all(participants.map(async (p: any) => {
              try {
                if (p.user_id) {
                  const prof = await fetchProfileById(p.user_id);
                  return { ...p, profile_pic: prof?.profile_pic || prof?.profile_pic_url || null, name: prof?.name || prof?.username || p.username };
                }
              } catch (e) {}
              return p;
            }));
            return { ...room, participants: others };
          }
          return room;
        }));
        // Group rooms by the other participant so the UI shows one conversation per other user
        const convMap = new Map<string, any>();
        const isCurrent = (p: any) => {
          if (!p) return false;
          if (typeof p === 'object') {
            return String(p.user_id || p.id || p.username) === String(resolvedCurrentId) || String(p.username) === String(resolvedCurrentId);
          }
          return String(p) === String(resolvedCurrentId);
        };

        enrichedRooms.forEach((r: any) => {
          const parts = r.participants || r.users || [];
          const others = Array.isArray(parts) ? parts.filter((p: any) => !isCurrent(p)) : [];

          let key: string | null = null;
          if (others.length === 1) {
            const o = others[0];
            key = typeof o === 'object' ? `user_${String(o.user_id || o.id || o.username)}` : `user_${String(o)}`;
          } else if (others.length > 1) {
            const ids = others.map((p: any) => (typeof p === 'object' ? String(p.user_id || p.id || p.username) : String(p))).filter(Boolean).sort();
            key = `group_${ids.join('_')}`;
          } else {
            // fallback to room id
            key = r?.room_id ? `room_${String(r.room_id)}` : null;
          }

          if (!key) return;

          if (!convMap.has(key)) {
            convMap.set(key, r);
          } else {
            // pick most recent room (by last_message.timestamp if available) else higher room_id
            const existing = convMap.get(key);
            const t1 = r?.last_message?.timestamp ? Date.parse(String(r.last_message.timestamp)) : null;
            const t2 = existing?.last_message?.timestamp ? Date.parse(String(existing.last_message.timestamp)) : null;
            if (t1 && t2) {
              if (t1 > t2) convMap.set(key, r);
            } else if (t1 && !t2) {
              convMap.set(key, r);
            } else if (!t1 && !t2) {
              // fallback to room id (prefer larger id)
              if ((r.room_id || 0) > (existing.room_id || 0)) convMap.set(key, r);
            }
          }
        });

    const dedupedRooms = Array.from(convMap.values());
  console.log('dedupedRooms ids:', dedupedRooms.map((r: any) => r.room_id || 'no-id'), 'count:', dedupedRooms.length);
  try { console.log('dedupedRooms full:', JSON.stringify(dedupedRooms, null, 2)); } catch(e) {}
    // If backend didn't include last_message, fetch the latest message per room as a fallback
    const fetchLastForRoom = async (room: any) => {
      try {
        const resMsgs = await fetch(`${backendUrl}/chat/getMessages/${room.room_id}/`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });
        const dm = await resMsgs.json().catch(() => null);
        const msgs = dm?.messages || [];
        if (msgs.length > 0) {
          const last = msgs[msgs.length - 1];
          return { ...room, last_message: last };
        }
      } catch (e) {
        // ignore
      }
      return room;
    };

    let roomsWithMessages = await Promise.all(dedupedRooms.map(async (r: any) => {
      if (r?.last_message) return r;
      return await fetchLastForRoom(r);
    }));
    try { console.log('roomsWithMessages full:', JSON.stringify(roomsWithMessages, null, 2)); } catch(e) {}
  // sort rooms by latest message timestamp (newest first)
  const getRoomTimestamp = (r: any) => {
    const lm = r?.last_message || {};
    const candidates: any[] = [
      lm?.timestamp,
      lm?.created_at,
      lm?.time,
      lm?.sent_at,
      lm?.sentAt,
      lm?.updated_at,
      r?.updated_at,
      r?.last_updated,
      r?.modified,
    ];
    for (const ts of candidates) {
      if (!ts && ts !== 0) continue;
      // numeric timestamps (seconds or ms)
      if (typeof ts === 'number') {
        // Heuristic: if timestamp looks like seconds (10 digits), convert to ms
        if (ts < 1e12) return ts * 1000;
        return ts;
      }
      // try parsing string timestamps
      try {
        const parsed = Date.parse(String(ts));
        if (!isNaN(parsed)) return parsed;
      } catch (e) {}
    }
    return 0;
  };
  // create a new array copy before sorting to avoid mutating original unexpectedly
  // attach a computed timestamp on each room to make sorting and debugging easier
  const roomsWithTs = roomsWithMessages.map((r: any) => ({
    ...r,
    __last_ts: getRoomTimestamp(r),
  }));

  // debug: log timestamps to help troubleshoot ordering
  try {
    console.log('room timestamps:', roomsWithTs.map((r: any) => ({ id: r.room_id || null, ts: r.__last_ts, last_message: r.last_message })));
  } catch (e) {}

  const sortedRooms = roomsWithTs.sort((a: any, b: any) => {
    if (b.__last_ts !== a.__last_ts) return b.__last_ts - a.__last_ts;
    // stable fallback: prefer room with larger room_id
    return (b.room_id || 0) - (a.room_id || 0);
  });

  setChatRooms(sortedRooms);
        // if backend also returned a following list, set it (will be filtered client-side)
        if (data.following && data.following.length > 0) {
          // dedupe following by user_id using a map
          const fMap = new Map<string, any>();
          (data.following || []).forEach((u: any) => {
            const k = u?.user_id ? String(u.user_id) : (u?.username ? String(u.username) : null);
            if (k) fMap.set(k, u);
          });
          const fvals = Array.from(fMap.values());
          try { console.log('dedupedFollowing full:', JSON.stringify(fvals, null, 2)); } catch(e) {}
          setFollowingUsers(fvals);
        } else {
          setFollowingUsers([]);
        }
      } else if (data.following && data.following.length > 0) {
        // enrich following users with profile pic where possible
        const following = data.following || [];
        const enriched = await Promise.all(following.map(async (u: any) => {
          try {
            if (u.user_id) {
              const prof = await fetchProfileById(u.user_id);
              return { ...u, profile_pic: prof?.profile_pic || prof?.profile_pic_url || null, name: prof?.name || prof?.username || u.username };
            }
          } catch (e) {}
          return u;
        }));
        const fMap = new Map<string, any>();
        enriched.forEach((u: any) => {
          const k = u?.user_id ? String(u.user_id) : (u?.username ? String(u.username) : null);
          if (k) fMap.set(k, u);
        });
  const fvals = Array.from(fMap.values());
  try { console.log('enrichedFollowing full:', JSON.stringify(fvals, null, 2)); } catch(e) {}
  setFollowingUsers(fvals);
        setChatRooms([]);
      }
    } catch (e) {
      setChatRooms([]);
      setFollowingUsers([]);
    }
    setLoading(false);
  };

  // debug: log fetched rooms so we can inspect profile_pic fields in the app logs
  useEffect(() => {
    console.log('chatRooms updated:', chatRooms);
  }, [chatRooms]);

  useEffect(() => {
    console.log('followingUsers updated:', followingUsers);
  }, [followingUsers]);

  // helper: format timestamp (ms) to relative "time ago" string
  const formatTimeAgo = (ts?: number | null) => {
    if (!ts) return '';
    const now = Date.now();
    const diff = Math.max(0, now - Number(ts));
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    const days = Math.floor(hr / 24);
    if (days < 7) return `${days}d`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo`;
    const years = Math.floor(days / 365);
    return `${years}y`;
  };

  const fetchProfileById = async (userId: number | string) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const res = await fetch(`${backendUrl}/accounts/getOtherProfile/?user_id=${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        // some endpoints return { profile: {...} } and others return the object directly
        return data?.profile || data || null;
      }
    } catch (e) {
      return null;
    }
    return null;
  };

  // initialize current user id and username for robust participant matching
  useEffect(() => {
    const initUser = async () => {
      try {
        const raw = await AsyncStorage.getItem('user');
        if (!raw) return;
        let parsed: any = raw;
        try { parsed = JSON.parse(raw); } catch (e) { parsed = raw; }
        const id = parsed && typeof parsed === 'object' ? (parsed.id || parsed.userId || parsed.user_id || parsed.pk || parsed) : parsed;
        const username = parsed && typeof parsed === 'object' ? (parsed.username || parsed.user || null) : null;
        if (id) setCurrentUserId(String(id));
        if (username) setCurrentUsername(String(username));
      } catch (e) {}
    };
    initUser();
    getChats();
  }, []);

  const sendMessageToRoom = async (roomId: number, content: string, videoId?: number) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const res = await fetch(`${backendUrl}/chat/sendMessage/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          room_id: roomId,
          content,
          ...(videoId ? { video_id: videoId } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        return data; // Message object
      } else {
        throw new Error(data.error || 'Failed to send message');
      }
    } catch (e) {
      // Optionally handle error
      return null;
    }
  };

  const renderRoom = ({ item }: { item: any }) => {
    // participants may be objects or usernames. Try to find the other participant.
    const participants = item.participants || item.users || [];
    
    let other: any = null;
    if (Array.isArray(participants) && participants.length > 0) {
      const isCurrent = (p: any) => {
        if (!p) return false;
        if (typeof p === 'object') {
          const pid = String(p.user_id || p.id || '');
          const pun = String(p.username || '');
          return (currentUserId && (pid === String(currentUserId) || pun === String(currentUserId))) || (currentUsername && (pun === String(currentUsername)));
        }
        // p is a string username or id
        return (currentUserId && String(p) === String(currentUserId)) || (currentUsername && String(p) === String(currentUsername));
      };

      if (typeof participants[0] === 'object') {
        other = participants.find((p: any) => !isCurrent(p)) || participants[0];
      } else {
        const username = participants.find((u: any) => {
          if (currentUsername) return String(u) !== String(currentUsername);
          if (currentUserId) return String(u) !== String(currentUserId);
          return true;
        }) || participants[0];
        other = { username };
      }
    }
  // allow fallback to avatarCache when the initial participant object didn't include profile_pic
  const avatar = other?.profile_pic || other?.avatar || (other?.user_id ? avatarCache[String(other.user_id)] : null) || null;
    // normalize avatar URL: backend may return relative paths
    let avatarUrl: string | null = null;
    if (avatar) {
      const s = String(avatar);
        const trimmed = s.trim();
        avatarUrl = trimmed.startsWith('http') ? trimmed : `${backendUrl}${trimmed}`;
    }
    try { console.log('renderRoom other:', JSON.stringify(other), 'avatarUrl:', avatarUrl); } catch(e) {}

    // If there's no avatar but we have an id and haven't fetched it yet, fetch profile for this participant
    if (!avatarUrl && other?.user_id && !fetchingAvatars.current[String(other.user_id)]) {
      fetchingAvatars.current[String(other.user_id)] = true;
      (async () => {
        try {
          const prof = await fetchProfileById(other.user_id);
          const url = prof?.profile_pic || prof?.profile_pic_url || null;
          setAvatarCache(prev => ({ ...prev, [String(other.user_id)]: url }));
          try { console.log('fetched avatar for', other.user_id, url); } catch (e) {}
        } catch (e) {
          try { console.log('failed fetch avatar for', other.user_id, e); } catch (e) {}
        }
      })();
    }
    const displayName = other?.name || other?.username || other?.display_name || `Room ${item.room_id}`;
    // Derive a short preview text for the last message from several possible fields.
    // This extractor searches common keys, handles nested objects, and falls back to the
    // first short string leaf it can find. It also returns a clip placeholder when the
    // last message contains a video id.
    const deriveLastMessage = (it: any) => {
      // only inspect explicit last_message-like objects. Avoid falling back to the whole room
      // object because that often contains participant usernames which were being returned
      // as the "preview". If there's no last_message, return empty string.
      const lm = it?.last_message ?? it?.lastMessage ?? it?.last ?? null;
      if (!lm) return '';

      // If the last message contains a video reference, show a friendly label
      const hasVideo = (obj: any) => {
        if (!obj) return false;
        if (obj.video_id || obj.video || obj.videoId || obj.video_url || obj.videoUrl) return true;
        if (obj?.type === 'video' || obj?.kind === 'video') return true;
        return false;
      };
      if (hasVideo(lm)) {
        try { console.log('deriveLastMessage: detected video in last_message', lm); } catch (e) {}
        return 'Shared a clip';
      }

      // If lm is a primitive string, return it
      if (typeof lm === 'string') return lm;

      // prioritized keys to check (shallow)
      const keys = ['content','text','message','body','preview','summary','caption','note'];
      for (const k of keys) {
        try {
          const val = lm[k];
          if (val || val === '') {
            if (typeof val === 'string' && val.trim() !== '') return val.trim();
            if (typeof val === 'object' && val !== null) {
              // sometimes val is { text: '...' }
              if (typeof val.text === 'string' && val.text.trim() !== '') return val.text.trim();
              if (typeof val.content === 'string' && val.content.trim() !== '') return val.content.trim();
            }
          }
        } catch (e) {}
      }

      // deep-search: find first short string leaf (BFS) to avoid huge payloads
      try {
        const queue = [lm];
        while (queue.length) {
          const node = queue.shift();
          if (!node) continue;
          if (typeof node === 'string' && node.trim() !== '') {
            const s = node.trim();
            if (s.length <= 200) return s;
          }
          if (typeof node === 'object') {
            for (const v of Object.values(node)) {
              if (typeof v === 'string' && v.trim() !== '') {
                const s = v.trim();
                if (s.length <= 200) return s;
              }
              if (typeof v === 'object' && v !== null) queue.push(v);
            }
          }
        }
      } catch (e) {}

      // last resort: stringify small object
      try {
        const nested = JSON.stringify(lm);
        if (nested && nested.length < 200) return nested;
      } catch (e) {}
      try { console.log('deriveLastMessage: no preview found for last_message', lm); } catch (e) {}
      return '';
    };

    const lastMessage = deriveLastMessage(item);

    // If there's no avatarUrl, generate an initials avatar so the tile still shows an image
    if (!avatarUrl) {
      try {
  const initials = encodeURIComponent((displayName || '').split(' ').slice(0,2).map((s: string) => s.charAt(0)).join(''));
        avatarUrl = `https://ui-avatars.com/api/?name=${initials}&background=E9EDF8&color=3b82f6&size=128`;
      } catch (e) {
        avatarUrl = null;
      }
    }

    // compute timestamp: prefer computed __last_ts (set in getChats), fall back to last_message fields
    const tsCandidates = item?.__last_ts ? Number(item.__last_ts) : null;
    let lastTs = tsCandidates;
    if (!lastTs) {
      const lm = item?.last_message || item?.lastMessage || item?.last || {};
      const maybe = lm?.timestamp || lm?.created_at || lm?.time || lm?.sent_at || lm?.sentAt || lm?.updated_at || item?.updated_at || item?.last_updated || item?.modified;
      if (maybe) {
        if (typeof maybe === 'number') {
          lastTs = maybe < 1e12 ? maybe * 1000 : maybe;
        } else {
          const parsed = Date.parse(String(maybe));
          if (!isNaN(parsed)) lastTs = parsed;
        }
      }
    }
    const timeLabel = lastTs ? formatTimeAgo(lastTs) : '';

    return (
      <TouchableOpacity style={styles.roomCard} onPress={() => router.push(`/(tabs)/chatRoom/${item.room_id}`)}>
        <View style={styles.roomCardTouchable}>
          {avatarUrl && !failedAvatar[`room_${item.room_id}`] ? (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatar}
              resizeMode="cover"
              onError={(e) => {
                console.log('avatar load failed for room', item.room_id, 'url:', avatarUrl, 'error:', e.nativeEvent || e);
                setFailedAvatar(prev => ({ ...prev, [`room_${item.room_id}`]: true }));
              }}
            />
          ) : (
            <View style={styles.avatarPlaceholder}><Text style={styles.avatarInitials}>{(displayName || '').charAt(0).toUpperCase()}</Text></View>
          )}

          <View style={styles.roomText}>
            <Text style={styles.roomName} numberOfLines={1}>{displayName}</Text>
            {lastMessage ? <Text style={styles.roomSnippet} numberOfLines={1}>{lastMessage}</Text> : null}
          </View>

          <View style={styles.roomMeta}>
            {timeLabel ? <Text style={styles.timeText}>{timeLabel}</Text> : null}
            {/* optional unread count: check common fields */}
            { (item?.unread_count || item?.unread || item?.unreadMessages) ? (
              <View style={styles.unreadCount}>
                <Text style={styles.unreadCountText}>{String(item?.unread_count || item?.unread || item?.unreadMessages)}</Text>
              </View>
            ) : null }
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFollowing = ({ item }: { item: any }) => {
  const avatar = item.profile_pic || item.avatar || (item?.user_id ? avatarCache[String(item.user_id)] : null) || null;
    let avatarUrl: string | null = null;
    if (avatar) {
      const s = String(avatar);
        const trimmed = s.trim();
        avatarUrl = trimmed.startsWith('http') ? trimmed : `${backendUrl}${trimmed}`;
    }
  const name = item.name || item.username || item.display_name || `User ${item.user_id}`;
  // placeholder avatar for followings without profile_pic
  if (!avatarUrl) {
    try {
  const initials = encodeURIComponent((name || '').split(' ').slice(0,2).map((s: string) => s.charAt(0)).join(''));
      avatarUrl = `https://ui-avatars.com/api/?name=${initials}&background=E9EDF8&color=3b82f6&size=128`;
    } catch (e) {
      avatarUrl = null;
    }
  }
  try { console.log('renderFollowing item:', JSON.stringify(item), 'avatarUrl:', avatarUrl); } catch(e) {}

  if (!avatarUrl && item?.user_id && !fetchingAvatars.current[String(item.user_id)]) {
    fetchingAvatars.current[String(item.user_id)] = true;
    (async () => {
      try {
        const prof = await fetchProfileById(item.user_id);
        const url = prof?.profile_pic || prof?.profile_pic_url || null;
        setAvatarCache(prev => ({ ...prev, [String(item.user_id)]: url }));
        try { console.log('fetched following avatar for', item.user_id, url); } catch (e) {}
      } catch (e) {
        try { console.log('failed fetch following avatar for', item.user_id, e); } catch (e) {}
      }
    })();
  }
    return (
      <TouchableOpacity
        style={styles.userCard}
        onPress={async () => {
          try {
            const token = await AsyncStorage.getItem('accessToken');
            const res = await fetch(`${backendUrl}/chat/createRoom/`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ participant_id: item.user_id }),
            });
            const data = await res.json();
            if (res.ok && data.room_id) {
              router.push({ pathname: '/(tabs)/chatRoom/[roomId]', params: { roomId: data.room_id.toString() } });
            }
          } catch (e) {
            // Optionally show error
          }
        }}
      >
        {avatarUrl && !failedAvatar[`user_${item.user_id}`] ? (
          <Image
            source={{ uri: avatarUrl }}
            style={styles.avatarSmall}
            resizeMode="cover"
            onError={(e) => {
              console.log('avatar load failed for user', item.user_id, 'url:', avatarUrl, 'error:', e.nativeEvent || e);
              setFailedAvatar(prev => ({ ...prev, [`user_${item.user_id}`]: true }));
            }}
          />
        ) : (
          <View style={styles.avatarPlaceholderSmall}><Text style={styles.avatarInitialsSmall}>{(name || '').charAt(0).toUpperCase()}</Text></View>
        )}
        <View style={styles.userTextWrap}>
          <Text style={styles.username} numberOfLines={1}>{name}</Text>
          <Text style={styles.userId}>@{item.username || item.user_id}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerWrapper}>
        <Text style={styles.title}>Messages</Text>
        <TouchableOpacity style={styles.addButton} activeOpacity={0.7}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#666" />
        </View>
      ) : (
        <FlatList
          data={chatRooms.length > 0 ? chatRooms : followingUsers}
          keyExtractor={(item, index) => {
            if (item?.room_id) return `room_${item.room_id}`;
            return `user_${item.user_id || index}`;
          }}
          renderItem={({ item }) => chatRooms.length > 0 ? renderRoom({ item }) : renderFollowing({ item })}
          scrollEnabled={true}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-outline" size={56} color="#ddd" />
              <Text style={styles.emptyText}>No conversations yet</Text>
              <Text style={styles.emptySubtext}>Start a new conversation</Text>
            </View>
          }
          contentContainerStyle={[styles.listContainer, chatRooms.length === 0 && followingUsers.length === 0 && { flexGrow: 1 }]}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#efefef',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e3',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4F8EF7',
  },
  headerIcon: {
    padding: 8,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  emptyHint: {
    fontSize: 12,
    color: '#bbb',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  roomCard: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 0,
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  roomCardTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#e8e8e8',
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#e8e8e8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarInitials: {
    color: '#666',
    fontWeight: '700',
    fontSize: 18,
  },
  roomText: {
    flex: 1,
  },
  roomName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 3,
  },
  roomSnippet: {
    color: '#999',
    fontSize: 13,
  },
  roomMeta: {
    alignItems: 'flex-end',
    marginLeft: 8,
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 6,
  },
  unreadCount: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4F8EF7',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  unreadBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4F8EF7',
    marginLeft: 8,
  },
  userCard: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
    marginBottom: 0,
    borderRadius: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: '#efefef',
    marginLeft: 78, // align separator after avatar
  },
  avatarSmall: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#e8e8e8',
    marginRight: 12,
  },
  avatarPlaceholderSmall: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#e8e8e8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarInitialsSmall: {
    color: '#666',
    fontWeight: '700',
    fontSize: 16,
  },
  userTextWrap: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  userId: {
    fontSize: 13,
    color: '#999',
  },
});

export default Chat;