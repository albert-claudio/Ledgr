import React, { useState } from 'react';
// KeyboardAvoidingView, Platform, StatusBar, ImageBackground, Dimensions,
//   ActivityIndicator, Pressable, Modal
// } from 'react-native';
import { supabase } from '@/lib/supabase'; // garante que isso existe como te mostrei antes
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
// OAuth removido: nÃ£o precisamos de Linking/WebBrowser/AuthSession aqui
import { Ionicons } from '@expo/vector-icons';
// removed OAuth context usage

import {
    ActivityIndicator,
    Dimensions,
    ImageBackground,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  // OAuth removido
  const params = useLocalSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [successVisible, setSuccessVisible] = useState(false);
  React.useEffect(() => {
    const prefill = (params as any)?.email;
    if (prefill) setEmail(String(prefill));
  }, [params]);
  const backgroundImage = require('@/assets/Rectangle 1.png'); // troca por uma imagem tua (blur de capas)

  async function handleLogin() {
    setErr(null);

    // validaÃ§Ã£o besta mas efetiva
    if (!email.trim() || !password.trim()) {
      setErr('Preencha e-mail e senha.');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setErr('E-mail inválido.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      // mensagens mais humanas
      const msg = error.message?.toLowerCase();
      if (msg.includes('invalid login credentials')) setErr('E-mail ou senha incorretos.');
      
      else setErr('Nãoo foi possivel entrar. Tente novamente.');
      return;
    }

    // sucesso: o listener do _layout pode redirecionar; se nÃ£o tiver listener, forÃ§a aqui:
    setOk('Login realizado!'); setSuccessVisible(true); try { require('expo-haptics').notificationAsync(require('expo-haptics').NotificationFeedbackType.Success); } catch {} setTimeout(() => router.replace('/(tabs)'), 2000);
  }

  // Google OAuth removido

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <ImageBackground
        // troca por uma imagem tua (blur de capas). Em dev, pode usar require('@/assets/login-blur.jpg')
        source={backgroundImage}
        style={styles.backgroundImage}
        resizeMode="cover"
        imageStyle={{ opacity: 0.25 }}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.85)', 'rgba(0,0,0,0.95)', '#000']}
          style={styles.gradient}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
            <View style={styles.content}>

              {/* Logo (placeholder) */}
              <View style={styles.logoContainer}>
                <View style={styles.logo}>
                  <Text style={styles.logoText}>L</Text>
                </View>
              </View>

              <Text style={styles.title}>Bem-vindo ao Ledgr.</Text>

              <View style={styles.form}>
                {/* Email */}
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Coloque seu Email..."
                    placeholderTextColor="#8b8b8b"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    inputMode="email"
                    returnKeyType="next"
                  />
                </View>

                {/* Senha + toggle */}
                <View style={[styles.inputContainer, { position: 'relative' }]}>
                  <TextInput
                    style={styles.input}
                    placeholder="Coloque sua Senha..."
                    placeholderTextColor="#8b8b8b"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={secure}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="password"
                    textContentType="password"
                    returnKeyType="go"
                    onSubmitEditing={() => !loading && handleLogin()}
                  />
                  <Pressable
                    onPress={() => setSecure(s => !s)}
                    style={styles.eye}
                    hitSlop={12}
                  >
                    <Ionicons name={secure ? 'eye-off' : 'eye'} size={20} color="#bfbfbf" />
                  </Pressable>
                </View>

                {/* Erro */}
                {err ? <Text style={styles.errorText}>{err}</Text> : null}
                {ok ? <Text style={styles.okText}>{ok}</Text> : null}

                {/* Links */}
                <View style={styles.linksContainer}>
                  <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
                    <Text style={styles.linkText}>Criar Conta</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push('/(auth)/reset')}>
                    <Text style={styles.linkText}>Esqueceu sua senha</Text>
                  </TouchableOpacity>
                </View>

                {/* Entrar */}
                <TouchableOpacity
                  style={[styles.loginButton, loading && { opacity: 0.6 }]}
                  onPress={handleLogin}
                  activeOpacity={0.85}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={['#5CE1E6', '#4DD4D9']}
                    style={styles.loginButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading ? (
                      <ActivityIndicator color="#001011" />
                    ) : (
                      <Text style={styles.loginButtonText}>Entrar</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Social OAuth */}
                <View style={{ display: 'none' }}>
                  <TouchableOpacity
                    style={styles.socialBtn}
                    onPress={() => {}}
                  >
                    <Ionicons name="logo-google" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={{ color:'#fff' }}>Entrar com Google</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </LinearGradient>
      </ImageBackground>
      <Modal transparent animationType="fade" visible={successVisible} onRequestClose={() => setSuccessVisible(false)} statusBarTranslucent>
        <View style={styles.overlay}> 
          <View style={styles.popup}>
            <Ionicons name="checkmark-circle" size={44} color="#34D399" />
            <Text style={styles.popupTitle}>Login realizado com sucesso</Text>
            <Text style={styles.popupMsg}>Entrando</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  backgroundImage: { flex: 1, width, height },
  gradient: { flex: 1 },
  keyboardView: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },

  logoContainer: { marginBottom: 32 },
  logo: { width: 84, height: 84, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  logoText: { fontSize: 48, fontWeight: '800', color: '#000' },

  title: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 26, textAlign: 'center' },

  form: { width: '100%', maxWidth: 360 },
  inputContainer: { marginBottom: 16 },
  input: {
    height: 50,
    borderWidth: 1, borderColor: '#2a2b2e',
    borderRadius: 10, paddingHorizontal: 14, fontSize: 16,
    color: '#fff', backgroundColor: 'rgba(23, 24, 26, 0.9)'
  },
  eye: { position: 'absolute', right: 12, top: 15 },
  socialBtn: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2b2e',
    backgroundColor: 'rgba(23,24,26,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row'
  },

  linksContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18, marginTop: 6 },
  linkText: { color: '#9edfe0', fontSize: 13 },

  loginButton: {
    marginTop: 6, borderRadius: 10, overflow: 'hidden',
    shadowColor: '#5CE1E6', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 2
  },
  loginButtonGradient: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  loginButtonText: { fontSize: 16, fontWeight: '800', color: '#001011' },

  errorText: { color: '#ff6b6b', marginBottom: 8, fontSize: 13 },
  okText: { color: '#a7f3d0', marginBottom: 8, fontSize: 13 },
  overlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  popup: { backgroundColor: '#111213', paddingVertical: 18, paddingHorizontal: 18, borderRadius: 14, alignItems: 'center', width: 280, borderWidth: StyleSheet.hairlineWidth, borderColor: '#2a2b2e' },
  popupTitle: { color: '#fff', fontWeight: '700', fontSize: 16, marginTop: 10, textAlign: 'center' },
  popupMsg: { color: '#cbd5e1', fontSize: 13, marginTop: 4, textAlign: 'center' }
});












