import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Input tipo para jogos com nome (para validação)
type GameInput = {
  appid: number;
  steam_name?: string;
};

type Body = {
  appid?: number;
  appids?: number[];
  games?: GameInput[]; // NOVO: formato com nomes para validação
  from_recent?: boolean;
  limit?: number;
  upsert_user_games?: boolean;
  status?: "playing" | "completed" | "paused" | "dropped" | "wishlist";
};

// Função de similaridade de strings usando Dice coefficient
// Eficaz para detectar nomes parecidos mesmo com pequenas diferenças
function stringSimilarity(str1: string, str2: string): number {
  // Normaliza: lowercase e remove caracteres especiais
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const s1 = normalize(str1);
  const s2 = normalize(str2);
  
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;
  
  // Cria bigrams do primeiro string
  const bigrams1 = new Map<string, number>();
  for (let i = 0; i < s1.length - 1; i++) {
    const bigram = s1.substring(i, i + 2);
    bigrams1.set(bigram, (bigrams1.get(bigram) || 0) + 1);
  }
  
  // Conta interseções com o segundo string
  let intersectionSize = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    const bigram = s2.substring(i, i + 2);
    const count = bigrams1.get(bigram) || 0;
    if (count > 0) {
      bigrams1.set(bigram, count - 1);
      intersectionSize++;
    }
  }
  
  return (2.0 * intersectionSize) / (s1.length - 1 + s2.length - 1);
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Use internal 'igdb' Edge Function (auto-renew Twitch token)

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const respondError = (code: string, message: string, status = 400) => respond({ error: code, message }, status);

async function igdbQueryViaFunction(supabase: ReturnType<typeof createClient>, endpoint: string, query: string) {
  const { data, error } = await supabase.functions.invoke("igdb", { body: { endpoint, body: query } });
  if (error) {
    const ctx = (error as any)?.message || (error as any)?.context?.error || "unknown";
    throw new Error(`IGDB function error: ${ctx}`);
  }
  return data as any;
}

// No direct IGDB fallback; rely solely on 'igdb' function

async function mapSingleApp(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  appid: number,
  steamName: string | null, // NOVO: nome do jogo vindo da Steam para validação
  upsertUserGame: boolean,
  status: Body["status"],
) {
  // 1) Resolve IGDB game id via external_games, fallback to websites.url
  let igdbId: number | null = null;
  let matchMethod: 'external_games' | 'website' | null = null;
  
  try {
    const extRows = await igdbQueryViaFunction(
      supabase,
      "external_games",
      `fields game,uid,category; where uid = "${appid}" & category = 1; limit 1;`,
    );
    const ext = Array.isArray(extRows) ? extRows[0] : null;
    if (ext?.game) {
      igdbId = Number(ext.game);
      matchMethod = 'external_games';
    }
  } catch (_) { /* ignore and try websites */ }
  
  if (!igdbId) {
    const gRows = await igdbQueryViaFunction(
      supabase,
      "games",
      `fields id,name,cover.image_id,websites.url; where websites.url ~ *"store.steampowered.com/app/${appid}"*; limit 1;`,
    );
    const g = Array.isArray(gRows) ? gRows[0] : null;
    if (g?.id) {
      igdbId = Number(g.id);
      matchMethod = 'website';
    }
  }
  
  if (!igdbId) {
    return { appid, mapped: false, reason: "not_found" };
  }

  // 2) Fetch game details FIRST to get the IGDB name for validation
  const detailsRows: any[] = await igdbQueryViaFunction(supabase, "games", `fields id,name,cover.image_id; where id = ${igdbId}; limit 1;`);
  const d = Array.isArray(detailsRows) ? detailsRows[0] : null;
  const igdbName: string = d?.name || `IGDB ${igdbId}`;
  const coverId: string | null = (d?.cover?.image_id as string | undefined) || null;

  // 3) NOVA VALIDAÇÃO: Se temos o nome da Steam, validar contra IGDB
  const MIN_SIMILARITY = 0.5; // 50% de similaridade mínima
  if (steamName && igdbName) {
    const similarity = stringSimilarity(steamName, igdbName);
    console.log(`[steam_map_igdb] Name validation: "${steamName}" vs "${igdbName}" = ${(similarity * 100).toFixed(1)}%`);
    
    if (similarity < MIN_SIMILARITY) {
      console.warn(`[steam_map_igdb] ⚠️ REJECTING mapping - low similarity: Steam ${appid} ("${steamName}") → IGDB ${igdbId} ("${igdbName}")`);
      return { 
        appid, 
        mapped: false, 
        reason: "name_mismatch", 
        steam_name: steamName, 
        igdb_name: igdbName, 
        similarity: Math.round(similarity * 100) 
      };
    }
  }

  // 4) Save mapping to steam_igdb_mappings (only after validation passes)
  let confidence = matchMethod === 'external_games' ? 95 : 80;
  // Reduce confidence if no name validation was performed
  if (!steamName) {
    confidence = Math.max(50, confidence - 20);
    console.log(`[steam_map_igdb] No Steam name provided - reduced confidence to ${confidence}`);
  }
  
  const nowIso = new Date().toISOString();
  
  try {
    await supabase
      .from("steam_igdb_mappings")
      .upsert(
        { 
          steam_appid: appid, 
          igdb_id: igdbId,
          confidence: confidence,
          last_verified_at: nowIso
        },
        { onConflict: "steam_appid" }
      );
    console.log(`[steam_map_igdb] ✓ Saved mapping: Steam ${appid} ("${steamName || 'unknown'}") → IGDB ${igdbId} ("${igdbName}") [confidence: ${confidence}]`);
  } catch (e: any) {
    console.error(`[steam_map_igdb] Failed to save mapping:`, e.message);
    // Continue anyway - mapping save is not critical
  }

  // Use validated name for storage
  const name = igdbName;

  // 3) Upsert into games by igdb_id
  const { data: gameRow, error: gameErr } = await supabase
    .from("games")
    .upsert({ igdb_id: igdbId, name, cover_image_id: coverId }, { onConflict: "igdb_id" })
    .select("id, igdb_id")
    .single();
  if (gameErr) throw gameErr;
  const gameId = (gameRow as any)?.id as number;

  // 4) Optionally, create/update user_games row for this game (enrich with Steam play history)
  if (upsertUserGame) {
    let minutes = 0;
    let lastSession: string | null = null;
    try {
      const { data: sg } = await supabase
        .from("steam_user_games")
        .select("playtime_forever, last_played")
        .eq("profile_id", userId)
        .eq("steam_appid", appid)
        .maybeSingle();
      minutes = Number((sg as any)?.playtime_forever ?? 0) || 0;
      lastSession = (sg as any)?.last_played ?? null;
    } catch {}
    const { error: ugErr } = await supabase
      .from("user_games")
      .upsert({ profile_id: userId, game_id: gameId, status: status || "playing", minutes_played: minutes, last_session_at: lastSession }, { onConflict: "profile_id,game_id" });
    if (ugErr) throw ugErr;
  }

  // 5) Return mapped info
  return { appid, mapped: true, igdb_id: igdbId, game_id: gameId, name, cover_image_id: coverId };
}

