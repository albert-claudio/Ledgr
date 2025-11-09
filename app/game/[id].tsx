import React from 'react';
import { 
  ScrollView, 
  View, 
  Image, 
  StyleSheet, 
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  Text,
  Alert,
  Dimensions
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { colors } from '../../components/theme/colors';
import { GameInfoCard } from '../../components/game/GameInfoCard';
import { AddToCollectionQuickModal } from '@/components/profile/AddToCollectionQuickModal';
import { RatingChart } from '../../components/game/RatingChart';
import { GameAboutSection } from '../../components/game/GameAboutSection';
import { GameScreenshots } from '../../components/game/GameScreenshots';
import { GameReviews } from '../../components/game/GameReviews';
import { Comments } from '../../components/game/Comments';
import { ErrorState } from '../../components/common/ErrorState';
import { useGameDetail, useGameScreenshots } from '../../hooks/useGameDetail';
import { useSteamReviews } from '../../hooks/useSteamReviews';
import { useUserRating } from '@/hooks/useUserRating';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { addUserGame, upsertGameFromIGDB, extractIgdbImageIdFromUrl } from '@/services/profile';
import { 
  getCompletionTime, 
  formatReleaseDate, 
  calculateRatingDistribution 
} from '../../services/gameDetail';

const { width: screenWidth } = Dimensions.get('window');
const BANNER_HEIGHT = 280;

export default function GameDetailScreen() {
  const [showAdd, setShowAdd] = React.useState(false);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const gameId = id ? parseInt(id) : undefined;

  const { data: game, isLoading, isError, refetch } = useGameDetail(gameId);
  const { data: screenshots } = useGameScreenshots(gameId);
  // Steam reviews hook must be called unconditionally (before early returns)
  const steamAppId = (game as any)?.steam_appid as number | undefined;
  const { data: steamReviews } = useSteamReviews(steamAppId);
  const ur = useUserRating(gameId);
  const [myRate, setMyRate] = React.useState<number | null>(null);
  React.useEffect(() => { setMyRate(ur.myRating ?? null); }, [ur.myRating]);
  const { user } = useAuth();
  const [myStatus, setMyStatus] = React.useState<'playing' | 'completed' | null>(null);
  const [busyStatus, setBusyStatus] = React.useState<'playing' | 'completed' | null>(null);
  const [inAnyShelf, setInAnyShelf] = React.useState<boolean>(false);
  const [inWishlist, setInWishlist] = React.useState<boolean>(false);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!user?.id || !gameId) { if (mounted) setMyStatus(null); return; }
        const { data: g } = await supabase.from('games').select('id').eq('igdb_id', gameId).maybeSingle();
        if (!g?.id) { if (mounted) setMyStatus(null); return; }
        const { data: ug } = await supabase.from('user_games').select('id, status').eq('profile_id', user.id).eq('game_id', g.id).maybeSingle();
        const s = (ug?.status === 'playing' || ug?.status === 'completed') ? ug.status : null;
        // Also check custom collections
        const { data: ucg } = await supabase.from('user_collection_games').select('id').eq('profile_id', user.id).eq('game_id', g.id).limit(1).maybeSingle();
        if (mounted) {
          // Status dentro do game deve iniciar desmarcado
          setMyStatus(null);
          setInAnyShelf(!!ug || !!ucg);
          setInWishlist(ug?.status === 'wishlist');
        }
      } catch {
        if (mounted) { setMyStatus(null); setInAnyShelf(false); setInWishlist(false); }
      }
    })();
    return () => { mounted = false; };
  }, [user?.id, gameId]);

  async function handleSetStatus(s: 'playing' | 'completed') {
    if (!user?.id || !game) { Alert.alert('Aviso', 'Faca login para definir status.'); return; }
    if (busyStatus) return;
    setBusyStatus(s);
    try {
      const coverId = extractIgdbImageIdFromUrl((game.cover_image || game.background_image) as any) || undefined;
      const g = await upsertGameFromIGDB({ igdb_id: game.id, name: game.name, slug: (game as any).slug, cover_image_id: coverId });
      await addUserGame(user.id, g.id, s);
      setMyStatus(s);
      setInAnyShelf(true);
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    } catch (e) {
      Alert.alert('Erro', 'Nao foi possivel atualizar o status.');
    } finally {
      setBusyStatus(null);
    }
  }

  const handleBack = () => {
    router.back();
  };

  const handleAddGame = () => {
    setShowAdd(true);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (isError || !game) {
    return (
      <SafeAreaView style={styles.container}>
        <ErrorState 
          message="Nao foi possivel carregar os detalhes do jogo"
          onRetry={refetch}
        />
      </SafeAreaView>
    );
  }

  const platforms = game.platforms?.map(p => p.platform.name) || [];
  const developer = game.developers?.[0]?.name || 'Unknown';
  const releaseYear = game.released ? game.released.split('-')[0] : 'TBA';
  const ratingDistribution = calculateRatingDistribution(game.ratings);
  const combinedCount = (game.ratings_count || 0) + (ur.aggregate?.count || 0);
  const combinedRating = combinedCount > 0
    ? (((game.rating || 0) * (game.ratings_count || 0)) + ((ur.aggregate?.avg || 0) * (ur.aggregate?.count || 0))) / combinedCount
    : (game.rating || 0);

  // Remove tags HTML da descricao
  const cleanDescription = game.description_raw || 
    game.description?.replace(/<[^>]*>/g, '') || 
    'Sem descricao disponivel.';

  const bannerUri = game.background_image || game.cover_image || (screenshots && (screenshots[0] as any)?.image) || '';
  return (
    <>
      <StatusBar style="light" />
      <ScrollView style={styles.container} bounces={false}>
        {/* Banner Image */}
        <View style={styles.bannerContainer}>
          {bannerUri ? (
            <Image
              source={{ uri: bannerUri }}
              style={styles.bannerImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.bannerImage, { backgroundColor: colors.card }]} />
          )}
          <LinearGradient
            colors={[
              'rgba(0,0,0,0)',
              'rgba(0,0,0,0.35)',
              'rgba(0,0,0,0.7)'
            ]}
            locations={[0, 0.6, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.bannerGradient}
          />
          
          {/* Back Button */}
          <SafeAreaView style={styles.headerContainer}>
            <TouchableOpacity 
              onPress={handleBack} 
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.white} />
            </TouchableOpacity>
          </SafeAreaView>
        </View>

        {/* Game Info Card */}
        <GameInfoCard
          coverImage={game.cover_image || game.background_image}
          title={game.name}
          producer={developer}
          platforms={platforms}
          year={releaseYear}
          trophies={game.achievements_count || 0}
          completionTime={getCompletionTime(game.playtime)}
          trophiesSource={(game as any).achievements_source || ''}
          completionSource={(game as any).playtime_source || ''}
          onAddPress={handleAddGame}
          isInCollection={inAnyShelf}
          isInWishlist={inWishlist}
          status={myStatus}
          busyStatus={busyStatus}
          onSetStatus={handleSetStatus}
        />

        {/* Rating Chart */}
        <RatingChart
          rating={combinedRating}
          ratingsCount={combinedCount}
          distribution={ratingDistribution}
        />

        {/* User rating stars */}
        {gameId && (
          <View style={{ marginHorizontal: 16, marginTop: 10, flexDirection: 'row', alignItems: 'center' }}>
            {[1,2,3,4,5].map((s) => (
              <TouchableOpacity
                key={s}
                onPress={async () => {
                  try {
                    setMyRate(s);
                    await ur.setRating(s);
                    try { await Haptics.selectionAsync(); } catch {}
                  } catch (e) {
                    Alert.alert('Aviso', 'Faca login para avaliar o jogo.');
                  }
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ paddingHorizontal: 2 }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 24, color: (myRate ?? 0) >= s ? '#FCD34D' : colors.secondary }}>*</Text>
              </TouchableOpacity>
            ))}
            <Text style={{ marginLeft: 8, color: colors.secondary }}>Sua avaliacao</Text>
          </View>
        )}

        {/* About Section */}
        <GameAboutSection description={cleanDescription} />

        {/* Screenshots */}
        {screenshots && screenshots.length > 0 && (
          <GameScreenshots screenshots={screenshots} />
        )}

        {/* Comments */}
        <Comments igdbId={game.id} />

        {/* Steam Reviews */}
        {steamReviews && steamReviews.length > 0 && (
          <GameReviews reviews={steamReviews} />
        )}
      </ScrollView>
      <AddToCollectionQuickModal visible={showAdd} onClose={() => setShowAdd(false)} game={game ? { id: game.id, name: game.name, slug: game.slug, coverUrl: game.cover_image || game.background_image } : null} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  bannerContainer: {
    height: BANNER_HEIGHT,
    width: screenWidth,
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  bannerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
