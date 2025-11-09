import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  isInCollection?: boolean;
  isInWishlist?: boolean;
  status?: 'playing' | 'completed' | null;
  busyStatus?: 'playing' | 'completed' | null;
  onSetStatus?: (s: 'playing' | 'completed') => void;
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
  isInCollection = false,
  isInWishlist = false,
  status = null,
  busyStatus = null,
  onSetStatus,
}) => {
  const prettySource = (src?: string) => {
    const s = (src || '').toUpperCase();
    if (s.startsWith('STEAM')) return 'Steam';
    if (s.startsWith('IGDB')) return 'IGDB';
    if (s === 'RAWG') return 'RAWG';
    return s || '';
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
        <View style={styles.coverContainer}>
          <Image 
            source={{ uri: coverImage }} 
            style={styles.coverImage}
            resizeMode="cover"
          />
        </View>

        {/* Game Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          
          <View style={styles.metaInfo}>
            <Text style={styles.label}>PRODUCER BY</Text>
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
            <View style={styles.statusRow}>
              <TouchableOpacity
                onPress={() => onSetStatus?.('playing')}
                disabled={!!busyStatus}
                style={[styles.statusBtn, status === 'playing' && styles.statusBtnActive]}
                activeOpacity={0.8}
              >
                <Text style={[styles.statusTxt, status === 'playing' && styles.statusTxtActive]}>
                  {busyStatus === 'playing' ? '...' : 'Jogando'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onSetStatus?.('completed')}
                disabled={!!busyStatus}
                style={[styles.statusBtn, status === 'completed' && styles.statusBtnActive]}
                activeOpacity={0.8}
              >
                <Text style={[styles.statusTxt, status === 'completed' && styles.statusTxtActive]}>
                  {busyStatus === 'completed' ? '...' : 'Zerado'}
                </Text>
              </TouchableOpacity>
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

      {/* Sources Row */}
      {(trophiesSource || completionSource) && (
        <View style={styles.sourcesRow}>
          {trophiesSource ? (
            <Text style={styles.sourceText}>Fonte troféus: {prettySource(trophiesSource)}</Text>
          ) : null}
          {completionSource ? (
            <Text style={styles.sourceText}>Fonte tempo: {prettySource(completionSource)}</Text>
          ) : null}
        </View>
      )}

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="trophy" size={16} color={colors.accent} />
          <Text style={styles.statValue}>{trophies}</Text>
          <Text style={styles.statLabel}>Troféus</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="time-outline" size={16} color={colors.accent} />
          <Text style={styles.statValue}>{completionTime}</Text>
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
  statusRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statusBtn: {
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  statusBtnActive: {
    backgroundColor: '#4DD4D9',
    borderColor: '#4DD4D9',
  },
  statusTxt: {
    color: colors.primary,
    fontWeight: '700' as any,
  },
  statusTxtActive: {
    color: '#001011',
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
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
    paddingHorizontal: 12,
  },
  sourceText: {
    ...typography.caption,
    color: colors.secondary,
    fontSize: 10,
  },
});
