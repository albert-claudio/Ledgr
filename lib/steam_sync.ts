import { supabase } from "./supabase"

type FunctionErrorPayload = {
  error?: string
  message?: string
}

function parseFunctionError(error: any): FunctionErrorPayload | null {
  const candidates = [
    typeof error?.message === "string" ? error.message : null,
    typeof error?.context?.error === "string" ? error.context.error : null,
    typeof error?.context?.body === "string" ? error.context.body : null,
  ]
  for (const raw of candidates) {
    if (!raw) continue
    const trimmed = raw.trim()
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed)
        if (parsed && typeof parsed === "object") return parsed as FunctionErrorPayload
      } catch {
        // noop
      }
    }
  }
  return null
}

export async function syncSteam(steamIdOrVanity: string, saveToDb = true) {
  const { data, error } = await supabase.functions.invoke("steam_sync", {
    body: { steamIdOrVanity, saveToDb, includeWishlist: true },
  })

  if (error) {
    const payload = parseFunctionError(error)
    const message = payload?.message || error.message || "Não foi possível sincronizar com a Steam."
    const err = new Error(message)
    if (payload?.error) (err as any).code = payload.error
    throw err
  }
  return data
}

export async function processSteamAchievements(limit = 15) {
  const { data, error } = await supabase.functions.invoke("steam_achievements", {
    body: { limit },
  })
  if (error) {
    const payload = parseFunctionError(error)
    const message = payload?.message || error.message || "Não foi possível processar troféus agora."
    const err = new Error(message)
    if (payload?.error) (err as any).code = payload.error
    throw err
  }
  return data
}

export async function startSteamLibrarySync(force = false) {
  const { data, error } = await supabase.functions.invoke("steam_sync_start", {
    body: { force },
  })
  if (error) {
    const payload = parseFunctionError(error)
    const message = payload?.message || error.message || "Não foi possível iniciar a sincronização."
    const err = new Error(message)
    if (payload?.error) (err as any).code = payload.error
    throw err
  }
  // Dispara o worker em background para processar o job recém-criado
  try {
    console.log('[startSteamLibrarySync] Triggering worker for job processing...');
    // não aguardamos; apenas iniciamos o processamento
    void supabase.functions.invoke("steam_sync_worker", { body: { limitJobs: 1 } })
      .then(() => console.log('[startSteamLibrarySync] Worker triggered successfully'))
      .catch(err => console.error('[startSteamLibrarySync] Worker trigger failed:', err));
  } catch (err) {
    console.error('[startSteamLibrarySync] Worker invocation error:', err);
    // ignore - não bloqueia o retorno
  }
  return data
}

export async function getSteamSyncStatus(jobId?: number) {
  const hasId = typeof jobId === 'number' && Number.isFinite(jobId)
  const invokeOpts: any = hasId ? { body: { job_id: jobId } } : undefined
  const { data, error } = await supabase.functions.invoke("steam_sync_status", invokeOpts)
  if (error) {
    const payload = parseFunctionError(error)
    const message = payload?.message || error.message || "Não foi possível obter status da sincronização."
    const err = new Error(message)
    if (payload?.error) (err as any).code = payload.error
    throw err
  }
  return data
}

export async function runSteamSyncWorker(limitJobs = 1) {
  const { data, error } = await supabase.functions.invoke("steam_sync_worker", {
    body: { limitJobs },
  })
  if (error) {
    const payload = parseFunctionError(error)
    const message = payload?.message || error.message || "Não foi possível executar o worker de sincronização."
    const err = new Error(message)
    if (payload?.error) (err as any).code = payload.error
    throw err
  }
  return data
}

// Map Steam recent apps to IGDB and seed user_games as 'playing'.
export async function seedCurrentlyPlayingFromSteam(limit = 12) {
  const { data, error } = await supabase.functions.invoke("steam_map_igdb", {
    body: { from_recent: true, limit, upsert_user_games: true, status: "playing" },
  })
  if (error) {
    const payload = parseFunctionError(error)
    const message = payload?.message || error.message || "Não foi possível preparar sua seção Jogando." 
    const err = new Error(message)
    if (payload?.error) (err as any).code = payload.error
    throw err
  }
  return data
}

// Map a specific Steam appid to IGDB and optionally add to user_games
export async function mapSteamAppToIgdb(appid: number, upsert = true, status: 'playing' | 'wishlist' | 'completed' = 'playing') {
  const { data, error } = await supabase.functions.invoke("steam_map_igdb", {
    body: { appid, upsert_user_games: upsert, status },
  })
  if (error) {
    const payload = parseFunctionError(error)
    const message = payload?.message || error.message || "Não foi possível mapear este jogo da Steam." 
    const err = new Error(message)
    if (payload?.error) (err as any).code = payload.error
    throw err
  }
  return data
}
