import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Background sync interval: 4 hours (240 minutes)
// The app does more frequent syncs when open, this is for when app is closed
const SYNC_INTERVAL_MINUTES = 240;

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

serve(async (req) => {
  // Get source from body (cron, manual, app)
  let source = "unknown";
  try {
    const body = await req.json().catch(() => ({}));
    source = body.source || "unknown";
  } catch {}
  
  console.log(`[steam_sync_scheduler] Starting background sync (source: ${source})`);
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Get all steam accounts that need sync
  // Priority: accounts that haven't synced in the longest time first
  const now = new Date();
  const cutoff = new Date(now.getTime() - SYNC_INTERVAL_MINUTES * 60000);
  
  // Fetch accounts that need sync, ordered by last sync (oldest first)
  const { data: accounts, error } = await supabase
    .from("steam_accounts")
    .select("profile_id, last_full_library_sync_at, status")
    .neq("status", "processing")
    .or(`last_full_library_sync_at.is.null,last_full_library_sync_at.lt.${cutoff.toISOString()}`)
    .order("last_full_library_sync_at", { ascending: true, nullsFirst: true })
    .limit(100); // Process in batches of 100 for background sync

  if (error) {
    console.error("Error fetching accounts:", error);
    return respond({ error: error.message }, 500);
  }

  if (!accounts || accounts.length === 0) {
    return respond({ message: "No accounts to sync." });
  }

  console.log(`Found ${accounts.length} accounts to sync.`);
  const results = [];

  for (const acc of accounts) {
    // Check if there is already a pending job to avoid duplicates
    const { data: existingJob } = await supabase
      .from("steam_sync_jobs")
      .select("id")
      .eq("profile_id", acc.profile_id)
      .eq("stage", "library")
      .in("status", ["pending", "processing"])
      .maybeSingle();

    if (existingJob) {
      console.log(`Skipping ${acc.profile_id} - job ${existingJob.id} already pending/processing`);
      continue;
    }

    // Create new job
    const { data: job, error: jobErr } = await supabase
      .from("steam_sync_jobs")
      .insert({
        profile_id: acc.profile_id,
        stage: "library",
        status: "pending",
        progress: 0,
        detail: "scheduled background sync"
      })
      .select("id")
      .single();

    if (jobErr) {
      console.error(`Failed to create job for ${acc.profile_id}:`, jobErr);
      continue;
    }

    // Trigger worker and await to guarantee dispatch before function returns.
    try {
      const { error: invokeErr } = await supabase.functions.invoke("steam_sync_worker", {
        body: { profile_id: acc.profile_id, limitJobs: 1 }
      });

      if (invokeErr) {
        console.error(`Worker invocation failed for ${acc.profile_id}:`, invokeErr);
        await supabase
          .from("steam_sync_jobs")
          .update({ status: "failed", detail: `worker invoke failed: ${invokeErr.message || 'unknown error'}` })
          .eq("id", job.id);
        continue;
      }

      results.push({ profile_id: acc.profile_id, job_id: job.id });
    } catch (e: any) {
      console.error(`Failed to invoke worker for ${acc.profile_id}:`, e);
      await supabase
        .from("steam_sync_jobs")
        .update({ status: "failed", detail: `worker invoke exception: ${e?.message || 'unknown error'}` })
        .eq("id", job.id);
    }
  }

  return respond({ 
    message: `Scheduled ${results.length} jobs`, 
    results 
  });
});
