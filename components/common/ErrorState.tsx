import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../components/theme/colors';
import { typography } from '../../components/theme/typography';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ 
  message = 'Ops! Algo deu errado', 
  onRetry,
  compact = false
}) => {
  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      <Ionicons 
        name="alert-circle-outline" 
        size={compact ? 32 : 48} 
        color={colors.error} 
      />
      <Text style={[styles.message, compact && styles.compactMessage]}>
        {message}
      </Text>
      {onRetry && (
        <TouchableOpacity 
          style={[styles.button, compact && styles.compactButton]} 
          onPress={onRetry}
        >
          <Text style={styles.buttonText}>Tentar novamente</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  compactContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  message: {
    ...typography.body,
    color: colors.secondary,
    marginTop: 12,
    textAlign: 'center',
  },
  compactMessage: {
    marginTop: 8,
    fontSize: 12,
  },
  button: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.button,
    borderRadius: 8,
  },
  compactButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  buttonText: {
    ...typography.button,
    color: colors.white,
    fontSize: 14,
  },
});