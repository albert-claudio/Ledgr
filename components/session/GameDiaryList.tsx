import { colors } from '@/components/theme/colors';
import { typography } from '@/components/theme/typography';
import { useGameDiary, useSessionDiaryMutation } from '@/hooks/useSessionDiary';
import { getGameStateIcon, getGameStateLabel, getMarkerIcon, getMarkerLabel, getMoodIcon, getMoodLabel } from '@/services/sessionDiary';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface GameDiaryListProps {
  gameId: number;
}

const formatDate = (dateString: string) => {
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

export function GameDiaryList({ gameId }: GameDiaryListProps) {
  const { data: entries, isLoading } = useGameDiary(gameId);
  const { remove } = useSessionDiaryMutation();

  const handleDelete = (id: number) => {
    Alert.alert(
      'Excluir nota',
      'Tem certeza que deseja excluir esta anotação?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Excluir', 
          style: 'destructive',
          onPress: () => remove.mutate(id) 
        }
      ]
    );
  };

  if (isLoading) {
    return <View style={styles.container}><Text style={styles.loadingText}>Carregando diário...</Text></View>;
  }

  if (!entries || entries.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Diário de Campanha</Text>
      
      {entries.map((entry) => (
        <View key={entry.id} style={styles.card}>
          {/* Header with Date and Actions */}
          <View style={styles.header}>
            <Text style={styles.date}>{formatDate(entry.created_at)}</Text>
            {entry.hours_played && (
               <View style={styles.badgeContainer}>
                  <Ionicons name="time-outline" size={12} color={colors.accent} />
                  <Text style={styles.badgeText}>+{entry.hours_played}h</Text>
               </View>
            )}
            <Pressable onPress={() => handleDelete(entry.id)} hitSlop={10} style={{ marginLeft: 'auto' }}>
               <Ionicons name="trash-outline" size={16} color={colors.error} style={{ opacity: 0.7 }} />
            </Pressable>
          </View>

          {/* Quick status row */}
          <View style={styles.statusRow}>
            {entry.game_state && (
              <View style={styles.pill}>
                <Text style={styles.pillIcon}>{getGameStateIcon(entry.game_state)}</Text>
                <Text style={styles.pillText}>{getGameStateLabel(entry.game_state)}</Text>
              </View>
            )}
            {entry.mood && (
              <View style={styles.pill}>
                <Text style={styles.pillIcon}>{getMoodIcon(entry.mood)}</Text>
                <Text style={styles.pillText}>{getMoodLabel(entry.mood)}</Text>
              </View>
            )}
             {entry.progress_text && (
              <View style={[styles.pill, { backgroundColor: colors.background }]}>
                <Text style={[styles.pillText, { color: colors.secondary }]}>{entry.progress_text}</Text>
              </View>
            )}
          </View>

          {/* Note Text */}
          {entry.note_text && (
            <Text style={styles.noteText}>{entry.note_text}</Text>
          )}

          {/* Media */}
          {entry.media_urls && entry.media_urls.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaRow}>
              {entry.media_urls.map((url, idx) => (
                <Image key={idx} source={{ uri: url }} style={styles.mediaImage} />
              ))}
            </ScrollView>
          )}

          {/* Markers */}
          {entry.markers && entry.markers.length > 0 && (
            <View style={styles.markerRow}>
              {entry.markers.map((m) => (
                <View key={m} style={styles.markerChip}>
                  <Text style={styles.markerIcon}>{getMarkerIcon(m)}</Text>
                  <Text style={styles.markerText}>{getMarkerLabel(m)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  title: {
    ...typography.title,
    color: colors.primary,
    fontSize: 18,
    marginBottom: 12,
  },
  loadingText: {
    ...typography.caption,
    color: colors.secondary,
    textAlign: 'center',
    marginVertical: 10,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  date: {
    ...typography.caption,
    color: colors.secondary,
    fontSize: 12,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  badgeText: {
    ...typography.caption,
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
  },
  pillIcon: {
    fontSize: 14,
  },
  pillText: {
    ...typography.caption,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  noteText: {
    ...typography.body,
    color: colors.primary,
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  mediaRow: {
    marginBottom: 12,
  },
  mediaImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: colors.background,
  },
  markerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  markerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  markerIcon: {
    fontSize: 10,
  },
  markerText: {
    ...typography.caption,
    color: colors.secondary,
    fontSize: 10,
  },
});
