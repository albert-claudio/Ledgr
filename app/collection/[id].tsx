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
import { useAuth } from '@/providers/AuthProvider';
import {
  igdbCoverUrl,
  listCollectionGames,
  removeUserCollectionGame,
  UserCollection,
} from '@/services/profile';
import { supabase } from '@/lib/supabase';
import { AddGameModal } from '@/components/profile/AddGameModal';
import ConfirmModal from '@/components/common/ConfirmModal';
import { ErrorState } from '@/components/common/ErrorState';

type CollectionGame = Awaited<ReturnType<typeof listCollectionGames>>[number];

export default function CollectionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const parsedId = React.useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }, [id]);
  const { user } = useAuth();
  const userId = user?.id || null;
  const [showAdd, setShowAdd] = React.useState(false);
  const [toRemove, setToRemove] = React.useState<CollectionGame | null>(null);

  const {
    data: collection,
    isLoading: metaLoading,
    isError: metaError,
    refetch: refetchMeta,
    error: collectionError,
  } = useQuery({
    queryKey: ['collection:meta', userId, parsedId],
    enabled: !!userId && !!parsedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_collections')
        .select('*')
        .eq('profile_id', userId!)
        .eq('id', parsedId!)
        .maybeSingle<UserCollection>();
      if (error) throw error;
      if (!data) throw new Error('NOT_FOUND');
      return data;
    },
  });

  const {
    data: games,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['collection:games', userId, parsedId],
    enabled: !!userId && !!parsedId,
    queryFn: () => listCollectionGames(userId!, parsedId!),
  });

  const canMutate = !!userId && !!parsedId && !metaError;

  function renderContent() {
    if (!parsedId) {
      return <Text style={styles.subtle}>Colecao invalida.</Text>;
    }
    if (!userId) {
      return <Text style={styles.subtle}>Entre na sua conta para ver esta colecao.</Text>;
    }
    if (metaLoading) {
      return (
        <View style={styles.centerWrap}>
          <ActivityIndicator color={colors.accent} />
        </View>
      );
    }
    if (metaError) {
      const message =
        (collectionError as Error | undefined)?.message === 'NOT_FOUND'
          ? 'Colecao nao encontrada.'
          : 'Nao foi possivel carregar a colecao.';
      return (
        <ErrorState
          message={message}
          onRetry={() => {
            refetchMeta();
            refetch();
          }}
        />
      );
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
          message="Falha ao carregar os jogos"
          onRetry={() => {
            refetch();
          }}
        />
      );
    }
    if (!games?.length) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.subtle}>Nenhum jogo por aqui ainda.</Text>
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
        data={games}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => item.game?.igdb_id && router.push(`/game/${item.game.igdb_id}`)}
            onLongPress={() => canMutate && setToRemove(item)}
            delayLongPress={250}
          >
            <Cover imageId={item.game?.cover_image_id} />
            <View style={{ flex: 1 }}>
              <Text style={styles.gameName} numberOfLines={2}>
                {item.game?.name || 'Jogo'}
              </Text>
              <Text style={styles.gameMeta}>{formatAddedAt(item.created_at)}</Text>
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
          {collection?.name || (metaLoading ? 'Carregando...' : 'Colecao')}
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

      {parsedId && (
        <AddGameModal
          visible={showAdd}
          onClose={() => setShowAdd(false)}
          onAdded={() => refetch()}
          status="playing"
          skipStatusEntry
          collectionId={parsedId}
        />
      )}

      <ConfirmModal
        visible={!!toRemove}
        title="Remover jogo"
        message="Deseja remover este jogo da colecao?"
        confirmText="Remover"
        cancelText="Cancelar"
        onCancel={() => setToRemove(null)}
        onConfirm={async () => {
          if (!toRemove || !userId || !parsedId) return;
          try {
            await removeUserCollectionGame(userId, toRemove.id);
          } finally {
            setToRemove(null);
            refetch();
          }
        }}
      />
    </SafeAreaView>
  );
}

function Cover({ imageId }: { imageId?: string | null }) {
  const uri = igdbCoverUrl(imageId || undefined, 't_1080p');
  if (!uri) {
    return <View style={[styles.cover, styles.coverPlaceholder]} />;
  }
  return <Image source={{ uri }} style={styles.cover} />;
}

function formatAddedAt(input?: string | null) {
  if (!input) return '';
  try {
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return '';
    if (typeof d.toLocaleDateString === 'function') return `Adicionado em ${d.toLocaleDateString('pt-BR')}`;
    return `Adicionado em ${d.toISOString().slice(0, 10)}`;
  } catch {
    return '';
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
