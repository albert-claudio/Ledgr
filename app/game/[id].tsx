import { TrophyProgressCard } from '@/components/game/TrophyProgressCard';
import { AddToCollectionQuickModal } from '@/components/profile/AddToCollectionQuickModal';
import { DiaryViewModal } from '@/components/session/DiaryViewModal';
import { GameDiaryList } from '@/components/session/GameDiaryList';
import { SessionDiaryModal } from '@/components/session/SessionDiaryModal';
import { GameDetailSkeleton } from '@/components/skeletons/GameDetailSkeleton';
import { LogSessionModal } from '@/components/timeline/LogSessionModal';
import { useGameDiary } from '@/hooks/useSessionDiary';
import { useSteamAchievements } from '@/hooks/useSteamAchievements';
import { useUserRating } from '@/hooks/useUserRating';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { logGameSession } from '@/services/events';
import { addUserGame, extractIgdbImageIdFromUrl, upsertGameFromIGDB } from '@/services/profile';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import {
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ErrorState } from '../../components/common/ErrorState';
import { Comments } from '../../components/game/Comments';
import { GameAboutSection } from '../../components/game/GameAboutSection';
import { GameInfoCard } from '../../components/game/GameInfoCard';
import { GameReviews } from '../../components/game/GameReviews';
import { GameScreenshots } from '../../components/game/GameScreenshots';
import { RatingChart } from '../../components/game/RatingChart';
import { colors } from '../../components/theme/colors';
import { useGameDetail, useGameExternalDetails, useGameScreenshots } from '../../hooks/useGameDetail';
import { useSteamReviews } from '../../hooks/useSteamReviews';
import {
  calculateRatingDistribution,
  getCompletionTime
} from '../../services/gameDetail';

const { width: screenWidth } = Dimensions.get('window');
const BANNER_HEIGHT = 280;

