import React, { useMemo, useState } from 'react';
import { Modal, View, Text, TextInput, StyleSheet, FlatList, Pressable, Image, ActivityIndicator } from 'react-native';
import { colors } from '@/components/theme/colors';
import { typography } from '@/components/theme/typography';
import { useSearchGames } from '@/hooks/useSearch';
import { extractIgdbImageIdFromUrl, igdbCoverUrl, addUserGame, upsertGameFromIGDB, UserGameRow } from '@/services/profile';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

type Props = {
  visible: boolean;
  onClose: () => void;
  onAdded?: () => void; // refresh caller lists
  status?: UserGameRow['status']; // default 'playing' | can be 'completed'
  collectionId?: number; // optionally also add to a custom collection
  skipStatusEntry?: boolean; // when true, do not touch user_games (used for custom collections)
};

export function AddGameModal({ visible, onClose, onAdded, status = 'playing', collectionId, skipStatusEntry = false }: Props) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const q = useMemo(() => text.trim(), [text]);
  const res = useSearchGames(q);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function ensureOwnProfile() {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
    if (!data) {
      const fallback = (user.user_metadata as any)?.username || (user.email || '').split('@')[0] || 'user';
      await supabase.from('profiles').upsert({ id: user.id, username: String(fallback).toLowerCase() });
    }
  }

  async function handleAdd(item: { id: number; name: string; slug: string; background_image?: string | null }) {
    if (!user || busyId) return;
    setErr(null);
    setBusyId(item.id);
    try {
      await ensureOwnProfile();
      const coverId = extractIgdbImageIdFromUrl(item.background_image || undefined);
      const game = await upsertGameFromIGDB({ igdb_id: item.id, name: item.name, slug: item.slug, cover_image_id: coverId || undefined });
      if (!skipStatusEntry) {
        await addUserGame(user.id, game.id, status);
      }
      if (collectionId) {
        try { const { addGameToCollection } = await import('@/services/profile'); await addGameToCollection(user.id, collectionId, game.id); } catch {}
      }
      onAdded?.();
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'Falha ao adicionar jogo.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <Text style={styles.title}>Adicionar jogo</Text>
        <TextInput
          placeholder="Buscar no IGDB"
          placeholderTextColor={colors.secondary}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          value={text}
          onChangeText={setText}
          returnKeyType="search"
        />

        {res.isLoading ? (
          <Text style={styles.subtitle}>Buscando…</Text>
        ) : res.error ? (
          <Text style={[styles.subtitle,{color:'#f87171'}]}>Erro ao buscar. Tente novamente.</Text>
        ) : (
          <FlatList
            contentContainerStyle={{ paddingBottom: 20 }}
            data={res.data || []}
            keyExtractor={(it, idx) => `${String(it?.id ?? 'row')}:${idx}`}
            renderItem={({ item }) => {
              const coverId = extractIgdbImageIdFromUrl(item.background_image || undefined);
              const img = igdbCoverUrl(coverId || undefined) || item.background_image || undefined;
              return (
                <View style={styles.row}>
                  {img ? (
                    <Image source={{ uri: img }} style={styles.cover} />
                  ) : (
                    <View style={[styles.cover,{backgroundColor:colors.card}]} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.gameName} numberOfLines={2}>{item.name}</Text>
                    <Pressable onPress={() => handleAdd(item)} style={[styles.addBtn, busyId===item.id && { opacity: 0.6 }]} disabled={busyId===item.id}>
                      {busyId===item.id ? (
                        <ActivityIndicator size="small" color="#001011" />
                      ) : (
                        <Text style={styles.addTxt}>Adicionar</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              );
            }}
          />
        )}

        {err ? <Text style={[styles.subtitle,{color:'#f87171'}]}>{err}</Text> : null}

        <Pressable onPress={onClose} style={[styles.addBtn,{backgroundColor:colors.card, marginTop:4}]}> 
          <Text style={[styles.addTxt,{color:colors.primary}]}>Fechar</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor: colors.background, padding: 16 },
  title: { ...typography.title, color: colors.primary, fontSize: 20, marginBottom: 8 },
  subtitle: { ...typography.body, color: colors.secondary, marginBottom: 8 },
  input: { backgroundColor: colors.card, color: colors.primary, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  cover: { width: 54, height: 72, borderRadius: 6 },
  gameName: { ...typography.body, color: colors.primary, marginBottom: 8 },
  addBtn: { backgroundColor: '#4DD4D9', alignSelf:'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addTxt: { color:'#001011', fontWeight:'700' },
});
