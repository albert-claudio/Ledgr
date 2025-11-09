import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Modal, ScrollView, SafeAreaView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../components/theme/colors';
import { typography } from '../components/theme/typography';
import { GameGridItem } from '../components/game/GameGridItem';
import { useCatalogFilters, useCatalogGames } from '../hooks/useCatalog';

type DateOptionKey = 'all' | 'last90' | 'thisYear' | 'y2010s' | 'y2000s' | 'before2000';

const computeDateRange = (key: DateOptionKey) => {
  const now = new Date();
  const end = Math.floor(now.getTime() / 1000);
  const year = now.getFullYear();
  switch (key) {
    case 'last90': {
      const start = Math.floor(new Date(now.getTime() - 90 * 24 * 3600 * 1000).getTime() / 1000);
      return { startEpoch: start, endEpoch: end };
    }
    case 'thisYear': {
      const start = Math.floor(new Date(year, 0, 1).getTime() / 1000);
      return { startEpoch: start, endEpoch: end };
    }
    case 'y2010s':
      return { startEpoch: Math.floor(new Date(2010, 0, 1).getTime() / 1000), endEpoch: Math.floor(new Date(2019, 11, 31).getTime() / 1000) };
    case 'y2000s':
      return { startEpoch: Math.floor(new Date(2000, 0, 1).getTime() / 1000), endEpoch: Math.floor(new Date(2009, 11, 31).getTime() / 1000) };
    case 'before2000':
      return { startEpoch: undefined, endEpoch: Math.floor(new Date(2000, 0, 1).getTime() / 1000) };
    default:
      return { startEpoch: undefined, endEpoch: undefined };
  }
};

export default function CatalogScreen() {
  const router = useRouter();
  const { genres, platforms } = useCatalogFilters();

  const [dateModal, setDateModal] = useState(false);
  const [genreModal, setGenreModal] = useState(false);
  const [platformModal, setPlatformModal] = useState(false);

  const [dateKey, setDateKey] = useState<DateOptionKey>('all');
  const [genreId, setGenreId] = useState<number | undefined>(undefined);
  const [platformId, setPlatformId] = useState<number | undefined>(undefined);

  const range = useMemo(() => computeDateRange(dateKey), [dateKey]);
  const filters = useMemo(() => ({ ...range, genreId, platformId, sort: 'popular' as const }), [range, genreId, platformId]);
  const query = useCatalogGames(filters);

  const data = query.data?.pages.flat() || [];

  const onEnd = () => {
    if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
  };

  const refreshing = query.isRefetching;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Descubra Catálogo</Text>
      </View>
      <View style={styles.filtersRow}>
        <Pressable onPress={() => setDateModal(true)} style={styles.filterChip}><Text style={styles.filterText}>Data</Text></Pressable>
        <Pressable onPress={() => setGenreModal(true)} style={styles.filterChip}><Text style={styles.filterText}>Gênero</Text></Pressable>
        <Pressable onPress={() => setPlatformModal(true)} style={styles.filterChip}><Text style={styles.filterText}>Plataforma</Text></Pressable>
      </View>

      <FlatList
        contentContainerStyle={styles.grid}
        data={data}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        renderItem={({ item }) => (
          <GameGridItem name={item.name} image={item.background_image} onPress={() => router.push(`/game/${item.id}`)} />
        )}
        onEndReachedThreshold={0.6}
        onEndReached={onEnd}
        refreshControl={<RefreshControl refreshing={!!refreshing} onRefresh={() => query.refetch()} tintColor={colors.accent} colors={[colors.accent]} />}
      />

      {/* Date modal */}
      <Modal visible={dateModal} transparent animationType="fade" onRequestClose={() => setDateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Período</Text>
            {([
              ['all','Todos'],
              ['last90','Últimos 90 dias'],
              ['thisYear','Este ano'],
              ['y2010s','2010–2019'],
              ['y2000s','2000–2009'],
              ['before2000','Antes de 2000'],
            ] as [DateOptionKey,string][]).map(([k,label]) => (
              <Pressable key={k} style={styles.modalItem} onPress={() => { setDateKey(k); setDateModal(false); }}>
                <Text style={[styles.modalText, dateKey===k && styles.modalTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      {/* Genre modal */}
      <Modal visible={genreModal} transparent animationType="fade" onRequestClose={() => setGenreModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCardList}>
            <Text style={styles.modalTitle}>Gênero</Text>
            <ScrollView>
              <Pressable style={styles.modalItem} onPress={() => { setGenreId(undefined); setGenreModal(false); }}>
                <Text style={styles.modalText}>Todos</Text>
              </Pressable>
              {(genres.data || []).map((g) => (
                <Pressable key={g.id} style={styles.modalItem} onPress={() => { setGenreId(g.id); setGenreModal(false); }}>
                  <Text style={[styles.modalText, genreId===g.id && styles.modalTextActive]}>{g.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Platform modal */}
      <Modal visible={platformModal} transparent animationType="fade" onRequestClose={() => setPlatformModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCardList}>
            <Text style={styles.modalTitle}>Plataforma</Text>
            <ScrollView>
              <Pressable style={styles.modalItem} onPress={() => { setPlatformId(undefined); setPlatformModal(false); }}>
                <Text style={styles.modalText}>Todas</Text>
              </Pressable>
              {(platforms.data || []).map((p) => (
                <Pressable key={p.id} style={styles.modalItem} onPress={() => { setPlatformId(p.id); setPlatformModal(false); }}>
                  <Text style={[styles.modalText, platformId===p.id && styles.modalTextActive]}>{p.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  title: { ...typography.title, color: colors.primary },
  filtersRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  filterChip: { backgroundColor: colors.card, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  filterText: { ...typography.caption, color: colors.secondary, fontSize: 12 },
  grid: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 80, rowGap: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.background, borderRadius: 8, padding: 16 },
  modalCardList: { backgroundColor: colors.background, borderRadius: 8, padding: 16, maxHeight: '70%' },
  modalTitle: { ...typography.title, color: colors.primary, marginBottom: 8, fontSize: 18 },
  modalItem: { paddingVertical: 10 },
  modalText: { ...typography.body, color: colors.primary },
  modalTextActive: { color: colors.accent },
});

