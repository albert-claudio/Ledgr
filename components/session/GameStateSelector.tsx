import { colors } from '@/components/theme/colors';
import { typography } from '@/components/theme/typography';
import { getGameStateIcon, getGameStateLabel, type GameState } from '@/services/sessionDiary';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface GameStateSelectorProps {
  value?: GameState | null;
  onChange: (state: GameState) => void;
}

const GAME_STATES: GameState[] = [
  'playing',
  'paused',
  'dropped',
  'completed',
  'ng_plus',
  'platinum',
];

export function GameStateSelector({ value, onChange }: GameStateSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Status do jogo</Text>
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stateList}
      >
        {GAME_STATES.map((state) => {
          const isSelected = value === state;
          return (
            <Pressable
              key={state}
              onPress={() => onChange(state)}
              style={[
                styles.stateChip,
                isSelected && styles.stateChipSelected,
              ]}
            >
              <Text style={styles.stateIcon}>{getGameStateIcon(state)}</Text>
              <Text
                style={[
                  styles.stateText,
                  isSelected && styles.stateTextSelected,
                ]}
              >
                {getGameStateLabel(state)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
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
  stateList: {
    gap: 8,
    paddingRight: 16,
  },
  stateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  stateChipSelected: {
    backgroundColor: colors.accent + '20',
    borderColor: colors.accent,
  },
  stateIcon: {
    fontSize: 16,
  },
  stateText: {
    ...typography.caption,
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  stateTextSelected: {
    color: colors.accent,
    fontWeight: '700',
  },
});
