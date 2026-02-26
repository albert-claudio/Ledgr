export { colors } from './colors';
export { typography } from './typography';
export { tabBarStyles, tabBarScreenOptions } from './tabBarStyles';

import { colors } from './colors';
import { typography } from './typography';
import { tabBarStyles } from './tabBarStyles';

export const theme = {
  colors,
  typography,
  tabBar: tabBarStyles,
} as const;

export default theme;