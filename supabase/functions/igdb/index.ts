import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TWITCH_CLIENT_ID = Deno.env.get("TWITCH_CLIENT_ID");
const TWITCH_CLIENT_SECRET = Deno.env.get("TWITCH_CLIENT_SECRET");
const DEEPL_API_KEY = Deno.env.get("DEEPL_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Inicializa cliente com permissão total (Service Role) para escrever no banco
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getAccessToken() {
  const params = new URLSearchParams();
  params.append("client_id", TWITCH_CLIENT_ID!);
  params.append("client_secret", TWITCH_CLIENT_SECRET!);
  params.append("grant_type", "client_credentials");

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: params,
  });

  const data = await res.json();
  return data.access_token;
}

// --- FUNÇÃO AUXILIAR: DEEPL ---
async function translateWithDeepL(texts: string[]): Promise<string[]> {
  if (texts.length === 0) return [];
  if (!DEEPL_API_KEY) {
    console.warn("DEEPL_API_KEY não configurada. Retornando texto original.");
    return texts;
  }

  const response = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: texts,
      target_lang: 'PT-BR'
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DeepL API Error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return data.translations.map((t: any) => t.text);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { endpoint, body } = await req.json();

    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
      throw new Error("Credenciais da Twitch não configuradas no Supabase.");
    }

    const token = await getAccessToken();
    const cleanEndpoint = (endpoint || "games").replace(/^\//, "");
    const url = `https://api.igdb.com/v4/${cleanEndpoint}`;

    console.log(`Calling IGDB: ${url}`);

    const igdbRes = await fetch(url, {
      method: "POST",
      headers: {
        "Client-ID": TWITCH_CLIENT_ID,
        "Authorization": `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body: body || "",
    });

    const text = await igdbRes.text();
    
    if (!igdbRes.ok) {
      console.error(`IGDB Error [${cleanEndpoint}]:`, text);
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let data: any[];
    try {
      data = text ? JSON.parse(text) : [];
    } catch (e) {
      console.warn(`Failed to parse IGDB response for ${cleanEndpoint}:`, text);
      data = [];
    }

    // --- LÓGICA DE TRADUÇÃO ---
    // Apenas se for endpoint de 'games' (ou similar) e tivermos um array de objetos com ID
    const isGameList = Array.isArray(data) && data.length > 0 && data[0].id;
    console.log(`[IGDB] Processing response. IsGameList: ${isGameList}, Items: ${data?.length}`);
    
    if (isGameList) {
      const gameIds = data.map((g: any) => g.id);
      console.log(`[IGDB] Game IDs: ${gameIds.join(',')}`);

      // 1. Buscar traduções existentes no banco (CACHE HIT)
      const { data: cachedTranslations, error } = await supabase
        .from('game_translations')
        .select('*')
        .in('game_id', gameIds)
        .eq('language', 'pt-BR');

      if (error) {
        console.error("[IGDB] Erro ao ler cache:", error);
      } else {
        console.log(`[IGDB] Cache hits: ${cachedTranslations?.length}`);
      }

      // 2. Processar jogos: Unir Cache ou Traduzir (CACHE MISS)
      // Limitamos a tradução aos primeiros 10 itens para evitar timeout/rate limit se a lista for grande
      const ITEMS_TO_TRANSLATE_LIMIT = 10;
      let translatedCount = 0;

      const finalGames = await Promise.all(data.map(async (game: any) => {
        // Se não tiver campos de texto, retorna original
        if (!game.summary && !game.storyline) {
            console.log(`[IGDB] Game ${game.id} has no summary/storyline to translate.`);
            return game;
        }

        // A. Tenta achar no cache
        const cached = cachedTranslations?.find(c => c.game_id === game.id);

        if (cached) {
          console.log(`[IGDB] Game ${game.id} found in cache.`);
          return {
            ...game,
            summary: cached.summary || game.summary,
            storyline: cached.storyline || game.storyline,
            is_translated: true
          };
        }

        // B. Se não achou, traduzir com DeepL (se dentro do limite)
        if (translatedCount >= ITEMS_TO_TRANSLATE_LIMIT) {
            console.log(`[IGDB] Game ${game.id} skipped (limit reached).`);
            return game;
        }
        translatedCount++;

        const hasSummary = game.summary && game.summary.length > 0;
        const hasStoryline = game.storyline && game.storyline.length > 0;

        let newSummary = game.summary;
        let newStoryline = game.storyline;

        try {
          console.log(`[IGDB] Translating Game ${game.id}...`);
          const textsToTranslate = [];
          if (hasSummary) textsToTranslate.push(game.summary);
          if (hasStoryline) textsToTranslate.push(game.storyline);

          const translatedTexts = await translateWithDeepL(textsToTranslate);
          console.log(`[IGDB] Translation success for Game ${game.id}`);

          let i = 0;
          if (hasSummary) newSummary = translatedTexts[i++];
          if (hasStoryline) newStoryline = translatedTexts[i++];

          // Salvar no Banco (sem await para não bloquear muito, mas cuidado com concorrência em serverless)
          // Em Deno Edge, é melhor dar await para garantir que o runtime não mate o processo
          await supabase.from('game_translations').insert({
            game_id: game.id,
            language: 'pt-BR',
            summary: newSummary,
            storyline: newStoryline
          }).then(() => console.log(`[IGDB] Saved Game ${game.id} to cache.`))
            .catch(err => console.error(`[IGDB] Error saving Game ${game.id} to cache:`, err));

          return {
            ...game,
            summary: newSummary,
            storyline: newStoryline,
            is_translated: 'fresh'
          };

        } catch (err) {
          console.error(`[IGDB] Falha ao traduzir game ${game.id}:`, err);
          return game; 
        }
      }));
      
      data = finalGames;
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Edge Function Error:", error);
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});