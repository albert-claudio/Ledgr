import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || (Constants.expoConfig?.extra as any)?.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_FUNCTIONS_URL = process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL || (Constants.expoConfig?.extra as any)?.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL;
const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON || (Constants.expoConfig?.extra as any)?.EXPO_PUBLIC_SUPABASE_ANON;

export const getEdgeFunctionUrl = (fnName: string): string => {
  if (SUPABASE_FUNCTIONS_URL) {
    const base = SUPABASE_FUNCTIONS_URL.replace(/\/$/, '');
    return `${base}/${fnName}`;
  }
  if (!SUPABASE_URL) throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL');
  try {
    const u = new URL(SUPABASE_URL);
    const host = u.host;
    if (host.endsWith('.supabase.co')) {
      const functionsHost = host.replace('.supabase.co', '.functions.supabase.co');
      return `${u.protocol}//${functionsHost}/${fnName}`;
    }
    // Fallback: append /functions/v1
    return `${u.origin}/functions/v1/${fnName}`;
  } catch (e) {
    throw new Error('Invalid EXPO_PUBLIC_SUPABASE_URL');
  }
};

export async function callEdgeFunction(url: string, payload: any) {
  if (__DEV__) {
    try { console.log(`[fx:fetch] -> ${url}`, payload); } catch {}
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(SUPABASE_ANON ? { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (__DEV__) {
      try { console.error(`[fx:fetch] !! ${url}`, { status: res.status, body: text }); } catch {}
    }
    throw new Error(`Edge function error: ${res.status} ${text}`);
  }
  const json = await res.json().catch(() => ({}));
  if (__DEV__) {
    try { console.log(`[fx:fetch] <- ${url}`, json); } catch {}
  }
  return json;
}

// Preferred cross-platform way to invoke Supabase edge functions in-app.
// Uses the configured `supabase` client and passes body JSON.
export async function invokeFunction(fnName: string, payload: any) {
  if (__DEV__) {
    try { console.log(`[fx] -> ${fnName}`, payload); } catch {}
  }
  const { data, error } = await supabase.functions.invoke(fnName, {
    body: payload,
  });
  if (error) {
    const details: any = {
      message: (error as any)?.message,
      name: (error as any)?.name,
      status: (error as any)?.context?.status,
      body: (error as any)?.context?.body,
      contextError: (error as any)?.context?.error,
    };
    if (__DEV__) {
      try { console.error(`[fx] !! ${fnName}`, details); } catch {}
    }
    throw error;
  }
  if (__DEV__) {
    try { console.log(`[fx] <- ${fnName}`, data); } catch {}
  }
  return data as any;
}
