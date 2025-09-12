import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { backendUrl } from '@/constants/Urls';

const ChatRoomPage = () => {
	const { roomId } = useLocalSearchParams();
	const [messages, setMessages] = useState<any[]>([]);
	const [input, setInput] = useState('');
	const [loading, setLoading] = useState(true);
	const [user, setUser] = useState('');
	const [userId, setUserId] = useState<string | null>(null);
	const ws = useRef<WebSocket | null>(null);
	const [wsReady, setWsReady] = useState(false);

	useEffect(() => {
		AsyncStorage.getItem('user').then(u => u && setUser(u));
		const fetchUserId = async () => {
			try {
				const token = await AsyncStorage.getItem('accessToken');
				const res = await fetch(`${backendUrl}/chat/getUserId/`, {
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${token}`,
						'Content-Type': 'application/json',
					},
				});
				const data = await res.json();
				if (res.ok && data.userId) {
					setUserId(data.userId.toString());
				}
			} catch {}
		};
		fetchUserId();
	}, []);

	useEffect(() => {
		// Fetch initial messages (optional, if you want to show history)
		const fetchMessages = async () => {
			setLoading(true);
			try {
				const token = await AsyncStorage.getItem('accessToken');
				const res = await fetch(`${backendUrl}/chat/getMessages/${roomId}`, {
					method: 'GET',
					headers: {
						'Authorization': `Bearer ${token}`,
						'Content-Type': 'application/json',
					},
				});
				const data = await res.json();
				if (res.ok && data.messages) {
					setMessages(
						data.messages.map((msg: any) => ({
							text: msg.content,
							sender: msg.sender.toString() === userId ? 'me' : msg.sender.toString()
						}))
					);
				}
			} catch {}
			setLoading(false);
		};
		if (roomId && userId) fetchMessages();
	}, [roomId, userId]);

	useEffect(() => {
		// Connect to WebSocket for real-time chat
		if (!roomId || !userId) return;
		if (!ws.current) {
			ws.current = new WebSocket(`ws://10.0.2.2:8000/ws/chat/${roomId}/`);
			ws.current.onopen = () => setWsReady(true);
			ws.current.onclose = () => setWsReady(false);
		}
		ws.current.onmessage = (e) => {
			try {
				const data = JSON.parse(e.data);
				if (data.message) {
					setMessages(prev => [...prev, { text: data.message, sender: data.sender.toString() === userId ? 'me' : data.sender.toString() }]);
				}
			} catch {}
		};
		return () => {
			ws.current?.close();
		};
	}, [roomId, userId]);

	const sendMessage = async () => {
		if (input.trim() && wsReady && userId) {
			ws.current?.send(JSON.stringify({ message: input, sender: userId }));
			try {
				const token = await AsyncStorage.getItem('accessToken');
				await fetch(`${backendUrl}/chat/sendMessage/`, {
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${token}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ room_id: roomId, content: input }),
				});
			} catch {}
			setInput('');
		}
	};

	return (
		<SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6FA' }}>
			<View style={styles.container}>
				<Text style={styles.title}>Chat Room {roomId}</Text>
				{loading ? (
					<Text>Loading messages...</Text>
				) : (
					<FlatList
						data={messages}
						keyExtractor={(_, idx) => idx.toString()}
						renderItem={({ item }) => (
							<View style={[styles.msgBubble, item.sender === 'me' ? styles.meBubble : styles.otherBubble]}>
								<Text style={styles.msgText}>{item.text}</Text>
							</View>
						)}
						style={styles.msgList}
					/>
				)}
				<View style={styles.inputRow}>
					<TextInput
						style={styles.input}
						value={input}
						onChangeText={setInput}
						placeholder="Type a message..."
						onSubmitEditing={sendMessage}
						returnKeyType="send"
					/>
					<TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
						<Text style={styles.sendText}>Send</Text>
					</TouchableOpacity>
				</View>
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
	msgList: {
		flex: 1,
		marginBottom: 8,
	},
	msgBubble: {
		borderRadius: 8,
		padding: 10,
		marginVertical: 4,
		maxWidth: '80%',
	},
	meBubble: {
		backgroundColor: '#4F8EF7',
		alignSelf: 'flex-end',
	},
	otherBubble: {
		backgroundColor: '#e3e8f7',
		alignSelf: 'flex-start',
	},
	msgText: {
		fontSize: 16,
		color: '#333',
	},
	inputRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 8,
	},
	input: {
		flex: 1,
		backgroundColor: '#fff',
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 8,
		fontSize: 16,
		borderWidth: 1,
		borderColor: '#dbeafe',
		marginRight: 8,
	},
	sendBtn: {
		backgroundColor: '#4F8EF7',
		borderRadius: 8,
		paddingVertical: 10,
		paddingHorizontal: 18,
	},
	sendText: {
		color: '#fff',
		fontWeight: 'bold',
		fontSize: 16,
	},
});

export default ChatRoomPage;
