import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Image, Pressable, ActivityIndicator, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '@/components/theme/colors';
import { typography } from '@/components/theme/typography';
import { useProfileHeader, useCurrentlyGaming, useWishlist } from '@/hooks/useProfile';
import { useAuth } from '@/providers/AuthProvider';
import { useFollow } from '@/hooks/useFollow';
import { igdbCoverUrl, getFavoriteUserGame } from '@/services/profile';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const targetId = id || '';
  const { user } = useAuth();
  const me = user?.id || '';
  const header = useProfileHeader(targetId);
  const { isFollowing, followers, following, follow, unfollow, isWorking } = useFollow(targetId);
  const router = useRouter();

  const prof = header.data?.profile;
  const counters = header.data?.counters;
  const playing = useCurrentlyGaming(targetId);
  const wishlist = useWishlist(targetId);
  const [favName, setFavName] = React.useState<string | null>(null);
  const [favCover, setFavCover] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (!targetId) return;
      try {
        const fav = await getFavoriteUserGame(targetId);
        if (mounted && fav) {
          setFavName(fav.game.name);
          setFavCover(igdbCoverUrl(fav.game.cover_image_id || undefined, 't_1080p'));
        } else if (mounted) {
          setFavName(null);
          setFavCover(null);
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, [targetId]);

  const onFollow = async () => {
    if (!targetId || me === targetId) return;
    try {
      if (isFollowing) await unfollow(); else await follow();
      try { await Haptics.selectionAsync(); } catch {}
    } catch {}
  };

  if (header.isLoading) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!prof) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ padding:16 }}>
          <Text style={styles.title}>Perfil não encontrado</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Text style={[styles.back]}>{'< Voltar'}</Text></Pressable>
      </View>

      <View style={{ alignItems:'center', marginTop: 12 }}>
        <View style={styles.avatarWrap}>
          {prof.avatar_url ? (
            <Image source={{ uri: prof.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.card }]} />
          )}
        </View>
        <Text style={styles.username}>@{prof.username}</Text>
        {!!prof.display_name && <Text style={styles.displayName}>{prof.display_name}</Text>}
        {me !== targetId && (
          <Pressable onPress={onFollow} disabled={isWorking} style={[styles.followBtn, isFollowing && styles.followingBtn]}>
            <Text style={[styles.followTxt, isFollowing && styles.followingTxt]}>{isFollowing ? 'Seguindo' : 'Seguir'}</Text>
          </Pressable>
        )}
        <View style={styles.counters}>
          <Text style={styles.counterText}>{followers} seguidores</Text>
          <Text style={styles.counterText}>{following} seguindo</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{counters?.completed_count ?? 0}</Text>
          <Text style={styles.statLabel}>Jogos zerados</Text>
        </View>
        <View style={styles.statCard}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
            <Text style={styles.statNumber}>{0}</Text>
            <Ionicons name="trophy" size={18} color={colors.primary} />
          </View>
          <Text style={styles.statLabel}>Trophies</Text>
        </View>
        <View style={[styles.statCard, { padding:0, overflow:'hidden' }]}> 
          {favCover ? (
            <Image source={{ uri: favCover }} style={{ width:'100%', height:64 }} />
          ) : (
            <View style={{ width:'100%', height:64, backgroundColor: colors.card }} />
          )}
          <View style={{ padding:8 }}>
            <Text style={[styles.statLabel,{ color: colors.secondary }]}>Favorite Game</Text>
            <Text style={[styles.statFavName]} numberOfLines={1}>{favName || ''}</Text>
          </View>
        </View>
      </View>

      {/* Currently Gaming */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>CURRENTLY GAMING</Text>
      </View>
      {playing.isLoading ? (
        <Text style={styles.subtle}>Carregando...</Text>
      ) : (playing.data?.length ?? 0) === 0 ? (
        <Text style={[styles.subtle,{ paddingHorizontal:16 }]}>Sem jogos aqui ainda.</Text>
      ) : (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          data={playing.data || []}
          keyExtractor={(ug) => String(ug.id)}
          renderItem={({ item }) => {
            const url = igdbCoverUrl(item.game.cover_image_id || undefined) || undefined;
            return (
              <View style={{ width: 120, marginRight: 12 }}>
                {url ? (
                  <Image source={{ uri: url }} style={styles.cover} />
                ) : (
                  <View style={[styles.cover,{ backgroundColor: colors.card }]} />
                )}
                <Text style={styles.gameName} numberOfLines={2}>{item.game.name}</Text>
              </View>
            );
          }}
        />
      )}

      {/* Want to Play */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>WANT TO PLAY</Text>
      </View>
      {wishlist.isLoading ? (
        <Text style={styles.subtle}>Carregando...</Text>
      ) : (wishlist.data?.length ?? 0) === 0 ? (
        <Text style={[styles.subtle,{ paddingHorizontal:16 }]}>Sem jogos na wishlist.</Text>
      ) : (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          data={wishlist.data || []}
          keyExtractor={(ug) => String(ug.id)}
          renderItem={({ item }) => {
            const url = igdbCoverUrl(item.game.cover_image_id || undefined) || undefined;
            return (
              <View style={{ width: 120, marginRight: 12 }}>
                {url ? (
                  <Image source={{ uri: url }} style={styles.cover} />
                ) : (
                  <View style={[styles.cover,{ backgroundColor: colors.card }]} />
                )}
                <Text style={styles.gameName} numberOfLines={2}>{item.game.name}</Text>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 20 },
  back: { ...typography.caption, color: colors.secondary },
  avatarWrap: { width: 96, height: 96, borderRadius: 48, overflow:'hidden' },
  avatar: { width: '100%', height: '100%' },
  username: { ...typography.title, color: colors.primary, marginTop: 8 },
  displayName: { ...typography.body, color: colors.secondary, marginTop: 2 },
  followBtn: { marginTop: 10, backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  followTxt: { color: '#000', fontWeight: '600' },
  followingBtn: { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  followingTxt: { color: colors.primary },
  counters: { flexDirection:'row', alignItems:'center', gap: 12, marginTop: 10 },
  counterText: { ...typography.caption, color: colors.secondary },
  title: { ...typography.title, color: colors.primary },
  statsRow: { flexDirection:'row', gap: 12, paddingHorizontal: 16, marginTop: 18 },
  statCard: { flex:1, backgroundColor: colors.card, borderRadius: 10, padding: 12 },
  statNumber: { ...typography.title, color: colors.primary },
  statLabel: { ...typography.caption, color: colors.secondary },
  statFavName: { ...typography.body, color: colors.primary },
  sectionHeader: { paddingHorizontal:16, marginTop: 18, marginBottom: 6, flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  sectionTitle: { ...typography.title, color: colors.primary, fontSize: 14 },
  subtle: { ...typography.caption, color: colors.secondary },
  cover: { width: 120, height: 160, borderRadius: 10 },
  gameName: { ...typography.caption, color: colors.primary, marginTop: 6 },
});