serve(async (req) => {
  if (req.method !== "POST") return respondError("method_not_allowed", "Use POST", 405);

  // IGDB credentials are managed by the dedicated 'igdb' function.
  // This function should not reference IGDB_CLIENT_ID/IGDB_ACCESS_TOKEN directly.

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  let body: Body = {} as any;
  try { if (req.headers.get("content-type")?.includes("application/json")) body = await req.json(); } catch {}

  let userId: string | null = null;
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    userId = user.id;
  } else if ((body as any).profile_id) {
    // Admin override (internal call)
    userId = (body as any).profile_id;
    console.log(`[steam_map_igdb] Admin override for profile ${userId}`);
  }

  if (!userId) return respondError("not_authenticated", "Faça login para mapear jogos.", 401);

  const upsertUserGame = !!body?.upsert_user_games;
  const status = (body?.status as Body["status"]) || "playing";
  const limit = Math.max(1, Math.min(50, Number(body?.limit) || 12));

  // NOVO: Suporta formato games[] com nomes para validação
  let gamesToMap: GameInput[] = [];
  
  if (Array.isArray(body?.games) && body!.games!.length > 0) {
    // NOVO formato com nomes para validação
    gamesToMap = body!.games!.map((g: any) => ({
      appid: Number(g.appid),
      steam_name: g.steam_name || null
    })).filter((g: GameInput) => Number.isFinite(g.appid));
    console.log(`[steam_map_igdb] Using new format with ${gamesToMap.length} games with names`);
  } else if (Array.isArray(body?.appids) && body!.appids!.length > 0) {
    // Formato legado - apenas appids
    gamesToMap = (body!.appids! as any[])
      .map((x) => Number(x))
      .filter(Number.isFinite)
      .map(appid => ({ appid, steam_name: undefined }));
    console.log(`[steam_map_igdb] Using legacy format with ${gamesToMap.length} appids (no names)`);
  } else if (Number.isFinite(body?.appid)) {
    gamesToMap = [{ appid: Number(body!.appid!), steam_name: undefined }];
  } else if (body?.from_recent) {
    const { data: rows, error } = await supabase
      .from("steam_user_games")
      .select("steam_appid, playtime_forever, last_played")
      .eq("profile_id", userId)
      .gt("playtime_forever", 0)
      .order("last_played", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) return respondError("db_error", "Erro ao carregar jogos recentes da Steam.", 500);
    
    // Para from_recent, busca os nomes do steam_apps se disponíveis
    const appids = Array.from(new Set((rows || []).map((r: any) => Number(r.steam_appid)).filter(Number.isFinite)));
    
    if (appids.length > 0) {
      const { data: steamApps } = await supabase
        .from("steam_apps")
        .select("appid, name")
        .in("appid", appids);
      
      const nameMap = new Map<number, string>((steamApps || []).map((a: any) => [a.appid, a.name]));
      gamesToMap = (appids as number[]).map((appid) => ({ 
        appid, 
        steam_name: nameMap.get(appid) || undefined 
      }));
    }
  } else {
    return respondError("invalid_request", "Informe 'appid', 'appids', 'games' ou 'from_recent'.", 400);
  }

  if (gamesToMap.length === 0) return respond({ mapped: [] });

  const results: any[] = [];
  for (const game of gamesToMap) {
    try {
      const mapped = await mapSingleApp(supabase, userId, game.appid, game.steam_name || null, upsertUserGame, status);
      results.push(mapped);
      // Tiny delay to be gentle with IGDB
      await new Promise((r) => setTimeout(r, 150));
    } catch (e: any) {
      console.error("[steam_map_igdb] map error", { appid: game.appid, message: e?.message });
      results.push({ appid: game.appid, mapped: false, reason: "error", message: e?.message || "unknown" });
    }
  }

  return respond({ mapped: results });
});
