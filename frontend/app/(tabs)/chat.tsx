import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { backendUrl } from '@/constants/Urls';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

const Chat = () => {
  const [chatRooms, setChatRooms] = useState<any[]>([]);
  const [followingUsers, setFollowingUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const getChats = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const res = await fetch(`${backendUrl}/chat/getChats/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      console.log(data);
      if (data.chat_rooms && data.chat_rooms.length > 0) {
        setChatRooms(data.chat_rooms);
        setFollowingUsers([]);
      } else if (data.following && data.following.length > 0) {
        setFollowingUsers(data.following);
        setChatRooms([]);
      }
    } catch (e) {
      setChatRooms([]);
      setFollowingUsers([]);
    }
    setLoading(false);
  };

  useEffect(() => {
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6FA' }}>
      <View style={styles.container}>
        <Text style={styles.title}>Chats</Text>
        {loading ? (
          <Text style={{ alignSelf: 'center', marginTop: 20 }}>Loading...</Text>
        ) : chatRooms.length > 0 ? (
          <>
            <Text style={styles.subtitle}>Your Chat Rooms</Text>
            <FlatList
              data={chatRooms}
              keyExtractor={item => item.room_id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.roomCard}
                  onPress={() => router.push(`/(tabs)/chatRoom/${item.room_id}`)}
                >
                  <Text style={styles.roomName}>{item.room_name || `Room ${item.room_id}`}</Text>
                  <Text style={styles.roomUsers}>Users: {item.users.join(', ')}</Text>
                </TouchableOpacity>
              )}
            />
          </>
        ) : followingUsers.length > 0 ? (
          <>
            <Text style={styles.subtitle}>Start a chat with someone you follow</Text>
            <FlatList
              data={followingUsers}
              keyExtractor={item => item.user_id.toString()}
              renderItem={({ item }) => (
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
                  <Text style={styles.username}>{item.username}</Text>
                  <Text style={styles.userId}>User ID: {item.user_id}</Text>
                </TouchableOpacity>
              )}
            />
          </>
        ) : (
          <Text style={{ alignSelf: 'center', marginTop: 20 }}>No chats or following users found.</Text>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#222',
    alignSelf: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#4F8EF7',
    alignSelf: 'flex-start',
  },
  roomCard: {
    backgroundColor: '#e3e8f7',
    borderRadius: 8,
    padding: 14,
    marginVertical: 6,
  },
  roomName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  roomUsers: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  username: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#222',
  },
  userId: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
});

export default Chat;