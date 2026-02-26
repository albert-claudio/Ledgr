import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../components/theme/colors';
import { typography } from '../../components/theme/typography';

interface GameInfoCardProps {
  coverImage: string;
  title: string;
  producer: string;
  platforms: string[];
  year: string;
  trophies: number;
  completionTime: string;
  trophiesSource?: string;
  completionSource?: string;
  onAddPress?: () => void;
  onDiaryPress?: () => void;
  onViewDiaryPress?: () => void;
  diaryEntriesCount?: number;
  isInCollection?: boolean;
  isInWishlist?: boolean;
  isManualGame?: boolean;
  status?: 'playing' | 'completed' | null;
  busyStatus?: 'playing' | 'completed' | null;
  onSetStatus?: (s: 'playing' | 'completed') => void;
  minutesPlayed?: number;
  isLoadingExternal?: boolean;
}

export const GameInfoCard: React.FC<GameInfoCardProps> = ({
  coverImage,
  title,
  producer,
  platforms,
  year,
  trophies,
  completionTime,
  trophiesSource,
  completionSource,
  onAddPress,
  onDiaryPress,
  onViewDiaryPress,
  diaryEntriesCount = 0,
  isInCollection = false,
  isInWishlist = false,
  isManualGame = false,
  status = null,
  busyStatus = null,
  onSetStatus,
  minutesPlayed,
  isLoadingExternal = false,
}) => {
  const formatPlaytime = () => {
    if (minutesPlayed === undefined || minutesPlayed === null) return null;
    if (minutesPlayed === 0) return 'Não iniciado';
    
    const hours = Math.floor(minutesPlayed / 60);
    const minutes = minutesPlayed % 60;
    
    if (hours === 0) return `${minutes}min`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}min`;
  };

  const prettySource = (src?: string) => {
    const s = (src || '').toUpperCase();
    if (s.startsWith('STEAM')) return 'Steam';
    if (s.startsWith('HLTB')) return 'HowLongToBeat';
    if (s.startsWith('IGDB')) return 'IGDB';
    if (s.startsWith('RAWG')) return 'RAWG';
    if (s.startsWith('ESTIMATE')) return 'Estimativa';
    return s || 'Desconhecida';
  };
  const getPlatformIcon = (platform: string): string => {
    const platformLower = platform.toLowerCase();
    if (platformLower.includes('playstation')) return 'logo-playstation';
    if (platformLower.includes('xbox')) return 'logo-xbox';
    if (platformLower.includes('pc') || platformLower.includes('windows')) return 'logo-windows';
    if (platformLower.includes('nintendo')) return 'game-controller';
    if (platformLower.includes('android')) return 'logo-android';
    if (platformLower.includes('ios')) return 'logo-apple';
    return 'game-controller-outline';
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {/* Cover Image */}
        <View style={styles.coverSection}>
          <View style={styles.coverContainer}>
            <Image 
              source={{ uri: coverImage }} 
              style={styles.coverImage}
              resizeMode="cover"
            />
          </View>
          
          {/* Diary Buttons - Para jogos na coleção */}
          {isInCollection && !isInWishlist && (
            <View style={styles.diaryButtonsRow}>
              {/* Botão para adicionar nova nota */}
              <TouchableOpacity 
                style={styles.diaryIconButton}
                onPress={onDiaryPress}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={22} color={colors.white} />
              </TouchableOpacity>
              
              {/* Botão para ver diário (só mostra se tem entradas) */}
              {diaryEntriesCount > 0 && onViewDiaryPress && (
                <TouchableOpacity 
                  style={styles.viewDiaryButton}
                  onPress={onViewDiaryPress}
                  activeOpacity={0.7}
                >
                  <Ionicons name="book" size={18} color={colors.accent} />
                  <Text style={styles.diaryCountText}>{diaryEntriesCount}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Game Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          
          <View style={styles.metaInfo}>
            <Text style={styles.label}>PRODUZIDO POR</Text>
            <Text style={styles.value}>{producer}</Text>
          </View>

          <View style={styles.platformsContainer}>
            {platforms.slice(0, 3).map((platform, index) => (
              <View key={index} style={styles.platformChip}>
                <Ionicons 
                  name={getPlatformIcon(platform) as any} 
                  size={12} 
                  color={colors.secondary} 
                />
                <Text style={styles.platformText}>{platform}</Text>
              </View>
            ))}
          </View>

          <View style={styles.yearContainer}>
            <Text style={styles.yearText}>{year} • </Text>
            <Text style={styles.genreText}>TRAILER</Text>
          </View>

          {isInCollection && !isInWishlist ? (
            <View style={styles.playtimeRow}>
              <Ionicons name="game-controller-outline" size={20} color={colors.accent} />
              <Text style={styles.playtimeText}>
                {formatPlaytime() || 'Sem registro de horas'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.addButton]} 
              onPress={onAddPress}
              activeOpacity={0.8}
            >
              <Ionicons 
                name={"add"} 
                size={20} 
                color={colors.white} 
              />
              <Text style={styles.addButtonText}>Adicionar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Sources Row - Always show if available */}
      {(trophiesSource || completionSource) && (
        <View style={styles.sourcesRow}>
          {completionSource && (
            <View style={styles.sourceChip}>
              <Ionicons name="time-outline" size={12} color={colors.accent} />
              <Text style={styles.sourceText}>Tempo: {prettySource(completionSource)}</Text>
            </View>
          )}
          {trophiesSource && (
            <View style={styles.sourceChip}>
              <Ionicons name="information-circle-outline" size={12} color={colors.secondary} />
              <Text style={styles.sourceText}>Troféus: {prettySource(trophiesSource)}</Text>
            </View>
          )}
        </View>
      )}

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="trophy" size={16} color={colors.accent} />
          {isLoadingExternal ? (
             <View style={{ width: 40, height: 16, backgroundColor: colors.border, borderRadius: 4, opacity: 0.5 }} />
          ) : (
             <Text style={styles.statValue}>{trophies}</Text>
          )}
          <Text style={styles.statLabel}>Troféus</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="time-outline" size={16} color={colors.accent} />
          {isLoadingExternal ? (
             <View style={{ width: 60, height: 16, backgroundColor: colors.border, borderRadius: 4, opacity: 0.5 }} />
          ) : (
             <Text style={styles.statValue}>{completionTime}</Text>
          )}
          <Text style={styles.statLabel}>Tempo de Jogo</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginTop: -40,
    zIndex: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  coverSection: {
    alignItems: 'center',
  },
  coverContainer: {
    width: 120,
    aspectRatio: 3 / 4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.card,
    elevation: 5,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  diaryButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  diaryIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  viewDiaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.accent,
    gap: 4,
  },
  diaryCountText: {
    ...typography.caption,
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  title: {
    ...typography.title,
    color: colors.primary,
    fontSize: 24,
    marginBottom: 8,
  },
  metaInfo: {
    marginBottom: 8,
  },
  label: {
    ...typography.caption,
    color: colors.secondary,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  value: {
    ...typography.body,
    color: colors.primary,
    fontSize: 15,
    marginTop: 2,
  },
  platformsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  platformChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  platformText: {
    ...typography.caption,
    color: colors.secondary,
    fontSize: 10,
  },
  yearContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  yearText: {
    ...typography.body,
    color: colors.secondary,
    fontSize: 12,
  },
  genreText: {
    ...typography.caption,
    color: colors.secondary,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    gap: 6,
  },
  addButtonActive: {
    backgroundColor: colors.success || '#10B981',
  },
  addButtonText: {
    ...typography.button,
    color: colors.white,
    fontSize: 14,
  },
  playtimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  playtimeText: {
    ...typography.body,
    color: colors.primary,
    fontSize: 18,
    fontWeight: '600' as any,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
  statValue: {
    ...typography.button,
    color: colors.primary,
    fontSize: 14,
  },
  statLabel: {
    ...typography.caption,
    color: colors.secondary,
    fontSize: 11,
  },
  sourcesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sourceText: {
    ...typography.caption,
    color: colors.secondary,
    fontSize: 11,
  },
});
