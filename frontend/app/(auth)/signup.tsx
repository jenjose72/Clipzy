import React, { useState, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, TextInput, Pressable, ActivityIndicator, TouchableOpacity } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../components/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { backendUrl } from '@/constants/Urls';
import ClipzyLogo from '@/components/icons/clipzyLogo';
// Using a simple text logo placeholder here to avoid changing the ClipzyLogo component

type Step = 1 | 2 | 3;

export default function Signup() {
  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const hiddenOtpInput = useRef<TextInput | null>(null);
  const router = useRouter();
  const { login } = useAuth();

  const handleBack = () => {
    if (step > 1) {
      setError('');
      // clear OTP when stepping back to step 1
      if (step === 2) setOtp('');
      setStep((s) => (s - 1) as Step);
    } else {
      router.back();
    }
  };

  const requestOtp = () => {
    setError('');
    if (!email) return setError('Please enter your email');
    setLoading(true);
    // dummy
    setTimeout(() => {
      setLoading(false);
      setStep(2);
    }, 600);
  };

  const verifyOtp = () => {
    setError('');
    if (!otp || otp.length < 6) return setError('Please enter the 6-digit pin');
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(3);
    }, 400);
  };

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

  const renderPinBoxes = () => {
    const digits = otp.split('');
    return (
      <View style={{ flexDirection: 'row', alignSelf: 'center', marginTop: 18, alignItems: 'center' }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={i} style={{ width: 48, height: 48, backgroundColor: '#6C5CE7', marginHorizontal: 6, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 18 }}>{digits[i] ?? ''}</Text>
          </View>
        ))}

        <Text style={{ width: 12, textAlign: 'center', marginHorizontal: 6, fontSize: 18 }}>-</Text>

        {Array.from({ length: 3 }).map((_, i) => (
          <View key={i + 3} style={{ width: 48, height: 48, backgroundColor: '#6C5CE7', marginHorizontal: 6, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 18 }}>{digits[i + 3] ?? ''}</Text>
          </View>
        ))}
      </View>
    );
  };

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
           <ClipzyLogo width={120} height={160} style={{ opacity: 1 }} />
          </View>

          <Text style={{ fontSize: 18, fontWeight: '700', marginTop: 22, textAlign: 'center' }}>Create an account</Text>
          <Text style={{ color: '#666', textAlign: 'center', marginTop: 8 }}>Enter your email to sign up for this app</Text>

          <TextInput
            placeholder="email@domain.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            style={{ borderWidth: 1, borderColor: '#eee', padding: 14, borderRadius: 12, marginTop: 18, backgroundColor: '#fff' }}
          />

          {loading ? (
            <ActivityIndicator style={{ marginTop: 16 }} />
          ) : (
            <PrimaryButton title="Continue" onPress={requestOtp} />
          )}

          <Text style={{ textAlign: 'center', color: '#666', marginTop: 12 }}>Already have an account? <Text style={{ fontWeight: '700' }} onPress={() => router.replace('/(auth)/login')}>Login Now!</Text></Text>

          <Text style={{ position: 'absolute', bottom: 18, left: 20, right: 20, textAlign: 'center', color: '#999', fontSize: 12 }}>
            By clicking continue, you agree to our Terms of Service and Privacy Policy
          </Text>
        </>
      )}

      {step === 2 && (
        <>
          <View style={{ alignItems: 'center', marginTop: 6 }}>
           <ClipzyLogo width={120} height={160} style={{ opacity: 1 }} />
          </View>

          <Text style={{ fontSize: 16, fontWeight: '700', marginTop: 18, textAlign: 'center' }}>Enter security pin sent to your email</Text>

          <TouchableOpacity activeOpacity={1} onPress={() => hiddenOtpInput.current?.focus()}>
            {renderPinBoxes()}
          </TouchableOpacity>

          {/* Hidden input captures the 6-digit pin */}
          <TextInput
            ref={(r) => { hiddenOtpInput.current = r; }}
            value={otp}
            onChangeText={(val) => setOtp(val.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            style={{ position: 'absolute', opacity: 0 }}
            importantForAutofill="no"
          />

          <View style={{ marginTop: 28 }}>
            <PrimaryButton title="Continue" onPress={verifyOtp} />
          </View>

          <Text style={{ textAlign: 'center', color: '#666', marginTop: 14 }}>not your email? <Text style={{ textDecorationLine: 'underline' }} onPress={() => { setStep(1); setOtp(''); }}>change it now</Text></Text>
        </>
      )}

      {step === 3 && (
        <>
          <View style={{ alignItems: 'center', marginTop: 6 }}>
            <ClipzyLogo width={120} height={160} style={{ opacity: 1 }} />
          </View>

          <Text style={{ fontSize: 18, fontWeight: '700', marginTop: 18, textAlign: 'center' }}>Personal Details</Text>

          <TextInput placeholder="full name" value={name} onChangeText={setName} style={{ borderWidth: 1, borderColor: '#eee', padding: 12, borderRadius: 10, marginTop: 18, backgroundColor: '#fff' }} />

          <TextInput placeholder="date of birth" value={dob} onChangeText={setDob} style={{ borderWidth: 1, borderColor: '#eee', padding: 12, borderRadius: 10, marginTop: 12, backgroundColor: '#fff' }} />

          <TextInput placeholder="username" value={username} onChangeText={setUsername} style={{ borderWidth: 1, borderColor: '#eee', padding: 12, borderRadius: 10, marginTop: 12, backgroundColor: '#fff' }} />

          <TextInput placeholder="password" secureTextEntry value={password} onChangeText={setPassword} style={{ borderWidth: 1, borderColor: '#eee', padding: 12, borderRadius: 10, marginTop: 12, backgroundColor: '#fff' }} />

          <TextInput placeholder="confirm password" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} style={{ borderWidth: 1, borderColor: '#eee', padding: 12, borderRadius: 10, marginTop: 12, backgroundColor: '#fff' }} />

          <View style={{ marginTop: 18 }}>
            <PrimaryButton
              title="Continue"
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
