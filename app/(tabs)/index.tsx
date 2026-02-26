import { HomeHeader } from '@/components/Home/HomeHeader';
import { ContinuarJogando } from '@/components/collection/ContinuarJogando';
import { SideMenu } from '@/components/common/SideMenu';
import { DailyQuest } from '@/components/profile/DailyQuest';
import { ActiveGameHeroSkeleton } from '@/components/skeletons/ActiveGameHeroSkeleton';
import { EventCardSkeleton } from '@/components/skeletons/EventCardSkeleton';
import { colors } from '@/components/theme/colors';
import { typography } from '@/components/theme/typography';
import { ActiveGameHero } from '@/components/timeline/ActiveGameHero';
import { DailySummaryCard } from '@/components/timeline/DailySummaryCard';
import { EmptyStateHeader } from '@/components/timeline/EmptyStateHeader';
import { EmptyTimeline } from '@/components/timeline/EmptyTimeline';
import { EventCard } from '@/components/timeline/EventCard';
import { SteamConnectBanner } from '@/components/timeline/SteamConnectBanner';
import { useCurrentlyPlaying } from '@/hooks/useCurrentlyPlaying';
import { useDailyQuestNotifications } from '@/hooks/useDailyQuestNotifications';
import { useSteamAccountStatus } from '@/hooks/useSteamAccountStatus';
import { useSteamAutoSync } from '@/hooks/useSteamAutoSync';
import { useUserEvents } from '@/hooks/useUserEvents';
import { startSteamLibrarySync } from '@/lib/steam_sync';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { markAppOpened } from '@/services/quests';
import type { Event as TimelineEvent } from '@/types/event';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ========================================
// PURE FUNCTIONS (outside component)
// ========================================

/**
 * Groups 'synced' events from the same game on the same day
 * This is a pure function moved outside component to prevent recreation on every render
 */
