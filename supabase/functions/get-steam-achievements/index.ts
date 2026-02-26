import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { steamAppId } = await req.json()
    
    // 1. Pegar o usuário logado
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Usuário não autenticado')

    // 2. Pegar o Steam ID do usuário na sua tabela de perfis
    // Ajuste 'profiles' e 'steam_id' conforme o nome da sua tabela
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('steam_id')
      .eq('id', user.id)
      .single()

    if (!profile?.steam_id) {
      return new Response(JSON.stringify({ error: 'Steam ID não vinculado' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404 
      })
    }

    // 3. Chamar a API da Steam
    const STEAM_KEY = Deno.env.get('STEAM_API_KEY') // Configure isso nos Secrets do Supabase
    const steamResponse = await fetch(
      `http://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid=${steamAppId}&key=${STEAM_KEY}&steamid=${profile.steam_id}`
    )
    
    const steamData = await steamResponse.json()

    // Verificações de erro da Steam (ex: perfil privado ou jogo sem troféus)
    if (!steamData.playerstats || !steamData.playerstats.achievements) {
       // Se o jogo não tiver conquistas ou falhar, retorna 0
       return new Response(JSON.stringify({ unlocked: 0, total: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Calcular conquistas
    const achievements = steamData.playerstats.achievements
    const unlockedCount = achievements.filter((a: any) => a.achieved === 1).length
    const totalCount = achievements.length

    return new Response(JSON.stringify({ 
      unlocked: unlockedCount, 
      total: totalCount 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})