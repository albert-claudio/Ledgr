import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Image, Pressable, ScrollView } from 'react-native';
import { typography } from '../../components/theme/typography';
import { colors } from '../../components/theme/colors';
import { useAuth } from '@/providers/AuthProvider';
import { useCurrentlyGaming, useWishlist } from '@/hooks/useProfile';
import { igdbCoverUrl, getPlatformsForIgdbIds, UserCollection, listUserCollections, getUserCollectionSamples } from '@/services/profile';
import { Ionicons } from '@expo/vector-icons';
import { CreateCollectionModal } from '@/components/profile/CreateCollectionModal';
import { useRouter } from 'expo-router';

export default function CollectionScreen() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const playing = useCurrentlyGaming(userId);
  const wishlist = useWishlist(userId);
  const [showCreate, setShowCreate] = React.useState(false);
  const [custom, setCustom] = React.useState<{ shelf: UserCollection; covers: (string | null)[]; count: number; platformIds: number[] }[]>([]);

  const router = useRouter();
  const playingCovers = (playing.data || []).slice(0, 3).map((ug) => igdbCoverUrl(ug.game.cover_image_id || undefined));
  const playingIds = (playing.data || []).map((ug) => ug.game.igdb_id);
  const wishlistCovers = (wishlist.data || []).slice(0, 3).map((ug) => igdbCoverUrl(ug.game.cover_image_id || undefined));
  const wishlistIds = (wishlist.data || []).map((ug) => ug.game.igdb_id);

  async function loadCustom() {
    if (!userId) return;
    const rows = await listUserCollections(userId);
    const acc: { shelf: UserCollection; covers: (string | null)[]; count: number; platformIds: number[] }[] = [];
    for (const shelf of rows) {
      const { games, count } = await getUserCollectionSamples(userId, shelf.id, 3);
      const covers = (games || []).map((g) => igdbCoverUrl(g.cover_image_id || undefined));
      const ids = (games || []).map((g) => g.igdb_id) as number[];
      acc.push({ shelf, covers, count: count || 0, platformIds: ids });
    }
    setCustom(acc);
  }

  React.useEffect(() => { if (userId) loadCustom(); }, [userId]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingTop: 24, paddingBottom: 42 }}>
        <Text style={styles.title}>SHELVES</Text>
        <View style={styles.titleDivider} />
        <Pressable onPress={() => setShowCreate(true)} style={styles.backlogBtn}>
          <Text style={styles.backlogTxt}>Update your backlog</Text>
        </Pressable>

        <ShelfRow title="Playing" count={playing.data?.length || 0} covers={playingCovers} platformIds={playingIds} onPress={() => router.push('/collection/status/playing')} />
        <View style={styles.separator} />

        <ShelfRow title="Want to Play" count={wishlist.data?.length || 0} covers={wishlistCovers} platformIds={wishlistIds} onPress={() => router.push('/collection/status/wishlist')} />
        <View style={styles.separator} />

        {/* Custom shelves */}
        {custom.map((it) => (
          <React.Fragment key={it.shelf.id}>
            <ShelfRow title={it.shelf.name} count={it.count} covers={it.covers} platformIds={it.platformIds} onPress={() => router.push(`/collection/${it.shelf.id}`)} />
            <View style={styles.separator} />
          </React.Fragment>
        ))}
      </ScrollView>

      <CreateCollectionModal visible={showCreate} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadCustom(); }} />
    </SafeAreaView>
  );
}

function ShelfRow({ title, count, covers, platformIds, onPress }: { title: string; count: number; covers: (string | null)[]; platformIds: number[]; onPress?: () => void }) {
  const [icons, setIcons] = React.useState<(keyof typeof Ionicons.glyphMap)[]>([]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const plats = await getPlatformsForIgdbIds((platformIds || []).slice(0, 12));
        if (!mounted) return;
        const glyphs = plats.slice(0, 3).map(slugToIcon).filter(Boolean) as (keyof typeof Ionicons.glyphMap)[];
        setIcons(glyphs);
      } catch {
        if (mounted) setIcons([]);
      }
    })();
    return () => { mounted = false; };
  }, [JSON.stringify(platformIds)]);

  const big = covers?.[0] || null;
  const small1 = covers?.[1] || null;
  const small2 = covers?.[2] || null;

  return (
    <Pressable style={styles.rowWrap} onPress={onPress as any}>
      <View style={styles.coverStack}>
        <View style={styles.bigCoverWrap}>
          {big ? <Image source={{ uri: big }} style={styles.bigCover} /> : <View style={[styles.bigCover, styles.coverPlaceholder]} />}
        </View>
        <View style={[styles.sliceCover, { left: 114 }]}>
          {small1 ? <Image source={{ uri: small1 }} style={styles.sliceImg} /> : <View style={[styles.sliceImg, styles.coverPlaceholder]} />}
        </View>
        <View style={[styles.sliceCover, { left: 134, backgroundColor: 'transparent' }]}>
          {small2 ? <Image source={{ uri: small2 }} style={styles.sliceImg} /> : <View style={[styles.sliceImg, styles.coverPlaceholder]} />}
        </View>
      </View>
      <View style={styles.metaBlock}>
        <Text style={styles.shelfTitle}>{title}</Text>
        <Text style={styles.shelfCount}>{count} games</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
          {icons.map((name, idx) => (
            <Ionicons key={idx} name={name as any} size={14} color={colors.primary} />
          ))}
        </View>
      </View>
    </Pressable>
  );
}

function slugToIcon(slug: string): keyof typeof Ionicons.glyphMap | null {
  const s = (slug || '').toLowerCase();
  if (!s) return null;
  if (s.includes('playstation')) return 'logo-playstation' as any;
  if (s.includes('xbox')) return 'logo-xbox' as any;
  if (s.includes('pc') || s.includes('windows') || s.includes('mac') || s.includes('linux')) return 'logo-windows' as any;
  if (s.includes('ios') || s.includes('apple')) return 'logo-apple' as any;
  if (s.includes('android')) return 'logo-android' as any;
  if (s.includes('nintendo') || s.includes('switch')) return 'game-controller' as any;
  return 'game-controller-outline' as any;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.title, color: colors.primary, fontSize: 20, textAlign: 'center', marginTop: 8, letterSpacing: 2 },
  titleDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginTop: 10, width: 90, alignSelf: 'center', marginBottom: 14 },
  backlogBtn: { alignSelf: 'center', backgroundColor: '#2A2A2A', paddingVertical: 14, paddingHorizontal: 18, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, width: '72%', alignItems: 'center', marginBottom: 10 },
  backlogTxt: { color: colors.primary, fontWeight: '700' },
  rowWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  coverStack: { width: 160, height: 160, position: 'relative' },
  bigCoverWrap: { position: 'absolute', left: 0, top: 0, width: 118, height: 158, borderRadius: 10, overflow: 'hidden' },
  bigCover: { width: '100%', height: '100%', borderRadius: 10 },
  sliceCover: { position: 'absolute', top: 0, width: 18, height: 158, borderRadius: 6, overflow: 'hidden', backgroundColor: colors.card },
  sliceImg: { width: '100%', height: '100%' },
  coverPlaceholder: { backgroundColor: colors.card },
  metaBlock: { flex: 1, marginLeft: 12 },
  shelfTitle: { ...typography.title, color: colors.primary, fontSize: 16 },
  shelfCount: { ...typography.caption, color: colors.secondary, marginTop: 2 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: 16, marginVertical: 10 },
});
