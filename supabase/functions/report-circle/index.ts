// "לדווח על המעגל" (design-v2 §9). Anyone can report; a Turnstile check keeps
// bots out, and a salted hash of the IP makes "3 separate reports" mean three
// different people. The raw IP is never stored. 3 reports hide the circle until
// the founder checks it; the person who opened it is not notified.
import { createClient } from "npm:@supabase/supabase-js@2";
import { clientIp, cors, json, sha256, turnstileOk } from "../_shared/http.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "method" }, 405);
  let body: { id?: string; reason?: string; captchaToken?: string };
  try {
    body = await req.json();
  } catch {
    return json(req, { ok: false, error: "bad_request" }, 400);
  }
  if (!body.id || !/^[0-9a-f-]{36}$/i.test(body.id)) return json(req, { ok: false, error: "bad_request" }, 400);
  const ip = clientIp(req);
  if (!(await turnstileOk(body.captchaToken, ip))) return json(req, { ok: false, error: "captcha" }, 403);
  const salt = Deno.env.get("REPORT_SALT") ?? "";
  const reporter = await sha256(`${salt}|${ip || crypto.randomUUID()}`);
  const res = await supabase.rpc("report_circle_as", {
    p_id: body.id, p_reporter_hash: reporter, p_reason: (body.reason ?? "").slice(0, 300),
  });
  if (res.error) return json(req, { ok: false, error: "server" }, 500);
  return json(req, res.data);
});
