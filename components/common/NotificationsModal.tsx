import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { useNotifications } from '@/providers/NotificationsProvider';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export const NotificationsModal: React.FC<Props> = ({ visible, onClose }) => {
  const { notifications } = useNotifications();

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Notificações</Text>
          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ paddingBottom: 8 }}>
            {notifications.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>Sem notificações</Text>
              </View>
            ) : (
              notifications.map((n) => (
                <View key={n.id} style={styles.item}>
                  {!!n.title && <Text style={styles.itemTitle}>{n.title}</Text>}
                  <Text style={styles.itemBody}>{n.body || ''}</Text>
                </View>
              ))
            )}
          </ScrollView>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeTxt}>Fechar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject as any,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '92%',
    borderRadius: 12,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  title: {
    ...typography.title,
    color: colors.primary,
    fontSize: 18,
    marginBottom: 10,
  },
  emptyBox: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.secondary,
  },
  item: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemTitle: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemBody: {
    ...typography.caption,
    color: colors.secondary,
  },
  closeBtn: {
    marginTop: 10,
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  closeTxt: {
    ...typography.body,
    color: colors.accent,
  },
});

export default NotificationsModal;
