import { colors } from '@/components/theme/colors';
import { typography } from '@/components/theme/typography';
import { getMarkerIcon, getMarkerLabel, type MarkerType } from '@/services/sessionDiary';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface MarkerChipsProps {
  value?: MarkerType[] | null;
  onChange: (markers: MarkerType[]) => void;
}

const MARKERS: MarkerType[] = [
  'boss_killed',
  'new_weapon',
  'new_character',
  'moral_choice',
  'build',
  'coop',
  'pvp',
  'mission_stuck',
];

export function MarkerChips({ value = [], onChange }: MarkerChipsProps) {
  const selectedMarkers = value || [];

  const toggleMarker = (marker: MarkerType) => {
    if (selectedMarkers.includes(marker)) {
      // Remove
      onChange(selectedMarkers.filter((m) => m !== marker));
    } else {
      // Add
      onChange([...selectedMarkers, marker]);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Marcadores (opcional)</Text>
      <Text style={styles.hint}>Selecione eventos importantes desta sessão</Text>
      
      <View style={styles.chipGrid}>
        {MARKERS.map((marker) => {
          const isSelected = selectedMarkers.includes(marker);
          return (
            <Pressable
              key={marker}
              onPress={() => toggleMarker(marker)}
              style={[
                styles.chip,
                isSelected && styles.chipSelected,
              ]}
            >
              <Text style={styles.chipIcon}>{getMarkerIcon(marker)}</Text>
              <Text
                style={[
                  styles.chipText,
                  isSelected && styles.chipTextSelected,
                ]}
              >
                {getMarkerLabel(marker)}
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
    marginBottom: 4,
  },
  hint: {
    ...typography.caption,
    color: colors.secondary,
    fontSize: 12,
    marginBottom: 12,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.accent + '20',
    borderColor: colors.accent,
  },
  chipIcon: {
    fontSize: 14,
  },
  chipText: {
    ...typography.caption,
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: colors.accent,
    fontWeight: '700',
  },
});
