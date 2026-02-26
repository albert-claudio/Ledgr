import { igdbCoverUrl } from '@/services/profile';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    ActivityIndicator,
    Image,
    ImageBackground,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

interface ActiveGameHeroProps {
  game: {
    id: number;
    igdb_id: number;
    name: string;
    cover_image_id?: string | null;
    minutes_played: number;
    last_session_at?: string;
  };
  onLogSession: () => void;
  onViewProgress: () => void;
  isSteamLinked?: boolean;
  isSyncing?: boolean;
}

export function ActiveGameHero({ game, onLogSession, onViewProgress, isSteamLinked, isSyncing = false }: ActiveGameHeroProps) {
  const router = useRouter();
  const coverUrl = igdbCoverUrl(game.cover_image_id || undefined);
  const totalHours = game.minutes_played / 60;
  
  // Smart formatting: hide if 0, use comma decimal, remove .0
  const formattedHours = totalHours === 0 
    ? null 
    : totalHours % 1 === 0 
      ? `${totalHours.toFixed(0)}h` 
      : `${totalHours.toFixed(1).replace('.', ',')}h`;
  
  const lastSessionText = game.last_session_at
    ? formatDistanceToNow(new Date(game.last_session_at), {
        addSuffix: true,
        locale: ptBR,
      })
    : null;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => router.push(`/game/${game.igdb_id}`)}
      activeOpacity={0.9}
    >
      <ImageBackground
        source={coverUrl ? { uri: coverUrl } : undefined}
        style={styles.background}
        imageStyle={styles.backgroundImage}
        blurRadius={20}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']}
          style={styles.overlay}
        >
          <View style={styles.content}>
            <View style={styles.topSection}>
              {coverUrl ? (
                <Image source={{ uri: coverUrl }} style={styles.poster} />
              ) : (
                <View style={[styles.poster, styles.posterPlaceholder]}>
                  <Ionicons name="game-controller" size={32} color={colors.secondary} />
                </View>
              )}

              <View style={styles.info}>
                <Text style={styles.label}>Continue sua jornada em</Text>
                <Text style={styles.gameName} numberOfLines={2}>
                  {game.name}
                </Text>
                
                {/* Smart Stats: Only show if there's data */}
                {formattedHours ? (
                  <View style={styles.statsRow}>
                    <View style={styles.stat}>
                      <Ionicons name="time-outline" size={16} color={colors.accent} />
                      <Text style={styles.statText}>{formattedHours} jogadas</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.inviteText}>Sua jornada começa agora ✨</Text>
                )}
                
                {/* Last Session: Only show if exists */}
                {lastSessionText ? (
                  <Text style={styles.lastSession}>
                    Última vez {lastSessionText}
                  </Text>
                ) : (
                  <Text style={styles.inviteText}>Toque em + para iniciar</Text>
                )}
              </View>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.primaryButton, isSyncing && styles.primaryButtonDisabled]}
                onPress={(e) => {
                  e.stopPropagation();
                  if (!isSyncing) onLogSession();
                }}
                activeOpacity={0.8}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <>
                    <ActivityIndicator size="small" color={colors.white} />
                    <Text style={styles.primaryButtonText}>Sincronizando...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="sync" size={24} color={colors.white} />
                    <Text style={styles.primaryButtonText}>Sincronizar Steam</Text>
                    {isSteamLinked && (
                      <View style={styles.steamBadge}>
                        <Ionicons name="logo-steam" size={12} color={colors.white} />
                      </View>
                    )}
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  background: {
    width: '100%',
    minHeight: 220,
  },
  backgroundImage: {
    resizeMode: 'cover',
  },
  overlay: {
    flex: 1,
    padding: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topSection: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  poster: {
    width: 100,
    height: 133,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  posterPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
  },
  label: {
    ...typography.caption,
    color: colors.secondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 11,
  },
  gameName: {
    ...typography.header,
    color: colors.white,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
    lineHeight: 28,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '600',
    fontSize: 14,
  },
  lastSession: {
    ...typography.caption,
    color: colors.secondary,
    fontSize: 13,
  },
  inviteText: {
    ...typography.caption,
    color: colors.accent,
    fontSize: 13,
    fontStyle: 'italic',
  },
  actions: {
    gap: 10,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
  steamBadge: {
    marginLeft: 4,
    opacity: 0.7,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
});
