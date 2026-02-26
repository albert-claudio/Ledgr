import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

interface SteamConnectBannerProps {
  onDismiss?: () => void;
}

export function SteamConnectBanner({ onDismiss }: SteamConnectBannerProps) {
  const router = useRouter();

  const handleConnect = () => {
    // TODO: Navigate to Steam connection flow
    router.push('/settings');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="logo-steam" size={40} color={colors.accent} />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.title}>Automatize seu diário</Text>
          <Text style={styles.description}>
            Conecte sua Steam para sincronizar jogos e progresso automaticamente.
          </Text>
        </View>
      </View>
      
      <View style={styles.actions}>
        <TouchableOpacity 
          style={styles.connectButton}
          onPress={handleConnect}
          activeOpacity={0.8}
        >
          <Ionicons name="link" size={18} color={colors.white} />
          <Text style={styles.connectButtonText}>Conectar Steam</Text>
        </TouchableOpacity>
        
        {onDismiss && (
          <TouchableOpacity 
            style={styles.dismissButton}
            onPress={onDismiss}
            activeOpacity={0.7}
          >
            <Text style={styles.dismissButtonText}>Talvez depois</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  content: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    ...typography.title,
    color: colors.primary,
    marginBottom: 6,
  },
  description: {
    ...typography.body,
    color: colors.secondary,
    lineHeight: 20,
  },
  actions: {
    gap: 10,
  },
  connectButton: {
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  connectButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
  },
  dismissButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  dismissButtonText: {
    ...typography.caption,
    color: colors.secondary,
  },
});