export default function GameDetailScreen() {
  const [showAdd, setShowAdd] = React.useState(false);
  const [showLogSession, setShowLogSession] = React.useState(false);
  const [showDiary, setShowDiary] = React.useState(false);
  const [showViewDiary, setShowViewDiary] = React.useState(false);
  const [lastEventId, setLastEventId] = React.useState<number | null>(null);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const gameId = id ? parseInt(id) : undefined;

  const { data: game, isLoading, isError, refetch } = useGameDetail(gameId);
  
  // Fetch external data (trophies, playtime) separately for faster initial load
  const { data: externalData, isLoading: isLoadingExternal } = useGameExternalDetails(
    gameId,
    game?.name,
    game?.steam_appid
  );
  
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
  const [minutesPlayed, setMinutesPlayed] = React.useState<number | undefined>(undefined);
  const [myTrophies, setMyTrophies] = React.useState<number>(0);
  const [internalGameId, setInternalGameId] = React.useState<number | null>(null);
  
  // Busca entradas do diário para mostrar contador
  const { data: diaryEntries } = useGameDiary(internalGameId);
  
  // Steam achievements integration
  const { steamData, loading: loadingSteam } = useSteamAchievements(
    steamAppId,
    user?.id
  );

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!user?.id || !gameId) { 
          if (mounted) {
            setMyStatus(null);
            setMinutesPlayed(undefined);
            setMyTrophies(0);
          }
          return;
        }
        const { data: g } = await supabase.from('games').select('id').eq('igdb_id', gameId).maybeSingle();

        if (!g?.id) { 
          if (mounted) {
            setMyStatus(null);
            setMinutesPlayed(undefined);
          }
          return;
        }
        const { data: ug, error: ugError } = await supabase
          .from('user_games')
          .select('id, status, minutes_played')
          .eq('profile_id', user.id)
          .eq('game_id', g.id)
          .maybeSingle();

        
        // Always check steam_user_games for playtime and achievements (even if game is in user_games)
        let minutesPlayedValue = ug?.minutes_played;
        let achievementsValue = 0; // achievements only from Steam
        
        // Try to find Steam appid mapping
        const { data: mapping } = await supabase
          .from('steam_igdb_mappings')
          .select('steam_appid')
          .eq('igdb_id', gameId)
          .maybeSingle();
        

        
        if (mapping?.steam_appid) {
          // Query steam_user_games with the steam_appid
          const { data: steamGame } = await supabase
            .from('steam_user_games')
            .select('playtime_forever, achievements_unlocked')
            .eq('profile_id', user.id)
            .eq('steam_appid', mapping.steam_appid)
            .maybeSingle();
          

          
          if (steamGame) {
            // Prefer Steam playtime if no manual entry
            if (!minutesPlayedValue) {
              minutesPlayedValue = steamGame.playtime_forever;
            }
            // Always use Steam achievements
            achievementsValue = steamGame.achievements_unlocked || 0;
          }
        }
        
        const s = (ug?.status === 'playing' || ug?.status === 'completed') ? ug.status : null;
        // Also check custom collections
        const { data: ucg } = await supabase.from('user_collection_games').select('id').eq('profile_id', user.id).eq('game_id', g.id).limit(1).maybeSingle();
        if (mounted) {
          // Status dentro do game deve iniciar desmarcado
          setMyStatus(null);
          const hasGame = !!ug || !!ucg || !!minutesPlayedValue;
          const isWish = ug?.status === 'wishlist';

          setInAnyShelf(hasGame);
          setInWishlist(isWish);
          setMinutesPlayed(minutesPlayedValue || 0);
          setMyTrophies(achievementsValue || 0);
          // Salva o game ID interno para o diário
          if (g?.id) setInternalGameId(g.id);
        }
      } catch {
        if (mounted) { 
          setMyStatus(null); 
          setInAnyShelf(false); 
          setInWishlist(false);
          setMinutesPlayed(undefined);
          setMyTrophies(0);
        }
      }
    })();
    return () => { mounted = false; };
  }, [user?.id, gameId]); // Removed showAdd - will use callback instead

  // Refetch function to update game collection status
  const refetchGameStatus = React.useCallback(async () => {
    if (!user?.id || !gameId) return;
    try {
      const { data: g } = await supabase.from('games').select('id').eq('igdb_id', gameId).maybeSingle();
      if (!g?.id) return;
      
      // Atualiza o ID interno do jogo
      setInternalGameId(g.id);
      
      const { data: ug } = await supabase
        .from('user_games')
        .select('id, status, minutes_played')
        .eq('profile_id', user.id)
        .eq('game_id', g.id)
        .maybeSingle();
      
      // If not found in user_games, check steam_user_games for playtime and achievements
      let minutesPlayedValue = ug?.minutes_played;
      let achievementsValue = 0; // achievements only from Steam
      
      if (!ug) {
        // Try to find Steam appid mapping first
        const { data: mapping } = await supabase
          .from('steam_igdb_mappings')
          .select('steam_appid')
          .eq('igdb_id', gameId)
          .maybeSingle();
        
        if (mapping?.steam_appid) {
          const { data: steamGame } = await supabase
            .from('steam_user_games')
            .select('playtime_forever, achievements_unlocked')
            .eq('profile_id', user.id)
            .eq('steam_appid', mapping.steam_appid)
            .maybeSingle();
          
          if (steamGame) {
            minutesPlayedValue = steamGame.playtime_forever;
            achievementsValue = steamGame.achievements_unlocked;
          }
        }
      }
      
      const { data: ucg } = await supabase.from('user_collection_games').select('id').eq('profile_id', user.id).eq('game_id', g.id).limit(1).maybeSingle();
      
      setInAnyShelf(!!ug || !!ucg || !!minutesPlayedValue);
      setInWishlist(ug?.status === 'wishlist');
      setMinutesPlayed(minutesPlayedValue || 0);
      setMyTrophies(achievementsValue || 0);
    } catch (e) {
      console.error('Error refetching game status:', e);
    }
  }, [user?.id, gameId]);

  // 🎯 Realtime: Atualiza playtime quando user_games muda
  React.useEffect(() => {
    if (!user?.id || !gameId) return;

    const channel = supabase
      .channel(`game-detail-${gameId}-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_games',
          filter: `profile_id=eq.${user.id}`,
        },
        async (payload: any) => {
          // Busca o game_id interno do IGDB id
          const { data: g } = await supabase.from('games').select('id').eq('igdb_id', gameId).maybeSingle();
          if (!g?.id) return;

          // Se este update é do jogo atual, atualiza o estado
          if (payload.new?.game_id === g.id) {
            setMinutesPlayed(payload.new?.minutes_played || 0);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, gameId]);

  async function handleSetStatus(s: 'playing' | 'completed') {
    if (!user?.id || !game) { Alert.alert('Aviso', 'Faça login para definir status.'); return; }
    if (busyStatus) return;
    setBusyStatus(s);
    try {
      const coverId = extractIgdbImageIdFromUrl((game.cover_image || game.background_image) as any) || undefined;
      const g = await upsertGameFromIGDB({ igdb_id: game.id, name: game.name, slug: (game as any).slug, cover_image_id: coverId });
      await addUserGame(user.id, g.id, s);
      setMyStatus(s);
      setInAnyShelf(true);
      setInWishlist(false); // Ensure wishlist is false when adding to collection
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível atualizar o status.');
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

  const handleCloseModal = () => {
    setShowAdd(false);
    // Refetch game status after modal closes to update collection state
    refetchGameStatus();
  };

  const handleLogSession = async (hours: number) => {
    if (!user?.id || !gameId) return;
    
    try {
      // Busca o game_id interno
      const { data: g } = await supabase.from('games').select('id').eq('igdb_id', gameId).maybeSingle();
      if (!g?.id) {
        Alert.alert('Erro', 'Jogo não encontrado');
        return;
      }

      const result = await logGameSession(g.id, hours);
      const eventId = (result as any)?.id || null;
      
      Alert.alert('✅ Sessão registrada!', `+${hours}h adicionadas`);
      setLastEventId(eventId);
      setShowLogSession(false);
      
      // Mostra prompt do diário
      setTimeout(() => setShowDiary(true), 300);
      
      // Atualiza status do jogo
      refetchGameStatus();
    } catch (error: any) {
      console.error('[GameDetailScreen] Erro ao registrar sessão:', error);
      Alert.alert('Erro', error.message || 'Não foi possível registrar a sessão');
    }
  };

  // Merge external data with IGDB data (must be before early returns)
  const mergedGame = React.useMemo(() => {
    if (!game || !externalData) return game;
    return {
      ...game,
      ...externalData,
      // Merge ratings intelligently - prefer Steam over IGDB if available
      rating: externalData.rating || game.rating,
      ratings: externalData.ratings || game.ratings,
      ratings_count: externalData.ratings_count || game.ratings_count,
      achievements_count: externalData.achievements_count || game.achievements_count,
      playtime: externalData.playtime || game.playtime,
      approval_percent: externalData.approval_percent || game.approval_percent,
      achievements_source: externalData.achievements_source || game.achievements_source,
      playtime_source: externalData.playtime_source || game.playtime_source,
    };
  }, [game, externalData]);


  if (isLoading) {
    return <GameDetailSkeleton />;
  }

  if (isError || !game) {
    return (
      <SafeAreaView style={styles.container}>
        <ErrorState 
          message="Não foi possível carregar os detalhes do jogo"
          onRetry={refetch}
        />
      </SafeAreaView>
    );
  }

  const platforms = game.platforms?.map(p => p.platform.name) || [];
  const developer = game.developers?.[0]?.name || 'Unknown';
  const releaseYear = game.released ? game.released.split('-')[0] : 'TBA';
  const ratingDistribution = calculateRatingDistribution(game.ratings);
  
  // Use mergedGame if available, otherwise fallback to game
  const finalGame = mergedGame || game;
  
  // Calculate trophy display values
  const displayTotalTrophies = steamData?.total || finalGame.achievements_count || 0;
  const displayUserTrophies = steamData?.unlocked || myTrophies || 0;
  const trophySource = steamData ? 'steam' : 'manual';
  
  const combinedCount = (finalGame?.ratings_count || 0) + (ur.aggregate?.count || 0);
  const combinedRating = combinedCount > 0
    ? (((finalGame?.rating || 0) * (finalGame?.ratings_count || 0)) + ((ur.aggregate?.avg || 0) * (ur.aggregate?.count || 0))) / combinedCount
    : (finalGame?.rating || 0);

  // Remove tags HTML da descrição
  const cleanDescription = game.description_raw || 
    game.description?.replace(/<[^>]*>/g, '') || 
    'Sem descrição disponível.';

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

            {!steamAppId && inAnyShelf && internalGameId && user && (
              <TouchableOpacity 
                onPress={() => setShowDiary(true)} 
                style={styles.backButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="journal-outline" size={24} color={colors.white} />
              </TouchableOpacity>
            )}
          </SafeAreaView>
        </View>

        {/* Game Info Card */}
        <GameInfoCard
            coverImage={game.cover_image || game.background_image}
            title={game.name}
            producer={developer}
            platforms={platforms}
            year={releaseYear}
            trophies={finalGame?.achievements_count || 0}
            completionTime={getCompletionTime(finalGame?.playtime)}
            trophiesSource={finalGame?.achievements_source || ''}
            completionSource={finalGame?.playtime_source || ''}
            onAddPress={handleAddGame}
            onDiaryPress={() => {
              if (!internalGameId) {
                Alert.alert('Diário indisponível', 'Este jogo ainda não foi adicionado à sua biblioteca. Adicione-o primeiro.');
                return;
              }
              setLastEventId(null);
              setShowDiary(true);
            }}
            onViewDiaryPress={() => setShowViewDiary(true)}
            diaryEntriesCount={diaryEntries?.length || 0}
            isInCollection={inAnyShelf}
            isInWishlist={inWishlist}
            isManualGame={!steamAppId && !!internalGameId}
            status={myStatus}
            busyStatus={busyStatus}
            onSetStatus={handleSetStatus}
            minutesPlayed={minutesPlayed}
            isLoadingExternal={isLoadingExternal}
        />

       {/* Card de Progresso de Troféus - Inteligente com Steam */}
{displayTotalTrophies > 0 && (
  <View style={{ marginHorizontal: 16, marginTop: 16 }}>
    <TrophyProgressCard 
      userTrophies={displayUserTrophies} 
      totalTrophies={displayTotalTrophies}
      source={trophySource}
    />
    {loadingSteam && (
      <Text style={{ fontSize: 10, color: colors.secondary, marginTop: 4, textAlign: 'center' }}>
        🔄 Sincronizando com Steam...
      </Text>
    )}
  </View>
)}

        {/* Botões de Ação - Só para jogos manuais */}
        {!steamAppId && inAnyShelf && internalGameId && user && (
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={styles.progressButton}
              onPress={() => setShowLogSession(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={20} color={colors.accent} />
              <Text style={styles.progressButtonText}>Marcar progresso</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.diaryButton}
              onPress={() => {
                setLastEventId(null); // Sem evento associado
                setShowDiary(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="journal-outline" size={20} color={colors.white} />
              <Text style={styles.diaryButtonText}>Adicionar nota</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Diário de Sessão - Apenas para jogos manuais na coleção */}
        {!steamAppId && inAnyShelf && internalGameId && (
          <GameDiaryList gameId={internalGameId} />
        )}

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
                    Alert.alert('Aviso', 'Faça login para avaliar o jogo.');
                  }
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ paddingHorizontal: 2 }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 24, color: (myRate ?? 0) >= s ? '#FCD34D' : colors.secondary }}>★</Text>
              </TouchableOpacity>
            ))}
            <Text style={{ marginLeft: 8, color: colors.secondary }}>Sua avaliação</Text>
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
      <AddToCollectionQuickModal 
        visible={showAdd} 
        onClose={handleCloseModal} 
        game={game ? { 
          id: game.id, 
          name: game.name, 
          slug: game.slug, 
          coverUrl: game.cover_image || game.background_image 
        } : null} 
      />

      {/* Modal de Sessão */}
      <LogSessionModal
        visible={showLogSession}
        gameName={game?.name || 'este jogo'}
        onClose={() => setShowLogSession(false)}
        onConfirm={handleLogSession}
      />

      {/* Modal de Diário */}
      <SessionDiaryModal
        visible={showDiary}
        onClose={() => setShowDiary(false)}
        eventId={lastEventId}
        gameId={internalGameId || 0}
        gameName={game?.name || 'este jogo'}
        onSaved={() => {
          setShowDiary(false);
          refetchGameStatus();
        }}
      />

      {/* Modal de Visualização do Diário */}
      <DiaryViewModal
        visible={showViewDiary}
        onClose={() => setShowViewDiary(false)}
        gameId={internalGameId}
        gameName={game?.name || 'este jogo'}
      />
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
  actionButtonsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  progressButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.accent,
    gap: 8,
  },
  progressButtonText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  diaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  diaryButtonText: {
    color: colors.black,
    fontSize: 14,
    fontWeight: '700',
  },
});