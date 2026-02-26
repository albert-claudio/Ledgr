import { logGameSession } from '@/services/events';
import { igdbCoverUrl } from '@/services/profile';
import type { Event } from '@/types/event';
import { formatPlaytime } from '@/utils/timeUtils';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SessionDiaryModal } from '../session/SessionDiaryModal';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { LogSessionModal } from './LogSessionModal';

interface EventCardProps {
  event: Event;
  showUserInfo?: boolean; // Default: true (ocultar na timeline pessoal)
  onAction?: (action: string) => void;
  onSessionLogged?: () => void; // Callback para recarregar timeline
}

function EventCardComponent({ 
  event, 
  showUserInfo = true, 
  onAction,
  onSessionLogged 
}: EventCardProps) {
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [showDiaryModal, setShowDiaryModal] = useState(false);
  const [lastEventId, setLastEventId] = useState<number | null>(null);
  
  const coverUrl = igdbCoverUrl(event.game?.cover_image_id || undefined);
  
  const timeAgo = formatDistanceToNow(new Date(event.created_at), {
    addSuffix: true,
    locale: ptBR,
  });

  // Detecta se é jogo Steam ou Manual
  const isSteamGame = !!event.steam_appid;
  const isManualGame = !isSteamGame;
  const isManualSession = event.meta.source === 'manual';

  // Handler para salvar sessão
  const handleConfirmSession = async (hours: number) => {
    if (!event.game_id) return;

    try {
      const result = await logGameSession(event.game_id, hours);
      const eventId = (result as any)?.id || null;
      
      Alert.alert('✅ Sessão registrada!', `+${hours}h adicionadas`);
      setLastEventId(eventId);
      setModalVisible(false);
      
      // Mostra prompt do diário
      setTimeout(() => setShowDiaryModal(true), 300);
      
      onSessionLogged?.(); // Recarrega a timeline
    } catch (error: any) {
      console.error('[EventCard] Erro ao registrar sessão:', error);
      Alert.alert('Erro', error.message || 'Não foi possível registrar a sessão');
    }
  };

  // Escolhe a cor da borda lateral e estilo baseado no tipo de evento
  const getEventStyle = () => {
    switch (event.type) {
      case 'finished':
        return {
          borderColor: '#FFD700', // Ouro
          backgroundColor: 'rgba(255, 215, 0, 0.05)', // Sutil dourado
          borderWidth: 2,
        };
      case 'rated':
        return {
          borderColor: '#FFC107', // Amarelo
          backgroundColor: colors.card,
          borderWidth: 2,
        };
      default:
        return {
          borderColor: 'transparent',
          backgroundColor: colors.card,
          borderWidth: 4,
        };
    }
  };

  const eventStyle = getEventStyle();

  const renderEventText = () => {
    switch (event.type) {
      case 'started':
        return (
          <>
            <Text style={styles.actionText}>Você começou a jogar</Text>
            <Text style={styles.gameName}>{event.game?.name || 'um jogo'}</Text>
          </>
        );
      
      case 'synced':
        const hoursAdded = event.meta.hours_added || 0;
        const isSteamSync = event.meta.source !== 'manual';
        const totalHours = event.meta.total_hours || 0;
        const isGrouped = event.meta.grouped === true;
        const sessionsCount = event.meta.sessions_count || 1;
        
        // Formata tempo de forma inteligente (minutos para < 1h, horas para >= 1h)
        const formatSmartTime = (hours: number) => {
          if (hours <= 0) return '0min';
          const totalMinutes = Math.round(hours * 60);
          if (totalMinutes < 60) {
            return `${totalMinutes}min`;
          }
          const h = Math.floor(totalMinutes / 60);
          const m = totalMinutes % 60;
          if (m === 0) return `${h}h`;
          return `${h}h ${m}min`;
        };
        
        return (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              {isSteamSync && (
                <View style={styles.steamBadge}>
                  <Ionicons name="logo-steam" size={12} color={colors.accent} />
                  <Text style={styles.steamBadgeText}>Steam</Text>
                </View>
              )}
              <Text style={styles.actionText}>
                {isGrouped 
                  ? `${sessionsCount} sessões hoje` 
                  : (isSteamSync ? 'Sessão sincronizada' : 'Sessão manual')}
              </Text>
            </View>
            <Text style={styles.gameName}>{event.game?.name || 'um jogo'}</Text>
            <View style={styles.playtimeHighlight}>
              <View style={styles.playtimeBadge}>
                <Ionicons name="time" size={16} color={colors.white} />
                <Text style={styles.playtimeValue}>+{formatSmartTime(hoursAdded)}</Text>
              </View>
              {totalHours > 0 && (
                <Text style={styles.playtimeTotal}>
                  Total: {formatSmartTime(totalHours)}
                </Text>
              )}
            </View>
          </>
        );
      
      case 'log':
        return (
          <>
            <Text style={styles.actionText}>Nova entrada no diário</Text>
            <Text style={styles.gameName}>{event.game?.name || 'um jogo'}</Text>
          </>
        );
      
      case 'rated':
        return (
          <>
            <Text style={styles.actionText}>Avaliou {event.game?.name}</Text>
            <Text style={styles.stars}>{'⭐'.repeat(event.meta.rating || 0)}</Text>
          </>
        );
      
      case 'finished':
        return (
          <>
            <Text style={styles.actionText}>Jornada Concluída! 🏆</Text>
            <Text style={styles.gameName}>{event.game?.name || 'um jogo'}</Text>
          </>
        );

      default:
        return <Text style={styles.gameName}>{event.game?.name || 'Atividade'}</Text>;
    }
  };

  const renderMetadata = () => {
    switch (event.type) {
      case 'started':
        // Mostra plataforma e status, NÃO mostra 0h
        const platform = event.meta.platform || 'PC';
        return <Text style={styles.metadata}>{platform} • Jogando</Text>;
      
      case 'synced':
        // Destaca o total acumulado com formatação clara
        const totalHours = event.meta.total_hours || 0;
        return (
          <View style={styles.metadataRow}>
            <Ionicons name="stats-chart-outline" size={14} color={colors.secondary} />
            <Text style={styles.metadata}>Total acumulado: {formatPlaytime(totalHours)}</Text>
          </View>
        );
      
      case 'log':
        // Snippet do diário
        const logText = event.meta.log_text || '';
        if (logText) {
          return <Text style={styles.logExcerpt} numberOfLines={2}>"{logText}"</Text>;
        }
        return null;
      
      case 'rated':
        return null; // Estrelas já estão no título
      
      case 'finished':
        // Tempo final
        const completionHours = event.meta.completion_time_hours || 0;
        if (completionHours > 0) {
          return <Text style={styles.metadata}>Tempo final: {completionHours.toFixed(0)}h</Text>;
        }
        return null;

      default:
        return null;
    }
  };

  const renderAction = () => {
    // REGRA DE OURO: Só mostra "Marcar progresso" para jogos MANUAIS (não Steam)
    const showProgressButton = isManualGame && event.type === 'started';

    if (showProgressButton) {
      return (
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Text style={styles.actionLink}>Marcar progresso</Text>
        </TouchableOpacity>
      );
    }

    // Ações para outros tipos
    switch (event.type) {
      case 'log':
        return (
          <TouchableOpacity onPress={() => router.push(`/game/${event.game?.igdb_id}`)}>
            <Text style={styles.actionLink}>Ver entrada</Text>
          </TouchableOpacity>
        );
      case 'rated':
        return (
          <TouchableOpacity onPress={() => router.push(`/game/${event.game?.igdb_id}`)}>
            <Text style={styles.actionLink}>Editar avaliação</Text>
          </TouchableOpacity>
        );
      default:
        return null;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          borderLeftColor: eventStyle.borderColor,
          backgroundColor: eventStyle.backgroundColor,
          borderLeftWidth: eventStyle.borderWidth,
        },
      ]}
      onPress={() => router.push(`/game/${event.game?.igdb_id}`)}
      activeOpacity={0.7}
    >
      {/* Header Opcional: Avatar + Username */}
      {showUserInfo && (
        <View style={styles.userHeader}>
          <View style={styles.avatarContainer}>
            {event.profile?.avatar_url ? (
              <Image source={{ uri: event.profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={14} color={colors.secondary} />
              </View>
            )}
          </View>
          <Text style={styles.username}>@{event.profile?.username || 'você'}</Text>
        </View>
      )}

      {/* Layout Horizontal: Capa + Conteúdo */}
      <View style={styles.mainContent}>
        {/* Capa Vertical (Esquerda) */}
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.posterCover} />
        ) : (
          <View style={[styles.posterCover, styles.coverPlaceholder]}>
            <Ionicons name="game-controller-outline" size={24} color={colors.secondary} />
          </View>
        )}

        {/* Conteúdo (Direita) */}
        <View style={styles.contentRight}>
          {/* Linha 1 + 2: Ação + Nome do Jogo */}
          {renderEventText()}

          {/* Linha 3: Metadados Contextuais */}
          <View style={styles.metadataRow}>
            {renderMetadata()}
          </View>

          {/* Rodapé: Timestamp + Ação */}
          <View style={styles.footer}>
            <Text style={styles.timestamp}>{timeAgo}</Text>
            {renderAction()}
          </View>
        </View>
      </View>

      {/* Modal de Sessão */}
      <LogSessionModal
        visible={modalVisible}
        gameName={event.game?.name || 'este jogo'}
        onClose={() => setModalVisible(false)}
        onConfirm={handleConfirmSession}
      />

      {/* Modal de Diário (opcional após logging de sessão) */}
      <SessionDiaryModal
        visible={showDiaryModal}
        onClose={() => setShowDiaryModal(false)}
        eventId={lastEventId}
        gameId={event.game?.igdb_id || 0}
        gameName={event.game?.name || 'este jogo'}
        onSaved={() => {
          setShowDiaryModal(false);
          onSessionLogged?.(); // Recarrega timeline para mostrar a nota
        }}
      />
    </TouchableOpacity>
  );
}

