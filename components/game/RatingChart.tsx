import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../components/theme/colors';
import { typography } from '../../components/theme/typography';

interface RatingChartProps {
  rating: number;
  ratingsCount: number;
  distribution: number[];
}

export const RatingChart: React.FC<RatingChartProps> = ({
  rating,
  ratingsCount,
  distribution,
}) => {
  const getRatingColor = (value: number): string => {
    if (value >= 4) return '#FCD34D'; // Amarelo para boas notas
    if (value >= 3) return colors.accent; // Azul para médias
    return colors.secondary; // Cinza para baixas
  };

  const getStarCount = (rating: number): number => {
    return Math.round(rating);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rating</Text>
      
      <View style={styles.content}>
        {/* Barras de distribuição */}
        <View style={styles.barsContainer}>
          <View style={styles.bars}>
            {distribution.map((height, index) => (
              <View key={index} style={styles.barWrapper}>
                <View 
                  style={[
                    styles.bar,
                    { 
                      height: `${Math.max(height, 10)}%`,
                      backgroundColor: index >= 15 ? '#FCD34D' : 
                                     index >= 10 ? colors.accent : 
                                     colors.border
                    }
                  ]} 
                />
              </View>
            ))}
          </View>
          
          {/* Linha base */}
          <View style={styles.baseLine} />
        </View>

        {/* Rating Score */}
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreValue}>{rating.toFixed(1)}</Text>
          
          {/* Stars */}
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Text 
                key={star} 
                style={[
                  styles.star,
                  { color: star <= getStarCount(rating) ? '#FCD34D' : colors.border }
                ]}
              >
                ★
              </Text>
            ))}
          </View>
          
          <Text style={styles.votesText}>{ratingsCount.toLocaleString()} avaliações</Text>
        </View>
      </View>

      {/* Porcentagem de aprovação */}
      <View style={styles.approvalContainer}>
        <View style={styles.approvalBar}>
          <View 
            style={[
              styles.approvalFill, 
              { 
                width: `${(rating / 5) * 100}%`,
                backgroundColor: getRatingColor(rating)
              }
            ]} 
          />
        </View>
        <Text style={styles.approvalText}>
          {Math.round((rating / 5) * 100)}% de aprovação
        </Text>
      </View>
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
    fontSize: 20,
    marginBottom: 16,
  },
  content: {
    flexDirection: 'row',
    gap: 24,
  },
  barsContainer: {
    flex: 1,
    height: 100,
    position: 'relative',
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: '100%',
    gap: 2,
  },
  barWrapper: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 2,
    minHeight: 4,
  },
  baseLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border,
  },
  scoreContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    ...typography.title,
    color: colors.primary,
    fontSize: 36,
    fontWeight: 'bold',
  },
  starsContainer: {
    flexDirection: 'row',
    marginTop: 4,
  },
  star: {
    fontSize: 16,
    marginHorizontal: 1,
  },
  votesText: {
    ...typography.caption,
    color: colors.secondary,
    fontSize: 11,
    marginTop: 4,
  },
  approvalContainer: {
    marginTop: 16,
  },
  approvalBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  approvalFill: {
    height: '100%',
    borderRadius: 3,
  },
  approvalText: {
    ...typography.caption,
    color: colors.secondary,
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
});