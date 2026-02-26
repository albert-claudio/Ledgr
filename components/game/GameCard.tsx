import React, { memo, useRef } from 'react';
import { 
  View, 
  Image, 
  Pressable, 
  StyleSheet, 
  Animated
} from 'react-native';
import { colors } from '../../components/theme/colors';
import { Game } from '../../services/igdb';
import { useQueryClient } from '@tanstack/react-query';
import { getGameDetails, getGameScreenshots } from '@/services/gameDetail';

interface GameCardProps {
  game: Game;
  onPress?: () => void;
}

export const GameCard: React.FC<GameCardProps> = memo(({ game, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const qc = useQueryClient();

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
    // Prefetch game details and screenshots to speed up navigation
    try {
      qc.prefetchQuery({ queryKey: ['game-detail', game.id], queryFn: () => getGameDetails(game.id), staleTime: 1000 * 60 * 60, gcTime: 1000 * 60 * 60 * 2 });
      qc.prefetchQuery({ queryKey: ['game-screenshots', game.id], queryFn: () => getGameScreenshots(game.id), staleTime: 1000 * 60 * 60, gcTime: 1000 * 60 * 60 * 2 });
    } catch {}
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
    >
      <Animated.View 
        style={[
          styles.container,
          {
            transform: [{ scale: scaleAnim }]
          }
        ]}
      >
        {game.background_image ? (
          <Image
            source={{ uri: game.background_image }}
            style={styles.image}
            resizeMode="cover"
            accessibilityLabel={game.name}
          />
        ) : (
          <View style={[styles.image, styles.placeholder]} />
        )}
      </Animated.View>
    </Pressable>
  );
});

GameCard.displayName = 'GameCard';

const styles = StyleSheet.create({
  container: {
    width: 160,
    aspectRatio: 7 / 10,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.card,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: colors.card,
  },
});
