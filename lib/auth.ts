import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';

// Ensure WebBrowser completes pending auth sessions on iOS
WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider =
  | 'apple'
  | 'google'
  | 'github'
  | 'gitlab'
  | 'bitbucket'
  | 'discord'
  | 'facebook'
  | 'twitch'
  | 'twitter'
  | 'spotify'
  | 'slack';

const getRedirectUrl = () => {
  // Uses app.json `scheme` + path to build deep link (e.g., ledgr://auth-callback)
  return Linking.createURL('auth-callback');
};

export async function signInWithOAuth(provider: OAuthProvider, scopes?: string[]) {
  const redirectTo = getRedirectUrl();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      // Important for React Native: we will open the returned URL ourselves
      skipBrowserRedirect: true,
      scopes: scopes?.join(' '),
    },
  });

  if (error) throw error;
  if (!data?.url) throw new Error('Auth URL ausente do provedor.');

  // Open provider auth page and wait for redirect back to our scheme
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === 'success' && result.url) {
    const code = getQueryParam(result.url, 'code');
    const errorDescription = getQueryParam(result.url, 'error_description');
    if (errorDescription) throw new Error(decodeURIComponent(errorDescription));
    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;
      return true;
    }
  }

  if (result.type === 'cancel') throw new Error('Autenticação cancelada.');
  throw new Error('Falha ao autenticar.');
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getActiveSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

// Handle deep links when app is opened via URL (cold start or background)
export async function handleOAuthRedirect(url?: string) {
  if (!url) return;
  const code = getQueryParam(url, 'code');
  const errorDescription = getQueryParam(url, 'error_description');
  if (errorDescription) throw new Error(decodeURIComponent(errorDescription));
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  }
}

function getQueryParam(url: string, key: string): string | null {
  try {
    const hasHash = url.includes('#');
    const queryString = hasHash ? url.split('#')[1] : url.split('?')[1];
    if (!queryString) return null;
    const params = new URLSearchParams(queryString);
    return params.get(key);
  } catch {
    return null;
  }
}