function groupSameDayEvents(events: TimelineEvent[]): TimelineEvent[] {
  const grouped: TimelineEvent[] = [];
  const gameSessionsMap = new Map<string, TimelineEvent[]>();
  
  events.forEach(event => {
    // Apenas agrupa eventos 'synced'
    if (event.type !== 'synced' || !event.game_id) {
      grouped.push(event);
      return;
    }
    
    // Cria chave: game_id + data (YYYY-MM-DD)
    const eventDate = new Date(event.created_at).toISOString().split('T')[0];
    const key = `${event.game_id}-${eventDate}`;
    
    if (!gameSessionsMap.has(key)) {
      gameSessionsMap.set(key, []);
    }
    
    gameSessionsMap.get(key)!.push(event);
  });
  
  // Processa eventos agrupados
  gameSessionsMap.forEach((sessions) => {
    if (sessions.length === 1) {
      // Sessão única, adiciona normal
      grouped.push(sessions[0]);
    } else {
      // Múltiplas sessões, cria evento consolidado
      const totalHoursAdded = sessions.reduce(
        (sum, s) => sum + (s.meta.hours_added || 0), 
        0
      );
      
      // Usa o evento mais recente como base
      const latestSession = sessions.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      
      grouped.push({
        ...latestSession,
        meta: {
          ...latestSession.meta,
          hours_added: Math.round(totalHoursAdded * 10) / 10,
          sessions_count: sessions.length,
          grouped: true, // Flag para EventCard saber que é agrupado
        },
      });
    }
  });
  
  // Reordena por data
  return grouped.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

// ========================================
// COMPONENT
// ========================================

export default function HomeScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [steamBannerDismissed, setSteamBannerDismissed] = React.useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);

  // Fetch data
  const eventsQuery = useUserEvents(user?.id);
  const steamStatus = useSteamAccountStatus(user?.id);
  const currentGame = useCurrentlyPlaying(user?.id);

  // Auto-sync Steam in background
  useSteamAutoSync(user?.id);

  // 🔔 Gerenciar notificações de daily quests (2 horas após completar primeira quest)
  useDailyQuestNotifications(user?.id, 120);

  // 🔥 Marcar "abriu o app" para quest daily - executa apenas uma vez ao montar
  useEffect(() => {
    if (user?.id) {
      markAppOpened();
    }
  }, [user?.id]);

  // Flatten paginated events
  const events = React.useMemo(() => {
    return eventsQuery.data?.pages.flatMap(page => page.events) || [];
  }, [eventsQuery.data]);

  // Refresh handler
  const handleRefresh = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    
    await Promise.all([
      eventsQuery.refetch(),
      steamStatus.refetch(),
      currentGame.refetch(),
    ]);
  };

  // Load more handler
  const handleLoadMore = () => {
    if (eventsQuery.hasNextPage && !eventsQuery.isFetchingNextPage) {
      eventsQuery.fetchNextPage();
    }
  };

  // 🎯 Realtime: Escuta atualizações em user_games para atualizar hero card
  // Isso captura mudanças do Steam sync que atualizam minutes_played
  React.useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`user-games-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_games',
          filter: `profile_id=eq.${user.id}`,
        },
        (payload) => {
          // Invalida cache do hero card quando minutes_played ou last_session_at mudar
          queryClient.invalidateQueries({ queryKey: ['currentGame', user.id] });
          queryClient.invalidateQueries({ queryKey: ['currently-playing', user.id] });
          queryClient.invalidateQueries({ queryKey: ['profile:playing', user.id] });
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (err) {
        console.warn('[HomeScreen] Error removing channel:', err);
      }
    };
  }, [user?.id, queryClient]);

  // Event action handler
  const handleEventAction = (action: string, event: TimelineEvent) => {
    switch (action) {
      case 'mark_progress':
        router.push(`/game/${event.game?.igdb_id}`);
        break;
      case 'view_entry':
        router.push(`/game/${event.game?.igdb_id}`);
        break;
      case 'edit_rating':
        router.push(`/game/${event.game?.igdb_id}`);
        break;
      default:
        break;
    }
  };

  // Fetch current game (most played in last 2 weeks)
  const { data: currentActiveGame } = useQuery({
    queryKey: ['currentGame', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      // Data limite: 2 semanas atrás
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      
      const { data, error } = await supabase
        .from('user_games')
        .select('*, game:games(id, igdb_id, name, slug, cover_image_id)')
        .eq('profile_id', user.id)
        .eq('status', 'playing')
        .gt('minutes_played', 0) // FILTRO: Apenas jogos realmente jogados
        .gte('last_session_at', twoWeeksAgo.toISOString()) // FILTRO: Últimas 2 semanas
        .order('minutes_played', { ascending: false }) // ORDENAÇÃO: Mais jogado primeiro
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;
      
      return {
        id: data.game.id,
        igdb_id: data.game.igdb_id,
        name: data.game.name,
        cover_image_id: data.game.cover_image_id,
        minutes_played: data.minutes_played,
        last_session_at: data.last_session_at,
      };
    },
    enabled: !!user?.id,
  });

  // Estado para tracking da sync automática
  const [isSyncing, setIsSyncing] = useState(false);

  // Handler de sync automática da Steam
  const handleSteamSync = async () => {
    if (!user?.id || !steamStatus.data?.linked) {
      Alert.alert('Steam não conectada', 'Conecte sua conta Steam para sincronizar.');
      return;
    }

    try {
      setIsSyncing(true);
      console.log('[handleSteamSync] 🔄 Iniciando sync automática da Steam...');
      
      // Dispara sync forçada
      await startSteamLibrarySync(true);
      
      // Feedback tátil inicial
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      
      // Aguarda 30s e mostra mensagem de conclusão
      setTimeout(() => {
        setIsSyncing(false);
        Alert.alert('✅ Sincronização completa', 'Sua biblioteca Steam foi atualizada com sucesso!');
        
        // Recarrega dados
        eventsQuery.refetch();
        currentGame.refetch();
        steamStatus.refetch();
      }, 30000); // 30 segundos
      
    } catch (error: any) {
      setIsSyncing(false);
      console.error('[handleSteamSync] Erro:', error);
      Alert.alert('Erro na sincronização', error.message || 'Não foi possível sincronizar com a Steam.');
    }
  };

  // Usa o jogo atual diretamente (sem optimistic updates)
  const displayGame = currentActiveGame;
  
  // Eventos já vêm agrupados do servidor (groupSameDayEvents moved outside component)
  const allEvents = React.useMemo(() => {
    return groupSameDayEvents(events);
  }, [events]);

  // Filtra eventos 'synced' de HOJE para o resumo diário
  const todaySyncedEvents = React.useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    return events.filter(event => {
      if (event.type !== 'synced') return false;
      const eventDate = new Date(event.created_at);
      return eventDate >= todayStart;
    });
  }, [events]);

  const displayEvents = showAllEvents ? allEvents : allEvents.slice(0, 3);

  // Dynamic Header Component
  const DynamicHeader = () => {
    return (
      <View style={{ marginBottom: 16 }}>
        {/* 1. Hero Ativo (Jogo Principal) - Apenas para usuários com Steam */}
        {displayGame && steamStatus.data?.linked ? (
          <ActiveGameHero
            game={displayGame}
            onLogSession={handleSteamSync}
            onViewProgress={() => router.push(`/game/${displayGame.igdb_id}`)}
            isSteamLinked={true}
            isSyncing={isSyncing}
          />
        ) : !steamStatus.data?.linked && !steamBannerDismissed ? (
          <SteamConnectBanner onDismiss={() => setSteamBannerDismissed(true)} />
        ) : events.length === 0 ? (
          <EmptyStateHeader />
        ) : null}

        {/* 2. Carrossel Secundário (Outros Jogos) */}
        {/* Só mostra se tiver logado. Exclui o jogo do Hero se houver. */}
        {user && <ContinuarJogando excludeId={displayGame?.id} />}

        {/* 3. Missão do dia (Daily Quest) */}
        <DailyQuest />

        {/* 4. Título do Feed */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: 24, marginBottom: 8 }}>
          <Text style={{ ...typography.header, fontSize: 20, color: colors.white }}>
            Sua Linha do Tempo
          </Text>
          {!showAllEvents && allEvents.length > 3 && (
            <Pressable onPress={() => setShowAllEvents(true)}>
              <Text style={{ ...typography.caption, color: colors.accent, fontSize: 14 }}>Ver tudo</Text>
            </Pressable>
          )}
        </View>

        {/* 5. Resumo do Dia (mostra jogos do dia com horas) */}
        {todaySyncedEvents.length > 0 && (
          <DailySummaryCard 
            date={new Date()} 
            events={todaySyncedEvents}
          />
        )}
      </View>
    );
  };

  // Render footer (loading indicator for infinite scroll)
  const renderFooter = () => {
    if (!eventsQuery.isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  };

  // Loading state
  if (eventsQuery.isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <HomeHeader onMenuPress={() => setMenuVisible(true)} />
        <View style={styles.content}>
          <ActiveGameHeroSkeleton />
          <View style={{ paddingHorizontal: 16, marginTop: 16, marginBottom: 8 }}>
            <Text style={{ ...typography.header, fontSize: 20, color: colors.white }}>
              Sua Linha do Tempo
            </Text>
          </View>
          <EventCardSkeleton />
          <EventCardSkeleton />
          <EventCardSkeleton />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HomeHeader onMenuPress={() => setMenuVisible(true)} />
      
      <FlatList
        data={displayEvents}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <EventCard 
            event={item}
            showUserInfo={false} // Oculta avatar/username na timeline pessoal
            onAction={(action) => handleEventAction(action, item)}
            onSessionLogged={() => eventsQuery.refetch()} // Recarrega timeline após nova sessão
          />
        )}
        ListHeaderComponent={<DynamicHeader />}
        ListEmptyComponent={<EmptyTimeline />}
        ListFooterComponent={renderFooter()}
        onEndReached={showAllEvents ? handleLoadMore : null}
        onEndReachedThreshold={0.5}
        contentContainerStyle={events.length === 0 ? styles.emptyContent : styles.content}
        refreshControl={
          <RefreshControl
            refreshing={eventsQuery.isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      <SideMenu 
        visible={menuVisible} 
        onClose={() => setMenuVisible(false)}
        items={[
          { label: 'Perfil', onPress: () => router.push('/(tabs)/profile') },
          { label: 'Configurações', onPress: () => {} },
          { 
            label: 'Sair', 
            onPress: async () => {
              try {
                await signOut();
              } catch (error) {
                console.error('Erro ao fazer logout:', error);
                Alert.alert('Erro', 'Não foi possível fazer logout');
              }
            }
          },
        ]}
      />
    </SafeAreaView>
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
  },
  content: {
    paddingBottom: 20,
  },
  emptyContent: {
    flexGrow: 1,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
