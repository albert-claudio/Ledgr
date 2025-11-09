import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

type Props = {
  visible: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export const ConfirmModal: React.FC<Props> = ({
  visible,
  title = 'Confirmação',
  message = 'Tem certeza?',
  confirmText = 'Excluir',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.msg}>{message}</Text>
          <View style={styles.row}>
            <Pressable onPress={onCancel} style={[styles.btn, styles.cancelBtn]}>
              <Text style={styles.cancelTxt}>{cancelText}</Text>
            </Pressable>
            <Pressable onPress={onConfirm} style={[styles.btn, styles.deleteBtn]}>
              <Text style={styles.deleteTxt}>{confirmText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '92%',
    backgroundColor: '#000',
    borderRadius: 12,
    padding: 16,
  },
  title: {
    ...typography.title,
    color: colors.primary,
    fontSize: 18,
    marginBottom: 8,
  },
  msg: {
    ...typography.body,
    color: colors.secondary,
    marginBottom: 14,
  },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  btn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
  cancelBtn: { backgroundColor: '#22D3EE' },
  deleteBtn: { backgroundColor: '#EF4444' },
  cancelTxt: { color: '#000', fontWeight: '600' },
  deleteTxt: { color: '#fff', fontWeight: '700' },
});

export default ConfirmModal;

