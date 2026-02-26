import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type StartBody = {
  action?: string;
  redirectTo?: string;
};

const withCors = (headers: HeadersInit = {}) => ({
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  ...headers,
});

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: withCors(),
  });

const errorJson = (code: string, message: string, status = 400) =>
  json({ error: code, message }, status);

const randomState = () => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
};

const ALLOWED_SCHEMES = new Set(["ledgr:", "exp:"]);
const isLocalHost = (host: string) =>
  host === "localhost" ||
  host === "127.0.0.1" ||
  host.startsWith("192.168.") ||
  host.endsWith(".ngrok-free.app");

const isExpoAuthProxyHost = (host: string) =>
  host === "auth.expo.dev" || host === "auth.expo.io";

const isAllowedRedirect = (value: string | null | undefined) => {
  if (!value) return false;
  try {
    const target = new URL(value);
    if (ALLOWED_SCHEMES.has(target.protocol)) return true;
    if ((target.protocol === "http:" || target.protocol === "https:") && isLocalHost(target.hostname)) {
      return true;
    }
    if (target.protocol === "https:" && isExpoAuthProxyHost(target.hostname)) {
      return true;
    }
    return false;
  } catch {
    return ALLOWED_SCHEMES.has(value.startsWith("exp://") ? "exp:" : value.startsWith("ledgr://") ? "ledgr:" : "");
  }
};

const buildAuthUrl = (baseUrl: string, realm: string, redirect: string, state: string) => {
  const returnTo = `${baseUrl}?state=${encodeURIComponent(state)}&redirect=${encodeURIComponent(redirect)}`;
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": realm,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  return `https://steamcommunity.com/openid/login?${params.toString()}`;
};

const extractSteamId = (claimedId?: string | null) => {
  if (!claimedId) return null;
  const match = claimedId.match(/\/(\d{17})(?:\/)?$/);
  return match?.[1] ?? null;
};

serve(async req => {
  const url = new URL(req.url);
  // ReconstrÃ³i a URL pÃºblica da funÃ§Ã£o usando o domÃ­nio canonical functions.supabase.co
  const forwardedHost = req.headers.get('x-forwarded-host') || url.host;
  const projectFromEnv = (Deno.env.get('SUPABASE_URL') || '').match(/^https?:\/\/([^.]+)\./)?.[1] || '';
  const projectRef = ((forwardedHost || '').split('.')?.[0]) || projectFromEnv || '';
  const functionName = 'steam_openid';
  const functionHost = `${projectRef}.functions.supabase.co`;
  const baseUrl = `https://${functionHost}/${functionName}`;

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
        "Access-Control-Allow-Headers": "authorization,content-type",
      },
    });
  }

  if (req.method === "POST") {
    let body: StartBody;
    try {
      body = await req.json();
    } catch {
      return errorJson("invalid_json", "JSON invÃƒÆ’Ã‚Â¡lido.", 400);
    }
    if (body.action !== "start") {
      return errorJson("invalid_action", "Informe action=start.", 400);
    }
    const redirectTo = typeof body.redirectTo === "string" ? body.redirectTo : "";
    if (!isAllowedRedirect(redirectTo)) {
      return errorJson("invalid_redirect", "Redirect nÃƒÆ’Ã‚Â£o permitido.", 400);
    }
    const state = randomState();
    const loginUrl = buildAuthUrl(baseUrl, `https://${functionHost}`, redirectTo, state);
    return json({ url: loginUrl, state });
  }

  if (req.method === "GET") {
    const redirect = url.searchParams.get("redirect");
    const state = url.searchParams.get("state") ?? "";

    if (!isAllowedRedirect(redirect)) {
      return new Response("Redirect invÃƒÆ’Ã‚Â¡lido.", { status: 400 });
    }

    const mode = url.searchParams.get("openid.mode");
    if (!mode) {
      return new Response("Fluxo OpenID invÃƒÆ’Ã‚Â¡lido.", { status: 400 });
    }

    const verifyParams = new URLSearchParams();
    for (const [key, value] of url.searchParams.entries()) {
      if (key.startsWith("openid.")) {
        verifyParams.set(key, value);
      }
    }
    verifyParams.set("openid.mode", "check_authentication");

    const verifyRes = await fetch("https://steamcommunity.com/openid/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: verifyParams.toString(),
    });

    const verifyText = await verifyRes.text();
    if (!/is_valid\s*:\s*true/i.test(verifyText)) {
      return new Response("NÃƒÆ’Ã‚Â£o foi possÃƒÆ’Ã‚Â­vel validar a resposta do Steam.", { status: 400 });
    }

    const steamid = extractSteamId(url.searchParams.get("openid.claimed_id"));
    if (!steamid) {
      return new Response("SteamID invÃƒÆ’Ã‚Â¡lido.", { status: 400 });
    }

    const target = new URL(redirect!);
    target.searchParams.set("steamid", steamid);
    if (state) target.searchParams.set("state", state);

      const finalUrl = target.toString();
  return new Response(null, {
    status: 302,
    headers: {
      "Location": finalUrl,
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Referrer-Policy": "no-referrer",
      "Content-Length": "0",
    },
  });
  }

  return new Response("Not found", { status: 404 });
});
