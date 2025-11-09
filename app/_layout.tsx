import { Slot, SplashScreen, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import 'react-native-url-polyfill/auto'; // necessário p/ supabase
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/providers/AuthProvider';
import { NotificationsProvider } from '@/providers/NotificationsProvider';
import * as WebBrowser from 'expo-web-browser';

// Previne o SplashScreen de esconder automaticamente
SplashScreen.preventAutoHideAsync();
WebBrowser.maybeCompleteAuthSession();

const queryClient = new QueryClient();

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Carrega a sessão inicial
  useEffect(() => {
    const loadSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
      } catch (error) {
        console.error('Erro ao carregar sessão:', error);
      } finally {
        setIsLoading(false);
        // Esconde o SplashScreen após carregar
        await SplashScreen.hideAsync();
      }
    };

    loadSession();
  }, []);

  // Listener para mudanças de autenticação
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Gerencia o redirecionamento baseado na autenticação
  useEffect(() => {
    if (!navigationState?.key || isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';

    if (!session && !inAuthGroup) {
      // Se não há sessão e não está na tela de auth, redireciona para login
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      const t = setTimeout(() => router.replace('/(tabs)'), 2000);
      return () => clearTimeout(t);
    }
  }, [session, segments, navigationState?.key, isLoading]);

  // Não renderiza nada enquanto carrega
  if (isLoading) {
    return null;
  }

    return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationsProvider>
          <Slot />
        </NotificationsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}


