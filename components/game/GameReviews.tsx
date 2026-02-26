import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../components/theme/colors';
import { typography } from '../../components/theme/typography';
import { SteamReview } from '../../services/steam';

interface GameReviewsProps {
  reviews: SteamReview[];
}

const formatDate = (ts: number) => {
  try {
    const d = new Date(ts * 1000);
    return d.toLocaleDateString('pt-BR');
  } catch {
    return '';
  }
};

export const GameReviews: React.FC<GameReviewsProps> = ({ reviews }) => {
  if (!reviews || reviews.length === 0) return null;
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Comentários da Comunidade (Steam)</Text>
      {reviews.slice(0, 6).map((r) => (
        <View key={r.recommendationid} style={styles.item}>
          <View style={styles.header}>
            <Text style={styles.author}>Usuário Steam</Text>
            <Text style={[styles.badge, r.voted_up ? styles.pos : styles.neg]}>
              {r.voted_up ? 'Recomendado' : 'Não recomendado'}
            </Text>
          </View>
          <Text style={styles.text} numberOfLines={4}>
            {r.review}
          </Text>
          <View style={styles.footer}>
            <Text style={styles.meta}>{formatDate(r.timestamp_created)}</Text>
            <Text style={styles.meta}>{r.votes_up} úteis</Text>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  title: {
    ...typography.title,
    color: colors.primary,
    fontSize: 18,
    marginBottom: 12,
  },
  item: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  author: {
    ...typography.caption,
    color: colors.secondary,
  },
  badge: {
    ...typography.caption,
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pos: { backgroundColor: 'rgba(16,185,129,0.2)', color: '#10B981' },
  neg: { backgroundColor: 'rgba(239,68,68,0.2)', color: '#EF4444' },
  text: {
    ...typography.body,
    color: colors.primary,
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  meta: {
    ...typography.caption,
    color: colors.secondary,
    fontSize: 11,
  },
});

