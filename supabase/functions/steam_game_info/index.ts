// Supabase Edge Function: steam_game_info
// Deploy with: supabase functions deploy steam_game_info --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const STEAM_API_KEY = Deno.env.get('STEAM_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { appid } = await req.json();

    if (!appid) {
      return new Response(JSON.stringify({ error: 'Missing appid' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!STEAM_API_KEY) {
      return new Response(JSON.stringify({ error: 'Server misconfiguration: Missing STEAM_API_KEY' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch Game Schema from Steam
    const url = `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${STEAM_API_KEY}&appid=${appid}`;
    const res = await fetch(url);
    
    if (!res.ok) {
      // If Steam returns 400/403/404/500, we just return 0 achievements
      return new Response(JSON.stringify({ achievements_count: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    const stats = data?.game?.availableGameStats;
    const achievements = stats?.achievements || [];
    const count = achievements.length;

    return new Response(JSON.stringify({ achievements_count: count }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
