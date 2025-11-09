import React, { useCallback, useState } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  RefreshControl,
  SafeAreaView
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../../components/common/Button';
import { GameSection } from '../../components/game/GameSection';
import { HomeHeader } from '../../components/Home/HomeHeader';
import { colors } from '../../components/theme/colors';
import { SideMenu } from '../../components/common/SideMenu';
import { usePopularThisMonth } from '../../hooks/usePopularThisMonth';
import { useNewAndPopular } from '../../hooks/useNewAndPopular';
import { Game } from '../../services/igdb';
import { useAuth } from '@/providers/AuthProvider';

export default function HomeScreen() {
  const router = useRouter();
  const { signOut } = useAuth();

  const popularQuery = usePopularThisMonth(20);
  const newQuery = useNewAndPopular();
  const [menuOpen, setMenuOpen] = useState(false);

  const isRefreshing = popularQuery.isRefetching || newQuery.isRefetching;

  const handleRefresh = useCallback(() => {
    popularQuery.refetch();
    newQuery.refetch();
  }, [popularQuery, newQuery]);

  const handleCatalogPress = () => {
    router.push('/catalog');
  };

  const handleGamePress = (game: Game) => {
    router.push(`/game/${game.id}`);
  };

  const handleMenuPress = () => setMenuOpen(true);

  return (
    <SafeAreaView style={styles.container}>
      <HomeHeader onMenuPress={handleMenuPress} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        <GameSection
          title="Populares"
          data={popularQuery.data}
          isLoading={popularQuery.isLoading}
          isError={popularQuery.isError}
          onRetry={() => popularQuery.refetch()}
          onGamePress={handleGamePress}
        />

        <GameSection
          title="Novos"
          data={newQuery.data}
          isLoading={newQuery.isLoading}
          isError={newQuery.isError}
          onRetry={() => newQuery.refetch()}
          onGamePress={handleGamePress}
        />

        <View style={styles.buttonContainer}>
          <Button
            title="Descubra o catalogo"
            onPress={handleCatalogPress}
            icon="chevron-forward"
            style={styles.catalogButton}
          />
        </View>
      </ScrollView>

      <SideMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Menu"
        items={[
          { label: 'Sobre nos' },
          { label: 'Leis e Termos' },
          { label: 'Configuracoes' },
          { label: 'Sair', onPress: () => signOut() },
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  buttonContainer: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  catalogButton: {
    width: '100%',
  },
});

