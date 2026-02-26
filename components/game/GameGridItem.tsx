import React from 'react';
import { View, Image, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../../components/theme/colors';

type Props = {
  name: string;
  image: string | null | undefined;
  onPress?: () => void;
};

export const GameGridItem: React.FC<Props> = ({ name, image, onPress }) => {
  return (
    <Pressable onPress={onPress} style={styles.container}>
      {image ? (
        <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.placeholder]} />
      )}
      <Text numberOfLines={2} style={styles.title}>{name}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '48%',
    marginBottom: 12,
  },
  image: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 8,
    backgroundColor: colors.card,
  },
  placeholder: {
    backgroundColor: colors.card,
  },
  title: {
    color: colors.primary,
    fontSize: 12,
    marginTop: 6,
  },
});

