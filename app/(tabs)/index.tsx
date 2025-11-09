import React, { useCallback, useState } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  RefreshControl,
  SafeAreaView,
  Text,
  Image,
  FlatList,
  TouchableOpacity
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../../components/common/Button';
import { HomeHeader } from '../../components/Home/HomeHeader';
import { colors } from '../../components/theme/colors';
import { typography } from '../../components/theme/typography';
import { SideMenu } from '../../components/common/SideMenu';
import { useAuth } from '@/providers/AuthProvider';
import { useCurrentlyGaming, useProfileHeader } from '@/hooks/useProfile';
import { useRecentDiary } from '@/hooks/useDiary';
import { igdbCoverUrl } from '@/services/profile';

export default function HomeScreen() {
  const router = useRouter();
  const { signOut, user } = useAuth();

  const playingQuery = useCurrentlyGaming(user?.id);
  const header = useProfileHeader(user?.id);
  const diary = useRecentDiary(user?.id, 3);
  const [menuOpen, setMenuOpen] = useState(false);

  const isRefreshing = playingQuery.isRefetching;

  const handleRefresh = useCallback(() => {
    playingQuery.refetch();
  }, [playingQuery]);

  const handleCatalogPress = () => {
    router.push('/catalog');
  };

  const handleMenuPress = () => setMenuOpen(true);

  return (
    <SafeAreaView style={styles.container}>
      <HomeHeader onMenuPress={handleMenuPress} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {user?.id && (
          <View style={{ marginTop: 8, marginBottom: 4 }}>
            <Text style={styles.sectionTitle}>Continuar Jogando</Text>
            {playingQuery.isLoading ? (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={[1,2,3,4]}
                keyExtractor={(i) => `playing-skel-${i}`}
                renderItem={() => (
                  <View style={styles.playingCard}>
                    <View style={[styles.playingCover, { backgroundColor: colors.card }]} />
                  </View>
                )}
                contentContainerStyle={styles.playingListContent}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            ) : (playingQuery.data?.length ?? 0) > 0 ? (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.playingListContent}
                data={playingQuery.data || []}
                keyExtractor={(ug) => String(ug.id)}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                renderItem={({ item }) => {
                  const url = igdbCoverUrl(item.game.cover_image_id || undefined) || undefined;
                  const igdbId = item.game.igdb_id;
                  return (
                    <View style={styles.playingCard}>
                      <TouchableOpacity activeOpacity={0.8} onPress={() => router.push(`/game/${igdbId}`)}>
                        {url ? (
                          <Image source={{ uri: url }} style={styles.playingCover} />
                        ) : (
                          <View style={[styles.playingCover,{ backgroundColor: colors.card }]} />
                        )}
                      </TouchableOpacity>
                      <Text style={styles.playingName} numberOfLines={2}>{item.game.name}</Text>
                    </View>
                  );
                }}
              />
            ) : null}
          </View>
        )}

        {user?.id && (
          <View style={styles.challengeCard}>
            <Text style={styles.challengeTitle}>Seu Desafio de {new Date().getFullYear()}</Text>
            <View style={styles.challengeTopRow}>
              <Text style={styles.challengeNumbers}>
                {(header.data?.counters?.completed_count ?? 0)} / {25} <Text style={styles.challengeNumbersSuffix}>jogos concluídos</Text>
              </Text>
              <Text style={styles.challengeMetaHint}>Meta anual definida por você</Text>
            </View>
            <ProgressBar
              value={(header.data?.counters?.completed_count ?? 0)}
              goal={25}
            />
            <ChallengeHint
              value={(header.data?.counters?.completed_count ?? 0)}
              goal={25}
            />
          </View>
        )}

        {user?.id && (
          <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
            <Text style={styles.sectionTitle}>O Diário</Text>
            {diary.isLoading ? (
              <Text style={styles.subtle}>Carregando...</Text>
            ) : (diary.data?.length ?? 0) === 0 ? (
              <Text style={styles.subtle}>Sem anotações ainda.</Text>
            ) : (
              <View style={{ gap: 12 }}>
                {(diary.data || []).map((it) => (
                  <TouchableOpacity key={it.id} style={styles.diaryItem} onPress={() => router.push(`/game/${it.igdb_id}`)}>
                    {it.game.cover_url ? (
                      <Image source={{ uri: it.game.cover_url }} style={styles.diaryCover} />
                    ) : (
                      <View style={[styles.diaryCover, { backgroundColor: colors.card }]} />
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                        <Text style={styles.diaryGame} numberOfLines={1}>{it.game.name}</Text>
                        <Text style={styles.diaryDate}>{formatRelativePt(it.created_at)}</Text>
                      </View>
                      <Text style={styles.diaryText} numberOfLines={2}>{it.text}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={() => router.push('/diary')} style={styles.diaryButton}>
                  <Text style={styles.diaryButtonText}>Ver todo o diário</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        

        <View style={styles.buttonContainer}>
          <Button
            title="Descubra o catalogo"
            onPress={handleCatalogPress}
            icon="chevron-forward"
            style={styles.catalogButton}
          />
        </View>
      </ScrollView>

      <SideMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Menu"
        items={[
          { label: 'Sobre nos' },
          { label: 'Leis e Termos' },
          { label: 'Configuracoes' },
          { label: 'Sair', onPress: () => signOut() },
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  buttonContainer: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  catalogButton: {
    width: '100%',
  },
  sectionTitle: {
    ...typography.title,
    color: colors.primary,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  subtle: { ...typography.caption, color: colors.secondary },
  playingListContent: {
    paddingHorizontal: 16,
  },
  separator: {
    width: 12,
  },
  playingCard: {
    width: 120,
  },
  playingCover: {
    width: 120,
    height: 160,
    borderRadius: 10,
  },
  playingName: {
    ...typography.caption,
    color: colors.primary,
    marginTop: 6,
  },
  challengeCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.button,
    shadowColor: colors.black,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  challengeTitle: {
    ...typography.header,
    color: colors.accent,
    marginBottom: 8,
  },
  challengeTopRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  challengeNumbers: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.accent,
  },
  challengeNumbersSuffix: {
    ...typography.body,
    color: colors.secondary,
  },
  challengeMetaHint: {
    ...typography.caption,
    color: colors.secondary,
  },
  diaryItem: { flexDirection:'row', gap: 12, alignItems: 'center' },
  diaryCover: { width: 48, height: 64, borderRadius: 8 },
  diaryGame: { ...typography.body, color: colors.primary, fontWeight: '600' },
  diaryDate: { ...typography.caption, color: colors.secondary, marginLeft: 8 },
  diaryText: { ...typography.caption, color: colors.secondary, marginTop: 4 },
  diaryButton: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.button },
  diaryButtonText: { ...typography.body, color: colors.accent, fontWeight: '600' },
});

// ProgressBar component (inline)
function ProgressBar({ value, goal }: { value: number; goal: number }) {
  const [width, setWidth] = React.useState(0);
  const pct = goal > 0 ? value / goal : 0;
  const fill = Math.min(1, pct) * width;
  const overflow = Math.max(0, pct - 1) * width;
  return (
    <View style={{ marginBottom: 8 }}>
      <View
        style={{
          height: 14,
          borderRadius: 8,
          backgroundColor: colors.border,
          position: 'relative',
        }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        <View style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: fill,
          backgroundColor: colors.accent,
          borderRadius: 8,
        }} />
        {overflow > 0 && (
          <View style={{
            position: 'absolute',
            left: width,
            top: 0,
            bottom: 0,
            width: overflow,
            backgroundColor: colors.accent,
            opacity: 0.5,
            borderTopRightRadius: 8,
            borderBottomRightRadius: 8,
          }} />
        )}
      </View>
    </View>
  );
}

function ChallengeHint({ value, goal }: { value: number; goal: number }) {
  const remaining = Math.max(0, goal - value);
  if (goal > 0 && value >= goal) {
    return <Text style={{ ...typography.body, color: colors.accent, marginTop: 6 }}>Meta concluída. Mandou bem.</Text>;
  }
  if (goal > 0 && value >= Math.max(goal - 3, Math.floor(goal * 0.88))) {
    return <Text style={{ ...typography.body, color: colors.accent, marginTop: 6 }}>Você está quase lá. Continua.</Text>;
  }
  if (value <= Math.max(2, Math.floor(goal * 0.1))) {
    return <Text style={{ ...typography.body, color: colors.accent, marginTop: 6 }}>Primeiros passos, bora continuar.</Text>;
  }
  return null;
}

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
