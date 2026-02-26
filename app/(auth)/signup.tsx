import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    ImageBackground,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text, TextInput, TouchableOpacity,
    View
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function Signup() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail]     = useState('');
  const [pass, setPass]       = useState('');
  const [confirm, setConfirm] = useState('');
  const [secure, setSecure]   = useState(true);
  const [secure2, setSecure2] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  
  const [ok, setOk] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [successVisible, setSuccessVisible] = useState(false);

  async function checkUsername(u: string) {
    const slug = u.trim().toLowerCase();
    if (!slug) { setAvailable(null); setSuggestions([]); return; }
    try {
      setChecking(true);
      // Prefer Edge Function that bypasses RLS for accurate result
      let taken = false;
      try {
        const { data: fx } = await supabase.functions.invoke('username-check', { body: { username: slug } });
        if (fx && typeof fx.exists === 'boolean') {
          taken = !!fx.exists;
        } else {
          throw new Error('bad-fn');
        }
      } catch {
        // Fallback to RLS-limited check (may miss private profiles)
        const { data, error } = await supabase.from('profiles').select('id').eq('username', slug).maybeSingle();
        if (error && (error as any).code !== 'PGRST116') throw error;
        taken = !!data?.id;
      }
      setAvailable(!taken);
      if (taken) {
        const base = slug.replace(/[^a-z0-9_.]/g, '').slice(0, 18) || 'user';
        const year = new Date().getFullYear();
        const pool = [
          `${base}${Math.floor(10+Math.random()*89)}`,
          `${base}_${Math.floor(100+Math.random()*899)}`,
          `${base}.${year}`,
          `${base}_${base.slice(0,3)}`,
          `${base}${base.length}`,
        ];
        const { data: used } = await supabase.from('profiles').select('username').in('username', pool);
        const usedSet = new Set((used||[]).map((r:any)=>r.username));
        setSuggestions(pool.filter(p => !usedSet.has(p)));
      } else {
        setSuggestions([]);
      }
    } finally {
      setChecking(false);
    }
  }

    useEffect(() => {
    const t = setTimeout(() => { if (username.trim().length>=3) checkUsername(username); }, 400);
    return () => clearTimeout(t);
  }, [username]);