// Custom comparison function for React.memo
// Only re-render if event data or showUserInfo actually changed
function arePropsEqual(prevProps: EventCardProps, nextProps: EventCardProps): boolean {
  // Compare event by id and created_at to detect changes
  if (prevProps.event.id !== nextProps.event.id) return false;
  if (prevProps.event.created_at !== nextProps.event.created_at) return false;
  // Also check meta since it can change (e.g., grouped flag)
  if (JSON.stringify(prevProps.event.meta) !== JSON.stringify(nextProps.event.meta)) return false;
  if (prevProps.showUserInfo !== nextProps.showUserInfo) return false;
  // We don't compare callbacks as they're typically stable or recreated
  return true;
}

// Export memoized component to prevent unnecessary re-renders
export const EventCard = React.memo(EventCardComponent, arePropsEqual);

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  
  // User Header (Opcional)
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarContainer: {
    marginRight: 8,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  avatarPlaceholder: {
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  username: {
    ...typography.caption,
    color: colors.secondary,
    fontWeight: '600',
  },

  // Layout Horizontal Principal
  mainContent: {
    flexDirection: 'row',
    gap: 12,
  },

  // Poster Vertical (Esquerda)
  posterCover: {
    width: 60,
    aspectRatio: 3 / 4, // ~80px altura
    borderRadius: 8,
  },
  coverPlaceholder: {
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Conteúdo Direita
  contentRight: {
    flex: 1,
    justifyContent: 'space-between',
  },

  // Textos
  actionText: {
    ...typography.caption,
    color: colors.secondary,
    marginBottom: 2,
  },
  gameName: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    marginBottom: 6,
  },
  highlight: {
    fontWeight: '700',
    color: colors.accent,
  },

  // Metadados
  metadataRow: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metadata: {
    ...typography.caption,
    color: colors.secondary,
    fontSize: 13,
  },
  sourceBadge: {
    ...typography.caption,
    color: colors.accent,
    fontSize: 11,
    fontWeight: '600',
  },
  logExcerpt: {
    ...typography.caption,
    color: colors.secondary,
    fontStyle: 'italic',
    lineHeight: 18,
    fontSize: 13,
  },
  stars: {
    fontSize: 14,
    lineHeight: 18,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timestamp: {
    ...typography.caption,
    color: colors.secondary,
    fontSize: 12,
  },
  actionLink: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
    fontSize: 13,
  },
  
  // Steam Badge
  steamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(102, 192, 244, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  steamBadgeText: {
    ...typography.caption,
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  
  // Playtime Highlight
  playtimeHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  playtimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  playtimeValue: {
    ...typography.body,
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  playtimeTotal: {
    ...typography.caption,
    color: colors.secondary,
    fontSize: 13,
  },
  playtimeAdded: {
    ...typography.body,
    color: colors.accent,
    fontSize: 18,
    fontWeight: '700',
  },
  playtimeLabel: {
    ...typography.caption,
    color: colors.secondary,
    fontSize: 14,
  },
});
