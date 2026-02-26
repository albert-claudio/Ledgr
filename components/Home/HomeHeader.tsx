import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../components/theme/colors';
import { typography } from '../../components/theme/typography';
import { NotificationBell } from '@/components/common/NotificationBell';

interface HomeHeaderProps {
  onMenuPress?: () => void;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({ onMenuPress }) => {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>L</Text>
        </View>
        <Text style={styles.title}>Início</Text>
      </View>
      <View style={styles.actions}>
        <NotificationBell />
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={onMenuPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="menu" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    backgroundColor: colors.background,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  logoText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: 'bold',
  },
  title: {
    ...typography.header,
    color: colors.primary,
  },
  menuButton: {
    padding: 4,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
