import { colors } from '@/components/theme/colors';
import { typography } from '@/components/theme/typography';
import { useProfileHeader } from '@/hooks/useProfile';
import { useAuth } from '@/providers/AuthProvider';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export const Desafio2025 = () => {
  const { user } = useAuth();
  const header = useProfileHeader(user?.id);

  if (!user?.id) return null;

  const currentYear = new Date().getFullYear();
  const completed = header.data?.counters?.completed_count ?? 0;
  const goal = 25;

  return (
    <View style={styles.challengeCard}>
      <Text style={styles.challengeTitle}>Seu Desafio de {currentYear}</Text>
      <View style={styles.challengeTopRow}>
        <Text style={styles.challengeNumbers}>
          {completed} / {goal} <Text style={styles.challengeNumbersSuffix}>jogos concluídos</Text>
        </Text>
        <Text style={styles.challengeMetaHint}>Meta anual definida por você</Text>
      </View>
      <ProgressBar value={completed} goal={goal} />
      <ChallengeHint value={completed} goal={goal} />
    </View>
  );
};

// Helper Components

function ProgressBar({ value, goal }: { value: number; goal: number }) {
  const [width, setWidth] = React.useState(0);
  const pct = goal > 0 ? value / goal : 0;
  const fill = Math.min(1, pct) * width;
  const overflow = Math.max(0, pct - 1) * width;
  
  return (
    <View style={{ marginBottom: 8 }}>
      <View
        style={{
          height: 14,
          borderRadius: 8,
          backgroundColor: colors.border,
          position: 'relative',
        }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        <View style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: fill,
          backgroundColor: colors.accent,
          borderRadius: 8,
        }} />
        {overflow > 0 && (
          <View style={{
            position: 'absolute',
            left: width,
            top: 0,
            bottom: 0,
            width: overflow,
            backgroundColor: colors.accent,
            opacity: 0.5,
            borderTopRightRadius: 8,
            borderBottomRightRadius: 8,
          }} />
        )}
      </View>
    </View>
  );
}

function ChallengeHint({ value, goal }: { value: number; goal: number }) {
  const remaining = Math.max(0, goal - value);
  
  if (goal > 0 && value >= goal) {
    return <Text style={styles.hintText}>Meta concluída. Mandou bem.</Text>;
  }
  if (goal > 0 && value >= Math.max(goal - 3, Math.floor(goal * 0.88))) {
    return <Text style={styles.hintText}>Você está quase lá. Continua.</Text>;
  }
  if (value <= Math.max(2, Math.floor(goal * 0.1))) {
    return <Text style={styles.hintText}>Primeiros passos, bora continuar.</Text>;
  }
  
  return null;
}

const styles = StyleSheet.create({
  challengeCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.button,
    shadowColor: colors.black,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  challengeTitle: {
    ...typography.header,
    color: colors.accent,
    marginBottom: 8,
  },
  challengeTopRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  challengeNumbers: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.accent,
  },
  challengeNumbersSuffix: {
    ...typography.body,
    color: colors.secondary,
  },
  challengeMetaHint: {
    ...typography.caption,
    color: colors.secondary,
  },
  hintText: {
    ...typography.body,
    color: colors.accent,
    marginTop: 6,
  },
});
