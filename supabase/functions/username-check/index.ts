import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { username } = await req.json().catch(() => ({ username: "" }));
    const slug = String(username || "").trim().toLowerCase();
    if (!slug || slug.length < 3) {
      return new Response(
        JSON.stringify({ exists: false, error: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey);

    const { count, error } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("username", slug);

    if (error) throw error;

    return new Response(
      JSON.stringify({ exists: (count ?? 0) > 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ exists: false, error: e?.message || "unknown" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

