import { colors } from '@/components/theme/colors';
import { typography } from '@/components/theme/typography';
import { getMoodIcon, getMoodLabel, type MoodType } from '@/services/sessionDiary';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface MoodSliderProps {
  value?: MoodType | null;
  onChange: (mood: MoodType) => void;
}

const MOODS: MoodType[] = ['happy', 'relaxed', 'excited', 'tilted', 'bored'];

export function MoodSlider({ value, onChange }: MoodSliderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Como você estava se sentindo?</Text>
      
      <View style={styles.moodGrid}>
        {MOODS.map((mood) => {
          const isSelected = value === mood;
          return (
            <Pressable
              key={mood}
              onPress={() => onChange(mood)}
              style={[
                styles.moodCard,
                isSelected && styles.moodCardSelected,
              ]}
            >
              <Text style={styles.moodEmoji}>{getMoodIcon(mood)}</Text>
              <Text
                style={[
                  styles.moodLabel,
                  isSelected && styles.moodLabelSelected,
                ]}
              >
                {getMoodLabel(mood)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: 12,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  moodCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  moodCardSelected: {
    backgroundColor: colors.accent + '20',
    borderColor: colors.accent,
  },
  moodEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  moodLabel: {
    ...typography.caption,
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  moodLabelSelected: {
    color: colors.accent,
    fontWeight: '700',
  },
});
