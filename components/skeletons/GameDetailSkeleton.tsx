import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SkeletonBox, SkeletonText } from '../common/Skeleton';
import { colors } from '../theme/colors';

/**
 * Skeleton loader for game detail page
 */
export const GameDetailSkeleton: React.FC = () => {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.content}>
        {/* Banner/Cover */}
        <SkeletonBox width="100%" height={300} borderRadius={0} />

        {/* Game Info */}
        <View style={styles.infoSection}>
          <SkeletonText width="70%" style={{ height: 24, marginBottom: 8 }} />
          <SkeletonText width="50%" style={{ marginBottom: 16 }} />

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <SkeletonBox width={60} height={40} borderRadius={8} />
            <SkeletonBox width={60} height={40} borderRadius={8} />
            <SkeletonBox width={60} height={40} borderRadius={8} />
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <SkeletonBox width="48%" height={44} borderRadius={8} />
            <SkeletonBox width="48%" height={44} borderRadius={8} />
          </View>

          {/* Description */}
          <View style={styles.descSection}>
            <SkeletonText width={100} style={{ height: 16, marginBottom: 12 }} />
            <SkeletonText width="100%" />
            <SkeletonText width="100%" style={{ marginTop: 6 }} />
            <SkeletonText width="90%" style={{ marginTop: 6 }} />
            <SkeletonText width="95%" style={{ marginTop: 6 }} />
            <SkeletonText width="70%" style={{ marginTop: 6 }} />
          </View>

          {/* Screenshots */}
          <View style={styles.screenshotsSection}>
            <SkeletonText width={120} style={{ height: 16, marginBottom: 12 }} />
            <View style={styles.screenshotsRow}>
              <SkeletonBox width={150} height={85} borderRadius={8} style={{ marginRight: 8 }} />
              <SkeletonBox width={150} height={85} borderRadius={8} style={{ marginRight: 8 }} />
              <SkeletonBox width={150} height={85} borderRadius={8} />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  infoSection: {
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  descSection: {
    marginBottom: 24,
  },
  screenshotsSection: {
    marginBottom: 24,
  },
  screenshotsRow: {
    flexDirection: 'row',
  },
});
