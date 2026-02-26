import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Body = {
  steamid?: string;
  display_name?: string | null;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const respondError = (code: string, message: string, status = 400) => respond({ error: code, message }, status);

serve(async (req) => {
  if (req.method !== "POST") return respondError("method_not_allowed", "Use POST", 405);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return respondError("not_authenticated", "Faça login para vincular sua conta Steam.", 401);

  let body: Body = {};
  try {
    if (req.headers.get("content-type")?.includes("application/json")) body = await req.json();
  } catch {
    // ignore invalid JSON; handled by checks below
  }

  const steamid = (body?.steamid || "").trim();
  if (!/^\d{17}$/.test(steamid)) {
    return respondError("invalid_steamid", "SteamID inválido.", 400);
  }

  const display = (body?.display_name || null) || null;

  // Upsert external_accounts
  const { error: extErr } = await supabase
    .from("external_accounts")
    .upsert({ profile_id: user.id, provider: "steam", external_id: steamid, display_name: display }, { onConflict: "profile_id,provider" });
  if (extErr) {
    console.error("steam_link external_accounts error", extErr);
    return respondError("db_error", "Erro ao registrar conta Steam.", 500);
  }

  // Upsert steam_accounts for status tracking
  const { error: accErr } = await supabase
    .from("steam_accounts")
    .upsert({ profile_id: user.id, steamid, status: "idle" }, { onConflict: "profile_id" });
  if (accErr) {
    console.error("steam_link steam_accounts error", accErr);
    return respondError("db_error", "Erro ao registrar status da sincronização.", 500);
  }

  return respond({ linked: true, steamid, display_name: display });
});

