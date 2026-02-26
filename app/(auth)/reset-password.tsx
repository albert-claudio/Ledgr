import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdatePassword = async () => {
    if (!password.trim()) {
      Alert.alert("Erro", "Digite uma nova senha.");
      return;
    }
    setLoading(true);
    // Como o app abriu pelo link mágico, a sessão já deve estar ativa (ou o token foi processado).
    // Apenas atualizamos o usuário.
    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      Alert.alert("Erro", "Não foi possível atualizar a senha. Tente novamente.");
    } else {
      Alert.alert("Sucesso", "Sua senha foi alterada!");
      // Como o usuário já está logado, podemos redirecionar para a Home (tabs)
      router.replace('/(tabs)'); 
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <LinearGradient colors={['rgba(0,0,0,0.85)','rgba(0,0,0,0.95)','#000']} style={{ flex:1 }}>
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{ flex:1 }}>
          <View style={styles.wrap}>
            <View style={styles.logo}><Text style={styles.logoTxt}>L</Text></View>
            <Text style={styles.title}>Nova Senha</Text>

            <View style={styles.form}>
              <TextInput
                placeholder="Digite a nova senha"
                placeholderTextColor="#8b8b8b"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                style={{ ...styles.input, marginBottom: 20 }}
              />
              
              <TouchableOpacity
                style={[styles.primaryBtn, loading && { opacity:0.6 }]}
                onPress={handleUpdatePassword}
                disabled={loading}
                activeOpacity={0.85}
              >
                <LinearGradient colors={['#5CE1E6','#4DD4D9']} style={styles.btnGrad} start={{x:0,y:0}} end={{x:1,y:0}}>
                  <Text style={styles.primaryTxt}>{loading ? 'Atualizando...' : 'Salvar Nova Senha'}</Text>
                </LinearGradient>
              </TouchableOpacity>
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
    paddingHorizontal:14, fontSize:16, color:'#fff', backgroundColor:'rgba(23,24,26,0.9)'
  },
  primaryBtn:{ marginTop:6, borderRadius:10, overflow:'hidden', elevation:2 },
  btnGrad:{ paddingVertical:14, alignItems:'center', justifyContent:'center' },
  primaryTxt:{ fontSize:16, fontWeight:'800', color:'#001011' },
});
