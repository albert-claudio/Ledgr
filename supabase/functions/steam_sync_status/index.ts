import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const respondError = (code: string, message: string, status = 400) => respond({ error: code, message }, status);

serve(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") return respondError("method_not_allowed", "Use GET/POST", 405);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return respondError("not_authenticated", "Faça login para consultar status.", 401);

  // Optional job_id filter (POST body or GET query)
  let jobId: number | null = null;
  try {
    if (req.method === "GET") {
      const u = new URL(req.url);
      const raw = u.searchParams.get("job_id");
      if (raw) jobId = Number(raw);
    } else if (req.method === "POST") {
      const ct = req.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const body = await req.json().catch(() => ({}));
        if (typeof body?.job_id === "number") jobId = body.job_id;
      }
    }
  } catch {
    // ignore
  }

  // Latest library sync job or by id
  let job: any = null;
  if (jobId && Number.isFinite(jobId)) {
    const { data } = await supabase
      .from("steam_sync_jobs")
      .select("id, stage, status, progress, detail, created_at, updated_at")
      .eq("profile_id", user.id)
      .eq("id", jobId)
      .maybeSingle();
    job = data || null;
  } else {
    const { data: rows } = await supabase
      .from("steam_sync_jobs")
      .select("id, stage, status, progress, detail, created_at, updated_at")
      .eq("profile_id", user.id)
      .eq("stage", "library")
      .order("created_at", { ascending: false })
      .limit(1);
    job = rows?.[0] || null;
  }

  // Counts for achievements queue
  const count = async (status: string) => {
    const res = await supabase
      .from("steam_achievement_jobs")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .eq("status", status);
    return res.count || 0;
  };

  const [pending, processing, completed] = await Promise.all([
    count("pending"),
    count("processing"),
    count("completed"),
  ]);

  const { count: gamesCount } = await supabase
    .from("steam_user_games")
    .select("steam_appid", { count: "exact", head: true })
    .eq("profile_id", user.id);

  return respond({
    library: job || { status: "idle", progress: 0 },
    achievements_queue: { pending, processing, completed },
    games_total: gamesCount || 0,
  });
});
