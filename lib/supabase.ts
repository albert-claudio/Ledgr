import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON!,
  {
    auth: {
      persistSession: true,
      storage: AsyncStorage as any,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  }
);

// Dev helper: log all Edge Function invocations to Metro terminal
if (__DEV__) {
  try {
    const originalInvoke = (supabase.functions as any).invoke.bind(supabase.functions);
    (supabase.functions as any).invoke = async (fnName: string, options?: any) => {
      try { console.log(`[fx] -> ${fnName}`, options?.body); } catch {}
      const res = await originalInvoke(fnName, options);
      if (res?.error) {
        const e: any = res.error;
        const details = {
          message: e?.message,
          name: e?.name,
          status: e?.context?.status,
          body: e?.context?.body,
          contextError: e?.context?.error,
        };
        try { console.error(`[fx] !! ${fnName}`, details); } catch {}
      } else {
        try { console.log(`[fx] <- ${fnName}`, res?.data); } catch {}
      }
      return res;
    };
  } catch {}
}
