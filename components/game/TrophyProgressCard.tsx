import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

interface TrophyProgressCardProps {
  userTrophies: number;
  totalTrophies: number;
  source?: 'steam' | 'manual';
}

export function TrophyProgressCard({ 
  userTrophies, 
  totalTrophies,
  source = 'manual'
}: TrophyProgressCardProps) {
  // Se não houver troféus totais, não renderiza nada
  if (!totalTrophies || totalTrophies === 0) return null;
  
  // Calcula a porcentagem (entre 0 e 100)
  const percentage = Math.min(100, Math.max(0, (userTrophies / totalTrophies) * 100));
  
  // Calcula quantos troféus faltam
  const remaining = Math.max(0, totalTrophies - userTrophies);
  
  // Verifica se platinou (pegou todos os troféus)
  const isPlatinum = remaining === 0 && totalTrophies > 0;
  
  return (
    <View style={styles.trophyContainer}>
      {/* Cabeçalho com título e contagem */}
      <View style={styles.trophyHeader}>
        <View style={styles.trophyTitleContainer}>
          <Text style={styles.trophyTitle}>Progresso de Troféus</Text>
          {source === 'steam' && (
            <Text style={styles.steamBadge}>Steam</Text>
          )}
        </View>
        <Text style={styles.trophyCount}>
          {userTrophies} <Text style={{ color: colors.secondary }}>/ {totalTrophies}</Text>
        </Text>
      </View>
      
      {/* Barra de Progresso */}
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${percentage}%` }]} />
      </View>
      
      {/* Rodapé com status e porcentagem */}
      <View style={styles.trophyFooter}>
        {isPlatinum ? (
          <Text style={[styles.trophyStatus, { color: '#FCD34D' }]}>
            🏆 Jogo Platinado! Parabéns!
          </Text>
        ) : (
          <Text style={styles.trophyStatus}>
            Faltam <Text style={{ fontWeight: 'bold', color: colors.white }}>{remaining}</Text> para platinar
          </Text>
        )}
        <Text style={styles.percentageText}>{percentage.toFixed(0)}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  trophyContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  trophyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  trophyTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trophyTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  steamBadge: {
    backgroundColor: 'rgba(103, 193, 245, 0.2)',
    color: '#67C1F5',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  trophyCount: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  trophyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trophyStatus: {
    color: colors.secondary,
    fontSize: 12,
  },
  percentageText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: 'bold',
  },
});