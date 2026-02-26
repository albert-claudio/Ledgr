import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ApiErrorCode =
  | "invalid_request"
  | "invalid_username"
  | "username_taken"
  | "email_taken"
  | "creation_failed";

type ApiResult =
  | { ok: true; userId: string; pendingVerification: boolean }
  | { ok: false; code: ApiErrorCode; message: string };

const respond = (payload: ApiResult, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const respondOk = (payload: ApiResult) => respond(payload, 200);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond({
      ok: false,
      code: "invalid_request",
      message: "Use POST",
    }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawEmail = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const originalUsername = String(body?.username ?? "").trim();
    const displayName = String(body?.displayName ?? originalUsername).trim() || originalUsername;
    const username = originalUsername.toLowerCase();

    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!rawEmail || !emailRegex.test(rawEmail)) {
      return respond({
        ok: false,
        code: "invalid_request",
        message: "E-mail inválido.",
      });
    }
    if (password.length < 6) {
      return respond({
        ok: false,
        code: "invalid_request",
        message: "Senha com tamanho insuficiente.",
      });
    }
    if (!username || username.length < 3 || !/^[a-z0-9_.-]+$/.test(username)) {
      return respond({
        ok: false,
        code: "invalid_username",
        message: "Username inválido.",
      });
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY");
    const redirectTo =
      Deno.env.get("EMAIL_VERIFY_REDIRECT") ??
      Deno.env.get("SUPABASE_EMAIL_CONFIRM_REDIRECT") ??
      Deno.env.get("SUPABASE_SITE_URL") ??
      "https://ledgr.app.br/auth-callback";
    if (!url || !serviceKey) {
      console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
      return respondOk({
        ok: false,
        code: "creation_failed",
        message: "Configuração ausente.",
      });
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: usernameExists } = await admin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .limit(1);

    if (usernameExists && usernameExists.length > 0) {
      return respond({
        ok: false,
        code: "username_taken",
        message: "Username indisponível.",
      });
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: rawEmail,
      password,
      email_confirm: false,
      user_metadata: { username },
    });

    if (createErr || !created?.user?.id) {
      const msg = createErr?.message?.toLowerCase() ?? "";
      if (msg.includes("already registered") || msg.includes("user exists")) {
      return respond({
        ok: false,
        code: "email_taken",
        message: "E-mail já cadastrado.",
      });
    }
    console.error("createUser", createErr);
    return respondOk({
      ok: false,
      code: "creation_failed",
      message: "Falha ao criar usuário.",
    });
    }

    const userId = created.user.id;
    const { error: profileErr } = await admin
      .from("profiles")
      .insert({
        id: userId,
        username,
        display_name: displayName || username,
      });

    if (profileErr) {
      console.error("profile insert failed", profileErr);
      await admin.auth.admin.deleteUser(userId);
      if (profileErr.code === "23505") {
      return respond({
        ok: false,
        code: "username_taken",
        message: "Username indisponível.",
      });
      }
      return respondOk({
        ok: false,
        code: "creation_failed",
        message: "Não foi possível criar o perfil.",
      });
    }

    const { error: resendErr } = await admin.auth.resend({
      type: "signup",
      email: rawEmail,
      options: { emailRedirectTo: redirectTo },
    });

    if (resendErr) {
      console.error("resend signup email failed", resendErr);
      await admin.auth.admin.deleteUser(userId);
      return respondOk({
        ok: false,
        code: "creation_failed",
        message: "Não conseguimos enviar o e-mail de confirmação.",
      });
    }

    return respondOk({ ok: true, userId, pendingVerification: true });
  } catch (err) {
    console.error("password-signup error", err);
    return respondOk({
      ok: false,
      code: "creation_failed",
      message: "Erro inesperado.",
    });
  }
});
