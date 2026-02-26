import React, { memo } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet,
  ListRenderItem
} from 'react-native';
import { colors } from '../../components/theme/colors';
import { typography } from '../../components/theme/typography';
import { Game } from '../../services/igdb';
import { GameCard } from './GameCard';
import { SkeletonCard } from '../common/SkeletonCard';
import { ErrorState } from '../common/ErrorState';

interface GameSectionProps {
  title: string;
  data?: Game[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onGamePress?: (game: Game) => void;
}

export const GameSection: React.FC<GameSectionProps> = memo(({ 
  title, 
  data, 
  isLoading = false,
  isError = false,
  onRetry,
  onGamePress
}) => {
  const renderItem: ListRenderItem<Game> = ({ item }) => (
    <GameCard game={item} onPress={() => onGamePress?.(item)} />
  );

  const renderSkeleton = () => (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={[1, 2, 3, 4]}
      keyExtractor={(item) => `skeleton-${item}`}
      renderItem={() => <SkeletonCard />}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>Nenhum jogo encontrado</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      
      {isLoading ? (
        renderSkeleton()
      ) : isError ? (
        <View style={styles.errorContainer}>
          <ErrorState 
            message="Não foi possível carregar os jogos" 
            onRetry={onRetry}
            compact
          />
        </View>
      ) : data && data.length > 0 ? (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={data}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      ) : (
        renderEmptyState()
      )}
    </View>
  );
});

GameSection.displayName = 'GameSection';

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 12,
  },
  title: {
    ...typography.title,
    color: colors.primary,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  separator: {
    width: 12,
  },
  errorContainer: {
    height: 150,
    marginHorizontal: 16,
  },
  emptyState: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.secondary,
  },
});
