// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function: IGDB proxy
// Deploy with: supabase functions deploy igdb --no-verify-jwt

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type ProxyPayload = {
  endpoint: string; // e.g., 'games', 'screenshots'
  body: string; // IGDB query string
};

const TWITCH_CLIENT_ID = Deno.env.get('TWITCH_CLIENT_ID');
const TWITCH_CLIENT_SECRET = Deno.env.get('TWITCH_CLIENT_SECRET');
const IGDB_BASE_URL = 'https://api.igdb.com/v4';

let cachedToken: { token: string | null; expiresAt: number } = {
  token: null,
  expiresAt: 0,
};

const now = () => Date.now();

async function getTwitchToken(): Promise<string> {
  if (cachedToken.token && cachedToken.expiresAt > now() + 60_000) {
    return cachedToken.token as string;
  }
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    throw new Error('Missing Twitch credentials on server (set secrets TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET)');
  }
  const params = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    client_secret: TWITCH_CLIENT_SECRET,
    grant_type: 'client_credentials',
  });
  const r = await fetch(`https://id.twitch.tv/oauth2/token?${params.toString()}`, { method: 'POST' });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`Twitch token error: ${r.status} ${t}`);
  }
  const data = await r.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: now() + Math.max(0, (data.expires_in - 60) * 1000),
  };
  return cachedToken.token as string;
}

async function handleProxy(req: Request): Promise<Response> {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const payload = await req.json() as ProxyPayload;
    if (!payload?.endpoint || typeof payload?.body !== 'string') {
      return json({ error: 'Invalid payload' }, 400);
    }
    const token = await getTwitchToken();
    const igdbRes = await fetch(`${IGDB_BASE_URL}/${payload.endpoint}`, {
      method: 'POST',
      headers: {
        'Client-ID': TWITCH_CLIENT_ID as string,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'text/plain',
      },
      body: payload.body,
    });
    const text = await igdbRes.text();
    const respHeaders = { ...corsHeaders, 'Content-Type': igdbRes.headers.get('Content-Type') || 'application/json' };
    if (!igdbRes.ok) {
      return new Response(text, { status: igdbRes.status, headers: respHeaders });
    }
    return new Response(text, { status: 200, headers: respHeaders });
  } catch (e: any) {
    return json({ error: e?.message || 'Unknown error' }, 500);
  }
}

const corsHeaders: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

serve(handleProxy);

