import { FeedEvent } from '@/types/feed';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { FeedFooter } from './FeedFooter';
import { FeedHeader } from './FeedHeader';
import { DiaryEntryCard } from './cards/DiaryEntryCard';
import { GameFinishedCard } from './cards/GameFinishedCard';

interface FeedItemProps {
  event: FeedEvent;
}

export const FeedItem = ({ event }: FeedItemProps) => {
  const renderContent = () => {
    switch (event.event_type) {
      case 'game_finished':
        return <GameFinishedCard payload={event.payload} />;
      case 'diary_entry':
        return <DiaryEntryCard payload={event.payload} />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <FeedHeader 
        user={event.user} 
        action={event.event_type} 
        time={event.created_at} 
      />
      
      <View style={styles.content}>
        {renderContent()}
      </View>

      <FeedFooter 
        likes={event.likes_count} 
        comments={event.comments_count} 
        eventId={event.id}
        isLiked={event.is_liked_by_me || false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E1E1E', // Dark grey for cards
    marginBottom: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  content: {
    marginVertical: 4,
  },
});
