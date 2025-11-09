import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { handleOAuthRedirect } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const { code, error_description } = useLocalSearchParams<{
    code?: string;
    error_description?: string;
  }>();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Prefer exchanging with params present on the route (warm start)
        if (typeof error_description === 'string' && error_description) {
          throw new Error(decodeURIComponent(error_description));
        }
        if (typeof code === 'string' && code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          // Fallback for cold starts: parse the initial deep link URL
          const initial = await Linking.getInitialURL();
          await handleOAuthRedirect(initial ?? undefined);
        }
      } catch (e) {
        // swallow; onAuthStateChange will reflect state
      } finally {
        if (mounted) router.replace('/(tabs)');
      }
    })();
    return () => { mounted = false; };
  }, [router, code, error_description]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
      <ActivityIndicator color="#4DD4D9" />
    </View>
  );
}
