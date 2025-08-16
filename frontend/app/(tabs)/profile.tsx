import { View, Text, Button } from 'react-native'
import React from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/components/AuthContext'
import { useRouter } from 'expo-router'

const profile = () => {
  const { logout } = useAuth()
  const router = useRouter()

  const handleLogout = () => {
    logout()
    router.replace('/(auth)/login')
  }

  return (
    <SafeAreaView>
        <View>
        <Text>profile</Text>
        <Button title="Logout" onPress={handleLogout} />
        </View>
    </SafeAreaView>
  )
}

export default profile