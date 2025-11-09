import React from 'react';
import { 
  View, 
  Image, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet,
  Dimensions
} from 'react-native';
import { colors } from '../../components/theme/colors';
import { Screenshot } from '../../types/game';

interface GameScreenshotsProps {
  screenshots: Screenshot[];
  onScreenshotPress?: (screenshot: Screenshot) => void;
}

const { width: screenWidth } = Dimensions.get('window');
const SCREENSHOT_WIDTH = screenWidth * 0.7;
const SCREENSHOT_HEIGHT = SCREENSHOT_WIDTH * 0.56; // 16:9 aspect ratio

export const GameScreenshots: React.FC<GameScreenshotsProps> = ({ 
  screenshots, 
  onScreenshotPress 
}) => {
  if (!screenshots || screenshots.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {screenshots.slice(0, 6).map((screenshot) => (
          <TouchableOpacity
            key={screenshot.id}
            onPress={() => onScreenshotPress?.(screenshot)}
            activeOpacity={0.9}
          >
            <View style={styles.screenshotContainer}>
              <Image
                source={{ uri: screenshot.image }}
                style={styles.screenshot}
                resizeMode="cover"
              />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
    marginBottom: 100, // Espaço para a tab bar
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  screenshotContainer: {
    width: SCREENSHOT_WIDTH,
    height: SCREENSHOT_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.card,
    marginRight: 12,
  },
  screenshot: {
    width: '100%',
    height: '100%',
  },
});