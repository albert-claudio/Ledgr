import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SkeletonBox, SkeletonText } from '../common/Skeleton';

interface GameCardSkeletonProps {
  orientation?: 'vertical' | 'horizontal';
}

/**
 * Skeleton loader for game cards
 * Matches the dimensions and layout of actual game cards
 */
export const GameCardSkeleton: React.FC<GameCardSkeletonProps> = ({ 
  orientation = 'vertical' 
}) => {
  if (orientation === 'horizontal') {
    return (
      <View style={styles.horizontalCard}>
        <SkeletonBox width={80} height={106} borderRadius={8} />
        <View style={styles.horizontalInfo}>
          <SkeletonText width="80%" />
          <SkeletonText width="50%" style={{ marginTop: 4 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.verticalCard}>
      <SkeletonBox width="100%" height={140} borderRadius={8} />
      <SkeletonText width="90%" style={{ marginTop: 8 }} />
      <SkeletonText width="60%" style={{ marginTop: 4 }} />
    </View>
  );
};

const styles = StyleSheet.create({
  verticalCard: {
    width: '100%',
    marginBottom: 16,
  },
  horizontalCard: {
    flexDirection: 'row',
    marginBottom: 12,
    marginRight: 12,
  },
  horizontalInfo: {
    marginLeft: 12,
    flex: 1,
    justifyContent: 'center',
  },
});
