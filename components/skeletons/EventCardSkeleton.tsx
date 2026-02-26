import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SkeletonBox, SkeletonCircle, SkeletonText } from '../common/Skeleton';
import { colors } from '../theme/colors';

/**
 * Skeleton loader for timeline event cards
 */
export const EventCardSkeleton: React.FC = () => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <SkeletonCircle size={40} />
        <View style={styles.headerText}>
          <SkeletonText width={120} />
          <SkeletonText width={80} style={{ marginTop: 4 }} />
        </View>
      </View>

      <View style={styles.content}>
        <SkeletonBox width={80} height={106} borderRadius={8} />
        <View style={styles.gameInfo}>
          <SkeletonText width="70%" />
          <SkeletonText width="90%" style={{ marginTop: 6 }} />
          <SkeletonText width="60%" style={{ marginTop: 6 }} />
        </View>
      </View>

      <View style={styles.footer}>
        <SkeletonText width={60} />
        <SkeletonText width={80} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  content: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  gameInfo: {
    marginLeft: 12,
    flex: 1,
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
});
