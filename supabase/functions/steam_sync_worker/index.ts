import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ==========================================
// CONFIGURAÇÕES E TIPOS
// ==========================================
const UPSERT_CHUNK = 200;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STEAM_API_KEY = Deno.env.get("STEAM_API_KEY")!;

console.log("[steam_sync_worker] STEAM_API_KEY:", !!STEAM_API_KEY);

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const respondError = (code: string, message: string, status = 400) => 
  respond({ error: code, message }, status);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function requestJson<T>(url: string, init: RequestInit = {}, retries = 2): Promise<T> {
  let attempt = 0;
  while (attempt <= retries) {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (e: any) {
      console.error("[steam_sync_worker] fetch error:", e.message);
      throw e;
    }
    
    if (res.status === 429 && attempt < retries) {
      const retryAfter = Number(res.headers.get("retry-after")) || 1;
      await sleep(retryAfter * 1000);
      attempt++;
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "no body");
      throw new Error(`API ${res.status}: ${text}`);
    }
    return res.json();
  }
  throw new Error("API rate limit exceeded");
}

const steam = {
  async getOwnedGames(steamid: string) {
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamid}&include_appinfo=1&include_played_free_games=1&format=json`;
    return requestJson<any>(url);
  },
  async getRecentlyPlayedGames(steamid: string) {
    const url =  `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamid}&format=json`;
    return requestJson<any>(url);
  },
  header(appid: number) {
    return `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`;
  },
  async getPlayerAchievements(steamid: string, appid: number) {
    const url = `http://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid=${appid}&key=${STEAM_API_KEY}&steamid=${steamid}`;
    return requestJson<any>(url);
  }
};

/**
 * Updates achievements for a list of games
 * Fetches from Steam API sequentially to avoid rate limits
 */
async function updateAchievements(
  supabase: any,
  userId: string,
  steamid: string,
  games: Array<{ appid: number; name: string }>
) {
  if (games.length === 0) return;
  
  console.log(`[updateAchievements] Processing ${games.length} games for achievements...`);
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const game of games) {
    try {
      const data = await steam.getPlayerAchievements(steamid, game.appid);
      
      // Check if game has achievements
      if (!data?.playerstats?.achievements || !Array.isArray(data.playerstats.achievements)) {
        console.log(`[${game.name}] No achievements data`);
        skipped++;
        continue;
      }

      const achievements = data.playerstats.achievements;
      const unlockedCount = achievements.filter((a: any) => a.achieved === 1).length;
      const totalCount = achievements.length;

      console.log(`[${game.name}] Achievements: ${unlockedCount}/${totalCount}`);

      // Update steam_user_games with achievement count
      const { error: updateErr } = await supabase
        .from('steam_user_games')
        .update({ achievements_unlocked: unlockedCount })
        .eq('profile_id', userId)
        .eq('steam_appid', game.appid);

      if (updateErr) {
        console.error(`[${game.name}] Update error:`, updateErr.message);
        errors++;
      } else {
        updated++;
      }

      // Small delay to avoid rate limiting (100ms between requests)
      await sleep(100);

    } catch (e: any) {
      // Silently ignore errors (game without stats, private profile, etc)
      console.log(`[${game.name}] Skipped - ${e.message}`);
      skipped++;
    }
  }

  console.log(`[updateAchievements] Summary: ${updated} updated, ${skipped} skipped, ${errors} errors`);
}

