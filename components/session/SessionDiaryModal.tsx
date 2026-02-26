import { colors } from '@/components/theme/colors';
import { typography } from '@/components/theme/typography';
import { useSessionDiaryMutation, useSessionMediaMutation, useSessionNoteByEvent } from '@/hooks/useSessionDiary';
import type { GameState, MarkerType, MoodType, SessionNoteInput } from '@/services/sessionDiary';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GameStateSelector } from './GameStateSelector';
import { MarkerChips } from './MarkerChips';
import { MoodSlider } from './MoodSlider';

interface SessionDiaryModalProps {
  visible: boolean;
  onClose: () => void;
  eventId?: number | null;
  gameId: number;
  gameName: string;
  onSaved?: () => void;
}

export function SessionDiaryModal({
  visible,
  onClose,
  eventId,
  gameId,
  gameName,
  onSaved,
}: SessionDiaryModalProps) {
  // Busca nota existente se tiver eventId
  const existingNote = useSessionNoteByEvent(eventId || null);
  
  // Form state
  const [progressText, setProgressText] = useState('');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [mood, setMood] = useState<MoodType | null>(null);
  const [markers, setMarkers] = useState<MarkerType[]>([]);
  const [noteText, setNoteText] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  
  // Mutations
  const diaryMutation = useSessionDiaryMutation();
  const mediaMutation = useSessionMediaMutation();

  // Carrega dados existentes quando encontra nota
  useEffect(() => {
    if (existingNote.data) {
      setProgressText(existingNote.data.progress_text || '');
      setGameState(existingNote.data.game_state || null);
      setMood(existingNote.data.mood || null);
      setMarkers(existingNote.data.markers || []);
      setNoteText(existingNote.data.note_text || '');
      setMediaUrls(existingNote.data.media_urls || []);
    }
  }, [existingNote.data]);

  // Reset form quando fecha
  useEffect(() => {
    if (!visible) {
      setProgressText('');
      setGameState(null);
      setMood(null);
      setMarkers([]);
      setNoteText('');
      setMediaUrls([]);
    }
  }, [visible]);

  const handleSave = async () => {
    // Validação: gameId deve ser um ID válido
    if (!gameId || gameId <= 0) {
      Alert.alert('Erro', 'Jogo não encontrado. Tente recarregar a página.');
      return;
    }
    
    try {
      const input: SessionNoteInput = {
        event_id: eventId || null,
        game_id: gameId,
        progress_text: progressText.trim() || undefined,
        game_state: gameState || undefined,
        mood: mood || undefined,
        markers: markers.length > 0 ? markers : undefined,
        note_text: noteText.trim() || undefined,
        media_urls: mediaUrls.length > 0 ? mediaUrls : undefined,
      };

      if (existingNote.data) {
        // Update
        await diaryMutation.update.mutateAsync({
          id: existingNote.data.id,
          updates: input,
        });
      } else {
        // Create
        await diaryMutation.create.mutateAsync(input);
      }

      onSaved?.();
      onClose();
    } catch (error) {
      console.error('[SessionDiaryModal] Save error:', error);
      Alert.alert('Erro', 'Não foi possível salvar o diário.');
    }
  };

  const handlePickImage = async () => {
    try {
      const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permResult.granted) {
        Alert.alert('Permissão necessária', 'Precisamos de acesso às suas fotos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await handleUploadMedia(result.assets[0].uri);
      }
    } catch (error) {
      console.error('[SessionDiaryModal] Pick image error:', error);
      Alert.alert('Erro', 'Não foi possível selecionar a imagem.');
    }
  };

  const handleUploadMedia = async (uri: string) => {
    try {
      // 1. Comprimir imagem para reduzir tamanho
      const compressedImage = await ImageManipulator.manipulateAsync(
        uri,
        [
          { resize: { width: 1200 } }, // Redimensiona para max 1200px de largura
        ],
        {
          compress: 0.7, // 70% de qualidade (reduz ~80% do tamanho)
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      // 2. Upload da imagem comprimida
      const sessionId = existingNote.data?.id || Date.now();
      const url = await mediaMutation.upload.mutateAsync({ 
        file: compressedImage.uri, 
        sessionId 
      });

      // 3. Adiciona URL à lista
      setMediaUrls((prev) => [...prev, url]);
    } catch (error) {
      console.error('[SessionDiaryModal] Upload error:', error);
      Alert.alert('Erro', 'Não foi possível fazer upload da imagem.');
    }
  };

  const handleRemoveMedia = (url: string) => {
    Alert.alert(
      'Remover imagem',
      'Deseja remover esta imagem do diário?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => {
            setMediaUrls((prev) => prev.filter((u) => u !== url));
          },
        },
      ]
    );
  };

  const isLoading = diaryMutation.isLoading || mediaMutation.isLoading;
  const hasContent =
    progressText.trim() ||
    gameState ||
    mood ||
    markers.length > 0 ||
    noteText.trim() ||
    mediaUrls.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.primary} />
            </Pressable>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.headerTitle}>Diário de Sessão</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {gameName}
              </Text>
            </View>
            <Pressable
              onPress={handleSave}
              disabled={isLoading || !hasContent}
              style={[
                styles.saveButton,
                (!hasContent || isLoading) && styles.saveButtonDisabled,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.black} />
              ) : (
                <Text style={styles.saveButtonText}>Salvar</Text>
              )}
            </Pressable>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
          >
            {/* Progress Input */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Progresso (opcional)</Text>
              <TextInput
                style={styles.textInput}
                value={progressText}
                onChangeText={setProgressText}
                placeholder='Ex: "Capítulo 3", "Level 18", "Main story 45%"'
                placeholderTextColor={colors.secondary}
                maxLength={100}
              />
            </View>

            {/* Game State */}
            <View style={styles.section}>
              <GameStateSelector value={gameState} onChange={setGameState} />
            </View>

            {/* Mood */}
            <View style={styles.section}>
              <MoodSlider value={mood} onChange={setMood} />
            </View>

            {/* Markers */}
            <View style={styles.section}>
              <MarkerChips value={markers} onChange={setMarkers} />
            </View>

            {/* Note Text */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Anotações (opcional)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Escreva sobre esta sessão..."
                placeholderTextColor={colors.secondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
              />
            </View>

            {/* Media Upload */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Screenshots (opcional)</Text>
              {mediaUrls.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.mediaList}
                >
                  {mediaUrls.map((url, idx) => (
                    <View key={idx} style={styles.mediaItem}>
                      <Image source={{ uri: url }} style={styles.mediaImage} />
                      <Pressable
                        onPress={() => handleRemoveMedia(url)}
                        style={styles.mediaRemoveButton}
                      >
                        <Ionicons name="close-circle" size={24} color={colors.error} />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              )}
              {mediaUrls.length < 5 && (
                <Pressable onPress={handlePickImage} style={styles.addMediaButton}>
                  <Ionicons name="images-outline" size={20} color={colors.accent} />
                  <Text style={styles.addMediaText}>Adicionar imagem</Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.title,
    color: colors.primary,
    fontSize: 18,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.secondary,
    fontSize: 13,
    marginTop: 2,
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 70,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    ...typography.body,
    color: colors.black,
    fontWeight: '700',
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    ...typography.body,
    color: colors.primary,
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 100,
  },
  mediaList: {
    marginBottom: 12,
  },
  mediaItem: {
    marginRight: 12,
    position: 'relative',
  },
  mediaImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
  },
  mediaRemoveButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.background,
    borderRadius: 12,
  },
  addMediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    borderWidth: 2,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    gap: 8,
  },
  addMediaText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '600',
  },
});
