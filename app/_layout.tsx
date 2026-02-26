import { getSteamAuthState } from '@/lib/steamAuth';
import { supabase } from '@/lib/supabase';
import { AuthProvider } from '@/providers/AuthProvider';
import { NotificationsProvider } from '@/providers/NotificationsProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { Slot, usePathname, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-url-polyfill/auto'; // necessario p/ supabase

// Completa a sessao de auth do WebBrowser (expo-auth-session)
WebBrowser.maybeCompleteAuthSession();

// QueryClient with sensible defaults for better UX
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry failed requests 2 times with exponential backoff
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      // Keep data fresh for 2 minutes by default
      staleTime: 1000 * 60 * 2,
      // Keep unused data in cache for 5 minutes
      gcTime: 1000 * 60 * 5,
      // Don't refetch on window focus (mobile doesn't have this concept)
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
    },
  },
});
const LAST_ROUTE_KEY = 'ledgr:last-route';
const EVER_LOGGED_KEY = 'ledgr:ever-logged-in';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const navigationState = useRootNavigationState();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasRestoredRoute, setHasRestoredRoute] = useState(false);
  const [ignoreAuthRedirect, setIgnoreAuthRedirect] = useState(false);
  const [everLogged, setEverLogged] = useState<boolean | null>(null);

  // Carrega a sessao inicial e flag de login persistente
  useEffect(() => {
    const loadSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
      } catch (error) {
        console.error('Erro ao carregar sessao:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const loadEverLogged = async () => {
      try {
        const raw = await AsyncStorage.getItem(EVER_LOGGED_KEY);
        setEverLogged(raw === '1');
      } catch {
        setEverLogged(false);
      }
    };

    loadSession();
    loadEverLogged();
  }, []);

  // Listener para mudancas de autenticacao
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session) {
        AsyncStorage.setItem(EVER_LOGGED_KEY, '1').catch(() => null);
        setEverLogged(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Gerencia o redirecionamento baseado na autenticacao
  useEffect(() => {
    if (!navigationState?.key || isLoading || everLogged === null) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isSteamAuthScreen = pathname?.endsWith('/steam-auth');
    const isResetPassword = pathname?.includes('reset-password');

    if (!session && !inAuthGroup && !ignoreAuthRedirect && !isSteamAuthScreen) {
      // Se nao ha sessao e nao esta na tela de auth, redireciona para login
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup && !isResetPassword) {
      const t = setTimeout(() => router.replace('/(tabs)'), 2000);
      return () => clearTimeout(t);
    }
  }, [session, segments, navigationState?.key, isLoading, everLogged, ignoreAuthRedirect, pathname]);

  // Recupera a ultima rota visitada antes de renderizar o app
  useEffect(() => {
    if (!navigationState?.key || isLoading || hasRestoredRoute) {
      return;
    }

    let isActive = true;

    const restoreRoute = async () => {
      try {
        // If the app was opened via deep link (Expo Go exp:// or scheme), handle first
        const initialUrl = await Linking.getInitialURL();
        if (!isActive) return;
        if (initialUrl) {
          const parsed = Linking.parse(initialUrl);
          const basePath = (parsed?.path || '').replace(/^\/+/, '');

          // Robust extractor: supports nested redirected URLs (url/redirect param)
          const tryExtract = (urlStr: string) => {
            try {
              const p: any = Linking.parse(urlStr) || {};
              const qp: any = p.queryParams || {};
              let steamid: string | undefined = qp.steamid ? String(qp.steamid) : undefined;
              let state: string | undefined = qp.state ? String(qp.state) : undefined;
              const nested = (qp.url as string | undefined) || (qp.redirect as string | undefined);
              if ((!steamid || !state) && nested) {
                try {
                  const decoded = decodeURIComponent(nested);
                  const np: any = Linking.parse(decoded) || {};
                  const nqp: any = np.queryParams || {};
                  steamid = steamid || (nqp.steamid as string | undefined) || undefined;
                  state = state || (nqp.state as string | undefined) || undefined;
                } catch {}
              }
              if (!steamid || !state) {
                try {
                  const raw = urlStr.split('#').pop() || urlStr.split('?').pop() || '';
                  const sp = new URLSearchParams(raw);
                  steamid = steamid || sp.get('steamid') || undefined;
                  state = state || sp.get('state') || undefined;
                } catch {}
              }
              const path = (p?.path || '').replace(/^\/+/, '');
              return { path, steamid, state } as { path: string; steamid?: string; state?: string };
            } catch {
              return { path: '' } as any;
            }
          };

          const primary = tryExtract(initialUrl);
          const hitSteamAuth = primary.path.endsWith('steam-auth') || basePath.endsWith('steam-auth');
          if (hitSteamAuth) {
            const stored = await getSteamAuthState();
            const stateFromLink = primary.state;
            if (stored && stored.state && stateFromLink && stored.state === stateFromLink) {
              const params = new URLSearchParams();
              if (primary.steamid) params.set('steamid', primary.steamid);
              if (stateFromLink) params.set('state', stateFromLink);
              const query = params.toString();
              const dest = query ? `/steam-auth?${query}` : '/steam-auth';
              setIgnoreAuthRedirect(true);
              if (dest !== pathname) {
                router.replace(dest as never);
              }
              setHasRestoredRoute(true);
              return;
            }
          }
        }

        const savedRoute = await AsyncStorage.getItem(LAST_ROUTE_KEY);
        if (!isActive) return;
        if (!savedRoute) return;
        if (!savedRoute.startsWith('/')) {
          await AsyncStorage.removeItem(LAST_ROUTE_KEY);
          return;
        }

        const restoringTabsWithoutSession = !session && savedRoute.startsWith('/(tabs)');
        const restoringAuthWithSession = session && savedRoute.startsWith('/(auth)');
        if (restoringTabsWithoutSession || restoringAuthWithSession) {
          return;
        }

        if (savedRoute !== pathname) {
          router.replace(savedRoute as never);
        }
      } catch (error) {
        console.warn('Falha ao restaurar rota persistida:', error);
        await AsyncStorage.removeItem(LAST_ROUTE_KEY).catch(() => null);
      } finally {
        if (isActive) {
          setHasRestoredRoute(true);
        }
      }
    };

    restoreRoute();

    return () => {
      isActive = false;
    };
  }, [navigationState?.key, isLoading, session, pathname, hasRestoredRoute, router]);

  // Also listen for runtime deep links (e.g., Expo Go firing the event after reload)
  useEffect(() => {
    let active = true;
    const onUrl = async ({ url }: { url: string }) => {
      if (!active || !url) return;
      try {
        const parsed = Linking.parse(url);
        const basePath = (parsed?.path || '').replace(/^\/+/, '');
        const tryExtract = (urlStr: string) => {
          try {
            const p: any = Linking.parse(urlStr) || {};
            const qp: any = p.queryParams || {};
            let steamid: string | undefined = qp.steamid ? String(qp.steamid) : undefined;
            let state: string | undefined = qp.state ? String(qp.state) : undefined;
            const nested = (qp.url as string | undefined) || (qp.redirect as string | undefined);
            if ((!steamid || !state) && nested) {
              try {
                const decoded = decodeURIComponent(nested);
                const np: any = Linking.parse(decoded) || {};
                const nqp: any = np.queryParams || {};
                steamid = steamid || (nqp.steamid as string | undefined) || undefined;
                state = state || (nqp.state as string | undefined) || undefined;
              } catch {}
            }
            if (!steamid || !state) {
              try {
                const raw = urlStr.split('#').pop() || urlStr.split('?').pop() || '';
                const sp = new URLSearchParams(raw);
                steamid = steamid || sp.get('steamid') || undefined;
                state = state || sp.get('state') || undefined;
              } catch {}
            }
            const path = (p?.path || '').replace(/^\/+/, '');
            return { path, steamid, state } as { path: string; steamid?: string; state?: string };
          } catch {
            return { path: '' } as any;
          }
        };
        const primary = tryExtract(url);
        const hitSteamAuth = primary.path.endsWith('steam-auth') || basePath.endsWith('steam-auth');
        if (!hitSteamAuth) return;
        const stored = await getSteamAuthState();
        const stateFromLink = primary.state;
        if (stored && stored.state && stateFromLink && stored.state === stateFromLink) {
          const params = new URLSearchParams();
          if (primary.steamid) params.set('steamid', primary.steamid);
          if (stateFromLink) params.set('state', stateFromLink);
          const query = params.toString();
          const dest = query ? `/steam-auth?${query}` : '/steam-auth';
          if (dest !== pathname) {
            router.replace(dest as never);
          }
          setHasRestoredRoute(true);
        }
      } catch {}
    };
    const sub = Linking.addEventListener('url', onUrl);
    return () => {
      active = false;
      try { (sub as any)?.remove?.(); } catch {}
    };
  }, [pathname, router]);


  // Persiste a rota atual para restaurar no proximo boot (opcional, desabilitado para evitar conflitos com deep link no Expo Go)
  // useEffect(() => {
  //   if (!navigationState?.key || !pathname || !hasRestoredRoute) return;
  //   AsyncStorage.setItem(LAST_ROUTE_KEY, pathname).catch(() => null);
  // }, [pathname, navigationState?.key, hasRestoredRoute]);

  // Removido o controle manual do SplashScreen para evitar atrasos/recargas indesejadas no Expo Go.

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AuthProvider>
          <NotificationsProvider>
            <Slot />
          </NotificationsProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
