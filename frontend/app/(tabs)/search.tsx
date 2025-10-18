import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { backendUrl } from '@/constants/Urls';

const Search = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [avatarCache, setAvatarCache] = useState<Record<string, string | null>>({});
  const fetchingAvatars = useRef<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSearch = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${backendUrl}/features/search/?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (res.ok) {
        setResults(data.results);
        // clear avatar cache for new results
        setAvatarCache({});
      } else {
        setError('Search failed');
      }
    } catch (e) {
      setError('Network error');
    }
    setLoading(false);
  };

  // background fetch for profile pics for each user result
  useEffect(() => {
    if (!results || results.length === 0) return;
    results.forEach((r) => {
      const id = String(r.id);
      if (avatarCache[id] !== undefined) return; // already have value (string|null)
      if (fetchingAvatars.current[id]) return;
      fetchingAvatars.current[id] = true;
      (async () => {
        try {
          const res = await fetch(`${backendUrl}/accounts/getOtherProfile/?user_id=${id}`);
          const data = await res.json().catch(() => null);
          const profile = data?.profile || data || {};
          const pic = profile?.profile_pic || null;
          setAvatarCache((prev) => ({ ...prev, [id]: pic }));
        } catch (e) {
          setAvatarCache((prev) => ({ ...prev, [id]: null }));
        }
      })().finally(() => { fetchingAvatars.current[id] = false; });
    });
  }, [results]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Search</Text>
        </View>

        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search users..."
            placeholderTextColor="#999"
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        {loading && <ActivityIndicator size="large" color="#4F8EF7" style={styles.loader} />}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Empty states: initial prompt when query is empty, and friendly "no results" when a query yields nothing */}

        <FlatList
          data={results}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => {
            const id = String(item.id);
            const avatarUri = avatarCache[id] ?? null;
            const displayName = item.name || item.username;
            let avatarUrl: string | null = avatarUri;
            if (!avatarUrl) {
              try {
                const initials = encodeURIComponent((displayName || '').split(' ').slice(0, 2).map((s: string) => s.charAt(0)).join(''));
                avatarUrl = `https://ui-avatars.com/api/?name=${initials}&background=E9EDF8&color=3b82f6&size=128`;
              } catch (e) {
                avatarUrl = null;
              }
            }
            return (
              <TouchableOpacity
                style={styles.resultCard}
                onPress={() => router.push(`/(tabs)/userProfile?userId=${item.id}`)}
              >
                <Image 
                  source={avatarUrl ? { uri: avatarUrl } : require('../../assets/images/avatar.png')} 
                  style={styles.resultAvatar}
                  defaultSource={require('../../assets/images/avatar.png')}
                />
                <View style={styles.resultTextWrap}>
                  <Text style={styles.username}>{item.username}</Text>
                  {displayName && displayName !== item.username ? (
                    <Text style={styles.displayName}>{displayName}</Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>
            );
          }}
          style={styles.resultList}
          scrollEnabled={results.length > 5}
          ListEmptyComponent={() => {
            if (loading) return null;
            if (!query || query.length === 0) {
              return (
                <View style={styles.emptyContainerSearch}>
                  <Ionicons name="people-outline" size={72} color="#e0e7ff" style={styles.emptyIconLarge} />
                  <Text style={styles.emptyTitle}>Find people to follow</Text>
                  <Text style={styles.emptySubtitle}>Search by username or name to discover creators and friends</Text>
                </View>
              );
            }
            // query present but no results
            return (
              <View style={styles.emptyContainerSearch}>
                <Ionicons name="search-outline" size={64} color="#f3f4f6" style={styles.emptyIconLarge} />
                <Text style={styles.emptyTitle}>No users found</Text>
                <Text style={styles.emptySubtitle}>Try a different search term or check the spelling</Text>
              </View>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  header: {
    marginBottom: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111',
    letterSpacing: 0.5,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 15,
    color: '#111',
  },
  clearBtn: {
    padding: 6,
    marginLeft: 4,
  },
  loader: {
    marginTop: 24,
  },
  error: {
    color: '#e74c3c',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  noResults: {
    color: '#999',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 32,
  },
  resultList: {
    width: '100%',
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e9edf8',
  },
  resultAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 12,
    backgroundColor: '#ddd',
  },
  resultTextWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  username: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  displayName: {
    color: '#666',
    fontSize: 13,
    marginTop: 3,
  },
  emptyContainerSearch: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 36,
  },
  emptyIconLarge: {
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default Search;