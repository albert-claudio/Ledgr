import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Image, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '@/components/theme/colors';
import { typography } from '@/components/theme/typography';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { uploadAvatarFromUri } from '@/services/profile';
import * as Haptics from 'expo-haptics';

export default function AvatarPreviewScreen() {
  const { uri } = useLocalSearchParams<{ uri?: string }>();
  const decodedUri = uri ? decodeURIComponent(uri) : undefined;
  const router = useRouter();
  const { user } = useAuth();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const qc = useQueryClient();

  const onSave = async () => {
    if (!user?.id || !decodedUri || saving) return;
    setError(null);
    setSaving(true);
    try {
      await uploadAvatarFromUri(user.id, decodedUri);
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      // Ensure profile header is refreshed when returning
      qc.invalidateQueries({ queryKey: ['profile:header', user.id] });
      router.replace('/(tabs)/profile');
    } catch (e: any) {
      setError(e?.message || 'Falha ao salvar avatar.');
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Text style={styles.back}>{'< Voltar'}</Text></Pressable>
        <Text style={styles.title}>Foto do perfil</Text>
        <View style={{ width: 60 }} />
      </View>

      {!decodedUri ? (
        <View style={{ padding: 16 }}>
          <Text style={styles.subtle}>Nenhuma imagem selecionada.</Text>
        </View>
      ) : (
        <View style={{ alignItems: 'center', marginTop: 24 }}>
          <View style={styles.circleWrap}>
            <Image source={{ uri: decodedUri }} style={styles.circleImg} />
          </View>
        </View>
      )}

      {error ? (
        <Text style={[styles.subtle,{ color: '#ef4444', textAlign: 'center', marginTop: 12 }]}>{error}</Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable onPress={() => router.back()} style={[styles.btn, styles.cancelBtn]}>
          <Text style={styles.cancelTxt}>Cancelar</Text>
        </Pressable>
        <Pressable onPress={onSave} disabled={!decodedUri || saving} style={[styles.btn, styles.saveBtn, (!decodedUri || saving) && { opacity: 0.7 }]}>
          {saving ? <ActivityIndicator size="small" color="#001011" /> : <Text style={styles.saveTxt}>Salvar</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const SIZE = 240;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingTop: 16 },
  title: { ...typography.title, color: colors.primary, fontSize: 18 },
  back: { color: colors.primary },
  subtle: { ...typography.caption, color: colors.secondary },
  circleWrap: { width: SIZE, height: SIZE, borderRadius: SIZE/2, overflow:'hidden', backgroundColor: colors.card },
  circleImg: { width: '100%', height: '100%' },
  actions: { marginTop: 24, paddingHorizontal: 16, flexDirection:'row', justifyContent:'flex-end', gap: 10 },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  cancelBtn: { backgroundColor: colors.card },
  cancelTxt: { color: colors.primary, fontWeight: '600' },
  saveBtn: { backgroundColor: '#4DD4D9' },
  saveTxt: { color: '#001011', fontWeight: '800' },
});
