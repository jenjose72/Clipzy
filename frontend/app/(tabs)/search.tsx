import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { backendUrl } from '@/constants/Urls';

const Search = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
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
      } else {
        setError('Search failed');
      }
    } catch (e) {
      setError('Network error');
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Search Users</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Enter username..."
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
            <Text style={styles.searchText}>Search</Text>
          </TouchableOpacity>
        </View>
        {loading && <ActivityIndicator size="small" color="#4F8EF7" />}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <FlatList
          data={results}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.resultItem}
              onPress={() => {
                router.push(`/(tabs)/userProfile?userId=${item.id}`);
              }}
            >
              <Text style={styles.username}>{item.username}</Text>
            </TouchableOpacity>
          )}
          style={styles.resultList}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 24,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
  searchBtn: {
    backgroundColor: '#4F8EF7',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  searchText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  error: {
    color: 'red',
    fontSize: 16,
    marginBottom: 16,
  },
  resultList: {
    width: '100%',
  },
  resultItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  username: {
    fontSize: 18,
    color: '#333',
    fontWeight: '600',
  },
});

export default Search;