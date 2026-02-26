import { colors } from '@/components/theme/colors';
import { typography } from '@/components/theme/typography';
import { useCurrentlyGaming } from '@/hooks/useProfile';
import { useAuth } from '@/providers/AuthProvider';
import { igdbCoverUrl } from '@/services/profile';
import { useRouter } from 'expo-router';
import React from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export const ContinuarJogando = ({ excludeId }: { excludeId?: number }) => {
  const router = useRouter();
  const { user } = useAuth();
  const playingQuery = useCurrentlyGaming(user?.id);

  if (!user?.id) return null;

  const filteredData = (playingQuery.data || []).filter(g => !excludeId || g.game.id !== excludeId);

  if (filteredData.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Continuar Jogando</Text>
      {playingQuery.isLoading ? (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[1, 2, 3, 4]}
          keyExtractor={(i) => `playing-skel-${i}`}
          renderItem={() => (
            <View style={styles.playingCard}>
              <View style={[styles.playingCover, { backgroundColor: colors.card }]} />
            </View>
          )}
          contentContainerStyle={styles.playingListContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      ) : (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.playingListContent}
          data={filteredData}
          keyExtractor={(ug) => String(ug.id)}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => {
            const url = igdbCoverUrl(item.game.cover_image_id || undefined) || undefined;
            const igdbId = item.game.igdb_id;
            return (
              <View style={styles.playingCard}>
                <TouchableOpacity activeOpacity={0.8} onPress={() => router.push(`/game/${igdbId}`)}>
                  {url ? (
                    <Image source={{ uri: url }} style={styles.playingCover} />
                  ) : (
                    <View style={[styles.playingCover, { backgroundColor: colors.card }]} />
                  )}
                </TouchableOpacity>
                <Text style={styles.playingName} numberOfLines={2}>{item.game.name}</Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginTop: 8,
    marginBottom: 20,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.primary,
    marginHorizontal: 16,
    marginBottom: 12,
    fontSize: 18,
  },
  subtle: { 
    ...typography.caption, 
    color: colors.secondary 
  },
  playingListContent: {
    paddingHorizontal: 16,
  },
  separator: {
    width: 12,
  },
  playingCard: {
    width: 120,
  },
  playingCover: {
    width: 120,
    height: 160,
    borderRadius: 10,
  },
  playingName: {
    ...typography.caption,
    color: colors.primary,
    marginTop: 6,
  },
});
