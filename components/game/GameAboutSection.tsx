import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../components/theme/colors';
import { typography } from '../../components/theme/typography';

interface GameAboutSectionProps {
  description: string;
}

export const GameAboutSection: React.FC<GameAboutSectionProps> = ({ description }) => {
  const [expanded, setExpanded] = useState(false);
  const maxLength = 200;
  const shouldTruncate = description.length > maxLength;

  const displayText = expanded || !shouldTruncate 
    ? description 
    : description.substring(0, maxLength) + '...';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>About this Game</Text>
      <Text style={styles.description}>
        {displayText}
      </Text>
      {shouldTruncate && (
        <TouchableOpacity onPress={() => setExpanded(!expanded)}>
          <Text style={styles.readMore}>
            {expanded ? 'Ver menos' : 'Ver mais'}
          </Text>
        </TouchableOpacity>
      )}
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
    marginBottom: 12,
  },
  description: {
    ...typography.body,
    color: colors.secondary,
    fontSize: 14,
    lineHeight: 22,
  },
  readMore: {
    ...typography.button,
    color: colors.accent,
    fontSize: 14,
    marginTop: 8,
  },
});