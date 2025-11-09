import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, Link } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleSend() {
    setErr(null);
    setMsg(null);
    if (!email.trim()) { setErr('Preencha o e-mail.'); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setErr('E-mail inválido.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'ledgr://auth-callback',
    });
    setLoading(false);
    if (error) {
      setErr('Não foi possível enviar o e-mail. Tente novamente.');
      return;
    }
    setMsg('Enviamos um e-mail com instruções para redefinir sua senha.');
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <LinearGradient colors={['rgba(0,0,0,0.85)','rgba(0,0,0,0.95)','#000']} style={{ flex:1 }}>
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{ flex:1 }}>
          <View style={styles.wrap}>
            <View style={styles.logo}><Text style={styles.logoTxt}>L</Text></View>
            <Text style={styles.title}>Redefinir senha</Text>

            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="Seu e-mail"
                placeholderTextColor="#8b8b8b"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                inputMode="email"
                returnKeyType="send"
                onSubmitEditing={() => !loading && handleSend()}
              />

              {err ? <Text style={styles.err}>{err}</Text> : null}
              {msg ? <Text style={styles.msg}>{msg}</Text> : null}

              <TouchableOpacity
                style={[styles.primaryBtn, loading && { opacity:0.6 }]}
                onPress={handleSend}
                disabled={loading}
                activeOpacity={0.85}
              >
                <LinearGradient colors={['#5CE1E6','#4DD4D9']} style={styles.btnGrad} start={{x:0,y:0}} end={{x:1,y:0}}>
                  <Text style={styles.primaryTxt}>{loading ? 'Enviando…' : 'Enviar link'}</Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.bottomRow}>
                <Link href="/(auth)/login" style={{ color:'#9edfe0' }}>Voltar ao login</Link>
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
  title:{ color:'#fff', fontSize:22, fontWeight:'700', marginBottom:18 },
  form:{ width:'100%', maxWidth:360 },
  input:{
    height:50, borderWidth:1, borderColor:'#2a2b2e', borderRadius:10,
    paddingHorizontal:14, fontSize:16, color:'#fff', backgroundColor:'rgba(23,24,26,0.9)', marginBottom:14
  },
  err:{ color:'#ff6b6b', marginBottom:8, fontSize:13 },
  msg:{ color:'#a7f3d0', marginBottom:8, fontSize:13 },
  primaryBtn:{ marginTop:6, borderRadius:10, overflow:'hidden', elevation:2 },
  btnGrad:{ paddingVertical:14, alignItems:'center', justifyContent:'center' },
  primaryTxt:{ fontSize:16, fontWeight:'800', color:'#001011' },
  bottomRow:{ marginTop:14, alignItems:'center' },
});

