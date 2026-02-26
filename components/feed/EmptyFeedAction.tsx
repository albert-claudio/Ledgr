import { useCurrentlyGaming } from '@/hooks/useProfile';
import { useAuth } from '@/providers/AuthProvider';
import { igdbCoverUrl } from '@/services/profile';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export const EmptyFeedAction = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { data: playingGames } = useCurrentlyGaming(user?.id);

  const activeGame = playingGames?.[0];

  if (!activeGame) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Nada novo por aqui...</Text>
        <Text style={styles.subtext}>Que tal adicionar alguns jogos à sua lista?</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.push('/catalog')}>
          <Text style={styles.buttonText}>Explorar Catálogo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const coverUrl = igdbCoverUrl(activeGame.game.cover_image_id);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Que tal registrar seu progresso?</Text>
        <Text style={styles.subtitle}>
          Você está jogando <Text style={styles.gameName}>{activeGame.game.name}</Text>
        </Text>
      </View>

      {coverUrl && (
        <Image
          source={{ uri: coverUrl }}
          style={styles.cover}
          contentFit="cover"
        />
      )}

      <View style={styles.actions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push(`/game/${activeGame.game.igdb_id}`)}
        >
          <Ionicons name="journal-outline" size={20} color="#FFF" />
          <Text style={styles.actionText}>Escrever Diário</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={() => router.push(`/game/${activeGame.game.igdb_id}`)}
        >
          <Ionicons name="star-outline" size={20} color="#AAA" />
          <Text style={[styles.actionText, styles.secondaryText]}>Avaliar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 32,
  },
  text: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 14,
    color: '#444',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    margin: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#AAA',
  },
  gameName: {
    color: '#007AFF',
    fontWeight: '600',
  },
  cover: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 16,
    opacity: 0.8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#444',
  },
  actionText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  secondaryText: {
    color: '#AAA',
  },
});
