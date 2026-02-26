import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

interface SkeletonBoxProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
}

interface SkeletonCircleProps {
  size: number;
  style?: ViewStyle;
}

interface SkeletonTextProps {
  width?: number | string;
  style?: ViewStyle;
}

/**
 * Base skeleton component with shimmer animation
 */
export const SkeletonBox: React.FC<SkeletonBoxProps> = ({ 
  width = '100%', 
  height = 20, 
  borderRadius = 4,
  style 
}) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

/**
 * Circular skeleton for avatars
 */
export const SkeletonCircle: React.FC<SkeletonCircleProps> = ({ size, style }) => {
  return (
    <SkeletonBox
      width={size}
      height={size}
      borderRadius={size / 2}
      style={style}
    />
  );
};

/**
 * Text skeleton with default height
 */
export const SkeletonText: React.FC<SkeletonTextProps> = ({ width = '100%', style }) => {
  return (
    <SkeletonBox
      width={width}
      height={14}
      borderRadius={4}
      style={style}
    />
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.border,
  },
});
