import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

type Body = {
force?: boolean
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!

const respond = (body: Record<string, unknown>, status = 200) =>
new Response(JSON.stringify(body), {
status,
headers: { "Content-Type": "application/json" }
})

const respondError = (code: string, message: string, status = 400) =>
respond({ error: code, message }, status)

const SYNC_COOLDOWN_MINUTES = 1 // Reduzido de 3 para 1 para permitir updates mais frequentes

Deno.serve(async req => {
if (req.method !== "POST") {
return respondError("method_not_allowed", "Use POST", 405)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }
})

const { data: auth, error: authErr } = await supabase.auth.getUser()
if (authErr) {
console.error("auth_error", authErr)
return respondError("auth_error", "Erro ao obter usuário.", 500)
}

const user = auth?.user
if (!user) {
return respondError("not_authenticated", "Faça login para iniciar a sync.", 401)
}

let body: Body = {}
try {
if (req.headers.get("content-type")?.includes("application/json")) {
body = await req.json()
}
} catch {
// se o body vier zuado, segue com defaults
}

const { data: ext, error: extErr } = await supabase
.from("external_accounts")
.select("external_id, display_name")
.eq("profile_id", user.id)
.eq("provider", "steam")
.maybeSingle()

if (extErr) {
console.error("ext_error", extErr)
return respondError("db_error", "Erro ao verificar conta Steam vinculada.", 500)
}

if (!ext?.external_id) {
return respondError("steam_not_linked", "Vincule sua conta Steam antes de sincronizar.", 400)
}

const { data: acc, error: accErr } = await supabase
.from("steam_accounts")
.select("profile_id, steamid, last_full_library_sync_at")
.eq("profile_id", user.id)
.maybeSingle()

if (accErr) {
console.error("acc_error", accErr)
return respondError("db_error", "Erro ao acessar steam_accounts.", 500)
}

const now = new Date()

if (!acc) {
const { error: insertAccErr } = await supabase
.from("steam_accounts")
.insert({ profile_id: user.id, steamid: ext.external_id, status: "idle" })

if (insertAccErr) {
  console.error("insert_acc_error", insertAccErr)
  return respondError("db_error", "Erro ao registrar conta Steam.", 500)
}


}

if (acc?.last_full_library_sync_at && !body.force) {
const last = new Date(acc.last_full_library_sync_at)
const diffMin = Math.floor((now.getTime() - last.getTime()) / 60000)

if (diffMin < SYNC_COOLDOWN_MINUTES) {
  return respond(
    {
      status: "throttled",
      message: `Última sync há ${diffMin} min. Tente novamente em alguns minutos.`,
      next_allowed_in_minutes: SYNC_COOLDOWN_MINUTES - diffMin
    },
    202
  )
}


}

const { data: job, error: jobErr } = await supabase
.from("steam_sync_jobs")
.insert({
profile_id: user.id,
stage: "library",
status: "pending",
progress: 0,
detail: "queued"
})
.select("id, created_at")
.single()

if (jobErr) {
console.error("job_error", jobErr)
return respondError("db_error", "Erro ao criar job de sincronização.", 500)
}

// Best-effort: disparar o worker para processar o job
// Não bloqueia a resposta; erros aqui não impedem o retorno 202
try {
  // Atualiza status da conta para indicar fila
  await supabase
    .from("steam_accounts")
    .update({ status: "queued" })
    .eq("profile_id", user.id)

  // Dispara o worker para processar até 1 job desta conta
  // Não aguardamos o resultado para evitar timeout do Edge Function
  // Ignoramos eventual erro aqui (o app pode chamar o worker explicitamente)
  supabase.functions.invoke("steam_sync_worker", { body: { limitJobs: 1 } })
    .then(() => {})
    .catch(err => console.warn("steam_sync_worker dispatch error", err))
  // Fallback: também dispara importação direta (compatibilidade com projetos sem worker publicado)
  const steamid = ext!.external_id as string
  supabase.functions.invoke("steam_sync", { body: { steamIdOrVanity: steamid, saveToDb: true, includeWishlist: true } })
    .then(() => {})
    .catch(err => console.warn("steam_sync fallback dispatch error", err))
} catch (e) {
  console.warn("steam_sync_start: worker dispatch failed", e)
}

return respond(
{
status: "queued",
job_id: job.id,
created_at: job.created_at
},
202
)
})
