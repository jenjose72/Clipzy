import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, TextInput, Pressable, ActivityIndicator, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../components/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { backendUrl } from '@/constants/Urls';
import ClipzyLogo from '@/components/icons/clipzyLogo';
import DateTimePicker from '@react-native-community/datetimepicker';
// Using a simple text logo placeholder here to avoid changing the ClipzyLogo component

type Step = 1 | 3;

export default function Signup() {
  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState('');
  // OTP flow removed — we skip verification and go straight to personal details
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const router = useRouter();
  const { login } = useAuth();

  const onDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || new Date();
    setShowDatePicker(Platform.OS === 'ios');
    setSelectedDate(currentDate);
    setDob(currentDate.toISOString().split('T')[0]); // Format as YYYY-MM-DD
  };

  const handleBack = () => {
    if (step > 1) {
      setError('');
      setStep(1);
    } else {
      router.back();
    }
  };

  // simplified: skip OTP and go straight to personal details
  const requestOtp = () => {
    setError('');
    if (!email) return setError('Please enter your email');
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) return setError('Please enter a valid email address');
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(3);
    }, 250);
  };

  // OTP verification removed

  const handleSignup = async () => {
    setError('');
    if (!username || !password || !email) return setError('Please fill all required fields');
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/accounts/signup/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email, name, dob }),
      });
      const data = await res.json();
      if (res.ok) {
        const loginRes = await fetch(`${backendUrl}/accounts/token/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        const loginData = await loginRes.json();
        if (loginRes.ok && loginData.access) {
          await AsyncStorage.setItem('accessToken', loginData.access);
          if (loginData.refresh) await AsyncStorage.setItem('refreshToken', loginData.refresh);
          await AsyncStorage.setItem('user', username);
          login(username);
          router.replace('/(tabs)');
        } else {
          setError('Signup succeeded but login failed');
        }
      } else {
        setError(data.error || 'Signup failed');
      }
    } catch (e) {
      console.error(e);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const PrimaryButton = ({ onPress, title }: { onPress: () => void; title: string }) => (
    <Pressable onPress={onPress} style={{ backgroundColor: 'black', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 18 }}>
      <Text style={{ color: 'white', fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );

  // enhanced primary button: supports disabled and loading states
  const PrimaryButtonEx = ({ onPress, title, disabled, loading }: { onPress: () => void; title: string; disabled?: boolean; loading?: boolean }) => (
    <Pressable onPress={() => { if (disabled || loading) return; onPress(); }} disabled={disabled || loading} style={{ backgroundColor: disabled || loading ? '#999' : 'black', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 18, opacity: disabled || loading ? 0.9 : 1 }}>
      {loading ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={{ color: 'white', fontWeight: '600' }}>{title}</Text>
        </View>
      ) : (
        <Text style={{ color: 'white', fontWeight: '600' }}>{title}</Text>
      )}
    </Pressable>
  );

  

  return (
    <SafeAreaView style={{ flex: 1, padding: 20 }} edges={['top', 'left', 'right']}>
      {/* Back button */}
      <Pressable onPress={handleBack} style={{ padding: 8, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center' }}>
        <MaterialIcons name="arrow-back-ios" size={18} color="#111" />
        <Text style={{ fontSize: 16, marginLeft: 6 }}>Back</Text>
      </Pressable>
      {step === 1 && (
        <>
          <View style={{ alignItems: 'center', marginTop: 12 }}>
           <ClipzyLogo xml={null} width={120} height={160} style={{ opacity: 1 }} />
          </View>

          <Text style={{ fontSize: 18, fontWeight: '700', marginTop: 22, textAlign: 'center' }}>Create an account</Text>
          <Text style={{ color: '#666', textAlign: 'center', marginTop: 8 }}>Enter your email to sign up for this app</Text>

          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              placeholder="email@domain.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor="#999"
              style={styles.input}
            />
          </View>

          <PrimaryButtonEx title="Continue" onPress={requestOtp} loading={loading} disabled={loading} />

          <Text style={{ textAlign: 'center', color: '#666', marginTop: 12 }}>Already have an account? <Text style={{ fontWeight: '700' }} onPress={() => router.replace('/(auth)/login')}>Login Now!</Text></Text>

          <Text style={{ position: 'absolute', bottom: 18, left: 20, right: 20, textAlign: 'center', color: '#999', fontSize: 12 }}>
            By clicking continue, you agree to our Terms of Service and Privacy Policy
          </Text>
        </>
      )}

      {/* OTP step removed — we skip verification and go straight to personal details */}

      {step === 3 && (
        <>
          <View style={{ alignItems: 'center', marginTop: 6 }}>
            <ClipzyLogo xml={null} width={120} height={160} style={{ opacity: 1 }} />
          </View>

          <Text style={{ fontSize: 18, fontWeight: '700', marginTop: 18, textAlign: 'center' }}>Personal Details</Text>

          {/* Full Name Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput 
              placeholder="Full name" 
              value={name} 
              onChangeText={setName} 
              autoCapitalize="words"
              autoCorrect={false}
              placeholderTextColor="#999"
              style={styles.input}
            />
          </View>

          {/* Date of Birth Input */}
          <TouchableOpacity 
            onPress={() => setShowDatePicker(true)} 
            style={styles.inputContainer}
          >
            <Ionicons name="calendar-outline" size={20} color="#666" style={styles.inputIcon} />
            <Text style={{ flex: 1, paddingVertical: 14, fontSize: 16, color: dob ? '#333' : '#999' }}>
              {dob || 'Date of birth'}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              testID="dateTimePicker"
              value={selectedDate}
              mode="date"
              is24Hour={true}
              display="default"
              onChange={onDateChange}
              maximumDate={new Date()} // Prevent future dates
            />
          )}

          {/* Username Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="at" size={20} color="#666" style={styles.inputIcon} />
            <TextInput 
              placeholder="Username" 
              value={username} 
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor="#999"
              style={styles.input}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput 
              placeholder="Password" 
              secureTextEntry={!showPassword}
              value={password} 
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor="#999"
              style={styles.input}
            />
            <TouchableOpacity 
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons 
                name={showPassword ? "eye-outline" : "eye-off-outline"} 
                size={22} 
                color="#666" 
              />
            </TouchableOpacity>
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput 
              placeholder="Confirm password" 
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword} 
              onChangeText={setConfirmPassword}
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor="#999"
              style={styles.input}
            />
            <TouchableOpacity 
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons 
                name={showConfirmPassword ? "eye-outline" : "eye-off-outline"} 
                size={22} 
                color="#666" 
              />
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: 18 }}>
            <PrimaryButtonEx
              title="Sign up"
              loading={loading}
              disabled={loading}
              onPress={() => {
                if (!name || !dob || !password || !username || !confirmPassword) return setError('Please fill all fields');
                if (password !== confirmPassword) return setError('Passwords do not match');
                handleSignup();
              }}
            />
          </View>
        </>
      )}

      {error ? <Text style={{ color: 'red', marginTop: 12 }}>{error}</Text> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F6FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 12,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: { 
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
  },
  eyeIcon: {
    padding: 4,
    marginLeft: 8,
  },
});
