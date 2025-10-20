import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TermsOfService() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/settings')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.lastUpdated}>Last updated: October 20, 2025</Text>

        <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
        <Text style={styles.paragraph}>
          By accessing and using Clipzy, you accept and agree to be bound by the terms and provisions 
          of this agreement. If you do not agree to these terms, please do not use this service.
        </Text>

        <Text style={styles.sectionTitle}>2. User Accounts</Text>
        <Text style={styles.paragraph}>
          You are responsible for maintaining the confidentiality of your account and password. You agree 
          to accept responsibility for all activities that occur under your account.
        </Text>
        <Text style={styles.bulletPoint}>• You must be at least 13 years old to use this service</Text>
        <Text style={styles.bulletPoint}>• You must provide accurate and complete information</Text>
        <Text style={styles.bulletPoint}>• You may not impersonate others or create fake accounts</Text>

        <Text style={styles.sectionTitle}>3. Content Guidelines</Text>
        <Text style={styles.paragraph}>
          You agree not to post content that:
        </Text>
        <Text style={styles.bulletPoint}>• Violates any laws or regulations</Text>
        <Text style={styles.bulletPoint}>• Infringes on intellectual property rights</Text>
        <Text style={styles.bulletPoint}>• Contains hate speech or harassment</Text>
        <Text style={styles.bulletPoint}>• Is sexually explicit or violent</Text>
        <Text style={styles.bulletPoint}>• Contains malware or spam</Text>

        <Text style={styles.sectionTitle}>4. User Conduct</Text>
        <Text style={styles.paragraph}>
          You agree to use Clipzy in a responsible manner. You will not:
        </Text>
        <Text style={styles.bulletPoint}>• Harass, bully, or intimidate other users</Text>
        <Text style={styles.bulletPoint}>• Attempt to gain unauthorized access to the service</Text>
        <Text style={styles.bulletPoint}>• Upload viruses or malicious code</Text>
        <Text style={styles.bulletPoint}>• Use automated systems to access the service</Text>

        <Text style={styles.sectionTitle}>5. Intellectual Property</Text>
        <Text style={styles.paragraph}>
          You retain ownership of content you post on Clipzy. However, by posting content, you grant 
          us a worldwide, non-exclusive, royalty-free license to use, reproduce, and distribute your 
          content as part of the service.
        </Text>

        <Text style={styles.sectionTitle}>6. Termination</Text>
        <Text style={styles.paragraph}>
          We reserve the right to terminate or suspend your account at any time, without prior notice, 
          for conduct that we believe violates these Terms of Service or is harmful to other users, us, 
          or third parties.
        </Text>

        <Text style={styles.sectionTitle}>7. Limitation of Liability</Text>
        <Text style={styles.paragraph}>
          Clipzy is provided "as is" without warranties of any kind. We shall not be liable for any 
          damages arising from your use of the service.
        </Text>

        <Text style={styles.sectionTitle}>8. Changes to Terms</Text>
        <Text style={styles.paragraph}>
          We reserve the right to modify these terms at any time. We will notify users of any material 
          changes. Your continued use of the service after such modifications constitutes acceptance 
          of the updated terms.
        </Text>

        <Text style={styles.sectionTitle}>9. Contact</Text>
        <Text style={styles.paragraph}>
          If you have any questions about these Terms of Service, please contact us at legal@clipzy.com
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
