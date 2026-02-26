import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Body = {
  steamIdOrVanity?: string;
  saveToDb?: boolean;
  includeWishlist?: boolean;
};

type SteamPlayer = {
  steamid: string;
  personaname?: string;
  avatar?: string;
  avatarmedium?: string;
  avatarfull?: string;
  realname?: string;
  communityvisibilitystate?: number;
  loccountrycode?: string;
  lastlogoff?: number;
};

type SteamGame = {
  appid: number;
  name?: string;
  playtime_forever?: number;
  playtime_2weeks?: number;
  rtime_last_played?: number;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const STEAM_API_KEY = Deno.env.get("STEAM_API_KEY")!;

const RECENT_SECONDS = 30 * 24 * 60 * 60; // 30 days
const UPSERT_CHUNK = 400;

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const respondError = (code: string, message: string, status = 400) => respond({ error: code, message }, status);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function requestJson<T>(url: string, init: RequestInit = {}, retries = 2): Promise<T> {
  let attempt = 0;
  while (attempt <= retries) {
    const res = await fetch(url, init);
    if (res.status === 429 && attempt < retries) {
      const retryAfter = Number(res.headers.get("retry-after")) || 0;
      const waitMs = retryAfter > 0 ? retryAfter * 1000 : (attempt + 1) * 600;
      await sleep(waitMs);
      attempt += 1;
      continue;
    }
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      const err = new Error(`Steam API ${res.status}: ${errorText || "unknown error"}`) as Error & { status?: number; body?: string };
      (err as any).status = res.status;
      (err as any).body = errorText;
      throw err;
    }
    return res.json();
  }
  throw new Error("Steam API rate limited");
}

const steam = {
  async resolveVanity(vanity: string): Promise<string | null> {
    const url = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${STEAM_API_KEY}&vanityurl=${encodeURIComponent(vanity)}`;
    const data = await requestJson<{ response?: { success?: number; steamid?: string } }>(url);
    if (data?.response?.success === 1 && data.response.steamid) return data.response.steamid;
    return null;
  },
  async getPlayerSummary(steamid: string): Promise<SteamPlayer | null> {
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamid}`;
    const data = await requestJson<{ response?: { players?: SteamPlayer[] } }>(url);
    return data?.response?.players?.[0] ?? null;
  },
  async getOwnedGames(steamid: string) {
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamid}&include_appinfo=1&include_played_free_games=1`;
    return requestJson<Record<string, unknown>>(url);
  },
  async getRecentlyPlayed(steamid: string) {
    const url = `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamid}`;
    return requestJson<Record<string, unknown>>(url);
  },
  async getWishlist(steamid: string) {
    const url = `https://store.steampowered.com/wishlist/profiles/${steamid}/wishlistdata/`;
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return {};
      return await res.json();
    } catch {
      return {};
    }
  },
  header(appid: number) {
    return `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`;
  },
};

