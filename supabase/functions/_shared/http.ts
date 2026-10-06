// Shared helpers for the edge functions: CORS for the site's origins, JSON replies.
const ALLOWED = (Deno.env.get("SITE_ORIGINS") ?? "https://gevasaf.github.io")
  .split(",").map((s) => s.trim()).filter(Boolean);

export function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.includes(origin) ? origin : ALLOWED[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

export function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") ??
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
}

// Cloudflare Turnstile (stack F6). Without a secret configured, checks are skipped
// so local development works; production sets TURNSTILE_SECRET.
export async function turnstileOk(token: string | undefined, ip: string): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET");
  if (!secret) return true;
  if (!token) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  const data = await r.json().catch(() => ({}));
  return data.success === true;
}

export async function sha256(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
