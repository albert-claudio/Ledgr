import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { colors } from '../../components/theme/colors';

interface SkeletonCardProps {
  width?: number;
  aspectRatio?: number;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ 
  width = 160, 
  aspectRatio = 7 / 10 
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={[styles.container, { width, aspectRatio }]}>
      <Animated.View style={[styles.skeleton, { opacity }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.card,
    marginRight: 12,
  },
  skeleton: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.secondary,
  },
});