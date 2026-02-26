import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

export function EmptyTimeline() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="game-controller-outline" size={64} color={colors.secondary} />
      </View>
      
      <Text style={styles.title}>Nenhuma atividade ainda</Text>
      
      <Text style={styles.description}>
        Comece marcando um jogo como "Jogando" ou escreva uma entrada no diário para criar sua linha do tempo.
      </Text>
      
      <TouchableOpacity 
        style={styles.button}
        onPress={() => router.push('/(tabs)/search')}
        activeOpacity={0.8}
      >
        <Ionicons name="search" size={20} color={colors.white} />
        <Text style={styles.buttonText}>Adicionar seu primeiro jogo</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  title: {
    ...typography.header,
    color: colors.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    ...typography.body,
    color: colors.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  button: {
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  buttonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
  },
});
