import { FeedPayload } from '@/types/feed';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  payload: FeedPayload;
}

export const GameFinishedCard = ({ payload }: Props) => {
  return (
    <View style={styles.container}>
      <Image
        source={{ uri: payload.cover_url }}
        style={styles.cover}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.content}>
        <Text style={styles.title}>{payload.game_title}</Text>
        <Text style={styles.platform}>{payload.platform}</Text>
        
        <View style={styles.statsRow}>
          {payload.user_rating && (
            <View style={styles.stat}>
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.statText}>{payload.user_rating}/5</Text>
            </View>
          )}
          {payload.playtime_hours && (
            <View style={styles.stat}>
              <Ionicons name="time-outline" size={14} color="#AAA" />
              <Text style={styles.statText}>{payload.playtime_hours}h</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#2A2A2A', // Slightly lighter than card background
    borderRadius: 12,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  cover: {
    width: 80,
    height: 110,
  },
  content: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF', // White
    marginBottom: 4,
  },
  platform: {
    fontSize: 12,
    color: '#AAA',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#333',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DDD',
  },
});
