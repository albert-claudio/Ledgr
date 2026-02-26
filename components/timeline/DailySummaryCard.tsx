import { igdbCoverUrl } from '@/services/profile';
import type { Event } from '@/types/event';
import { formatPlaytime } from '@/utils/timeUtils';
import { Ionicons } from '@expo/vector-icons';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

interface DailySummaryCardProps {
  date: Date;
  events: Event[];
  onViewAll?: () => void;
}

/**
 * Componente que exibe um resumo diário de todos os jogos jogados
 * Agrupa por dia e mostra:
 * - Data formatada (Hoje, Ontem, ou data)
 * - Total de horas jogadas no dia
 * - Lista de jogos com suas respectivas horas
 */
export function DailySummaryCard({ date, events, onViewAll }: DailySummaryCardProps) {
  const router = useRouter();
  
  // Calcula o total de horas do dia
  const totalHours = events.reduce((sum, event) => {
    return sum + (event.meta?.hours_added || 0);
  }, 0);
  
  // Formata a data
  const formatDateHeader = () => {
    if (isToday(date)) return 'Hoje';
    if (isYesterday(date)) return 'Ontem';
    return format(date, "EEEE, d 'de' MMMM", { locale: ptBR });
  };
  
  // Agrupa eventos por jogo para evitar duplicatas
  const gameMap = new Map<number, { event: Event; hours: number; sessions: number }>();
  
  events.forEach(event => {
    if (!event.game_id) return;
    
    const existing = gameMap.get(event.game_id);
    if (existing) {
      existing.hours += (event.meta?.hours_added || 0);
      existing.sessions += 1;
    } else {
      gameMap.set(event.game_id, {
        event,
        hours: event.meta?.hours_added || 0,
        sessions: 1,
      });
    }
  });
  
  const games = Array.from(gameMap.values()).sort((a, b) => b.hours - a.hours);
  
  // Se não houver jogos, não renderiza
  if (games.length === 0) return null;
  
  return (
    <View style={styles.container}>
      {/* Header do Dia */}
      <View style={styles.header}>
        <View style={styles.dateContainer}>
          <Ionicons name="calendar-outline" size={16} color={colors.accent} />
          <Text style={styles.dateText}>{formatDateHeader()}</Text>
        </View>
        <View style={styles.totalBadge}>
          <Ionicons name="time" size={14} color={colors.accent} />
          <Text style={styles.totalText}>{formatPlaytime(totalHours)}</Text>
        </View>
      </View>
      
      {/* Lista de Jogos */}
      <View style={styles.gamesList}>
        {games.slice(0, 5).map(({ event, hours, sessions }) => {
          const coverUrl = igdbCoverUrl(event.game?.cover_image_id || undefined);
          
          return (
            <TouchableOpacity 
              key={event.game_id}
              style={styles.gameRow}
              onPress={() => router.push(`/game/${event.game?.igdb_id}`)}
              activeOpacity={0.7}
            >
              {/* Capa do jogo */}
              {coverUrl ? (
                <Image source={{ uri: coverUrl }} style={styles.gameCover} />
              ) : (
                <View style={[styles.gameCover, styles.coverPlaceholder]}>
                  <Ionicons name="game-controller" size={16} color={colors.secondary} />
                </View>
              )}
              
              {/* Info do jogo */}
              <View style={styles.gameInfo}>
                <Text style={styles.gameName} numberOfLines={1}>
                  {event.game?.name || 'Jogo'}
                </Text>
                {sessions > 1 && (
                  <Text style={styles.sessionsText}>
                    {sessions} sessões
                  </Text>
                )}
              </View>
              
              {/* Horas jogadas */}
              <View style={styles.hoursContainer}>
                <Text style={styles.hoursText}>+{formatPlaytime(hours)}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      
      {/* Ver mais (se houver mais de 5 jogos) */}
      {games.length > 5 && (
        <TouchableOpacity style={styles.viewMore} onPress={onViewAll}>
          <Text style={styles.viewMoreText}>
            +{games.length - 5} jogos • Ver todos
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
    textTransform: 'capitalize',
  },
  totalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(102, 192, 244, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  totalText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '700',
    fontSize: 14,
  },
  
  // Lista de jogos
  gamesList: {
    gap: 12,
  },
  gameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gameCover: {
    width: 40,
    height: 54,
    borderRadius: 6,
  },
  coverPlaceholder: {
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameInfo: {
    flex: 1,
  },
  gameName: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  sessionsText: {
    ...typography.caption,
    color: colors.secondary,
    fontSize: 12,
    marginTop: 2,
  },
  hoursContainer: {
    backgroundColor: 'rgba(102, 192, 244, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  hoursText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '700',
    fontSize: 14,
  },
  
  // Ver mais
  viewMore: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  viewMoreText: {
    ...typography.caption,
    color: colors.secondary,
    fontSize: 13,
  },
});
