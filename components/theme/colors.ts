export const colors = {
  background: '#0E0E0E',
  primary: '#F5F5F5',
  secondary: '#9CA3AF',
  accent: '#22D3EE',
  card: '#1A1A1A',
  button: '#1F2937',
  error: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.5)',
  border: '#2A2A2A',
  inactive: '#6B7280',
  tabBarInactive: '#9CA3AF',
  transparent: 'transparent',
} as const;

export type Colors = typeof colors;