import ConfirmModal from '@/components/common/ConfirmModal';
import { NotificationBell } from '@/components/common/NotificationBell';
import { AddGameModal } from '@/components/profile/AddGameModal';
import { useMostPlayedGame, useProfileHeader, useSteamTrophies, useTopRatedGames, useWishlist } from '@/hooks/useProfile';
import { useSteamAccount } from '@/hooks/useSteamAccount';
import { clearSteamAuthState, saveSteamAuthState } from '@/lib/steamAuth';
import { steamErrorMessage } from '@/lib/steamErrors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { igdbCoverUrl, removeAvatar, removeUserGame } from '@/services/profile';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    LayoutAnimation,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    UIManager,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../components/theme/colors';
import { typography } from '../../components/theme/typography';

export default function ProfileScreen() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const header = useProfileHeader(userId);
  const wishlist = useWishlist(userId);
  const trophies = useSteamTrophies(userId);
  const mostPlayed = useMostPlayedGame(userId);
  const topRated = useTopRatedGames(userId);
  const steamAccount = useSteamAccount(userId);
  
  const [showAddWishlist, setShowAddWishlist] = useState(false);
  const [toDelete, setToDelete] = useState<{ type: 'wishlist'; gameId: number } | null>(null);
  const [steamAuthLinking, setSteamAuthLinking] = useState(false);
  const [steamAuthMessage, setSteamAuthMessage] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false); // Track avatar loading errors
  const router = useRouter();

  const counters = header.data?.counters;
  const profile = header.data?.profile;

  // Derived state for Favorite Game (Most Played)
  const favName = mostPlayed.data?.name || null;
  const favCover = useMemo(() => {
    if (!mostPlayed.data) return null;
    if (mostPlayed.data.source === 'igdb' && mostPlayed.data.cover_image_id) {
      return igdbCoverUrl(mostPlayed.data.cover_image_id, 't_1080p');
    }
    if (mostPlayed.data.source === 'steam' && mostPlayed.data.header_image) {
      return mostPlayed.data.header_image;
    }
    return null;
  }, [mostPlayed.data]);

  const usernameToShow = useMemo(() => {
    const u = (profile?.username || '').trim();
    if (u) return u;
    const metaU = ((user as any)?.user_metadata?.username || '').trim();
    if (metaU) return metaU;
    const email = user?.email || '';
    const local = email.includes('@') ? email.split('@')[0] : email;
    return local || '';
  }, [profile?.username, (user as any)?.user_metadata?.username, user?.email]);

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

  async function onSyncSteam() {
    if (!userId) {
      Alert.alert('Steam', 'Faca login para sincronizar com a Steam.');
      return;
    }
    try {
      setSteamAuthLinking(true);
      setSteamAuthMessage('Abrindo login da Steam...');
      // Evita o proxy do Expo para reduzir reloads; usa schema do app
      const redirectTo = Linking.createURL('steam-auth');
      const { data, error } = await supabase.functions.invoke('steam_openid', {
        body: { action: 'start', redirectTo },
      });
      if (error) throw error;
      const authUrl = (data as any)?.url as string | undefined;
      const expectedState = (data as any)?.state as string | undefined;
      if (!authUrl || !expectedState) throw new Error('Fluxo da Steam indisponivel no momento. Tente novamente mais tarde.');
      await saveSteamAuthState(expectedState);

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectTo);
      setSteamAuthMessage('Validando retorno da Steam...');
      if (result.type === 'cancel' || result.type === 'dismiss') {
        await clearSteamAuthState();
        return;
      }
      if (result.type !== 'success' || !result.url) {
        await clearSteamAuthState();
        throw new Error('Nao foi possivel completar o login na Steam. Tente novamente.');
      }

      const extractor = (urlStr: string) => { try { const p: any = Linking.parse(urlStr) || {}; const qp: any = p.queryParams || {}; let steamid = (qp.steamid as string | undefined) || undefined; let state = (qp.state as string | undefined) || undefined; const nested = (qp.url as string | undefined) || (qp.redirect as string | undefined); if ((!steamid || !state) && nested) { try { const decoded = decodeURIComponent(nested); const np: any = Linking.parse(decoded) || {}; const nqp: any = np.queryParams || {}; steamid = steamid || (nqp.steamid as string | undefined) || undefined; state = state || (nqp.state as string | undefined) || undefined; } catch {} } if (!steamid || !state) { try { const raw = urlStr.split('#').pop() || urlStr.split('?').pop() || ''; const sp = new URLSearchParams(raw); steamid = steamid || sp.get('steamid') || undefined; state = state || sp.get('state') || undefined; } catch {} } return { steamid, state }; } catch { return {}; } }; const { steamid, state: returnedState } = extractor(result.url); if (!steamid) throw new Error('SteamID não retornado. Confira se concluiu o login.');
      if (returnedState !== expectedState) throw new Error('e');

            // Redireciona para tela dedicada que faz o vinculo e inicia a sync
      router.replace(('/steam-auth?steamid=' + encodeURIComponent(steamid) + '&state=' + encodeURIComponent(returnedState || '')) as any);
      return;

    } catch (err) {
      Alert.alert('Steam', steamErrorMessage(err));
      await clearSteamAuthState();
    } finally {
      setSteamAuthMessage(null);
      setSteamAuthLinking(false);
    }
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
          <Text style={styles.appBarTitle}>Perfil</Text>
          <View style={{ flexDirection:'row', alignItems:'center' }}>
            <NotificationBell size={20} />
            <Ionicons name="menu" size={22} color={colors.primary} style={{ marginLeft: 8 }} />
          </View>
        </View>

        {/* Avatar + edit */}
        <View style={{ alignItems:'center', marginTop: 12 }}>
          <View style={styles.avatarWithEdit}>
            <View style={styles.bigAvatarWrap}>
              {profile?.avatar_url && !avatarError ? (
                <Image 
                  source={{ uri: profile.avatar_url }} 
                  style={styles.bigAvatar}
                  onError={() => setAvatarError(true)}
                />
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
          {steamAccount.data ? (
            <View style={styles.steamConnectedCard}>
              <View style={styles.steamAuthIconBadge}>
                <Ionicons name="logo-steam" size={18} color="#fff" />
              </View>
              <Text style={styles.steamConnectedLabel}>{steamAccount.data.display_name || 'Conta Steam'}</Text>
            </View>
          ) : (
            <Pressable
              style={[styles.steamAuthButton, steamAuthLinking && styles.steamAuthButtonDisabled]}
              onPress={onSyncSteam}
              accessibilityLabel="Sincronizar com a Steam"
              disabled={steamAuthLinking}
            >
              <View style={styles.steamAuthIconBadge}>
                <Ionicons name="logo-steam" size={18} color="#fff" />
              </View>
              {steamAuthLinking && <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />}
              <Text style={styles.steamAuthLabel}>{steamAuthLinking ? 'Conectando...' : 'Conectar Steam'}</Text>
            </Pressable>
          )}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{counters?.playing_count ?? 0}</Text>
            <Text style={styles.statLabel}>Jogos em 2025</Text>
          </View>
          <View style={styles.statCard}>
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:4 }}>
              <Text style={styles.statNumber}>{trophies.data ?? 0}</Text>
              <Ionicons name="trophy" size={16} color={colors.primary} style={{marginBottom:2}} />
            </View>
            <Text style={styles.statLabel}>Troféus</Text>
          </View>
          <View style={[styles.statCard, { padding:0, overflow:'hidden', flexDirection:'row' }]}> 
            {favCover ? (
              <Image source={{ uri: favCover }} style={{ width: 40, height: '100%' }} resizeMode="cover" />
            ) : (
              <View style={{ width: 40, height: '100%', backgroundColor: colors.card }} />
            )}
            <View style={{ flex:1, paddingHorizontal: 10, justifyContent:'center' }}>
              <Text style={[styles.statLabel,{ color: colors.secondary, fontSize: 10, marginTop:0 }]}>Jogo Favorito</Text>
              <Text style={[styles.statFavName, {fontSize: 13}]} numberOfLines={2}>{favName || 'Selecionar'}</Text>
            </View>
          </View>
        </View>

        {/* Wishlist */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>QUERO JOGAR</Text>
          <Pressable onPress={() => router.push('/collection/status/wishlist')}><Text style={styles.seeAll}>VER TODOS <Ionicons name="chevron-forward" size={10} /></Text></Pressable>
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
            keyExtractor={(ug, idx) => `${String(ug?.id ?? ug?.game_id ?? 'row')}:${idx}`}
            renderItem={({ item }) => {
              const url = igdbCoverUrl(item.game.cover_image_id || undefined, "t_1080p") || undefined;
              return (
                <Pressable
                  onLongPress={async () => {
                    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                    setToDelete({ type: 'wishlist', gameId: item.game_id });
                  }}
                  style={{ width: 100, marginRight: 12 }}
                >
                  {url ? (
                    <Image source={{ uri: url }} style={styles.cover} />
                  ) : (
                    <View style={[styles.cover,{ backgroundColor: colors.card }]} />
                  )}
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

        {/* Top Rated (5 Stars) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>MAIS AVALIADOS</Text>
        </View>
        {topRated.isLoading ? (
          <Text style={styles.subtle}>Carregando...</Text>
        ) : (topRated.data?.length ?? 0) === 0 ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 6 }}>
            <Text style={styles.subtle}>Nenhum jogo 5 estrelas ainda.</Text>
            <Pressable onPress={() => router.push('/collection')} style={[styles.primaryBtn,{marginTop:8, alignSelf:'flex-start'}]}>
              <Text style={styles.primaryTxt}>Avaliar Jogos</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            data={topRated.data || []}
            keyExtractor={(ug, idx) => `top-${ug.game_id}-${idx}`}
            renderItem={({ item }) => {
              const url = igdbCoverUrl(item.game.cover_image_id || undefined, "t_1080p") || undefined;
              return (
                <Pressable
                  onPress={() => router.push(`/game/${item.game.igdb_id}`)}
                  style={{ width: 100, marginRight: 12 }}
                >
                  {url ? (
                    <Image source={{ uri: url }} style={styles.cover} />
                  ) : (
                    <View style={[styles.cover,{ backgroundColor: colors.card }]} />
                  )}
                  <View style={{ position: 'absolute', bottom: -10, right: -6 }}>
                     <Text style={{ fontSize: 24 }}>⭐</Text>
                  </View>
                </Pressable>
              );
            }}
          />
        )}

      </ScrollView>

      {/* Steam linking overlay */}
      <Modal visible={steamAuthLinking} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.overlayBackdrop}>
          <View style={styles.overlayCard}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.overlayTitle}>Conectando a Steam...</Text>
            {!!steamAuthMessage && <Text style={styles.overlaySub}>{steamAuthMessage}</Text>}
          </View>
        </View>
      </Modal>

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
            if (toDelete.type === 'wishlist') { wishlist.refetch(); }
            header.refetch();
            setToDelete(null);
          }
        }}
      />

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
  avatarWithEdit: { width:120, height:120, alignItems:'center', justifyContent:'center', position:'relative' },
  bigAvatarWrap: { width:120, height:120, borderRadius:60, overflow:'hidden', position:'relative', borderWidth: 2, borderColor: colors.card },
  bigAvatar: { width:120, height:120, borderRadius:60 },
  bigAvatarPlaceholder: { backgroundColor: colors.card, alignItems:'center', justifyContent:'center', borderWidth: 2, borderColor: colors.border },
  editBadgeOutside: { position:'absolute', right:0, bottom:0, width:32, height:32, borderRadius:16, backgroundColor:'#fff', alignItems:'center', justifyContent:'center', shadowColor:'#000', shadowOpacity:0.35, shadowRadius:5, elevation:3 },
  bigUsername: { ...typography.title, color: colors.primary, fontSize: 20, marginTop: 12, textAlign: 'center' },
  subtitleLine: { ...typography.caption, color: colors.secondary, marginTop: 4, textAlign: 'center' },
  steamAuthButton: { marginTop: 12, flexDirection:'row', alignItems:'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: '#1B2838' },
  steamAuthIconBadge: { width: 28, height: 28, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.1)', alignItems:'center', justifyContent:'center', marginRight: 10 },
  steamAuthLabel: { ...typography.caption, color: '#fff', fontWeight: '700' as any },
  steamAuthButtonDisabled: { opacity: 0.6 },
  steamConnectedCard: { marginTop: 12, flexDirection:'row', alignItems:'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: '#1B2838' },
  steamConnectedLabel: { ...typography.caption, color: '#fff', fontWeight: '700' as any },
  overlayBackdrop: { position:'absolute', left:0, right:0, top:0, bottom:0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems:'center', justifyContent:'center' },
  overlayCard: { width: 280, borderRadius: 16, padding: 20, backgroundColor: colors.card, alignItems:'center' },
  overlayTitle: { ...typography.title, color: colors.primary, marginTop: 12, textAlign:'center' },
  overlaySub: { ...typography.caption, color: colors.secondary, marginTop: 6, textAlign:'center' },
  subtle: { ...typography.caption, color: colors.secondary, paddingHorizontal: 16 },
  primaryBtn: { backgroundColor: '#4DD4D9', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  primaryTxt: { color:'#001011', fontWeight:'800' },
  statsRow: { flexDirection:'row', gap:12, paddingHorizontal:16, marginTop: 24, marginBottom: 12 },
  statCard: { flex:1, backgroundColor: '#1A1A1A', borderRadius: 8, padding: 12, alignItems: 'center', justifyContent: 'center', minHeight: 60 },
  statNumber: { ...typography.title, color: '#fff', fontSize: 20, fontWeight: '800' as any },
  statLabel: { ...typography.caption, color: '#888', fontSize: 10, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  statFavName: { ...typography.body, color: '#fff', fontWeight: '700' as any },
  sectionHeader: { paddingHorizontal:16, marginTop: 24, marginBottom: 12, flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  sectionTitle: { ...typography.caption, color: '#888', fontSize: 12, letterSpacing: 1, fontWeight: '600' as any, textTransform: 'uppercase' },
  seeAll: { ...typography.caption, color: '#666', fontSize: 11, fontWeight: '600' as any, flexDirection: 'row', alignItems: 'center' },
  addFooterWrap: { width: 48, height: 140, alignItems:'center', justifyContent:'center', marginRight: 16 },
  addCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, alignItems:'center', justifyContent:'center' },
  addPlus: { color: colors.black, fontWeight: '800', fontSize: 18, lineHeight: 18 },
  cover: { width: 100, height: 140, borderRadius: 6 },
  gameName: { ...typography.caption, color: colors.primary, marginTop: 6 },
});
