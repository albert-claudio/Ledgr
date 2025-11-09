import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, Image, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { useComments } from '@/hooks/useComments';

type Props = { igdbId?: number };

export const Comments: React.FC<Props> = ({ igdbId }) => {
  const [text, setText] = useState('');
  const cmts = useComments(igdbId);
  const router = useRouter();

  const submit = async () => {
    const v = text.trim();
    if (!v) return;
    try {
      await cmts.add(v);
      setText('');
    } catch {}
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Comentários</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Escreva um comentário"
          placeholderTextColor={colors.secondary}
          value={text}
          onChangeText={setText}
          multiline
        />
        <Pressable style={styles.sendBtn} onPress={submit} disabled={cmts.isAdding || !text.trim()}>
          <Text style={styles.sendText}>Enviar</Text>
        </Pressable>
      </View>

      <FlatList
        data={cmts.data || []}
        keyExtractor={(item) => String(item.id)}
        scrollEnabled={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Image source={{ uri: item.profile?.avatar_url || undefined }} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Pressable onPress={() => router.push(`/u/${item.profile_id}`)} hitSlop={8}>
                <Text style={styles.username}>@{item.profile?.username || item.profile_id.slice(0,6)}</Text>
              </Pressable>
              <Text style={styles.text}>{item.text}</Text>
              <View style={styles.metaRow}>
                <Pressable onPress={() => cmts.toggleLike(item)} hitSlop={10}>
                  <Text style={[styles.like, item.liked_by_me && { color: '#F87171' }]}>
                    ♥ {item.likes_count}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={() => (
          <Text style={styles.empty}>Seja o primeiro a comentar</Text>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 16 },
  title: { ...typography.title, color: colors.primary, marginBottom: 8 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 12 },
  input: { flex: 1, backgroundColor: colors.card, color: colors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, minHeight: 42 },
  sendBtn: { backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignSelf: 'flex-end' },
  sendText: { color: '#000', fontWeight: '600' },
  item: { flexDirection: 'row', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card },
  username: { ...typography.caption, color: colors.secondary, marginBottom: 4 },
  text: { ...typography.body, color: colors.primary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  like: { ...typography.caption, color: colors.secondary },
  empty: { ...typography.caption, color: colors.secondary, marginTop: 8 },
});

export default Comments;
