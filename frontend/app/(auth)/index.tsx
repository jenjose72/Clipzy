
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/components/AuthContext';
import ClipzyLogo from '@/components/icons/clipzyLogo';

export default function AuthIndex() {
	const { user } = useAuth();
	const router = useRouter();

	useEffect(() => {
		if (user) {
			router.replace('/(tabs)');
		}
	}, [user]);

	return (
		<View style={styles.safe}>
			<View style={styles.container}>
				<ClipzyLogo width={120} height={160} style={{ opacity: 1, marginBottom: 12 }} />

				<Text style={styles.subtitle}>Please log in or sign up to continue</Text>

				<View style={styles.actions}>
					<TouchableOpacity style={styles.primary} onPress={() => router.push('/(auth)/login')}>
						<Text style={styles.primaryText}>Login</Text>
					</TouchableOpacity>
					<TouchableOpacity style={styles.ghost} onPress={() => router.push('/(auth)/signup')}>
						<Text style={styles.ghostText}>Sign up</Text>
					</TouchableOpacity>
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: '#fff' },
	container: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
	title: { fontSize: 26, fontWeight: '700', marginTop: 8 },
	subtitle: { color: '#666', fontSize:16,marginTop: 6, textAlign: 'center' },
	actions: { width: '100%', marginTop: 24, paddingHorizontal: 16 },
	primary: { backgroundColor: '#000', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
	primaryText: { color: '#fff', fontWeight: '600' },
	ghost: { paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#eee' },
	ghostText: { color: '#000', fontWeight: '600' },
});
