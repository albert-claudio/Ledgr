import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

interface LogSessionModalProps {
  visible: boolean;
  gameName: string;
  onClose: () => void;
  onConfirm: (hours: number) => void;
}

export function LogSessionModal({
  visible,
  gameName,
  onClose,
  onConfirm,
}: LogSessionModalProps) {
  const [hours, setHours] = useState('0');

  const handleChipPress = (minutesToAdd: number) => {
    const currentHours = parseFloat(hours) || 0;
    const hoursToAdd = minutesToAdd / 60;
    const newTotal = currentHours + hoursToAdd;
    setHours(newTotal.toFixed(1));
  };

  const handleConfirm = () => {
    const hoursValue = parseFloat(hours) || 0;
    if (hoursValue > 0) {
      onConfirm(hoursValue);
      setHours('0'); // Reset
      onClose();
    }
  };

  const handleCancel = () => {
    setHours('0');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <Pressable style={styles.backdrop} onPress={handleCancel}>
        <Pressable style={styles.bottomSheet} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.handle} />
            <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.secondary} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Ionicons name="game-controller" size={48} color={colors.accent} />
            
            <Text style={styles.title}>Quanto tempo jogou hoje?</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {gameName}
            </Text>

            {/* Input Principal */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={hours}
                onChangeText={setHours}
                keyboardType="decimal-pad"
                placeholder="0.0"
                placeholderTextColor={colors.secondary}
                selectTextOnFocus
              />
              <Text style={styles.inputLabel}>horas</Text>
            </View>

            {/* Chips de Atalho */}
            <Text style={styles.chipsLabel}>Atalhos rápidos:</Text>
            <View style={styles.chipsContainer}>
              <TouchableOpacity
                style={styles.chip}
                onPress={() => handleChipPress(15)}
              >
                <Text style={styles.chipText}>+15m</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.chip}
                onPress={() => handleChipPress(30)}
              >
                <Text style={styles.chipText}>+30m</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.chip}
                onPress={() => handleChipPress(60)}
              >
                <Text style={styles.chipText}>+1h</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.chip}
                onPress={() => handleChipPress(120)}
              >
                <Text style={styles.chipText}>+2h</Text>
              </TouchableOpacity>
            </View>

            {/* Botão de Confirmação */}
            <TouchableOpacity
              style={[
                styles.confirmButton,
                parseFloat(hours) <= 0 && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={parseFloat(hours) <= 0}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={20} color={colors.white} />
              <Text style={styles.confirmButtonText}>Confirmar Sessão</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingTop: 12,
    position: 'relative',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    padding: 4,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    alignItems: 'center',
  },
  title: {
    ...typography.header,
    color: colors.primary,
    fontSize: 22,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.secondary,
    marginBottom: 32,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 24,
  },
  input: {
    ...typography.header,
    color: colors.primary,
    fontSize: 56,
    fontWeight: '700',
    minWidth: 120,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
    paddingVertical: 8,
  },
  inputLabel: {
    ...typography.body,
    color: colors.secondary,
    fontSize: 18,
    marginLeft: 8,
  },
  chipsLabel: {
    ...typography.caption,
    color: colors.secondary,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  chipsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  chip: {
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    gap: 8,
  },
  confirmButtonDisabled: {
    backgroundColor: colors.border,
    opacity: 0.5,
  },
  confirmButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
});
