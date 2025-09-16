import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { backendUrl } from '@/constants/Urls';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

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
			<SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
				<View style={styles.header}>
					<View style={{ flexDirection: 'row', alignItems: 'center' }}>
						<TouchableOpacity style={{ padding: 8 }} onPress={() => history.back()}>
							<MaterialIcons name="arrow-back-ios" size={20} color="#111" />
						</TouchableOpacity>
						<View style={{ width: 8 }} />
						<View style={styles.avatarSmall} />
						<View style={{ marginLeft: 10 }}>
							<Text style={styles.headerName}>Helena Hills</Text>
							<Text style={styles.headerStatus}>Active 11m ago</Text>
						</View>
					</View>

					<View style={{ flexDirection: 'row', alignItems: 'center' }}>
						<TouchableOpacity style={{ padding: 8 }}>
							<MaterialIcons name="call" size={20} color="#111" />
						</TouchableOpacity>
						<TouchableOpacity style={{ padding: 8 }}>
							<MaterialIcons name="videocam" size={20} color="#111" />
						</TouchableOpacity>
					</View>
				</View>

				<FlatList
					data={messages}
					keyExtractor={(_, idx) => idx.toString()}
					contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
					renderItem={({ item }) => {
						// timestamp center bubble
						if (item.type === 'time') {
							return (
								<View style={{ alignItems: 'center', marginVertical: 12 }}>
									<Text style={{ fontSize: 12, color: '#999' }}>{item.text}</Text>
								</View>
							);
						}

						const isMe = item.sender === 'me';
						return (
							<View style={{ flexDirection: 'row', marginVertical: 6, alignItems: 'flex-end' }}>
								{!isMe && <View style={styles.msgAvatar} />}
								<View style={{ flex: 1, alignItems: isMe ? 'flex-end' : 'flex-start' }}>
									<View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
										<Text style={[styles.bubbleText, isMe ? { color: '#fff' } : { color: '#111' }]}>{item.text}</Text>
									</View>
								</View>
								{isMe && <View style={{ width: 36 }} />}
							</View>
						);
					}}
				/>

				<View style={styles.inputBar}>
					<TouchableOpacity style={styles.inputIcon}><MaterialIcons name="emoji-emotions" size={22} color="#666" /></TouchableOpacity>
					<TextInput
						style={styles.messageInput}
						value={input}
						onChangeText={setInput}
						placeholder="Message..."
						placeholderTextColor="#999"
					/>
					<TouchableOpacity style={styles.inputIcon}><MaterialIcons name="image" size={22} color="#666" /></TouchableOpacity>
					<TouchableOpacity style={[styles.sendCircle]} onPress={sendMessage}>
						<MaterialIcons name="send" size={20} color="#fff" />
					</TouchableOpacity>
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
		header: {
			height: 68,
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			paddingHorizontal: 12,
			borderBottomWidth: 1,
			borderBottomColor: '#eee',
			backgroundColor: '#fff',
		},
		avatarSmall: {
			width: 36,
			height: 36,
			borderRadius: 18,
			backgroundColor: '#ccc',
		},
		headerName: {
			fontSize: 16,
			fontWeight: '700',
		},
		headerStatus: {
			fontSize: 12,
			color: '#777',
		},
		msgAvatar: {
			width: 32,
			height: 32,
			borderRadius: 16,
			backgroundColor: '#999',
			marginRight: 8,
		},
		bubble: {
			paddingVertical: 10,
			paddingHorizontal: 14,
			borderRadius: 18,
			maxWidth: '80%'
		},
		bubbleMe: {
			backgroundColor: '#111',
			borderBottomRightRadius: 6,
		},
		bubbleOther: {
			backgroundColor: '#eee',
			borderBottomLeftRadius: 6,
		},
		bubbleText: {
			fontSize: 15,
			lineHeight: 20,
		},
		inputBar: {
			position: 'absolute',
			left: 0,
			right: 0,
			bottom: 0,
			backgroundColor: '#fff',
			padding: 8,
			flexDirection: 'row',
			alignItems: 'center',
			borderTopWidth: 1,
			borderTopColor: '#eee'
		},
		inputIcon: {
			padding: 8,
		},
		messageInput: {
			flex: 1,
			backgroundColor: '#f6f6f6',
			borderRadius: 20,
			paddingHorizontal: 14,
			paddingVertical: 8,
			marginHorizontal: 8,
		},
		sendCircle: {
			width: 40,
			height: 40,
			borderRadius: 20,
			backgroundColor: '#111',
			alignItems: 'center',
			justifyContent: 'center',
		}
});

export default ChatRoomPage;
