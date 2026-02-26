import { colors } from '@/components/theme/colors';
import { typography } from '@/components/theme/typography';
import { runSteamSyncWorker, startSteamLibrarySync } from '@/lib/steam_sync';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface DiagnosticResult {
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  details?: string;
}

export default function DebugSteamScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [bulkRemapping, setBulkRemapping] = useState(false);

  // Check 1: Events table exists
  const eventsCheck = useQuery({
    queryKey: ['debug', 'events'],
    queryFn: async (): Promise<DiagnosticResult> => {
      try {
        const { data, error, count } = await supabase
          .from('events')
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          return {
            name: 'Events Table',
            status: 'error',
            message: 'Table does not exist or is inaccessible',
            details: error.message,
          };
        }
        
        return {
          name: 'Events Table',
          status: 'ok',
          message: `✅ Table exists with ${count ?? 0} events`,
        };
      } catch (e: any) {
        return {
          name: 'Events Table',
          status: 'error',
          message: '❌ Failed to check table',
          details: e.message,
        };
      }
    },
  });

  // Check 2: IGDB Mappings
  const mappingsCheck = useQuery({
    queryKey: ['debug', 'mappings'],
    queryFn: async (): Promise<DiagnosticResult> => {
      const { count, error } = await supabase
        .from('steam_igdb_mappings')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        return {
          name: 'IGDB Mappings',
          status: 'error',
          message: '❌ Table not accessible',
          details: error.message,
        };
      }
      
      if (count === 0) {
        return {
          name: 'IGDB Mappings',
          status: 'warning',
          message: '⚠️ No mappings found',
          details: 'Events will not be created without Steam-to-IGDB mappings',
        };
      }
      
      return {
        name: 'IGDB Mappings',
        status: 'ok',
        message: `✅ ${count} mappings available`,
      };
    },
  });

  // Check 3: Sync Jobs
  const jobsCheck = useQuery({
    queryKey: ['debug', 'jobs', user?.id],
    queryFn: async (): Promise<DiagnosticResult> => {
      if (!user) throw new Error('No user');
      
      const { data, error } = await supabase
        .from('steam_sync_jobs')
        .select('status')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) {
        return {
          name: 'Sync Jobs',
          status: 'error',
          message: '❌ Cannot read jobs',
          details: error.message,
        };
      }
      
      const pending = data?.filter(j => j.status === 'pending').length ?? 0;
      const processing = data?.filter(j => j.status === 'processing').length ?? 0;
      const completed = data?.filter(j => j.status === 'completed').length ?? 0;
      const failed = data?.filter(j => j.status === 'failed').length ?? 0;
      
      const hasStuck = pending > 0 || processing > 0;
      
      return {
        name: 'Sync Jobs',
        status: hasStuck ? 'warning' : 'ok',
        message: `Pending: ${pending}, Processing: ${processing}, Completed: ${completed}, Failed: ${failed}`,
        details: hasStuck ? 'You have stuck jobs that may need manual processing' : undefined,
      };
    },
    enabled: !!user,
  });

  // Check 4: Steam User Games
  const steamGamesCheck = useQuery({
    queryKey: ['debug', 'steam_games', user?.id],
    queryFn: async (): Promise<DiagnosticResult> => {
      if (!user) throw new Error('No user');
      
      const { data, error, count } = await supabase
        .from('steam_user_games')
        .select('steam_appid, playtime_forever, steam_apps(name)', { count: 'exact' })
        .eq('profile_id', user.id)
        .order('last_synced_at', { ascending: false })
        .limit(5);
      
      if (error) {
        return {
          name: 'Steam Games',
          status: 'error',
          message: '❌ Cannot read Steam games',
          details: error.message,
        };
      }
      
      if ((count ?? 0) === 0) {
        return {
          name: 'Steam Games',
          status: 'warning',
          message: '⚠️ No Steam games synced yet',
          details: 'Try running a sync first',
        };
      }
      
      const topGames = data?.map(g => `${(g.steam_apps as any)?.name}: ${g.playtime_forever} min`).join('\n');
      
      return {
        name: 'Steam Games',
        status: 'ok',
        message: `✅ ${count} games synced`,
        details: `Recent games:\n${topGames}`,
      };
    },
    enabled: !!user,
  });

  // Check 5: Steam Account
  const steamAccountCheck = useQuery({
    queryKey: ['debug', 'steam_account', user?.id],
    queryFn: async (): Promise<DiagnosticResult> => {
      if (!user) throw new Error('No user');
      
      const { data: ext } = await supabase
        .from('external_accounts')
        .select('external_id, provider')
        .eq('profile_id', user.id)
        .eq('provider', 'steam')
        .maybeSingle();
      
      if (!ext) {
        return {
          name: 'Steam Account',
          status: 'error',
          message: '❌ Not linked',
          details: 'Link your Steam account first',
        };
      }
      
      return {
        name: 'Steam Account',
        status: 'ok',
        message: `✅ Linked (${ext.external_id})`,
      };
    },
    enabled: !!user,
  });

  const handleForceSync = async () => {
    try {
      setSyncing(true);
      Alert.alert('🔄 Starting Sync', 'Forcing a new sync job...');
      
      const result = await startSteamLibrarySync(true); // force = true
      console.log('[DebugSteam] Sync result:', result);
      
      if (result?.status === 'queued') {
        // Wait a bit and trigger worker
        setTimeout(async () => {
          try {
            await runSteamSyncWorker(1);
            Alert.alert('✅ Sync Triggered', 'Worker started. Check logs in Supabase.');
          } catch (e: any) {
            console.warn('[DebugSteam] Worker error:', e);
          }
        }, 1000);
      } else if (result?.status === 'throttled') {
        Alert.alert('⏳ Throttled', result.message || 'Too soon since last sync');
      }
    } catch (error: any) {
      Alert.alert('❌ Sync Failed', error.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      eventsCheck.refetch(),
      mappingsCheck.refetch(),
      jobsCheck.refetch(),
      steamGamesCheck.refetch(),
      steamAccountCheck.refetch(),
    ]);
    setRefreshing(false);
  };

  const handleBulkRemap = async () => {
    try {
      setBulkRemapping(true);
      Alert.alert('🔧 Re-mapeando Jogos', 'Buscando IDs corretos do IGDB...');
      
      const { data, error } = await supabase.functions.invoke('steam_bulk_remap');
      
      if (error) {
        Alert.alert('❌ Erro', error.message || 'Falha ao re-mapear jogos');
        return;
      }
      
      console.log('[DebugSteam] Remap result:', data);
      
      Alert.alert(
        '✅ Re-mapeamento Completo!', 
        `Total: ${data.total_games}\nRe-mapeados: ${data.remapped}\nJá corretos: ${data.skipped}\n\nAgora seus jogos devem abrir as páginas corretas!`
      );
      
      // Refresh checks to see updated mappings
      await handleRefresh();
    } catch (e: any) {
      Alert.alert('❌ Erro', e.message);
    } finally {
      setBulkRemapping(false);
    }
  };

  const checks = [
    steamAccountCheck,
    eventsCheck,
    mappingsCheck,
    steamGamesCheck,
    jobsCheck,
  ];

  const isLoading = checks.some(c => c.isLoading);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>🔍 Steam Sync Debug</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
        }
      >
        <Text style={styles.subtitle}>Diagnostic Report</Text>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Running diagnostics...</Text>
          </View>
        ) : (
          <>
            {checks.map((check, idx) => (
              <DiagnosticCard key={idx} result={check.data} />
            ))}
          </>
        )}

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary, bulkRemapping && styles.buttonDisabled]}
          onPress={handleBulkRemap}
          disabled={bulkRemapping}
        >
          {bulkRemapping ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Ionicons name="refresh-circle" size={20} color={colors.white} />
              <Text style={styles.buttonText}>Re-mapear Todos os Jogos</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, syncing && styles.buttonDisabled]}
          onPress={handleForceSync}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Ionicons name="sync" size={20} color={colors.white} />
              <Text style={styles.buttonText}>Force Sync Now</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>💡 Troubleshooting</Text>
          <Text style={styles.infoText}>
            1. If Events Table is missing, run fix_steam_sync_complete.sql in Supabase{'\n'}
            2. If IGDB Mappings are 0, popular games won't create events{'\n'}
            3. If Steam Account not linked, go to Profile {'\u003e'} Settings{'\n'}
            4. Check Supabase Edge Function logs for detailed errors
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DiagnosticCard({ result }: { result?: DiagnosticResult }) {
  if (!result) return null;

  const getStatusColor = () => {
    switch (result.status) {
      case 'ok':
        return colors.success || '#10b981';
      case 'warning':
        return colors.warning || '#f59e0b';
      case 'error':
        return colors.error || '#ef4444';
    }
  };

  const getStatusIcon = () => {
    switch (result.status) {
      case 'ok':
        return 'checkmark-circle';
      case 'warning':
        return 'warning';
      case 'error':
        return 'close-circle';
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name={getStatusIcon()} size={24} color={getStatusColor()} />
        <Text style={styles.cardTitle}>{result.name}</Text>
      </View>
      <Text style={styles.cardMessage}>{result.message}</Text>
      {result.details && <Text style={styles.cardDetails}>{result.details}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  title: {
    ...typography.header,
    fontSize: 24,
    color: colors.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  subtitle: {
    ...typography.header,
    fontSize: 18,
    color: colors.secondary,
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    ...typography.body,
    color: colors.secondary,
    marginTop: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  cardTitle: {
    ...typography.header,
    fontSize: 16,
    color: colors.primary,
  },
  cardMessage: {
    ...typography.body,
    color: colors.primary,
    marginBottom: 4,
  },
  cardDetails: {
    ...typography.caption,
    color: colors.secondary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  button: {
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    marginVertical: 16,
  },
  buttonSecondary: {
    backgroundColor: '#f59e0b', // Orange/warning color for remap action
    marginBottom: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
  },
  infoBox: {
    backgroundColor: 'rgba(102, 192, 244, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoTitle: {
    ...typography.header,
    fontSize: 16,
    color: colors.accent,
    marginBottom: 8,
  },
  infoText: {
    ...typography.caption,
    color: colors.secondary,
    lineHeight: 20,
  },
});