serve(async (req) => {
  if (req.method !== "POST") return respondError("method_not_allowed", "Use POST", 405);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return respondError("not_authenticated", "Faça login para sincronizar com a Steam.", 401);
  if (!STEAM_API_KEY) {
    console.error("[steam_sync] STEAM_API_KEY missing");
    return respondError("steam_api_key_missing", "Configuracao ausente: defina a variavel de ambiente STEAM_API_KEY nas Edge Functions.", 500);
  }
  console.log("[steam_sync] user", user.id);

  let body: Body;
  try { body = await req.json(); } catch { return respondError("invalid_json", "JSON inválido.", 400); }

  const rawSteamId = body?.steamIdOrVanity?.trim();
  if (!rawSteamId) return respondError("missing_steam_id", "Informe o SteamID/vanity recebido no login.", 400);

  let steamid = rawSteamId;
  if (!/^\d{17}$/.test(steamid)) {
    const resolved = await steam.resolveVanity(steamid);
    if (!resolved) return respondError("steam_user_not_found", "Usuário Steam não encontrado.", 404);
    steamid = resolved;
  }
  console.log(`[steam_sync] steamid=${steamid} saveToDb=${!!body.saveToDb} includeWishlist=${!!body.includeWishlist}`);

  let player: SteamPlayer | null = null;
  try {
    player = await steam.getPlayerSummary(steamid);
  } catch (error) {
    console.error("getPlayerSummary error", { status: (error as any)?.status, body: (error as any)?.body, message: (error as any)?.message });
    return respondError("steam_profile_error", "Não foi possível ler o perfil Steam.", 502);
  }
  if (!player) return respondError("steam_profile_not_found", "Perfil Steam não encontrado.", 404);
  if ((player.communityvisibilitystate ?? 0) !== 3) {
    return respondError("steam_profile_private", "O perfil Steam precisa estar público (Profile, Game details e Playtime) para importar os jogos.", 403);
  }

  let owned: any;
  try {
    owned = await steam.getOwnedGames(steamid);
  } catch (error: any) {
    if (error?.status === 403) {
      return respondError("steam_profile_private", "Ative a opção 'Game details: Public' no perfil Steam para permitir a sincronização.", 403);
    }
    console.error("getOwnedGames error", { status: error?.status, body: error?.body, message: error?.message });
    return respondError("steam_api_unavailable", "Não foi possível buscar sua biblioteca na Steam.", 502);
  }

  const rawGames: SteamGame[] = owned?.response?.games ?? [];
  const nowIso = new Date().toISOString();
  const normalizedGames = rawGames.map((g) => {
    const lastPlayedUnix = typeof g.rtime_last_played === "number" ? g.rtime_last_played : null;
    return {
      appid: g.appid,
      name: g.name || `App ${g.appid}`,
      playtime_forever: g.playtime_forever ?? 0,
      playtime_recent: g.playtime_2weeks ?? 0,
      last_played: lastPlayedUnix ? new Date(lastPlayedUnix * 1000).toISOString() : null,
      last_played_unix: lastPlayedUnix,
      header_image: steam.header(g.appid),
    };
  });
  console.log("[steam_sync] games", normalizedGames.length);

  let recent: any = null;
  try { recent = await steam.getRecentlyPlayed(steamid); } catch (error) { console.warn("getRecentlyPlayed error", error); }

  let wishlist: any = {};
  if (body.includeWishlist) wishlist = await steam.getWishlist(steamid);

  const warning = normalizedGames.length === 0 ? "Perfil público mas não recebemos jogos. Confirme se 'Game details' está como Public na Steam." : undefined;

  if (body.saveToDb) {
    const upsertRows = async (table: string, rows: Record<string, unknown>[], onConflict?: string) => {
      if (!rows.length) return;
      for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
        const chunk = rows.slice(i, i + UPSERT_CHUNK);
        const { error } = await supabase.from(table).upsert(chunk, onConflict ? { onConflict } : undefined);
        if (error) throw error;
      }
    };
    try {
      const appRows = normalizedGames.map(g => ({
        appid: g.appid,
        name: g.name,
        header_image: g.header_image,
        store_url: `https://store.steampowered.com/app/${g.appid}`,
        last_seen_at: nowIso,
      }));
      await upsertRows("steam_apps", appRows, "appid");

      const userGameRows = normalizedGames.map(g => ({
        profile_id: user.id,
        steam_appid: g.appid,
        playtime_forever: g.playtime_forever,
        playtime_recent: g.playtime_recent,
        last_played: g.last_played,
        last_synced_at: nowIso,
      }));
      await upsertRows("steam_user_games", userGameRows, "profile_id,steam_appid");

      const nowSeconds = Math.floor(Date.now() / 1000);
      const scored = normalizedGames
        .map(game => {
          const playtime = game.playtime_forever ?? 0;
          const lastPlayedUnix = game.last_played_unix ?? 0;
          const isRecent = lastPlayedUnix > 0 && (nowSeconds - lastPlayedUnix) <= RECENT_SECONDS;
          const score = (isRecent ? 1 : 0) * 1_000_000 + playtime;
          return { game, score };
        })
        .sort((a, b) => b.score - a.score);

      const achievementRows = scored.map((item, index) => ({
        profile_id: user.id,
        steam_appid: item.game.appid,
        priority: index < 50 ? 1 : index < 200 ? 2 : index < 500 ? 3 : 5,
        playtime_forever: item.game.playtime_forever,
        last_played: item.game.last_played ?? null,
      }));
      await upsertRows("steam_achievement_jobs", achievementRows, "profile_id,steam_appid");

      await supabase.from("external_accounts").upsert({
        profile_id: user.id,
        provider: "steam",
        external_id: steamid,
        display_name: player.personaname ?? null,
      }, { onConflict: "profile_id,provider" });

      await supabase.from("steam_sync_runs").insert({ profile_id: user.id, steamid, game_count: normalizedGames.length, warning: warning ?? null });
    } catch (dbErr) {
      console.error("steam_sync db error", dbErr);
      return respondError("db_error", "Erro ao salvar dados da Steam.", 500);
    }
  }

  return respond({
    steamid,
    imported_at: nowIso,
    game_count: normalizedGames.length,
    player: {
      steamid: player.steamid,
      personaname: player.personaname,
      avatar: (player as any).avatarfull ?? (player as any).avatarmedium ?? (player as any).avatar,
      country: player.loccountrycode,
      lastlogoff: player.lastlogoff ?? null,
      visibility: player.communityvisibilitystate ?? null,
    },
    games: normalizedGames,
    recently_played: recent?.response?.games ?? [],
    wishlist,
    warning,
  });
});

