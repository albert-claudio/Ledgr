import { FeedEventType } from '@/types/feed';
import { formatDistanceToNow } from 'date-fns';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface FeedHeaderProps {
  user?: {
    username: string;
    avatar_url: string;
  };
  action: FeedEventType;
  time: string;
}

const getActionText = (action: FeedEventType) => {
  switch (action) {
    case 'game_started': return 'started playing';
    case 'game_finished': return 'finished';
    case 'diary_entry': return 'wrote a diary entry';
    case 'review': return 'reviewed';
    case 'goal_completed': return 'completed a goal';
    case 'platinum_trophy': return 'earned a platinum trophy';
    case 'batch_import': return 'added games';
    default: return 'posted an update';
  }
};

export const FeedHeader = ({ user, action, time }: FeedHeaderProps) => {
  const timeAgo = formatDistanceToNow(new Date(time), { addSuffix: true });

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: user?.avatar_url || 'https://via.placeholder.com/40' }}
        style={styles.avatar}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.textContainer}>
        <Text style={styles.username}>
          {user?.username || 'Unknown User'} <Text style={styles.action}>{getActionText(action)}</Text>
        </Text>
        <Text style={styles.time}>{timeAgo}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#333',
  },
  textContainer: {
    flex: 1,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF', // White text
  },
  action: {
    fontWeight: '400',
    color: '#AAA', // Lighter grey for action text
  },
  time: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});
