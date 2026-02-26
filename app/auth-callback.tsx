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
        // Prefer exchanging with params on the route (warm start)
        if (typeof error_description === 'string' && error_description) {
          throw new Error(decodeURIComponent(error_description));
        }
        let handled = false;
        if (!handled && typeof code === 'string' && code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) handled = true; else throw error;
        }
        if (!handled) {
          const initial = await Linking.getInitialURL();
          const url = initial || '';
          if (url) {
            const q = url.split('?')[1] || '';
            const params = new URLSearchParams(q);
            const tokenHash = params.get('token_hash') || params.get('token') || '';
            const email = params.get('email') || undefined;
            const typ = (params.get('type') || 'signup') as any;
            if (tokenHash) {
              let err: any = null;
              try { const { error } = await supabase.auth.verifyOtp({ type: typ, token_hash: tokenHash } as any); if (error) err = error; else handled = true; } catch (e: any) { err = e; }
              if (!handled) { try { const { error } = await supabase.auth.verifyOtp({ type: typ, token: tokenHash, email } as any); if (error) err = error; else handled = true; } catch (e: any) { err = e; } }
              if (!handled && err) throw err;
            } else if (url) {
              await handleOAuthRedirect(url);
              handled = true;
            }
          }
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


