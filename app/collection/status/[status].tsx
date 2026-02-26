import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { colors } from '@/components/theme/colors';
import { typography } from '@/components/theme/typography';
import { AddGameModal } from '@/components/profile/AddGameModal';
import ConfirmModal from '@/components/common/ConfirmModal';
import { ErrorState } from '@/components/common/ErrorState';
import { useAuth } from '@/providers/AuthProvider';
import {
  getUserGamesByStatus,
  igdbCoverUrl,
  removeUserGameById,
  UserGameWithCatalog,
  UserGameRow,
} from '@/services/profile';

const STATUS_COPY: Record<
  UserGameRow['status'],
  { title: string; empty: string }
> = {
  playing: { title: 'Currently Gaming', empty: 'Voce ainda nao adicionou jogos aqui.' },
  wishlist: { title: 'Want to Play', empty: 'Nenhum jogo na wishlist.' },
  completed: { title: 'Zerados', empty: 'Nenhum jogo zerado ainda.' },
  paused: { title: 'Pausados', empty: 'Nenhum jogo pausado.' },
  dropped: { title: 'Abandonados', empty: 'Nenhum jogo abandonado.' },
};

type StatusKey = keyof typeof STATUS_COPY;

export default function StatusCollectionScreen() {
  const router = useRouter();
  const { status } = useLocalSearchParams<{ status?: string }>();
  const normalized = (status || '').toLowerCase() as StatusKey;
  const config = STATUS_COPY[normalized];
  const { user } = useAuth();
  const userId = user?.id || null;
  const [showAdd, setShowAdd] = React.useState(false);
  const [toRemove, setToRemove] = React.useState<UserGameWithCatalog | null>(null);

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['collection:status', userId, normalized],
    enabled: !!userId && !!config,
    queryFn: () => getUserGamesByStatus(userId!, normalized),
  });

  const canMutate = !!userId && !!config;

  function renderContent() {
    if (!config) {
      return <Text style={styles.subtle}>Status desconhecido.</Text>;
    }
    if (!userId) {
      return <Text style={styles.subtle}>Entre na sua conta para ver os jogos.</Text>;
    }
    if (isLoading) {
      return (
        <View style={styles.centerWrap}>
          <ActivityIndicator color={colors.accent} />
        </View>
      );
    }
    if (isError) {
      return (
        <ErrorState
          message="Nao foi possivel carregar os jogos"
          onRetry={() => refetch()}
        />
      );
    }
    if (!data || data.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.subtle}>{config.empty}</Text>
          {canMutate && (
            <Pressable onPress={() => setShowAdd(true)} style={[styles.addBtn, { marginTop: 16 }]}>
              <Text style={styles.addTxt}>Adicionar jogo</Text>
            </Pressable>
          )}
        </View>
      );
    }
    return (
      <FlatList
        data={data}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: 36 }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => item.game?.igdb_id && router.push(`/game/${item.game.igdb_id}`)}
            onLongPress={() => canMutate && setToRemove(item)}
            delayLongPress={250}
          >
            <StatusCover imageId={item.game?.cover_image_id} />
            <View style={{ flex: 1 }}>
              <Text style={styles.gameName} numberOfLines={2}>
                {item.game?.name || 'Jogo'}
              </Text>
              <Text style={styles.gameMeta}>Adicionado {formatLastSession(item)}</Text>
            </View>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>{'< Voltar'}</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {config?.title || 'Colecao'}
        </Text>
        <Pressable
          onPress={() => setShowAdd(true)}
          disabled={!canMutate}
          style={[styles.addBtn, !canMutate && styles.addBtnDisabled]}
        >
          <Text style={[styles.addTxt, !canMutate && styles.addTxtDisabled]}>Adicionar</Text>
        </Pressable>
      </View>

      <View style={styles.body}>{renderContent()}</View>

      {config && (
        <AddGameModal
          visible={showAdd}
          onClose={() => setShowAdd(false)}
          onAdded={() => refetch()}
          status={normalized}
        />
      )}

      <ConfirmModal
        visible={!!toRemove}
        title="Remover jogo"
        message="Deseja remover este jogo da lista?"
        confirmText="Remover"
        cancelText="Cancelar"
        onCancel={() => setToRemove(null)}
        onConfirm={async () => {
          if (!toRemove || !userId) return;
          try {
            await removeUserGameById(userId, toRemove.id);
          } finally {
            setToRemove(null);
            refetch();
          }
        }}
      />
    </SafeAreaView>
  );
}

function StatusCover({ imageId }: { imageId?: string | null }) {
  const uri = igdbCoverUrl(imageId || undefined, 't_1080p');
  if (!uri) {
    return <View style={[styles.cover, styles.coverPlaceholder]} />;
  }
  return <Image source={{ uri }} style={styles.cover} />;
}

function formatLastSession(item: UserGameWithCatalog) {
  const fallback = item.updated_at || item.created_at;
  if (!fallback) return 'recentemente';
  try {
    const d = new Date(fallback);
    if (Number.isNaN(d.getTime())) return 'recentemente';
    if (typeof d.toLocaleDateString === 'function') return `em ${d.toLocaleDateString('pt-BR')}`;
    return `em ${d.toISOString().slice(0, 10)}`;
  } catch {
    return 'recentemente';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  back: { ...typography.caption, color: colors.secondary },
  title: { ...typography.title, color: colors.primary, flex: 1, textAlign: 'center' },
  addBtn: {
    backgroundColor: '#4DD4D9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  addBtnDisabled: { opacity: 0.4 },
  addTxt: { color: '#001011', fontWeight: '800' },
  addTxtDisabled: { color: '#001011' },
  body: { flex: 1, paddingHorizontal: 16 },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  subtle: { ...typography.body, color: colors.secondary, textAlign: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  cover: { width: 70, height: 94, borderRadius: 8, backgroundColor: colors.card },
  coverPlaceholder: { backgroundColor: colors.card },
  gameName: { ...typography.body, color: colors.primary },
  gameMeta: { ...typography.caption, color: colors.secondary, marginTop: 4 },
});
