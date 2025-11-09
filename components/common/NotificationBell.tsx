import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useNotifications } from '@/providers/NotificationsProvider';
import { NotificationsModal } from './NotificationsModal';

type Props = {
  size?: number;
  color?: string;
  onPress?: () => void;
};

export const NotificationBell: React.FC<Props> = ({ size = 20, color = colors.primary, onPress }) => {
  const { unseenCount, markAllSeen } = useNotifications();
  const [open, setOpen] = React.useState(false);

  const handlePress = () => {
    markAllSeen();
    setOpen(true);
    onPress?.();
  };

  return (
    <>
      <Pressable onPress={handlePress} style={styles.wrap} hitSlop={10}>
        <Ionicons name="notifications-outline" size={size} color={color} />
        {unseenCount > 0 && <View style={styles.badge} />}
      </Pressable>
      <NotificationsModal visible={open} onClose={() => setOpen(false)} />
    </>
  );
};

const styles = StyleSheet.create({
  wrap: { padding: 4 },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
});

export default NotificationBell;
