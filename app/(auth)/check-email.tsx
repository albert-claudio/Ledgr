import { 
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert
} from 'react-native';
import React, { useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

export default function CheckEmail() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function resend() {
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: String(email),
    });
    setLoading(false);
    if (error) {
      Alert.alert('Erro', 'Não foi possível reenviar o e-mail. consegui reenviar agora. Tenta de novo em 1 min.');
      return;
    }
    setSent(true);
  }

  function openMailApp() {
    // tenta abrir o Gmail; se nÃ£o rolar, cai num mailto:
    Linking.openURL('mailto:').catch(() => {
      Alert.alert('Dica', 'Abra seu app de e-mail e busque pelo assunto de confirmaÃ§Ã£o do Ledgr.');
    });
  }

  return (
    <SafeAreaView style={s.wrap}>
      <View style={s.card}>
        <Text style={s.title}>Verifique seu e-mail</Text>
        <Text style={s.body}>
          Enviamos um link de confirmaÃ§Ã£o para{'\n'}
          <Text style={s.bold}>{email || 'seu endereço de e-mail'}</Text>.
        </Text>

        <TouchableOpacity style={s.primary} onPress={openMailApp}>
          <Text style={s.primaryTxt}>Abrir app de e-mail</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.ghost, { marginTop: 10 }]} onPress={() => router.replace('/(auth)/login')}>
          <Text style={s.ghostTxt}>JÃ¡ confirmei â€” Voltar ao login</Text>
        </TouchableOpacity>

        <View style={{ height: 16 }} />

        <TouchableOpacity style={s.linkBtn} onPress={resend} disabled={loading}>
          {loading ? <ActivityIndicator color="#9edfe0" /> : (
            <Text style={s.linkTxt}>{sent ? 'E-mail reenviado! (confira o spam)' : 'Reenviar e-mail de confirmaÃ§Ã£o'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0b0b0c', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#121316', borderRadius: 14, padding: 22, borderWidth: 1, borderColor: '#232428' },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  body: { color: '#bfbfbf', fontSize: 14, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  bold: { color: '#fff', fontWeight: '700' },
  primary: { backgroundColor: '#24d1c4', paddingVertical: 12, borderRadius: 10 },
  primaryTxt: { color: '#001011', fontWeight: '800', textAlign: 'center' },
  ghost: { paddingVertical: 10 },
  ghostTxt: { color: '#9edfe0', textAlign: 'center' },
  linkBtn: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  linkTxt: { color: '#9edfe0' }
});