serve(async (req) => {
  // ==========================================
  // SUPABASE CLIENT INITIALIZATION
  // ==========================================
  // Support user-authenticated calls and background service-role calls.
  const authHeader = req.headers.get("Authorization") ?? "";
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

  let supabase;
  let userId: string | undefined;

  if (authHeader) {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user: authUser }, error: authError } = await userClient.auth.getUser();
    if (!authError && authUser) {
      userId = authUser.id;
      supabase = userClient;
      console.log(`[steam_sync_worker] User call for: ${userId}`);
    }
  }

  // Fallback: background execution uses service-role and may process one user or many.
  if (!supabase) {
    userId = body.userId || body.profile_id;
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    if (userId) {
      console.log(`[steam_sync_worker] Background call for user: ${userId}`);
    } else {
      console.log("[steam_sync_worker] Background call for pending jobs (all users)");
    }
  }

  // Get optional limit from query params or body
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit")) || Number(body.limitJobs) || 1;

  // ==========================================
  // MAIN LOGIC
  // ==========================================
  let jobsQuery = supabase
    .from("steam_sync_jobs")
    .select("id, profile_id")
    .eq("stage", "library")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (userId) jobsQuery = jobsQuery.eq("profile_id", userId);

  const { data: jobs, error: jobsErr } = await jobsQuery;

  if (jobsErr) return respondError("db_error", jobsErr.message, 500);
  if (!jobs || jobs.length === 0) return respond({ message: "Nenhum job pendente." });

  const processed: number[] = [];

  for (const job of jobs) {
    userId = job.profile_id;
    console.log(`Processing job ${job.id} for user ${userId}...`);

    const { data: acc } = await supabase
      .from("steam_accounts")
      .select("steamid")
      .eq("profile_id", userId)
      .single();

    if (!acc?.steamid) {
      await supabase.from("steam_sync_jobs").update({ status: "failed", detail: "Conta Steam não vinculada." }).eq("id", job.id);
      continue;
    }

    const steamid = acc.steamid;
    await supabase.from("steam_sync_jobs").update({ status: "processing", progress: 10, detail: "buscando dados steam" }).eq("id", job.id);

    try {
      const [ownedRes, recentRes] = await Promise.all([
        steam.getOwnedGames(steamid),
        steam.getRecentlyPlayedGames(steamid)
      ]);

      const rawGames = ownedRes?.response?.games || [];
      const recentGames = recentRes?.response?.games || [];
      console.log(`Steam found: ${rawGames.length} owned, ${recentGames.length} recent`);

      const recentMap = new Map(recentGames.map((g: any) => [g.appid, g]));
      const merged = rawGames.map((g: any) => {
        const r = recentMap.get(g.appid);
        return r ? { ...g, ...r } : g;
      });

      recentGames.forEach((g: any) => {
        if (!merged.find((m: any) => m.appid === g.appid)) merged.push(g);
      });

      const played = merged.filter((g: any) => (g.playtime_forever || 0) > 0);
      const nowIso = new Date().toISOString();

      const normalized = played.map((g: any) => ({
        appid: g.appid,
        name: g.name || `App ${g.appid}`,
        playtime_forever: g.playtime_forever || 0,
        playtime_recent: g.playtime_2weeks || 0,
        last_played: g.rtime_last_played ? new Date(g.rtime_last_played * 1000).toISOString() : null,
        header_image: steam.header(g.appid)
      }));

      const { data: prevData } = await supabase
        .from("steam_user_games")
        .select("steam_appid, playtime_forever")
        .eq("profile_id", userId);
      
      const prevMap = new Map((prevData || []).map((p: any) => [p.steam_appid, p.playtime_forever]));

      const apps = normalized.map((g: any) => ({
        appid: g.appid,
        name: g.name,
        header_image: g.header_image,
        store_url: `https://store.steampowered.com/app/${g.appid}`,
        last_seen_at: nowIso
      }));
      await supabase.from("steam_apps").upsert(apps, { onConflict: "appid" });

      const links = normalized.map((g: any) => ({
        profile_id: userId,
        steam_appid: g.appid,
        playtime_forever: g.playtime_forever,
        playtime_recent: g.playtime_recent,
        last_played: g.last_played,
        last_synced_at: nowIso
      }));
      
      for (let i = 0; i < links.length; i += UPSERT_CHUNK) {
        await supabase.from("steam_user_games").upsert(links.slice(i, i + UPSERT_CHUNK), { onConflict: "profile_id,steam_appid" });
      }

      // Update achievements for games with recent playtime
      const recentlyPlayed = normalized.filter((g: any) => g.playtime_recent > 0).slice(0, 20); // Limit to 20 most recent
      if (recentlyPlayed.length > 0) {
        console.log(`Syncing achievements for ${recentlyPlayed.length} recently played games...`);
        await updateAchievements(supabase, userId, steamid, recentlyPlayed);
      }

      await supabase.from("steam_sync_jobs").update({ progress: 50, detail: "analisando eventos" }).eq("id", job.id);

      // Detect games with playtime increase
      const increases = normalized.filter((g: any) => {
        const prev = prevMap.get(g.appid);
        if (prev === undefined) return (g.playtime_forever > 0 && g.playtime_forever < 600);
        return (g.playtime_forever - prev) >= 1;
      });

      // NEW: Also detect games played TODAY (based on last_played timestamp)
      // This catches games that Steam hasn't reported playtime change for yet
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const gamesPlayedToday = normalized.filter((g: any) => {
        if (!g.last_played) return false;
        const lastPlayedDate = new Date(g.last_played);
        return lastPlayedDate >= todayStart;
      });
      
      console.log(`Found ${gamesPlayedToday.length} games played TODAY`);
      
      // Add games played today that aren't already in increases
      for (const game of gamesPlayedToday) {
        if (!increases.find((g: any) => g.appid === game.appid)) {
          console.log(`Adding ${game.name} (played today, no playtime change yet)`);
          increases.push(game);
        }
      }

      if (increases.length > 0) {
        console.log(`Found ${increases.length} games with playtime increase.`);
        console.log("Games with increase:", increases.map((g: any) => `${g.name} (${g.appid})`));
        
        const steamIds = increases.map((g: any) => g.appid);
        const { data: mappings } = await supabase
          .from("steam_igdb_mappings")
          .select("steam_appid, igdb_id")
          .in("steam_appid", steamIds);
        
        console.log(`Found ${(mappings || []).length} mappings for ${steamIds.length} games`);
        
        const mapSteamToIgdb = new Map((mappings || []).map((m: any) => [m.steam_appid, m.igdb_id]));
        
        const unmappedSteamIds: number[] = [];
        for (const g of increases) {
          if (!mapSteamToIgdb.has(g.appid)) {
            unmappedSteamIds.push(g.appid);
          }
        }

        if (unmappedSteamIds.length > 0) {
          console.log(`Auto-mapping ${unmappedSteamIds.length} unmapped games...`);
          
          try {
            // OTIMIZAÇÃO: Passa nomes dos jogos para validação contra IGDB
            const gamesForMapping = increases
              .filter(g => unmappedSteamIds.includes(g.appid))
              .map(g => ({ appid: g.appid, steam_name: g.name }));
            
            console.log("Games for mapping:", gamesForMapping.map(g => `${g.appid}: ${g.steam_name}`).join(", "));
            
            const { data: mapResult, error: mapErr } = await supabase.functions.invoke("steam_map_igdb", {
              body: { games: gamesForMapping, upsert_user_games: true, status: "playing" }
            });
            
            if (mapErr) {
              console.error("steam_map_igdb error:", mapErr);
            } else {
              console.log("steam_map_igdb completed:", mapResult);
              
              // Log rejected mappings for debugging
              const rejected = (mapResult?.mapped || []).filter((r: any) => r.reason === "name_mismatch");
              if (rejected.length > 0) {
                console.warn(`⚠️ ${rejected.length} games rejected due to name mismatch:`, 
                  rejected.map((r: any) => `Steam "${r.steam_name}" vs IGDB "${r.igdb_name}" (${r.similarity}%)`).join(", "));
              }
              
              const { data: newMappings } = await supabase
                .from("steam_igdb_mappings")
                .select("steam_appid, igdb_id")
                .in("steam_appid", unmappedSteamIds);
                
              if (newMappings && newMappings.length > 0) {
                console.log(`Retrieved ${newMappings.length} new mappings`);
                newMappings.forEach((m: any) => {
                  mapSteamToIgdb.set(m.steam_appid, m.igdb_id);
                });
              }
            }
          } catch (e: any) {
            console.error("Error during auto-mapping:", e.message);
          }
        }
        
        const validIgdbIds = Array.from(mapSteamToIgdb.values());
        let mapIgdbToUuid = new Map();
        
        if (validIgdbIds.length > 0) {
          const { data: games } = await supabase
            .from("games")
            .select("id, igdb_id")
            .in("igdb_id", validIgdbIds);
          
          console.log(`Found ${(games || []).length} games in database for ${validIgdbIds.length} IGDB IDs`);
          
          if (games) {
             mapIgdbToUuid = new Map(games.map((g: any) => [g.igdb_id, g.id]));
          }
        }

        const events = [];
        const skipped = { noMapping: 0, noInternalId: 0 };
        
        for (const g of increases) {
          const igdbId = mapSteamToIgdb.get(g.appid);
          if (!igdbId) {
            console.log(`Skipping ${g.name} (${g.appid}) - no mapping`);
            skipped.noMapping++;
            continue;
          }

          const internalId = mapIgdbToUuid.get(igdbId);
          if (!internalId) {
            console.log(`Skipping ${g.name} (${g.appid}) - not in DB (IGDB ${igdbId})`);
            skipped.noInternalId++;
            continue;
          }

          const prev = prevMap.get(g.appid) || 0;
          const delta = Math.round(((g.playtime_forever - prev) / 60) * 10) / 10;
          const total = Math.round((g.playtime_forever / 60) * 10) / 10;

          console.log(`Creating event for ${g.name}: +${delta}h (total: ${total}h)`);

          events.push({
            profile_id: userId,
            game_id: internalId,
            steam_appid: g.appid,
            type: "synced",
            meta: { hours_added: delta, total_hours: total },
            created_at: nowIso
          });
        }

        console.log(`Events summary: ${events.length} created, ${skipped.noMapping} no mapping, ${skipped.noInternalId} not in DB`);

        if (events.length > 0) {
          // Get today's date for checking existing events
          const gameIds = events.map(e => e.game_id);
          
          // Fetch existing events for these games from TODAY (to update instead of duplicate)
          const { data: existingEvents } = await supabase
            .from("events")
            .select("id, game_id, meta")
            .eq("profile_id", userId)
            .eq("type", "synced")
            .in("game_id", gameIds)
            .gte("created_at", todayStart.toISOString());
          
          const existingEventMap = new Map((existingEvents || []).map((e: any) => [e.game_id, e]));
          
          const toInsert = [];
          const toUpdate = [];
          
          for (const evt of events) {
            const existing = existingEventMap.get(evt.game_id);
            
            if (existing) {
              // UPDATE existing event - accumulate hours
              const oldHours = parseFloat(existing.meta?.hours_added) || 0;
              const newHours = Math.round((oldHours + evt.meta.hours_added) * 10) / 10;
              const sessionsCount = (existing.meta?.sessions_count || 1) + 1;
              
              toUpdate.push({
                id: existing.id,
                meta: {
                  hours_added: newHours,
                  total_hours: evt.meta.total_hours,
                  grouped: true,
                  sessions_count: sessionsCount
                }
              });
              console.log(`Updating event ${existing.id}: ${oldHours}h -> ${newHours}h (${sessionsCount} sessions)`);
            } else {
              // CREATE new event
              toInsert.push(evt);
            }
          }
          
          // Batch update existing events
          for (const upd of toUpdate) {
            await supabase
              .from("events")
              .update({ meta: upd.meta })
              .eq("id", upd.id);
          }
          
          // Insert new events
          if (toInsert.length > 0) {
            console.log(`Inserting ${toInsert.length} new timeline events`);
            const { error: evtErr } = await supabase.from("events").insert(toInsert);
            if (evtErr) {
              console.error("Event insertion error:", evtErr);
            } else {
              console.log("✓ Timeline events inserted!");
            }
          }
          
          console.log(`Timeline: ${toInsert.length} inserted, ${toUpdate.length} updated`);
          
          // Update user_games.last_session_at for all affected games
          const allGameIds = events.map(e => e.game_id);
          for (const gameId of allGameIds) {
            await supabase
              .from("user_games")
              .update({ 
                last_session_at: nowIso,
                updated_at: nowIso
              })
              .eq("profile_id", userId)
              .eq("game_id", gameId);
          }
          console.log(`Updated last_session_at for ${allGameIds.length} games`);
        }
      }
      // Update steam_accounts.last_full_library_sync_at to track last successful sync
      await supabase
        .from("steam_accounts")
        .update({ 
          last_full_library_sync_at: nowIso,
          status: "idle"
        })
        .eq("profile_id", userId);
      console.log("✓ Updated steam_accounts.last_full_library_sync_at");

      await supabase.from("steam_sync_jobs").update({ status: "completed", progress: 100, detail: "concluido" }).eq("id", job.id);
      processed.push(job.id);

    } catch (e: any) {
      console.error(`Job ${job.id} failed:`, e);
      await supabase.from("steam_sync_jobs").update({ status: "failed", detail: e.message || "Erro desconhecido" }).eq("id", job.id);
    }
  }

  return respond({ processed });
});
