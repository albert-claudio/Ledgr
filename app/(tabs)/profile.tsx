import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  FlatList,
  Pressable,
  ScrollView,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { colors } from '../../components/theme/colors';
import { typography } from '../../components/theme/typography';
import { useAuth } from '@/providers/AuthProvider';
import { useCurrentlyGaming, useProfileHeader, useWishlist } from '@/hooks/useProfile';
import { igdbCoverUrl, getFavoriteUserGame, removeUserGame, removeAvatar } from '@/services/profile';
import { AddGameModal } from '@/components/profile/AddGameModal';
import { Ionicons } from '@expo/vector-icons';
import { NotificationBell } from '@/components/common/NotificationBell';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import ConfirmModal from '@/components/common/ConfirmModal';

export default function ProfileScreen() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const header = useProfileHeader(userId);
  const playing = useCurrentlyGaming(userId);
  const wishlist = useWishlist(userId);
  const [showAddPlaying, setShowAddPlaying] = useState(false);
  const [showAddWishlist, setShowAddWishlist] = useState(false);
  const [favName, setFavName] = useState<string | null>(null);
  const [favCover, setFavCover] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<{ type: 'playing' | 'wishlist'; gameId: number } | null>(null);
  const router = useRouter();

  const counters = header.data?.counters;
  const profile = header.data?.profile;
  const usernameToShow = useMemo(() => {
    const u = (profile?.username || '').trim();
    if (u) return u;
    const metaU = ((user as any)?.user_metadata?.username || '').trim();
    if (metaU) return metaU;
    const email = user?.email || '';
    const local = email.includes('@') ? email.split('@')[0] : email;
    return local || '';
  }, [profile?.username, (user as any)?.user_metadata?.username, user?.email]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (!userId) return;
      try {
        const fav = await getFavoriteUserGame(userId);
        if (mounted && fav) {
          setFavName(fav.game.name);
          setFavCover(igdbCoverUrl(fav.game.cover_image_id || undefined, 't_1080p'));
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, [userId]);

  async function onPickAvatar() {
    try {
      if (!userId) { Alert.alert('Aviso', 'Faca login para alterar o avatar.'); return; }
      // Check + request permission (accept limited on iOS)
      let perm = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (!perm.granted && (perm as any).status !== 'limited') {
        perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      }
      if (!perm.granted && (perm as any).status !== 'limited') {
        Alert.alert('Permissao', 'Permita acesso as fotos para escolher um avatar.');
        return;
      }
      const hasNew = (ImagePicker as any).MediaType && (ImagePicker as any).MediaType.Images;
      const pickOpts: any = { quality: 0.9 };
      if (hasNew) { pickOpts.mediaTypes = (ImagePicker as any).MediaType.Images; }
      const result = await ImagePicker.launchImageLibraryAsync(pickOpts);
      if (result?.canceled) return;
      const uri = (result as any)?.assets?.[0]?.uri as string | undefined;
      if (uri) {
        router.push(`/p/avatar?uri=${encodeURIComponent(uri)}`);
      }
    } catch (e) {
      Alert.alert('Erro', 'Nao foi possivel abrir a galeria.');
    }
  }

  async function onTakeAvatar() {
    try {
      if (!userId) { Alert.alert('Aviso', 'Faca login para tirar foto.'); return; }
      // Permissao de camera
      let perm = await ImagePicker.getCameraPermissionsAsync();
      if (!perm.granted) {
        perm = await ImagePicker.requestCameraPermissionsAsync();
      }
      if (!perm.granted) {
        Alert.alert('Permissao', 'Permita acesso a camera para tirar uma foto.');
        return;
      }
      const opts: any = { quality: 0.9 };
      // Camera frontal para selfie, quando disponivel
      if ((ImagePicker as any).CameraType) {
        opts.cameraType = (ImagePicker as any).CameraType.front;
      }
      const result = await ImagePicker.launchCameraAsync(opts);
      if (result?.canceled) return;
      const uri = (result as any)?.assets?.[0]?.uri as string | undefined;
      if (uri) {
        router.push(`/p/avatar?uri=${encodeURIComponent(uri)}`);
      }
    } catch (e) {
      Alert.alert('Erro', 'Nao foi possivel abrir a camera.');
    }
  }

  async function onRemoveAvatar() {
    if (!userId) return;
    Alert.alert(
      'Remover foto',
      'Deseja remover sua foto de perfil?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeAvatar(userId);
              try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
              header.refetch();
            } catch (e) {
              Alert.alert('Erro', 'Nao foi possivel remover a foto.');
            }
          },
        },
      ]
    );
  }

  function onEditAvatar() {
    const buttons: any[] = [];
    if (profile?.avatar_url) {
      buttons.push({ text: 'Remover foto', style: 'destructive', onPress: () => onRemoveAvatar() });
    }
    buttons.push(
      { text: 'Tirar foto', onPress: () => onTakeAvatar() },
      { text: 'Escolher da galeria', onPress: () => onPickAvatar() },
      { text: 'Cancelar', style: 'cancel' },
    );
    Alert.alert('Foto do perfil', 'O que deseja fazer?', buttons);
  }

  React.useEffect(() => {
    const isFabric = !!(globalThis as any)?.nativeFabricUIManager;
    if (Platform.OS === 'android' && !isFabric && (UIManager as any).setLayoutAnimationEnabledExperimental) {
      (UIManager as any).setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Top app bar */}
        <View style={styles.appBar}>
          <View style={styles.logoBox}><Text style={styles.logoTxt}>L</Text></View>
          <Text style={styles.appBarTitle}>Profile</Text>
          <View style={{ flexDirection:'row', alignItems:'center' }}>
            <NotificationBell size={20} />
            <Ionicons name="menu" size={22} color={colors.primary} style={{ marginLeft: 8 }} />
          </View>
        </View>

        {/* Avatar + edit */}
        <View style={{ alignItems:'center', marginTop: 12 }}>
          <View style={styles.avatarWithEdit}>
            <View style={styles.bigAvatarWrap}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.bigAvatar} />
              ) : (
                <View style={[styles.bigAvatar, styles.bigAvatarPlaceholder]}>
                  <Ionicons name="person" size={72} color={colors.secondary} />
                </View>
              )}
            </View>
            <Pressable onPress={onEditAvatar} style={styles.editBadgeOutside} hitSlop={10}>
              <Ionicons name="create" size={16} color="#000" />
            </Pressable>
          </View>
          <Text style={styles.bigUsername}>@{usernameToShow}</Text>
          {!!profile?.display_name && (
            <Text style={styles.subtitleLine} numberOfLines={1}>{profile.display_name}</Text>
          )}
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
          <Pressable onPress={() => router.push('/(tabs)/collection')}><Text style={styles.seeAll}>SEE ALL</Text></Pressable>
        </View>
        {playing.isLoading ? (
          <Text style={styles.subtle}>Carregando...</Text>
        ) : (playing.data?.length ?? 0) === 0 ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 6 }}>
            <Text style={styles.subtle}>Voce ainda nao adicionou jogos.</Text>
            <Pressable onPress={() => setShowAddPlaying(true)} style={[styles.primaryBtn,{marginTop:8, alignSelf:'flex-start'}]}>
              <Text style={styles.primaryTxt}>Adicionar</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            data={playing.data || []}
            keyExtractor={(ug) => String(ug.id)}
            renderItem={({ item }) => {
              const url = igdbCoverUrl(item.game.cover_image_id || undefined, "t_1080p") || undefined;
              return (
                <Pressable
                  onLongPress={async () => {
                    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                    setToDelete({ type: 'playing', gameId: item.game_id });
                  }}
                  style={{ width: 120, marginRight: 12 }}
                >
                  {url ? (
                    <Image source={{ uri: url }} style={styles.cover} />
                  ) : (
                    <View style={[styles.cover,{ backgroundColor: colors.card }]} />
                  )}
                  <Text style={styles.gameName} numberOfLines={2}>{item.game.name}</Text>
                </Pressable>
              );
            }}
            ListFooterComponent={
              <Pressable onPress={() => setShowAddPlaying(true)} style={styles.addFooterWrap} accessibilityLabel="Adicionar jogo em Currently Gaming">
                <View style={styles.addCircle}><Text style={styles.addPlus}>+</Text></View>
              </Pressable>
            }
          />
        )}

        {/* Wishlist */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>WANT TO PLAY</Text>
          <Pressable onPress={() => router.push('/(tabs)/collection')}><Text style={styles.seeAll}>SEE ALL</Text></Pressable>
        </View>
        {wishlist.isLoading ? (
          <Text style={styles.subtle}>Carregando...</Text>
        ) : (wishlist.data?.length ?? 0) === 0 ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 6 }}>
            <Text style={styles.subtle}>Sem jogos na sua wishlist.</Text>
            <Pressable onPress={() => setShowAddWishlist(true)} style={[styles.primaryBtn,{marginTop:8, alignSelf:'flex-start'}]}>
              <Text style={styles.primaryTxt}>Adicionar</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            data={wishlist.data || []}
            keyExtractor={(ug) => String(ug.id)}
            renderItem={({ item }) => {
              const url = igdbCoverUrl(item.game.cover_image_id || undefined, "t_1080p") || undefined;
              return (
                <Pressable
                  onLongPress={async () => {
                    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                    setToDelete({ type: 'wishlist', gameId: item.game_id });
                  }}
                  style={{ width: 120, marginRight: 12 }}
                >
                  {url ? (
                    <Image source={{ uri: url }} style={styles.cover} />
                  ) : (
                    <View style={[styles.cover,{ backgroundColor: colors.card }]} />
                  )}
                  <Text style={styles.gameName} numberOfLines={2}>{item.game.name}</Text>
                </Pressable>
              );
            }}
            ListFooterComponent={
              <Pressable onPress={() => setShowAddWishlist(true)} style={styles.addFooterWrap} accessibilityLabel="Adicionar jogo em Want to Play">
                <View style={styles.addCircle}><Text style={styles.addPlus}>+</Text></View>
              </Pressable>
            }
          />
        )}
      </ScrollView>

      <ConfirmModal
        visible={!!toDelete}
        title="Deseja excluir"
        message={toDelete?.type === 'wishlist' ? 'Remover este jogo da wishlist?' : 'Remover este jogo da colecao?'}
        confirmText="Excluir"
        cancelText="Cancelar"
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete || !userId) return;
          try {
            LayoutAnimation.configureNext({
              duration: 300,
              update: { type: LayoutAnimation.Types.easeInEaseOut },
              delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
            } as any);
            await removeUserGame(userId, toDelete.gameId);
          } finally {
            if (toDelete.type === 'playing') { playing.refetch(); } else { wishlist.refetch(); }
            header.refetch();
            setToDelete(null);
          }
        }}
      />

      <AddGameModal visible={showAddPlaying} status="playing" onClose={() => setShowAddPlaying(false)} onAdded={() => { playing.refetch(); header.refetch(); }} />
      <AddGameModal visible={showAddWishlist} status="wishlist" onClose={() => setShowAddWishlist(false)} onAdded={() => { wishlist.refetch(); header.refetch(); }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  appBar: { paddingHorizontal:16, paddingTop: 20, flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  logoBox: { width:28, height:28, backgroundColor:'#fff', borderRadius:4, alignItems:'center', justifyContent:'center' },
  logoTxt: { fontWeight:'900', fontSize:16 },
  appBarTitle: { ...typography.title, color: colors.primary, fontSize: 22, marginLeft: 8, flex: 1 },
  avatarWithEdit: { width:160, height:160, alignItems:'center', justifyContent:'center', position:'relative' },
  bigAvatarWrap: { width:160, height:160, borderRadius:80, overflow:'hidden', position:'relative', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  bigAvatar: { width:160, height:160, borderRadius:80 },
  bigAvatarPlaceholder: { backgroundColor: colors.card, alignItems:'center', justifyContent:'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  editBadgeOutside: { position:'absolute', right:-14, bottom:6, width:36, height:36, borderRadius:18, backgroundColor:'#fff', alignItems:'center', justifyContent:'center', shadowColor:'#000', shadowOpacity:0.35, shadowRadius:5, elevation:3, borderWidth:1, borderColor:'#000' },
  bigUsername: { ...typography.title, color: colors.primary, fontSize: 22, marginTop: 10 },
  subtitleLine: { ...typography.body, color: colors.secondary, marginTop: 4 },
  title: { ...typography.title, color: colors.primary, fontSize: 20 },
  subtle: { ...typography.caption, color: colors.secondary },
  primaryBtn: { backgroundColor: '#4DD4D9', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  primaryTxt: { color:'#001011', fontWeight:'800' },
  statsRow: { flexDirection:'row', gap:12, paddingHorizontal:16, marginTop: 12 },
  statCard: { flex:1, backgroundColor: colors.card, borderRadius: 10, padding: 10 },
  statNumber: { ...typography.title, color: colors.primary, fontSize: 18 },
  statLabel: { ...typography.caption, color: colors.primary, marginTop: 2 },
  statFavName: { ...typography.body, color: colors.primary, fontWeight: '700' as any },
  sectionHeader: { paddingHorizontal:16, marginTop: 18, marginBottom: 6, flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  sectionTitle: { ...typography.title, color: colors.primary, fontSize: 14, letterSpacing: 1 },
  seeAll: { ...typography.caption, color: colors.primary },
  addFooterWrap: { width: 48, height: 160, alignItems:'center', justifyContent:'center', marginRight: 16 },
  addCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, alignItems:'center', justifyContent:'center' },
  addPlus: { color: colors.black, fontWeight: '800', fontSize: 18, lineHeight: 18 },
  cover: { width: 120, height: 160, borderRadius: 10 },
  gameName: { ...typography.caption, color: colors.primary, marginTop: 6 },
});

