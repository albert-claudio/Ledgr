import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Dimensions } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

type MenuItem = {
  label: string;
  onPress?: () => void;
};

type Props = {
  visible: boolean;
  title?: string;
  items: MenuItem[];
  onClose: () => void;
  widthPct?: number; // 0-1 (default 0.65)
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const SideMenu: React.FC<Props> = ({ visible, title = 'Menu', items, onClose, widthPct = 0.65 }) => {
  const screenW = Dimensions.get('window').width;
  const menuW = Math.max(260, Math.min(screenW * widthPct, 420));
  const anim = useRef(new Animated.Value(0)).current; // 0 hidden, 1 shown
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [menuW, 0],
  });
  const backdropOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] });

  if (!mounted) return null as any;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      <AnimatedPressable style={[styles.backdrop, { opacity: backdropOpacity }]} onPress={onClose} />
      <Animated.View style={[styles.sheet, { width: menuW, transform: [{ translateX }] }]}> 
        <Text style={styles.title}>{title}</Text>
        <View style={styles.divider} />
        {items.map((it, idx) => (
          <Pressable
            key={`${it.label}-${idx}`}
            onPress={() => { try { it.onPress?.(); } finally { onClose(); } }}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
          >
            <Text style={styles.itemText}>{it.label}</Text>
          </Pressable>
        ))}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject as any,
    backgroundColor: '#000',
  },
  sheet: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.background,
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  title: {
    ...typography.title,
    color: colors.primary,
    fontSize: 22,
    textAlign: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginTop: 12,
    marginBottom: 8,
  },
  item: {
    paddingVertical: 14,
  },
  itemPressed: {
    opacity: 0.7,
  },
  itemText: {
    ...typography.body,
    color: colors.primary,
    fontSize: 18,
  },
});

export default SideMenu;
