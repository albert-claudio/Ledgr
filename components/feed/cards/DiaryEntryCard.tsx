import { FeedPayload } from '@/types/feed';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  payload: FeedPayload;
}

export const DiaryEntryCard = ({ payload }: Props) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="journal-outline" size={20} color="#AAA" />
        <Text style={styles.gameTitle}>{payload.game_title}</Text>
      </View>
      <Text style={styles.content} numberOfLines={4}>
        {payload.diary_content}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#2A2A2A', // Slightly lighter than card background
    borderRadius: 12,
    marginHorizontal: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  gameTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#AAA',
  },
  content: {
    fontSize: 15,
    lineHeight: 22,
    color: '#DDD', // Light grey text
    fontStyle: 'italic',
  },
});
