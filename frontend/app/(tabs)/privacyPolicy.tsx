import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function PrivacyPolicy() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/settings')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.lastUpdated}>Last updated: October 20, 2025</Text>

        <Text style={styles.sectionTitle}>Introduction</Text>
        <Text style={styles.paragraph}>
          Welcome to Clipzy. We respect your privacy and are committed to protecting your personal data. 
          This privacy policy will inform you about how we look after your personal data when you visit 
          our app and tell you about your privacy rights and how the law protects you.
        </Text>

        <Text style={styles.sectionTitle}>Information We Collect</Text>
        <Text style={styles.paragraph}>
          We may collect, use, store and transfer different kinds of personal data about you including:
        </Text>
        <Text style={styles.bulletPoint}>• Identity Data (name, username)</Text>
        <Text style={styles.bulletPoint}>• Contact Data (email address)</Text>
        <Text style={styles.bulletPoint}>• Profile Data (profile picture, bio, preferences)</Text>
        <Text style={styles.bulletPoint}>• Usage Data (how you use our app)</Text>
        <Text style={styles.bulletPoint}>• Technical Data (device information, IP address)</Text>

        <Text style={styles.sectionTitle}>How We Use Your Information</Text>
        <Text style={styles.paragraph}>
          We use your personal data to provide and improve our services, including:
        </Text>
        <Text style={styles.bulletPoint}>• Managing your account and profile</Text>
        <Text style={styles.bulletPoint}>• Delivering content you upload or interact with</Text>
        <Text style={styles.bulletPoint}>• Communicating with you about your account</Text>
        <Text style={styles.bulletPoint}>• Improving our app and user experience</Text>

        <Text style={styles.sectionTitle}>Data Security</Text>
        <Text style={styles.paragraph}>
          We have put in place appropriate security measures to prevent your personal data from being 
          accidentally lost, used or accessed in an unauthorized way, altered or disclosed.
        </Text>

        <Text style={styles.sectionTitle}>Your Rights</Text>
        <Text style={styles.paragraph}>
          You have the right to:
        </Text>
        <Text style={styles.bulletPoint}>• Access your personal data</Text>
        <Text style={styles.bulletPoint}>• Correct your personal data</Text>
        <Text style={styles.bulletPoint}>• Delete your personal data</Text>
        <Text style={styles.bulletPoint}>• Object to processing of your personal data</Text>
        <Text style={styles.bulletPoint}>• Request transfer of your personal data</Text>

        <Text style={styles.sectionTitle}>Contact Us</Text>
        <Text style={styles.paragraph}>
          If you have any questions about this privacy policy or our privacy practices, please contact us 
          at support@clipzy.com
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
  },
  lastUpdated: {
    fontSize: 13,
    color: '#999',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginTop: 24,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 15,
    color: '#333',
    lineHeight: 24,
    marginBottom: 16,
  },
  bulletPoint: {
    fontSize: 15,
    color: '#333',
    lineHeight: 24,
    marginLeft: 8,
    marginBottom: 8,
  },
});
