import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Body = {
  limit?: number;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const STEAM_API_KEY = Deno.env.get("STEAM_API_KEY")!;

const DEFAULT_LIMIT = 10; // per run, to avoid rate limits

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const respondError = (code: string, message: string, status = 400) =>
  respond({ error: code, message }, status);

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function requestJson<T>(url: string, init: RequestInit = {}, retries = 2): Promise<T> {
  let attempt = 0;
  while (attempt <= retries) {
    const res = await fetch(url, init);
    if (res.status === 429 && attempt < retries) {
      const retryAfter = Number(res.headers.get("retry-after")) || 0;
      const waitMs = retryAfter > 0 ? retryAfter * 1000 : (attempt + 1) * 700;
      await sleep(waitMs);
      attempt += 1;
      continue;
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      const err = new Error(`Steam API ${res.status}: ${errText || "unknown error"}`) as Error & { status?: number; body?: string };
      (err as any).status = res.status;
      (err as any).body = errText;
      throw err;
    }
    return res.json();
  }
  throw new Error("Steam API rate limited");
}

async function getAchievementsTotal(appid: number): Promise<number> {
  // Using store API for total achievements (no auth)
  const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&l=english`;
  try {
    const json = await requestJson<Record<string, any>>(url, {}, 1);
    const entry = json?.[appid];
    if (!entry?.success) return 0;
    const total = entry?.data?.achievements?.total;
    return typeof total === "number" ? total : 0;
  } catch {
    return 0;
  }
}

async function getPlayerUnlocked(steamid: string, appid: number): Promise<number> {
  const url = `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?key=${STEAM_API_KEY}&steamid=${steamid}&appid=${appid}&l=english`;
  try {
    const data = await requestJson<Record<string, any>>(url, {}, 1);
    const ach = data?.playerstats?.achievements as Array<{ achieved?: number }> | undefined;
    if (!Array.isArray(ach)) return 0;
    return ach.reduce((acc, a) => acc + ((a?.achieved ?? 0) ? 1 : 0), 0);
  } catch (e: any) {
    // Some games/users may not have public stats; treat as 0 unlocked
    const msg = (e?.body as string) || "";
    if (typeof msg === "string" && /private|not have stats|N/A/i.test(msg)) return 0;
    throw e;
  }
}

async function getSchemaForGame(appid: number): Promise<Array<{ name: string; displayName?: string; description?: string; hidden?: number; icon?: string; icongray?: string }>> {
  const url = `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${STEAM_API_KEY}&appid=${appid}&l=english`;
  try {
    const data = await requestJson<Record<string, any>>(url, {}, 1);
    const list = data?.game?.availableGameStats?.achievements as Array<any> | undefined;
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

serve(async req => {
  if (req.method !== "POST") {
    return respondError("method_not_allowed", "Use POST", 405);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) {
    return respondError("not_authenticated", "Faça login para importar troféus.", 401);
  }

  let body: Body = {};
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      body = await req.json();
    }
  } catch {
    // ignore invalid body; fall back to defaults
  }
  const limit = Math.max(1, Math.min(50, Number(body?.limit) || DEFAULT_LIMIT));

  // Resolve user's SteamID from external_accounts
  const { data: ext, error: extErr } = await supabase
    .from("external_accounts")
    .select("external_id")
    .eq("profile_id", user.id)
    .eq("provider", "steam")
    .maybeSingle();
  if (extErr) {
    console.error("external_accounts error", extErr);
    return respondError("db_error", "Erro ao buscar conta Steam vinculada.", 500);
  }
  const steamid = ext?.external_id;
  if (!steamid) {
    return respondError("steamid_missing", "Vincule sua conta Steam antes de importar troféus.", 400);
  }

  // Fetch pending jobs for this user ordered by priority and created_at
  const { data: jobs, error: jobsErr } = await supabase
    .from("steam_achievement_jobs")
    .select("id, steam_appid, attempts")
    .eq("status", "pending")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (jobsErr) {
    console.error("jobs select error", jobsErr);
    return respondError("db_error", "Erro ao carregar fila de troféus.", 500);
  }

  const processed: Array<{ id: number; appid: number; unlocked: number; total: number; status: string }> = [];
  if (!jobs || jobs.length === 0) {
    return respond({ processed, message: "Nenhum job pendente." });
  }

  for (const job of jobs) {
    const appid = Number(job.steam_appid);
    let unlocked = 0;
    let total = 0;
    try {
      // Mark as processing + increment attempts
      await supabase
        .from("steam_achievement_jobs")
        .update({ status: "processing", attempts: (job.attempts ?? 0) + 1 })
        .eq("id", job.id);

      // Read totals and unlocked sequentially with small delay to avoid rate limits
      total = await getAchievementsTotal(appid);
      await sleep(500);
      unlocked = await getPlayerUnlocked(steamid, appid);

      // Update user game counters
      const { error: updErr } = await supabase
        .from("steam_user_games")
        .update({ achievements_total: total, achievements_unlocked: unlocked, last_synced_at: new Date().toISOString() })
        .eq("profile_id", user.id)
        .eq("steam_appid", appid);
      if (updErr) throw updErr;

      // If there are achievements, ensure game schema exists then upsert user unlock states
      if (total > 0) {
        // Check if we already have schema for this game
        const { count: existing } = await supabase
          .from("steam_game_achievements")
          .select("id", { count: "exact", head: true })
          .eq("appid", appid);
        if (!existing || existing === 0) {
          const schema = await getSchemaForGame(appid);
          if (schema.length) {
            const rows = schema.map((ach) => ({
              appid,
              api_name: ach.name,
              display_name: ach.displayName ?? null,
              description: ach.description ?? null,
              icon: ach.icon ?? null,
              icon_gray: ach.icongray ?? null,
              hidden: (ach.hidden ?? 0) ? true : false,
            }));
            // Upsert in chunks small (100)
            for (let i = 0; i < rows.length; i += 100) {
              const chunk = rows.slice(i, i + 100);
              const { error } = await supabase.from("steam_game_achievements").upsert(chunk, { onConflict: "appid,api_name" });
              if (error) throw error;
            }
          }
        }

        // Upsert user unlock map
        const url = `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?key=${STEAM_API_KEY}&steamid=${steamid}&appid=${appid}&l=english`;
        const pdata = await requestJson<Record<string, any>>(url, {}, 1);
        const achievements = pdata?.playerstats?.achievements as Array<any> | undefined;
        if (Array.isArray(achievements)) {
          const rows = achievements.map((a) => ({
            profile_id: user.id,
            appid,
            api_name: a.apiname as string,
            unlocked: (a.achieved ?? 0) ? true : false,
            unlock_time: typeof a.unlocktime === "number" && a.unlocktime > 0 ? new Date(a.unlocktime * 1000).toISOString() : null,
          }));
          for (let i = 0; i < rows.length; i += 200) {
            const chunk = rows.slice(i, i + 200);
            const { error } = await supabase.from("steam_user_achievements").upsert(chunk, { onConflict: "profile_id,appid,api_name" });
            if (error) throw error;
          }
        }
      }

      await supabase
        .from("steam_achievement_jobs")
        .update({ status: "completed", last_error: null })
        .eq("id", job.id);

      processed.push({ id: job.id, appid, unlocked, total, status: "completed" });
    } catch (e: any) {
      const status = (e?.status as number) || 500;
      const message = (e?.message as string) || "Erro desconhecido";
      await supabase
        .from("steam_achievement_jobs")
        .update({ status: "failed", last_error: `${status}: ${message}` })
        .eq("id", job.id);
      processed.push({ id: job.id, appid, unlocked, total, status: "failed" });
      // Backoff a bit on failure to be gentle with API
      await sleep(600);
    }
    // Gentle pacing between jobs
    await sleep(500);
  }

  return respond({ processed, count: processed.length });
});
