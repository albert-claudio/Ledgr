import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, Image, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '@/components/theme/colors';
import { typography } from '@/components/theme/typography';
import { useAuth } from '@/providers/AuthProvider';
import { listCollectionGames, igdbCoverUrl, removeUserCollectionGame } from '@/services/profile';
import * as Haptics from 'expo-haptics';
import ConfirmModal from '@/components/common/ConfirmModal';
import { Ionicons } from '@expo/vector-icons';
import { AddGameModal } from '@/components/profile/AddGameModal';

export default function CollectionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const collectionId = id ? Number(id) : NaN;
  const { user } = useAuth();
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [toDelete, setToDelete] = React.useState<number | null>(null);
  const [showAdd, setShowAdd] = React.useState(false);

  async function load() {
    if (!user || !collectionId) return;
    setLoading(true);
    try {
      const rows = await listCollectionGames(user.id, collectionId);
      setItems(rows || []);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { load(); }, [user?.id, collectionId]);
  React.useEffect(() => {
    const isFabric = !!(globalThis as any)?.nativeFabricUIManager;
    if (Platform.OS === 'android' && !isFabric && (UIManager as any).setLayoutAnimationEnabledExperimental) {
      (UIManager as any).setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>{'< Voltar'}</Text></Pressable>
        <Text style={styles.title}>Colecao</Text>
        <Pressable onPress={() => setShowAdd(true)} hitSlop={10} style={styles.addBtnHeader}>
          <Ionicons name="add" size={22} color={colors.primary} />
        </Pressable>
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
              return (
                <Pressable
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
            message="Remover este jogo desta prateleira?"
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
                await removeUserCollectionGame(user.id, id);
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
        onAdded={() => load()}
        collectionId={collectionId}
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
  addBtnHeader: { padding: 6, width: 60, alignItems: 'flex-end' },
});
