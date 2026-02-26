import React, { useState } from 'react';
import { Modal, View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { colors } from '@/components/theme/colors';
import { typography } from '@/components/theme/typography';
import { useAuth } from '@/providers/AuthProvider';
import { createUserCollection } from '@/services/profile';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

export function CreateCollectionModal({ visible, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleCreate() {
    if (!user) return;
    const n = name.trim();
    if (!n) { setErr('Dê um nome para sua coleção'); return; }
    setErr(null);
    setBusy(true);
    try {
      await createUserCollection(user.id, n);
      setBusy(false);
      setName('');
      onCreated?.();
      onClose();
    } catch (e: any) {
      setBusy(false);
      setErr(e?.message || 'Falha ao criar.');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Nova coleção</Text>
          <TextInput
            placeholder="Nome da coleção"
            placeholderTextColor={colors.secondary}
            style={styles.input}
            value={name}
            onChangeText={setName}
          />
          {err ? <Text style={styles.err}>{err}</Text> : null}
          <View style={{ flexDirection:'row', gap:10 }}>
            <Pressable onPress={onClose} style={[styles.btn,{ backgroundColor: colors.card }]}><Text style={[styles.btnTxt,{ color: colors.primary }]}>Cancelar</Text></Pressable>
            <Pressable onPress={handleCreate} style={styles.btn} disabled={busy}><Text style={styles.btnTxt}>{busy?'Criando...':'Criar'}</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex:1, backgroundColor:'rgba(0,0,0,0.55)', alignItems:'center', justifyContent:'center' },
  card: { width: 300, backgroundColor:'#111213', borderRadius:14, padding:16, borderWidth: StyleSheet.hairlineWidth, borderColor:'#2a2b2e' },
  title: { ...typography.title, color: colors.primary, fontSize: 18, marginBottom: 8, textAlign:'center' },
  input: { backgroundColor: colors.card, color: colors.primary, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, marginBottom: 10 },
  btn: { backgroundColor:'#4DD4D9', paddingHorizontal:14, paddingVertical:10, borderRadius:10, alignItems:'center', justifyContent:'center', flex:1 },
  btnTxt: { color:'#001011', fontWeight:'800' },
  err: { color:'#f87171', marginBottom: 6, textAlign:'center' },
});

