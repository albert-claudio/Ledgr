import { colors } from '@/components/theme/colors';
import { typography } from '@/components/theme/typography';
import { useGameDiary } from '@/hooks/useSessionDiary';
import { getGameStateIcon, getGameStateLabel, getMarkerIcon, getMarkerLabel, getMoodIcon, getMoodLabel } from '@/services/sessionDiary';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface DiaryViewModalProps {
  visible: boolean;
  onClose: () => void;
  gameId: number | null;
  gameName: string;
}

const formatDate = (dateString: string) => {
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } catch {
    return '';
  }
};

export function DiaryViewModal({
  visible,
  onClose,
  gameId,
  gameName,
}: DiaryViewModalProps) {
  const { data: entries, isLoading } = useGameDiary(gameId);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color={colors.primary} />
          </Pressable>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>Diário de Campanha</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {gameName}
            </Text>
          </View>
          {entries && entries.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{entries.length} {entries.length === 1 ? 'nota' : 'notas'}</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.loadingText}>Carregando diário...</Text>
            </View>
          ) : !entries || entries.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="journal-outline" size={64} color={colors.secondary} />
              <Text style={styles.emptyTitle}>Nenhuma anotação</Text>
              <Text style={styles.emptyText}>
                Suas anotações, humores e screenshots aparecerão aqui
              </Text>
            </View>
          ) : (
            entries.map((entry) => (
              <View key={entry.id} style={styles.entryCard}>
                {/* Header da entrada */}
                <View style={styles.entryHeader}>
                  <Text style={styles.entryDate}>{formatDate(entry.created_at)}</Text>
                  {entry.hours_played && (
                    <View style={styles.hoursBadge}>
                      <Ionicons name="time-outline" size={12} color={colors.accent} />
                      <Text style={styles.hoursText}>+{entry.hours_played}h</Text>
                    </View>
                  )}
                </View>

                {/* Mood e Estado do jogo */}
                {(entry.mood || entry.game_state) && (
                  <View style={styles.statusRow}>
                    {entry.mood && (
                      <View style={styles.moodChip}>
                        <Text style={styles.moodEmoji}>{getMoodIcon(entry.mood)}</Text>
                        <Text style={styles.moodText}>{getMoodLabel(entry.mood)}</Text>
                      </View>
                    )}
                    {entry.game_state && (
                      <View style={styles.stateChip}>
                        <Text style={styles.stateEmoji}>{getGameStateIcon(entry.game_state)}</Text>
                        <Text style={styles.stateText}>{getGameStateLabel(entry.game_state)}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Progresso */}
                {entry.progress_text && (
                  <View style={styles.progressContainer}>
                    <Ionicons name="flag-outline" size={14} color={colors.secondary} />
                    <Text style={styles.progressText}>{entry.progress_text}</Text>
                  </View>
                )}

                {/* Nota de texto */}
                {entry.note_text && (
                  <Text style={styles.noteText}>{entry.note_text}</Text>
                )}

                {/* Screenshots/Media */}
                {entry.media_urls && entry.media_urls.length > 0 && (
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    style={styles.mediaScroll}
                  >
                    {entry.media_urls.map((url, idx) => (
                      <Image 
                        key={idx} 
                        source={{ uri: url }} 
                        style={styles.mediaImage} 
                      />
                    ))}
                  </ScrollView>
                )}

                {/* Marcadores */}
                {entry.markers && entry.markers.length > 0 && (
                  <View style={styles.markersRow}>
                    {entry.markers.map((marker) => (
                      <View key={marker} style={styles.markerChip}>
                        <Text style={styles.markerEmoji}>{getMarkerIcon(marker)}</Text>
                        <Text style={styles.markerText}>{getMarkerLabel(marker)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.title,
    color: colors.primary,
    fontSize: 18,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.secondary,
    fontSize: 13,
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    ...typography.caption,
    color: colors.black,
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  loadingText: {
    ...typography.body,
    color: colors.secondary,
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.primary,
    fontSize: 20,
    marginTop: 16,
  },
  emptyText: {
    ...typography.body,
    color: colors.secondary,
    textAlign: 'center',
    marginTop: 8,
  },
  entryCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  entryDate: {
    ...typography.caption,
    color: colors.secondary,
    fontSize: 12,
  },
  hoursBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  hoursText: {
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
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  moodEmoji: {
    fontSize: 16,
  },
  moodText: {
    ...typography.body,
    color: '#FBBF24',
    fontSize: 13,
    fontWeight: '600',
  },
  stateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  stateEmoji: {
    fontSize: 16,
  },
  stateText: {
    ...typography.body,
    color: '#8B5CF6',
    fontSize: 13,
    fontWeight: '600',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  progressText: {
    ...typography.body,
    color: colors.secondary,
    fontSize: 13,
  },
  noteText: {
    ...typography.body,
    color: colors.primary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  mediaScroll: {
    marginBottom: 12,
    marginHorizontal: -4,
  },
  mediaImage: {
    width: 140,
    height: 140,
    borderRadius: 12,
    marginHorizontal: 4,
    backgroundColor: colors.background,
  },
  markersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  markerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  markerEmoji: {
    fontSize: 12,
  },
  markerText: {
    ...typography.caption,
    color: colors.secondary,
    fontSize: 11,
  },
});
