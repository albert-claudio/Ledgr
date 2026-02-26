import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFollowStats, listRecentFollowers } from '@/services/follows';

type NotificationItem = {
  id: string;
  ts: number;
  title?: string;
  body?: string;
  key?: string;
};

type NotificationsContextType = {
  unseenCount: number;
  hasUpdates: boolean;
  notifications: NotificationItem[];
  markAllSeen: () => void;
  addNotification: (n: Partial<NotificationItem> & { title?: string; body?: string; key?: string }) => void;
};

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unseenCount, setUnseenCount] = useState<number>(0);
  const [followerCount, setFollowerCount] = useState<number>(0);
  const { user } = useAuth();
  const uid = user?.id;
  useEffect(() => {
    setNotifications([]);
    setUnseenCount(0);
  }, [uid]);
  // Offline sync: compute unseen followers since last seen count
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!uid) return;
      try {
        const key = `notifications:${uid}:seenFollowers`;
        const raw = await AsyncStorage.getItem(key);
        const seen = raw ? parseInt(raw) : 0;
        const stats = await getFollowStats(uid);
        const total = stats.followers || 0;
        if (cancelled) return;
        setFollowerCount(total);
        const delta = Math.max(0, total - (Number.isFinite(seen) ? seen : 0));
        if (delta > 0) {
          setUnseenCount(delta);
          try {
            const recents = await listRecentFollowers(uid, Math.min(5, delta));
            if (!cancelled) {
              const now = Date.now();
              const items = recents.map((r) => ({
                id: `${now}-${r.id}-${Math.random().toString(36).slice(2)}`,
                ts: now,
                title: 'Novo seguidor',
                body: r.username ? `@${r.username} começou a seguir você` : 'Você tem um novo seguidor',
                key: 'follow:new',
              }));
              setNotifications(items);
            }
          } catch {}
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [uid]);
  // Realtime: new followers
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let channel2: ReturnType<typeof supabase.channel> | null = null;
    if (!uid) return;
    channel = supabase
      .channel(`follows:me:${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'follows', filter: `following_id=eq.${uid}` }, async (payload) => {
        try {
          const followerId = (payload.new as any)?.follower_id as string | undefined;
          if (!followerId) return;
          const { data: prof } = await supabase.from('profiles').select('username').eq('id', followerId).maybeSingle();
          const uname = (prof?.username || '').trim();
          setUnseenCount((c) => c + 1);
          setNotifications((list) => [
            { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, ts: Date.now(), title: 'Novo seguidor', body: uname ? `@${uname} começou a seguir você` : 'Você tem um novo seguidor', key: 'follow:new' },
            ...list,
          ].slice(0, 50));
        } catch {}
      })
      .subscribe();
    // Fallback subscription that does not depend on profile read
    channel2 = supabase
      .channel(`follows:me:fallback:${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'follows', filter: `following_id=eq.${uid}` }, async (_payload) => {
        // Add a generic notification in case profile fetch is blocked or fails
        const now = Date.now();
        setNotifications((list) => {
          const recentFollow = list.some((n) => n.key === 'follow:new' && (now - (n.ts || 0)) < 2000);
          if (recentFollow) return list; // primary handler already added
          setUnseenCount((c) => c + 1);
          return [
            { id: `${now}-${Math.random().toString(36).slice(2)}`, ts: now, title: 'Novo seguidor', body: 'Você tem um novo seguidor', key: 'follow:new' },
            ...list,
          ].slice(0, 50);
        });
      })
      .subscribe();
    return () => { if (channel) supabase.removeChannel(channel); if (channel2) supabase.removeChannel(channel2); };
  }, [uid]);

  // Subscribe to React Query cache updates and flag updates
  useEffect(() => {
    const AUTO_FROM_QUERIES = false; // ativar no futuro se quiser alimentar via queries
    if (!AUTO_FROM_QUERIES) return;
    const unsubscribe = qc.getQueryCache().subscribe((event) => {
      try {
        if (event?.type === 'updated') {
          const q = (event as any).query;
          const status: string | undefined = q?.state?.status;
          if (status === 'success') {
            const key0 = Array.isArray(q?.queryKey) ? q.queryKey[0] : undefined;
            const key = typeof key0 === 'string' ? key0 : undefined;
            if (key && (key.startsWith('igdb:') || key.startsWith('steam:') || key.startsWith('profile:'))) {
              setUnseenCount((c) => c + 1);
              setNotifications((list) => [
                { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, ts: Date.now(), title: 'Atualização de dados', body: key, key },
                ...list,
              ].slice(0, 50));
            }
          }
        }
      } catch {}
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [qc]);

  const addNotification: NotificationsContextType['addNotification'] = (n) => {
    const item: NotificationItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ts: Date.now(),
      title: n.title,
      body: n.body,
      key: n.key,
    };
    setNotifications((list) => [item, ...list].slice(0, 50));
    setUnseenCount((c) => c + 1);
  };

  const markAllSeen = () => {
    if (uid) {
      const key = `notifications:${uid}:seenFollowers`;
      AsyncStorage.setItem(key, String((followerCount || 0) + (unseenCount || 0))).catch(() => {});
    }
    setUnseenCount(0);
  };

  const value = useMemo<NotificationsContextType>(() => ({
    unseenCount,
    hasUpdates: unseenCount > 0,
    notifications,
    markAllSeen,
    addNotification,
  }), [unseenCount, notifications]);

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
