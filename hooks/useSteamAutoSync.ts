import { startSteamLibrarySync } from '@/lib/steam_sync';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSteamAccountStatus } from './useSteamAccountStatus';

const MIN_TIME_BETWEEN_SYNCS_MS = 1 * 60 * 1000; // 1 minute

/**
 * Hook that automatically syncs Steam library in the background
 * - Runs on app open (after 500ms delay)
 * - Runs when app comes to foreground
 * - Checks if server already synced in background before triggering new sync
 */
export function useSteamAutoSync(userId: string | undefined) {
  const steamStatus = useSteamAccountStatus(userId);
  const lastSyncTimeRef = useRef<number>(0);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const queryClient = useQueryClient();
  const isLinked = steamStatus.data?.linked;

  /**
   * Invalidate queries to fetch fresh data from server
   */
  const refreshQueries = useCallback(() => {
    console.log('[useSteamAutoSync] Refreshing queries for fresh data...');
    queryClient.invalidateQueries({ queryKey: ['events'] });
    queryClient.invalidateQueries({ queryKey: ['currently-playing'] });
    queryClient.invalidateQueries({ queryKey: ['collection'] });
    queryClient.invalidateQueries({ queryKey: ['currentGame'] });
    queryClient.invalidateQueries({ queryKey: ['profile:playing'] });
  }, [queryClient]);

  /**
   * Check if server has completed a sync more recently than our last local sync
   */
  const checkServerSync = useCallback(async (): Promise<Date | null> => {
    if (!userId) return null;
    
    try {
      const { data } = await supabase
        .from('steam_sync_jobs')
        .select('updated_at')
        .eq('profile_id', userId)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      return data?.updated_at ? new Date(data.updated_at) : null;
    } catch {
      return null;
    }
  }, [userId]);

  const performSync = useCallback(async (force = false) => {
    // Don't sync if no user or Steam not linked
    if (!userId || !isLinked) {
      console.log('[useSteamAutoSync] Skipping sync (no user or Steam not linked)');
      return;
    }

    const now = Date.now();
    const timeSinceLastSync = now - lastSyncTimeRef.current;

    // Throttle: Don't sync if we synced recently (unless forced)
    if (!force && timeSinceLastSync < MIN_TIME_BETWEEN_SYNCS_MS) {
      console.log('[useSteamAutoSync] Skipping sync (too soon since last sync)');
      return;
    }

    try {
      // Check if server already synced in background
      const serverSyncTime = await checkServerSync();
      if (serverSyncTime && serverSyncTime.getTime() > lastSyncTimeRef.current) {
        console.log('[useSteamAutoSync] ✅ Server already synced at:', serverSyncTime.toISOString());
        lastSyncTimeRef.current = serverSyncTime.getTime();
        // Just refresh queries to get the new data
        refreshQueries();
        return;
      }

      console.log('[useSteamAutoSync] Starting background sync...');
      const result = await startSteamLibrarySync(false); // force=false
      
      // Verificar se foi bloqueado por throttle
      if (result?.status === 'throttled') {
        console.warn('[useSteamAutoSync] ⚠️ Sync throttled:', result.message);
        console.warn('[useSteamAutoSync] Next allowed in:', result.next_allowed_in_minutes, 'minutes');
        // Still refresh queries in case server synced
        refreshQueries();
        return;
      }
      
      // Sucesso: job foi enfileirado
      lastSyncTimeRef.current = now;
      console.log('[useSteamAutoSync] ✅ Sync queued successfully:', result);
      
      // Refresh queries after a delay to pick up new data
      setTimeout(refreshQueries, 3000);
    } catch (error: any) {
      // Silent fail - don't show alerts for background sync
      console.error('[useSteamAutoSync] ❌ Background sync failed:', error.message);
      // Still try to refresh queries
      refreshQueries();
    }
  }, [userId, isLinked, checkServerSync, refreshQueries]);

  useEffect(() => {
    // Only run if user exists and Steam is linked
    if (!userId || !isLinked) {
      return;
    }

    // Run immediately on mount (reduced delay from 2000ms to 500ms)
    const initialTimeout = setTimeout(() => {
      performSync();
    }, 500);

    // Listen to app state changes (sync on resume)
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const previousState = appState.current;
      appState.current = nextAppState;
      
      // Sync when app comes to foreground from background
      if (previousState.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[useSteamAutoSync] App came to foreground, checking for updates...');
        performSync();
      }
    });

    return () => {
      clearTimeout(initialTimeout);
      subscription.remove();
    };
  }, [userId, isLinked, performSync]);

  return {
    isLinked,
    performManualSync: () => performSync(true),
  };
}

