import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { MaterialIcons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Octicons from '@expo/vector-icons/Octicons';
export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: 'absolute',
          },
          default: {},
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Octicons name="home" size={28} color={color} />,
          tabBarActiveTintColor: Colors.dark.tint,
          tabBarInactiveTintColor: Colors.dark.icon,
          tabBarStyle: {
            backgroundColor: '#000',
          },
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <Octicons name="search" size={28} color={color} />,
        }}
      />
       <Tabs.Screen
        name="upload"
        options={{
          title: 'Upload',
          tabBarIcon: ({ color }) => <IconSymbol name="plus" size={28} color={color} />,
          
         }}
      />
      <Tabs.Screen
        name='chat'
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="chat" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <MaterialIcons name="person" size={28} color={color} />,
        }}
      />
     
       <Tabs.Screen
        name="chatRoom"
        options={{ href: null }}
      />
       <Tabs.Screen
        name="[roomId]"
        options={{ href: null }}
      />
       <Tabs.Screen
        name="userProfile"
        options={{ href: null }}
      />
       <Tabs.Screen
        name="chatRoom/[roomId]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="settings"
        options={{ href: null }}
      /><Tabs.Screen
        name="editProfile"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="blockedUsers"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="privacyPolicy"
        options={{ href: null }}
      /><Tabs.Screen
        name="termsOfService"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="clip/[clipId]"
        options={{ tabBarStyle: {
            backgroundColor: '#000',
          },href: null }}
        
      />
    </Tabs>
  );
}
