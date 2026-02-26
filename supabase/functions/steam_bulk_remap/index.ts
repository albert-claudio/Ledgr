import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { 
    status, 
    headers: { "Content-Type": "application/json" } 
  });

serve(async (req) => {
  if (req.method !== "POST") {
    return respond({ error: "method_not_allowed", message: "Use POST" }, 405);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }
  });

  // Auth check
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return respond({ error: "unauthorized", message: "Login required" }, 401);
  }

  try {
    console.log(`[steam_bulk_remap] Starting for user ${user.id}`);

    // Get all Steam App IDs from user's library
    const { data: steamGames, error: gamesErr } = await supabase
      .from("steam_user_games")
      .select("steam_appid")
      .eq("profile_id", user.id)
      .gt("playtime_forever", 0);

    if (gamesErr) throw gamesErr;

    if (!steamGames || steamGames.length === 0) {
      console.log("[steam_bulk_remap] No games to remap");
      return respond({ message: "No games to remap", remapped: 0, total: 0 });
    }

    const steamAppIds = steamGames.map(g => g.steam_appid);
    console.log(`[steam_bulk_remap] Found ${steamAppIds.length} games in library`);

    // Check existing mappings - skip high confidence ones (95+)
    const { data: existingMappings } = await supabase
      .from("steam_igdb_mappings")
      .select("steam_appid, confidence")
      .in("steam_appid", steamAppIds);

    const highConfidence = new Set(
      (existingMappings || [])
        .filter(m => m.confidence && m.confidence >= 95)
        .map(m => m.steam_appid)
    );

    const toRemap = steamAppIds.filter(id => !highConfidence.has(id));
    console.log(`[steam_bulk_remap] Remapping ${toRemap.length} games (skipping ${highConfidence.size} high-confidence)`);

    if (toRemap.length === 0) {
      return respond({ 
        message: "All games already have high-confidence mappings", 
        remapped: 0,
        total: steamAppIds.length,
        skipped: highConfidence.size 
      });
    }

    // Call steam_map_igdb in batches to avoid rate limits
    const BATCH_SIZE = 10;
    let remapped = 0;
    let errors = 0;
    const failedBatches: number[][] = [];
    
    for (let i = 0; i < toRemap.length; i += BATCH_SIZE) {
      const batch = toRemap.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(toRemap.length / BATCH_SIZE);
      
      try {
        console.log(`[steam_bulk_remap] Processing batch ${batchNum}/${totalBatches}: ${batch.join(', ')}`);
        
        const { data: mapData, error: mapErr } = await supabase.functions.invoke("steam_map_igdb", {
          body: { 
            appids: batch, 
            upsert_user_games: true, 
            status: "playing" 
          }
        });
        
        if (mapErr) {
          console.error(`[steam_bulk_remap] Batch ${batchNum} error:`, mapErr);
          errors += batch.length;
          failedBatches.push(batch);
        } else {
          console.log(`[steam_bulk_remap] Batch ${batchNum} result:`, mapData);
          remapped += batch.length;
        }
        
        console.log(`[steam_bulk_remap] Progress: ${remapped}/${toRemap.length} remapped, ${errors} errors`);
        
        // Longer delay between batches to avoid rate limits
        if (i + BATCH_SIZE < toRemap.length) {
          await new Promise(r => setTimeout(r, 1000)); // Increased from 500ms to 1s
        }
      } catch (e: any) {
        console.error(`[steam_bulk_remap] Batch ${batchNum} exception:`, e.message);
        errors += batch.length;
        failedBatches.push(batch);
      }
    }

    console.log(`[steam_bulk_remap] Complete: ${remapped} remapped, ${errors} errors`);
    if (failedBatches.length > 0) {
      console.log(`[steam_bulk_remap] Failed batches:`, failedBatches);
    }

    return respond({ 
      message: errors > 0 ? "Remapping completed with some errors" : "Remapping complete", 
      total_games: steamAppIds.length,
      remapped,
      skipped: highConfidence.size,
      errors,
      failed_appids: failedBatches.flat()
    });

  } catch (e: any) {
    console.error("[steam_bulk_remap] Error:", e);
    return respond({ error: "server_error", message: e.message }, 500);
  }
});
