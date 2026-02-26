import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function VerifyCodeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = params.email as string;

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleVerify() {
    setErr(null);
    if (!code.trim() || code.length < 6) {
      setErr('Digite o código de 6 dígitos.');
      return;
    }
    setLoading(true);

    const { data, error } = await supabase.auth.verifyOtp({
      email: email,
      token: code,
      type: 'recovery',
    });

    setLoading(false);

    if (error) {
      setErr('Código inválido ou expirado.');
      return;
    }

    // Sucesso: Usuário logado via recovery.
    // Vamos para a tela de definir nova senha.
    router.replace('/(auth)/reset-password');
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <LinearGradient colors={['rgba(0,0,0,0.85)','rgba(0,0,0,0.95)','#000']} style={{ flex:1 }}>
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{ flex:1 }}>
          <View style={styles.wrap}>
            <View style={styles.logo}><Text style={styles.logoTxt}>L</Text></View>
            <Text style={styles.title}>Verificar Código</Text>
            <Text style={styles.subtitle}>Digite o código enviado para {email}</Text>

            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="000000"
                placeholderTextColor="#8b8b8b"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                autoCapitalize="none"
                returnKeyType="go"
                onSubmitEditing={() => !loading && handleVerify()}
              />

              {err ? <Text style={styles.err}>{err}</Text> : null}

              <TouchableOpacity
                style={[styles.primaryBtn, loading && { opacity:0.6 }]}
                onPress={handleVerify}
                disabled={loading}
                activeOpacity={0.85}
              >
                <LinearGradient colors={['#5CE1E6','#4DD4D9']} style={styles.btnGrad} start={{x:0,y:0}} end={{x:1,y:0}}>
                  <Text style={styles.primaryTxt}>{loading ? 'Verificando...' : 'Verificar'}</Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.bottomRow}>
                <TouchableOpacity onPress={() => router.back()}>
                  <Text style={{ color:'#9edfe0' }}>Voltar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:'#000' },
  wrap:{ flex:1, justifyContent:'center', alignItems:'center', paddingHorizontal:28 },
  logo:{ width:84, height:84, backgroundColor:'#fff', justifyContent:'center', alignItems:'center', marginBottom:20 },
  logoTxt:{ fontSize:48, fontWeight:'800', color:'#000' },
  title:{ color:'#fff', fontSize:22, fontWeight:'700', marginBottom:8 },
  subtitle:{ color:'#ccc', fontSize:14, marginBottom:24, textAlign:'center' },
  form:{ width:'100%', maxWidth:360 },
  input:{
    height:50, borderWidth:1, borderColor:'#2a2b2e', borderRadius:10,
    paddingHorizontal:14, fontSize:16, color:'#fff', backgroundColor:'rgba(23,24,26,0.9)', marginBottom:14,
    textAlign: 'center', letterSpacing: 4
  },
  err:{ color:'#ff6b6b', marginBottom:8, fontSize:13, textAlign:'center' },
  primaryBtn:{ marginTop:6, borderRadius:10, overflow:'hidden', elevation:2 },
  btnGrad:{ paddingVertical:14, alignItems:'center', justifyContent:'center' },
  primaryTxt:{ fontSize:16, fontWeight:'800', color:'#001011' },
  bottomRow:{ marginTop:14, alignItems:'center' },
});
