import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SkeletonBox, SkeletonCircle, SkeletonText } from '../common/Skeleton';
import { colors } from '../theme/colors';

/**
 * Skeleton loader for profile header
 */
export const ProfileHeaderSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <SkeletonCircle size={80} />
        <View style={styles.userInfo}>
          <SkeletonText width={120} style={{ height: 18 }} />
          <SkeletonText width={90} style={{ marginTop: 6 }} />
        </View>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <SkeletonText width={50} style={{ height: 24 }} />
          <SkeletonText width={70} style={{ marginTop: 4 }} />
        </View>
        <View style={styles.stat}>
          <SkeletonText width={50} style={{ height: 24 }} />
          <SkeletonText width={60} style={{ marginTop: 4 }} />
        </View>
        <View style={styles.stat}>
          <SkeletonText width={50} style={{ height: 24 }} />
          <SkeletonText width={80} style={{ marginTop: 4 }} />
        </View>
      </View>

      <SkeletonBox width="100%" height={100} borderRadius={12} style={{ marginTop: 16 }} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  userInfo: {
    marginLeft: 16,
    flex: 1,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  stat: {
    alignItems: 'center',
  },
});
