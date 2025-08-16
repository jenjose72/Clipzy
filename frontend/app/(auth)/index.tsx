
import React, { useEffect } from 'react';
import { View, Button, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/components/AuthContext';

export default function AuthIndex() {
	const { user } = useAuth();
	const router = useRouter();

	useEffect(() => {
		if (user) {
			router.replace('/(tabs)');
		}
	}, [user]);

	return (
		<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
			<Text style={{ fontSize: 24, marginBottom: 20 }}>You are not logged in</Text>
			<Button title="Go to Login" onPress={() => router.push('/(auth)/login')} />
			<View style={{ height: 10 }} />
			<Button title="Go to Signup" onPress={() => router.push('/(auth)/signup')} />
		</View>
	);
}
