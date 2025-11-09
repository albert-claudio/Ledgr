import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, FlatList, Image, Pressable, ScrollView } from 'react-native';
import { colors } from '../../components/theme/colors';
import { typography } from '../../components/theme/typography';
import { useRouter } from 'expo-router';
import { usePopularThisWeek, useSearchGames, useWeeklySteamReviews, useSearchSuggestions } from '../../hooks/useSearch';
import { GameGridItem } from '../../components/game/GameGridItem';
import { SkeletonCard } from '../../components/common/SkeletonCard';
import { Game } from '../../services/igdb';

export default function SearchScreen() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [showSugg, setShowSugg] = useState(true);
  const q = useMemo(() => text.trim(), [text]);
  const [debouncedQ, setDebouncedQ] = useState(q);
  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(id);
  }, [q]);
  const weekly = usePopularThisWeek(!q);
  const searchRes = useSearchGames(debouncedQ);
  const reviews = useWeeklySteamReviews(!q);
  const sugg = useSearchSuggestions(debouncedQ, 5);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Text style={styles.title}>Buscar</Text>
        </View>

        <View style={styles.searchBox}>
          <TextInput
            placeholder="Buscar titulo, genero..."
            placeholderTextColor={colors.secondary}
            style={styles.input}
            value={text}
            onChangeText={(v) => { setText(v); setShowSugg(true); }}
            onSubmitEditing={() => { setText((prev) => prev.trim()); setShowSugg(false); }}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            onFocus={() => setShowSugg(true)}
          />
        </View>

        {showSugg && q.length >= 2 && (sugg.data || []).length > 0 && (
          <View style={styles.suggBox}>
            {(sugg.data || []).slice(0, 5).map((g) => (
              <Pressable key={g.id} onPress={() => { setText(g.name); setShowSugg(false); }} style={styles.suggItem}>
                <Text style={styles.suggText}>{g.name}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {!q && (
          <>
            <Text style={styles.sectionTitle}>Populares da Semana</Text>
            {weekly.isLoading ? (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16 }}
                data={[1,2,3,4,5]}
                keyExtractor={(i) => `sk-${i}`}
                renderItem={() => <SkeletonCard width={160} aspectRatio={7/10} />}
              />
            ) : (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16 }}
                data={(weekly.data || []).slice(0, 10)}
                keyExtractor={(item: Game, index) => `${item.id}-${index}`}
                renderItem={({ item }) => (
                  <View style={{ width: 160, marginRight: 16 }}>
                    <Pressable onPress={() => router.push(`/game/${item.id}`)}>
                      <Image source={{ uri: item.background_image || '' }} style={styles.cardImage} />
                    </Pressable>
                    <View style={styles.starsRow}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Text key={i} style={{ color: i < Math.round(item.rating) ? '#FCD34D' : colors.border }}>*</Text>
                      ))}
                      <Text style={styles.ratingText}>({item.rating.toFixed(1)})</Text>
                    </View>
                  </View>
                )}
              />
            )}

            <Text style={styles.sectionTitle}>Reviews</Text>
            {reviews.isLoading ? (
              [1,2,3].map((i) => (
                <View key={`rsk-${i}`} style={styles.reviewCard}>
                  <View style={{ width: 200, height: 14, backgroundColor: colors.card, borderRadius: 4, marginBottom: 10 }} />
                  <View style={{ width: '100%', height: 40, backgroundColor: colors.card, borderRadius: 6 }} />
                </View>
              ))
            ) : (
              (reviews.data || []).map((r, idx) => (
                <View key={`${r?.review?.recommendationid ?? idx}`} style={styles.reviewCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={styles.avatar} />
                    <Text style={styles.reviewHeader}>@{r.review.author?.steamid?.slice(-6) || 'user'}  <Text style={{ fontWeight: 'bold' }}>{r.gameName}</Text></Text>
                  </View>
                  <Text style={styles.reviewText} numberOfLines={4}>{r.review.review}</Text>
                  <View style={styles.starsRow}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Text key={i} style={{ color: i < (r.review.voted_up ? 5 : 2) ? '#FCD34D' : colors.border }}>*</Text>
                    ))}
                    <Text style={styles.ratingText}>( {r.review.voted_up ? '5,0' : '2,0'} )</Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {q.length >= 2 && (
          <>
            <Text style={styles.sectionTitle}>Resultados</Text>
            {searchRes.isLoading ? (
              <FlatList
                contentContainerStyle={styles.grid}
                data={[1,2,3,4,5,6]}
                keyExtractor={(i) => `skres-${i}`}
                numColumns={2}
                columnWrapperStyle={{ justifyContent: 'space-between' }}
                renderItem={() => <SkeletonCard width={'48%'} aspectRatio={3/4} />}
                scrollEnabled={false}
              />
            ) : searchRes.error ? (
              <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                <Text style={{ color: colors.secondary }}>Não foi possível buscar resultados. Tente novamente.</Text>
              </View>
            ) : (
              <FlatList
                contentContainerStyle={styles.grid}
                data={searchRes.data || []}
                keyExtractor={(item, index) => `${item.id}-${index}`}
                numColumns={2}
                columnWrapperStyle={{ justifyContent: 'space-between' }}
                renderItem={({ item }) => (
                  <GameGridItem name={item.name} image={item.background_image} onPress={() => router.push(`/game/${item.id}`)} />
                )}
                scrollEnabled={false}
              />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 },
  title: {
    ...typography.title,
    color: colors.primary,
    fontSize: 28,
    marginVertical: 12,
  },
  searchBox: { marginHorizontal: 16, marginBottom: 12 },
  input: { backgroundColor: colors.card, color: colors.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  sectionTitle: { ...typography.title, color: colors.primary, fontSize: 22, marginHorizontal: 16, marginTop: 12, marginBottom: 8 },
  cardImage: { width: 160, aspectRatio: 7/10, borderRadius: 12, backgroundColor: colors.card },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  ratingText: { ...typography.caption, color: colors.secondary, marginLeft: 6 },
  reviewCard: { marginHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  reviewHeader: { ...typography.body, color: colors.primary },
  reviewText: { ...typography.body, color: colors.primary, marginTop: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card },
  grid: { paddingHorizontal: 16, rowGap: 12, paddingBottom: 20 },
  suggBox: { marginHorizontal: 16, marginTop: -6, marginBottom: 8, backgroundColor: colors.card, borderRadius: 10 },
  suggItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  suggText: { ...typography.body, color: colors.primary },
});

