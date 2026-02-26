import { igdbCoverUrl } from '@/services/profile';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

interface ActiveGameStatusProps {
  game: {
    id: number;
    game_id: number;
    game: {
      igdb_id: number;
      name: string;
      cover_image_id: string | null;
    };
  };
}

export function ActiveGameStatus({ game }: ActiveGameStatusProps) {
  const router = useRouter();
  const coverUrl = igdbCoverUrl(game.game.cover_image_id || undefined);

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.content}
        onPress={() => router.push(`/game/${game.game.igdb_id}`)}
        activeOpacity={0.8}
      >
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Ionicons name="game-controller-outline" size={24} color={colors.secondary} />
          </View>
        )}
        
        <View style={styles.info}>
          <Text style={styles.label}>Jogando agora</Text>
          <Text style={styles.gameName} numberOfLines={1}>{game.game.name}</Text>
        </View>
      </TouchableOpacity>
      
      <View style={styles.actions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push(`/game/${game.game.igdb_id}`)}
          activeOpacity={0.7}
        >
          <Ionicons name="book-outline" size={20} color={colors.accent} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push(`/game/${game.game.igdb_id}`)}
          activeOpacity={0.7}
        >
          <Ionicons name="time-outline" size={20} color={colors.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cover: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  coverPlaceholder: {
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  label: {
    ...typography.caption,
    color: colors.secondary,
    marginBottom: 2,
  },
  gameName: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
