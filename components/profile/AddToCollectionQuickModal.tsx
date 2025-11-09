import React, { useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { colors } from '@/components/theme/colors';
import { typography } from '@/components/theme/typography';
import { useAuth } from '@/providers/AuthProvider';
import { addUserGame, extractIgdbImageIdFromUrl, upsertGameFromIGDB, listUserCollections } from '@/services/profile';
import { addGameToCollection } from '@/services/profile';
import { supabase } from '@/lib/supabase';
import * as Haptics from 'expo-haptics';

type Status = 'playing' | 'wishlist';

type Props = {
  visible: boolean;
  onClose: () => void;
  game: {
    id: number; // IGDB id
    name: string;
    slug?: string | null;
    coverUrl?: string | null;
  } | null;
};

export function AddToCollectionQuickModal({ visible, onClose, game }: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = useState<Status | null>(null);
  const [busyCol, setBusyCol] = useState<number | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [collections, setCollections] = useState<{ id: number; name: string }[]>([]);

  const canAdd = !!user && !!game?.id;

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (!visible || !user) return;
      try {
        const rows = await listUserCollections(user.id);
        if (mounted) setCollections(rows.map(r => ({ id: r.id, name: r.name })));
      } catch { if (mounted) setCollections([]); }
    })();
    return () => { mounted = false; };
  }, [visible, user?.id]);

  const handleChoose = async (status: Status) => {
    if (!canAdd || !game || busy) return;
    setErr(null);
    setBusy(status);
    try {
      // Ensure profile row exists for FK/RLS
      const { data: prof } = await supabase.from('profiles').select('id').eq('id', user!.id).maybeSingle();
      if (!prof) {
        const fallback = (user as any)?.user_metadata?.username || (user?.email || '').split('@')[0] || 'user';
        await supabase.from('profiles').upsert({ id: user!.id, username: String(fallback).toLowerCase() });
      }
      const coverId = extractIgdbImageIdFromUrl(game.coverUrl || undefined) || undefined;
      const g = await upsertGameFromIGDB({ igdb_id: game.id, name: game.name, slug: game.slug || undefined, cover_image_id: coverId });
      await addUserGame(user!.id, g.id, status);
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      setSuccess('Adicionado com sucesso');
      setBusy(null);
    } catch (e: any) {
      setBusy(null);
      setErr(e?.message || 'Falha ao adicionar.');
    }
  };

  const handleAddToCollection = async (collectionId: number) => {
    if (!canAdd || !game || busy || busyCol) return;
    setErr(null);
    setBusyCol(collectionId);
    try {
      // Ensure profile row exists
      const { data: prof } = await supabase.from('profiles').select('id').eq('id', user!.id).maybeSingle();
      if (!prof) {
        const fallback = (user as any)?.user_metadata?.username || (user?.email || '').split('@')[0] || 'user';
        await supabase.from('profiles').upsert({ id: user!.id, username: String(fallback).toLowerCase() });
      }
      const coverId = extractIgdbImageIdFromUrl(game.coverUrl || undefined) || undefined;
      const g = await upsertGameFromIGDB({ igdb_id: game.id, name: game.name, slug: game.slug || undefined, cover_image_id: coverId });
      await addGameToCollection(user!.id, collectionId, g.id);
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      setSuccess('Adicionado com sucesso');
    } catch (e: any) {
      setErr(e?.message || 'Falha ao adicionar.');
    } finally {
      setBusyCol(null);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Adicionar em…</Text>
          {game ? <Text style={styles.subtitle} numberOfLines={2}>{game.name}</Text> : null}

          {success ? (
            <Text style={[styles.success]}>{success}</Text>
          ) : (
            <View style={{ gap: 10, marginTop: 8, alignSelf:'stretch' }}>
              <Pressable onPress={() => handleChoose('playing')} style={[styles.optionBtn]} disabled={!canAdd || !!busy}>
                {busy === 'playing' ? (
                  <ActivityIndicator color="#001011" />
                ) : (
                  <Text style={styles.optionTxt}>Currently Gaming</Text>
                )}
              </Pressable>
              <Pressable onPress={() => handleChoose('wishlist')} style={[styles.optionBtn]} disabled={!canAdd || !!busy}>
                {busy === 'wishlist' ? (
                  <ActivityIndicator color="#001011" />
                ) : (
                  <Text style={styles.optionTxt}>Want to Play</Text>
                )}
              </Pressable>
              {collections.map((c) => (
                <Pressable key={c.id} onPress={() => handleAddToCollection(c.id)} style={[styles.optionBtn, { backgroundColor: '#374151' }]} disabled={!canAdd || !!busyCol}>
                  {busyCol === c.id ? (
                    <ActivityIndicator color="#001011" />
                  ) : (
                    <Text style={[styles.optionTxt,{ color:'#fff' }]}>{c.name}</Text>
                  )}
                </Pressable>
              ))}
            </View>
          )}

          {err ? <Text style={styles.err}>{err}</Text> : null}

          <Pressable onPress={onClose} style={[styles.closeBtn, success && { backgroundColor: colors.card }]}>
            <Text style={[styles.closeTxt]}>{success ? 'Fechar' : 'Cancelar'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex:1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems:'center', justifyContent:'center' },
  card: { width: 300, borderRadius: 14, backgroundColor: '#111213', padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#2a2b2e' },
  title: { ...typography.title, color: colors.primary, fontSize: 18, textAlign:'center' },
  subtitle: { ...typography.caption, color: colors.secondary, marginTop: 4, textAlign:'center' },
  optionBtn: { backgroundColor:'#4DD4D9', borderRadius: 10, paddingVertical: 10, alignItems:'center' },
  optionTxt: { color:'#001011', fontWeight:'800' },
  err: { color:'#f87171', marginTop: 8, textAlign:'center' },
  success: { color:'#a7f3d0', marginTop: 12, textAlign:'center', fontWeight:'700' },
  closeBtn: { marginTop: 12, backgroundColor: colors.card, paddingVertical: 10, borderRadius: 10, alignItems:'center' },
  closeTxt: { color: colors.primary, fontWeight:'700' },
});
