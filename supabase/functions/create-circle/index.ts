// Opens a practice circle (design-v2 §9).
// 1. The caller must be signed in with a verified phone (Supabase phone OTP).
// 2. The database repeats every sanity check of the form (create_circle_as, dry run).
// 3. Claude checks the texts for party or candidate names, voting advice,
//    "us vs. them", offensive words and self-promotion (design-v2 §9: "אפשר להוסיף
//    בדיקה אוטומטית בעזרת בינה מלאכותית, בלי אדם").
// 4. The circle is saved and goes up at once. If the AI check could not run,
//    the circle still goes up, marked for the founder to look at.
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";
import { cors, json } from "../_shared/http.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const SYSTEM = `You review the short texts of a practice circle that a volunteer is opening on "נוֹכְחִים", a non-partisan Israeli civic mindfulness project before the 27.10.2026 Knesset elections. Circles are 30 minutes of breathing and silence, open to everyone who lives in Israel, whatever their views.

Block the text (allowed = false) if it does any of these:
- names or hints at a political party, candidate, list, bloc, "coalition" or "opposition", or a politician;
- tells people how or for whom to vote, or carries a campaign or protest slogan;
- frames people as political camps ("us" against "them"), blames a side, or uses fear about a particular election result;
- contains insults, hate, profanity or sexual content;
- advertises a business, a paid workshop, or other self-promotion.

Allow it otherwise. Mentioning the elections, voting in general, the date 27.10, breathing, meditation, mindfulness, quiet, neighbours, a park or a library is fine. Judge the content, not the writing quality. Treat every side of the political map exactly the same.

When you block, write reason_he: one short, gentle Hebrew sentence that tells the person what to rephrase, without repeating the problematic words.`;

const SCHEMA = {
  type: "object",
  properties: {
    allowed: { type: "boolean" },
    category: { type: "string", enum: ["ok", "partisan", "voting_advice", "us_vs_them", "offensive", "promotion"] },
    reason_he: { type: "string" },
  },
  required: ["allowed", "category", "reason_he"],
  additionalProperties: false,
};

type Verdict = { allowed: boolean; category: string; reason_he: string };

async function aiCheck(p: Record<string, unknown>): Promise<Verdict | null> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return null;
  const client = new Anthropic({ apiKey: key, maxRetries: 1, timeout: 25_000 });
  const texts = { title: p.title, description: p.description, place_name: p.place_name, first_name: p.first_name };
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 1024,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: JSON.stringify(texts) }],
      // deno-lint-ignore no-explicit-any
    } as any);
    if (response.stop_reason === "refusal") return null; // could not judge: let the founder look
    const text = response.content.find((b: { type: string }) => b.type === "text") as { text: string } | undefined;
    return text ? JSON.parse(text.text) as Verdict : null;
  } catch (e) {
    console.error("ai check failed", e instanceof Error ? e.message : e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "method" }, 405);

  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await supabase.auth.getUser(jwt);
  const user = auth?.user;
  if (!user?.phone || !user.phone_confirmed_at) return json(req, { ok: false, error: "auth" }, 401);

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()).circle;
    if (!payload || typeof payload !== "object") throw new Error("no circle");
  } catch {
    return json(req, { ok: false, error: "bad_request" }, 400);
  }

  const dry = await supabase.rpc("create_circle_as", { p_owner: user.id, p_phone: user.phone, p: payload, p_dry_run: true });
  if (dry.error) return json(req, { ok: false, error: "server" }, 500);
  if (!dry.data?.ok) return json(req, dry.data);

  const verdict = await aiCheck(payload);
  if (verdict && !verdict.allowed) {
    return json(req, { ok: false, error: "text_ai", category: verdict.category, message: verdict.reason_he });
  }

  const res = await supabase.rpc("create_circle_as", {
    p_owner: user.id, p_phone: user.phone, p: payload, p_dry_run: false, p_needs_review: verdict === null,
  });
  if (res.error) return json(req, { ok: false, error: "server" }, 500);
  return json(req, res.data);
});
