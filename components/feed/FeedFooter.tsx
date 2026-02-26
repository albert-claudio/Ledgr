import { toggleLike } from '@/services/feedService';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface FeedFooterProps {
  likes: number;
  comments: number;
  eventId: string;
  isLiked: boolean;
}

export const FeedFooter = ({ likes: initialLikes, comments, eventId, isLiked: initialIsLiked }: FeedFooterProps) => {
  const [liked, setLiked] = useState(initialIsLiked);
  const [likesCount, setLikesCount] = useState(initialLikes);

  const handleLike = async () => {
    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Optimistic UI update
    const newLikedState = !liked;
    setLiked(newLikedState);
    setLikesCount(prev => newLikedState ? prev + 1 : prev - 1);

    try {
      await toggleLike(eventId, liked);
    } catch (error) {
      // Revert on error
      setLiked(!newLikedState);
      setLikesCount(prev => !newLikedState ? prev + 1 : prev - 1);
      console.error('Error toggling like:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
          <Ionicons 
            name={liked ? "heart" : "heart-outline"} 
            size={24} 
            color={liked ? "#E91E63" : "#AAA"} 
          />
          <Text style={[styles.actionText, liked && styles.likedText]}>
            {likesCount > 0 ? likesCount : 'Like'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="chatbubble-outline" size={22} color="#AAA" />
          <Text style={styles.actionText}>
            {comments > 0 ? comments : 'Comment'}
          </Text>
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity style={styles.addButton}>
        <Ionicons name="add-circle-outline" size={24} color="#AAA" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    paddingTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    color: '#AAA', // Light grey
    fontWeight: '500',
  },
  likedText: {
    color: '#E91E63',
  },
  addButton: {
    padding: 4,
  },
});
