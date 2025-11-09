import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, Image, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '@/components/theme/colors';
import { typography } from '@/components/theme/typography';
import { useAuth } from '@/providers/AuthProvider';
import { getUserGamesByStatus, igdbCoverUrl, removeUserGameById } from '@/services/profile';
import * as Haptics from 'expo-haptics';
import ConfirmModal from '@/components/common/ConfirmModal';
import { Ionicons } from '@expo/vector-icons';
import { AddGameModal } from '@/components/profile/AddGameModal';

export default function StatusCollectionScreen() {
  const router = useRouter();
  const { status } = useLocalSearchParams<{ status: string }>();
  const { user } = useAuth();
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [toDelete, setToDelete] = React.useState<number | null>(null);
  const [showAdd, setShowAdd] = React.useState(false);

  async function load() {
    if (!user || !status) return;
    setLoading(true);
    try {
      const rows = await getUserGamesByStatus(user.id, status as any);
      setItems(rows || []);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { load(); }, [user?.id, status]);
  React.useEffect(() => {
    const isFabric = !!(globalThis as any)?.nativeFabricUIManager;
    if (Platform.OS === 'android' && !isFabric && (UIManager as any).setLayoutAnimationEnabledExperimental) {
      (UIManager as any).setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const title = (status === 'playing') ? 'Playing' : (status === 'wishlist') ? 'Want to Play' : String(status || '').toUpperCase();
  const canAdd = status === 'playing' || status === 'wishlist';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>{'< Voltar'}</Text></Pressable>
        <Text style={styles.title}>{title}</Text>
        {canAdd ? (
          <Pressable onPress={() => setShowAdd(true)} hitSlop={10} style={{ width: 60, alignItems: 'flex-end', padding: 6 }}>
            <Ionicons name="add" size={22} color={colors.primary} />
          </Pressable>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {loading ? (
        <Text style={styles.subtle}>Carregando...</Text>
      ) : items.length === 0 ? (
        <View style={{ padding: 16 }}>
          <Text style={styles.subtle}>Sem jogos ainda.</Text>
        </View>
      ) : (
        <>
          <FlatList
            numColumns={3}
            data={items}
            keyExtractor={(it) => String(it.id)}
            contentContainerStyle={{ padding: 12 }}
            renderItem={({ item }) => {
              const url = igdbCoverUrl(item.game?.cover_image_id || undefined) || undefined;
              const igdbId = item?.game?.igdb_id as number | undefined;
              return (
                <Pressable
                  onPress={() => { if (igdbId) router.push(`/game/${igdbId}`); }}
                  onLongPress={async () => { try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}; setToDelete(item.id); }}
                  style={{ width: '33.33%', padding: 6 }}
                >
                  {url ? (
                    <Image source={{ uri: url }} style={{ width: '100%', aspectRatio: 3/4, borderRadius: 8 }} />
                  ) : (
                    <View style={{ width: '100%', aspectRatio: 3/4, borderRadius: 8, backgroundColor: colors.card }} />
                  )}
                </Pressable>
              );
            }}
          />
          <ConfirmModal
            visible={toDelete != null}
            title="Deseja excluir"
            message="Remover este jogo?"
            confirmText="Excluir"
            cancelText="Cancelar"
            onCancel={() => setToDelete(null)}
            onConfirm={async () => {
              const id = toDelete;
              if (!user?.id || id == null) { setToDelete(null); return; }
              try {
                LayoutAnimation.configureNext({
                  duration: 300,
                  update: { type: LayoutAnimation.Types.easeInEaseOut },
                  delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
                } as any);
                setItems((prev) => prev.filter((r: any) => r.id !== id));
                setToDelete(null);
                await removeUserGameById(user.id, id);
              } finally {
                load();
              }
            }}
          />
        </>
      )}
      <AddGameModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={() => { setShowAdd(false); load(); }}
        status={(status as any) || 'playing'}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingTop: 24 },
  title: { ...typography.title, color: colors.primary, fontSize: 18 },
  back: { color: colors.primary },
  subtle: { ...typography.caption, color: colors.secondary, paddingHorizontal:16, paddingTop: 8 },
});
