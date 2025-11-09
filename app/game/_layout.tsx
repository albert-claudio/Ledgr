import { Stack } from 'expo-router';
import { colors } from '../../components/theme/colors';

export default function GameLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.background,
        },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen 
        name="[id]" 
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}