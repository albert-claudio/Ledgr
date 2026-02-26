import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/components/theme/colors';
import { typography } from '@/components/theme/typography';
import { useAuth } from '@/providers/AuthProvider';
import { useRecentDiary } from '@/hooks/useDiary';

export default function DiaryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const diary = useRecentDiary(user?.id, 50);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>{'< Voltar'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Seu Diário</Text>
      </View>
      {diary.isLoading ? (
        <Text style={styles.subtle}>Carregando...</Text>
      ) : (diary.data?.length ?? 0) === 0 ? (
        <Text style={styles.subtle}>Sem anotações ainda.</Text>
      ) : (
        <FlatList
          data={diary.data}
          keyExtractor={(it) => String(it.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item: it }) => (
            <TouchableOpacity style={styles.item} onPress={() => router.push(`/game/${it.igdb_id}`)}>
              {it.game.cover_url ? (
                <Image source={{ uri: it.game.cover_url }} style={styles.cover} />
              ) : (
                <View style={[styles.cover, { backgroundColor: colors.card }]} />
              )}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                  <Text style={styles.game} numberOfLines={1}>{it.game.name}</Text>
                  <Text style={styles.date}>{formatRelativePt(it.created_at)}</Text>
                </View>
                <Text style={styles.text} numberOfLines={2}>{it.text}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 16 },
  back: { ...typography.caption, color: colors.secondary, marginBottom: 8 },
  title: { ...typography.title, color: colors.primary },
  subtle: { ...typography.caption, color: colors.secondary, paddingHorizontal: 16, marginTop: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cover: { width: 48, height: 64, borderRadius: 8 },
  game: { ...typography.body, color: colors.primary, fontWeight: '600' },
  date: { ...typography.caption, color: colors.secondary, marginLeft: 8 },
  text: { ...typography.caption, color: colors.secondary, marginTop: 4 },
});

function formatRelativePt(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
    const diffMs = startOfDay(now).getTime() - startOfDay(d).getTime();
    const diffDays = Math.round(diffMs / (24 * 3600 * 1000));
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const day = d.getDate();
    const mon = months[d.getMonth()];
    const year = d.getFullYear();
    if (year === now.getFullYear()) return `${day} de ${mon}`;
    return `${day} de ${mon} de ${year}`;
  } catch {
    return '';
  }
}