import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SkeletonBox, SkeletonText } from '../common/Skeleton';
import { colors } from '../theme/colors';

/**
 * Skeleton loader for Active Game Hero card
 */
export const ActiveGameHeroSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SkeletonBox width={120} height={160} borderRadius={12} />
        <View style={styles.info}>
          <SkeletonText width="80%" style={{ height: 20 }} />
          <SkeletonText width="60%" style={{ marginTop: 8 }} />
          <SkeletonText width="50%" style={{ marginTop: 8 }} />
        </View>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <SkeletonText width={60} />
          <SkeletonText width={40} style={{ marginTop: 4 }} />
        </View>
        <View style={styles.stat}>
          <SkeletonText width={80} />
          <SkeletonText width={50} style={{ marginTop: 4 }} />
        </View>
      </View>

      <View style={styles.actions}>
        <SkeletonBox width="48%" height={44} borderRadius={8} />
        <SkeletonBox width="48%" height={44} borderRadius={8} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  info: {
    marginLeft: 16,
    flex: 1,
    justifyContent: 'center',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  stat: {
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
