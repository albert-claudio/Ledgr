import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '@/components/theme/colors';
import { typography } from '@/components/theme/typography';
import { startSteamLibrarySync, getSteamSyncStatus, seedCurrentlyPlayingFromSteam } from '@/lib/steam_sync';
import { supabase } from '@/lib/supabase';
import { steamErrorMessage } from '@/lib/steamErrors';
import { getSteamAuthState, clearSteamAuthState } from '@/lib/steamAuth';

type Status = 'loading' | 'error' | 'success';

export default function SteamAuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ steamid?: string; state?: string }>();
  const [status, setStatus] = React.useState<Status>('loading');
  const [message, setMessage] = React.useState('Abrindo Steam...');
  const [error, setError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<number>(0);

  React.useEffect(() => {
    let active = true;
    (async () => {
      const steamid = params.steamid;
      const stateParam = params.state;
      if (!steamid || typeof steamid !== 'string') {
        setStatus('error');
        setError('SteamID ausente no retorno do login.');
        return;
      }
      if (!stateParam || typeof stateParam !== 'string') {
        setStatus('error');
        setError('Sessao da Steam invalida.');
        return;
      }

      const stored = await getSteamAuthState();
      if (!stored || stored.state !== stateParam) {
        setStatus('error');
        setError('Sessao expirada. Inicie a sincronizacao novamente.');
        return;
      }

      try {
        setMessage('Vinculando conta Steam...');
        // Tenta salvar o vinculo da conta Steam para este usuario
        const linkRes = await supabase.functions.invoke('steam_link', { body: { steamid } });
        if (linkRes.error) {
          // Se a funcao nao existir no projeto remoto, seguimos adiante
          console.warn('steam_link error:', linkRes.error);
        }

        if (!active) return;
        setMessage('Iniciando sincronizacao da biblioteca...');
        const queued: any = await startSteamLibrarySync(false);
        if (!active) return;

        // Monitora o progresso via worker/status
        if ((queued as any)?.status === 'throttled') {
          const nextIn = Number((queued as any)?.next_allowed_in_minutes ?? 0);
          setMessage(nextIn > 0 ? `Aguarde ${nextIn} min para nova sincronizacao...` : 'Aguarde alguns minutos para nova sincronizacao...');
        } else {
          setMessage('Sincronizando biblioteca da Steam...');
        }
        const jobId = Number((queued as any)?.job_id || 0) || undefined;
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
        let done = false;
        while (active && !done) {
          const status = await getSteamSyncStatus(jobId).catch(() => null as any);
          if (!active) break;
          const job = (status as any)?.library || null;
          const gamesTotal = Number((status as any)?.games_total ?? 0);
          const jStatus = (job?.status as string | undefined) || 'idle';
          const progress = Number(job?.progress ?? 0);
          const detail = (job?.detail as string | undefined) || '';
          if (progress >= 0) setProgress(progress);
          if (progress > 0) setMessage(`Sincronizando biblioteca da Steam (${progress}%)...\n${detail}`);
          if (jStatus === 'completed') {
            setMessage(gamesTotal > 0 ? `Importamos ${gamesTotal} jogos.` : 'Conexao concluida.');
            setProgress(100);
            setStatus('success');
            // Mapear alguns jogos recentes da Steam para IGDB para popular os cards
            try {
              setMessage('Preparando seus cards...');
              await seedCurrentlyPlayingFromSteam(12);
            } catch {}
            done = true;
            break;
          }
          if (jStatus === 'failed') {
            throw new Error(detail || 'Nao foi possivel concluir a sincronizacao.');
          }
          await sleep(2000);
        }
        // Só sai do loop ao completar ou falhar

        await clearSteamAuthState();
        setTimeout(() => {
          if (active) router.replace('/(tabs)/profile');
        }, 800);
      } catch (err) {
        if (!active) return;
        setStatus('error');
        setError(steamErrorMessage(err));
        await clearSteamAuthState();
      }
    })();
    return () => {
      active = false;
    };
  }, [params.state, params.steamid, router]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {status === 'loading' && (
          <>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.message}>{message}</Text>
            <View style={{ width: '100%', marginTop: 12 }}>
              <View
                style={{ height: 12, borderRadius: 8, backgroundColor: colors.border, position: 'relative' }}
              >
                <View
                  style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.max(0, Math.min(100, progress))}%`, backgroundColor: colors.accent, borderRadius: 8 }}
                />
              </View>
            </View>
            <Text style={styles.sub}>Por favor, nao feche o app enquanto importamos sua biblioteca.</Text>
          </>
        )}

        {status === 'success' && (
          <>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.message}>{message}</Text>
            <View style={{ width: '100%', marginTop: 12 }}>
              <View
                style={{ height: 12, borderRadius: 8, backgroundColor: colors.border, position: 'relative' }}
              >
                <View
                  style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '100%', backgroundColor: colors.accent, borderRadius: 8 }}
                />
              </View>
            </View>
            <Text style={styles.sub}>Voltando para o seu perfil...</Text>
          </>
        )}

        {status === 'error' && (
          <>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.message}>{error || 'Nao foi possivel concluir a sincronizacao.'}</Text>
            <Pressable style={styles.retryBtn} onPress={() => router.replace('/(tabs)/profile')}>
              <Text style={styles.retryTxt}>Voltar ao perfil</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, backgroundColor: colors.card, borderRadius: 16, padding: 24, alignItems: 'center' },
  message: { ...typography.title, textAlign: 'center', color: colors.primary, marginTop: 16 },
  sub: { ...typography.caption, textAlign: 'center', color: colors.secondary, marginTop: 8 },
  successIcon: { fontSize: 48 },
  errorIcon: { fontSize: 48 },
  retryBtn: { marginTop: 20, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.accent },
  retryTxt: { ...typography.caption, fontWeight: '700', color: colors.black },
});