function validate() {
    if (!username.trim()) return 'Escolha um username.';
    if (!email.trim()) return 'Preencha o e-mail.';
    if (!/\S+@\S+\.\S+/.test(email)) return 'E-mail inválido.';
    if (pass.length < 6) return 'Senha precisa ter pelo menos 6 caracteres.';
    if (pass !== confirm) return 'As senhas não batem.';
    return null;
  }

  async function ensureProfile() {
    // tenta criar o profile (se funciona se já existir sessão)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('profiles')
      .upsert({ id: user.id, username: username.trim().toLowerCase() })
      .select()
      .single();
  }

  async function handleSignup() {
    setErr(null);
    // Final server-side availability check to avoid RLS false-positives
    try {
      const slug = username.trim().toLowerCase();
      if (!slug) { setErr('Escolha um username.'); return; }
      const { data: fx } = await supabase.functions.invoke('username-check', { body: { username: slug } });
      if (fx && fx.exists) {
        setErr('Username indisponível.');
        return;
      }
    } catch {}
    const e = validate();
    if (e) { setErr(e); return; }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: { username }
      }
    });
    setLoading(false);

        if (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes("already registered")) {
        setErr("E-mail já cadastrado. Faça login.");
      } else if (msg.includes("username")) {
        setErr("Username indisponível.");
      } else {
        setErr("Não foi possível criar sua conta.");
      }
      return;
    }

     // Caso Supabase: identities vazio => e-mail já existe
    const identities = (data as any)?.user?.identities;
    if (Array.isArray(identities) && identities.length === 0) {
      setErr('E-mail já cadastrado. Faça login.');
      try { (router as any).replace({ pathname: '/(auth)/login', params: { email } }); } catch {}
      return;
    }   // Login automático após cadastro
    setOk('Cadastro realizado com sucesso!'); try { require('expo-haptics').notificationAsync(require('expo-haptics').NotificationFeedbackType.Success); } catch {} await new Promise(res=>setTimeout(res,500)); const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (signInErr) {
      setErr("Não foi possível entrar automaticamente. Verifique seu e-mail/senha.");
      return;
    }

    await ensureProfile();
    setOk('Cadastro realizado com sucesso!');
    setSuccessVisible(true);
    try { require('expo-haptics').notificationAsync(require('expo-haptics').NotificationFeedbackType.Success); } catch {}
    setTimeout(() => router.replace('/(tabs)'), 2000);
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1600&auto=format&fit=crop' }}
        style={styles.bg}
        resizeMode="cover"
        imageStyle={{ opacity: 0.25 }}
      >
        <LinearGradient colors={['rgba(0,0,0,0.85)','rgba(0,0,0,0.95)','#000']} style={{ flex:1 }}>
          <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{ flex:1 }}>
            <View style={styles.wrap}>
              <View style={styles.logo}><Text style={styles.logoTxt}>L</Text></View>
              <Text style={styles.title}>Crie sua conta</Text>

              <View style={styles.form}>
                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor="#8b8b8b"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="username"
                  returnKeyType="next"
                />

                {checking ? (
                  <Text style={styles.hint}>Verificando disponibilidade</Text>
                ) : available === false ? (
                  <View style={{ marginTop: 6 }}>
                    <Text style={[styles.hint,{color:'#ffb4b4'}]}>Nome indisponivel. Sugestão:</Text>
                    <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:6 }}>
                      {suggestions.map(s => (
                        <Pressable key={s} onPress={() => setUsername(s)} style={styles.suggestion}>
                          <Text style={styles.suggestionTxt}>{s}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : available === true ? (
                  <Text style={[styles.hint,{color:'#a7f3d0'}]}>Disponivel</Text>
                ) : null}

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
                  returnKeyType="next"
                />

                <View style={{ position:'relative' }}>
                  <TextInput
                    style={styles.input}
                    placeholder="Senha (min. 6)"
                    placeholderTextColor="#8b8b8b"
                    value={pass}
                    onChangeText={setPass}
                    secureTextEntry={secure}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="password"
                    textContentType="newPassword"
                    returnKeyType="next"
                  />
                  <Pressable onPress={()=>setSecure(s=>!s)} style={styles.eye} hitSlop={12}>
                    <Ionicons name={secure?'eye-off':'eye'} size={20} color="#bfbfbf"/>
                  </Pressable>
                </View>

                <View style={{ position:'relative' }}>
                  <TextInput
                    style={styles.input}
                    placeholder="Confirmar senha"
                    placeholderTextColor="#8b8b8b"
                    value={confirm}
                    onChangeText={setConfirm}
                    secureTextEntry={secure2}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="password"
                    returnKeyType="go"
                    onSubmitEditing={() => !loading && handleSignup()}
                  />
                  <Pressable onPress={()=>setSecure2(s=>!s)} style={styles.eye} hitSlop={12}>
                    <Ionicons name={secure2?'eye-off':'eye'} size={20} color="#bfbfbf"/>
                  </Pressable>
                </View>

                {err ? <Text style={styles.err}>{err}</Text> : null}
                {ok ? <Text style={styles.ok}>{ok}</Text> : null}

                <TouchableOpacity
                  style={[styles.primaryBtn, loading && { opacity:0.6 }]}
                  onPress={handleSignup}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={['#5CE1E6','#4DD4D9']} style={styles.btnGrad} start={{x:0,y:0}} end={{x:1,y:0}}>
                    {loading ? <ActivityIndicator color="#001011"/> : <Text style={styles.primaryTxt}>Criar conta</Text>}
                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.bottomRow}>
                  <Text style={{ color:'#bfbfbf' }}>Já tem conta?</Text>
                  <Pressable onPress={() => router.push('/(auth)/login')} hitSlop={8}>
                    <Text style={{ color:'#9edfe0', marginLeft:6 }}>Entrar</Text>
                  </Pressable>
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
            <Text style={styles.popupTitle}>Cadastro feito com sucesso</Text>
            <Text style={styles.popupMsg}>Entrando…</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hint:{ color:'#bfbfbf', fontSize:12, marginTop:-8 },
  suggestion:{ backgroundColor:'rgba(255,255,255,0.08)', borderWidth:1, borderColor:'#2a2b2e', paddingHorizontal:10, paddingVertical:6, borderRadius:8 },
  suggestionTxt:{ color:'#fff', fontSize:12 },
  container:{ flex:1, backgroundColor:'#000' },
  bg:{ flex:1, width, height },
  wrap:{ flex:1, justifyContent:'center', alignItems:'center', paddingHorizontal:28 },
  logo:{ width:84, height:84, backgroundColor:'#fff', justifyContent:'center', alignItems:'center', marginBottom:20 },
  logoTxt:{ fontSize:48, fontWeight:'800', color:'#000' },
  title:{ color:'#fff', fontSize:22, fontWeight:'700', marginBottom:18 },
  form:{ width:'100%', maxWidth:360 },
  input:{
    height:50, borderWidth:1, borderColor:'#2a2b2e', borderRadius:10,
    paddingHorizontal:14, fontSize:16, color:'#fff', backgroundColor:'rgba(23,24,26,0.9)', marginBottom:14
  },
  eye:{ position:'absolute', right:12, top:15 },
  err:{ color:'#ff6b6b', marginBottom:8, fontSize:13 },
  overlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  popup: { backgroundColor: '#111213', paddingVertical: 18, paddingHorizontal: 18, borderRadius: 14, alignItems: 'center', width: 280, borderWidth: StyleSheet.hairlineWidth, borderColor: '#2a2b2e' },
  popupTitle: { color: '#fff', fontWeight: '700', fontSize: 16, marginTop: 10, textAlign: 'center' },
  popupMsg: { color: '#cbd5e1', fontSize: 13, marginTop: 4, textAlign: 'center' },
  ok:{ color:'#a7f3d0', marginBottom:8, fontSize:13 },
  primaryBtn:{ marginTop:6, borderRadius:10, overflow:'hidden', elevation:2 },
  btnGrad:{ paddingVertical:14, alignItems:'center', justifyContent:'center' },
  primaryTxt:{ fontSize:16, fontWeight:'800', color:'#001011' },
  bottomRow:{ flexDirection:'row', alignItems:'center', justifyContent:'center', marginTop:14 },
});












