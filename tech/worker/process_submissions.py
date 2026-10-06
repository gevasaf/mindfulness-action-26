"""v2 worker: processes teacher recordings and keeps personal data on schedule.

Runs every ~10 minutes in GitHub Actions (.github/workflows/worker.yml; stack
F7). Each run:

1. New uploads (status "uploaded"): check the length (3-15 minutes, design-v2
   §9), make the version that will be published (mono 80 kbps MP3; with the
   site's music bed if the teacher asked, same mix as the existing meditations),
   transcribe it (ElevenLabs Scribe), and rate it with Claude against the
   project's rules. Then status "review": the founder decides in admin.html.
   Nothing is ever published without the founder's approval.
2. Approved ("approved"): copy the audio and photo to the public "media"
   bucket and mark "published"; the meditations page lists it from then on.
3. Removed by the founder ("removed"): delete the public files.
4. From 30.11.2026 (Israel time): purge_personal_data() and delete the phone
   sign-in accounts. Published meditations stay, without phone numbers.

Environment: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ELEVENLABS_API_KEY,
ANTHROPIC_API_KEY (the last two optional: without them that step is skipped
and noted for the founder). Needs ffmpeg.
"""
import datetime as dt
import json
import os
import pathlib
import sys
import tempfile
import urllib.parse
import zoneinfo

import requests

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "tools"))
from meditation_mix import duration, encode_voice_only, mix  # noqa: E402

URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
MIN_SEC, MAX_SEC = 3 * 60 - 15, 15 * 60 + 30  # design: 3 to 15 minutes, with a little slack
VOICE_FILTER = "highpass=f=70,loudnorm=I=-18:TP=-2:LRA=9"  # even out phone recordings
PURGE_FROM = dt.date(2026, 11, 30)


# ---------------------------------------------------------------- Supabase REST

def rows(status):
    r = requests.get(f"{URL}/rest/v1/submissions", headers=H,
                     params={"status": f"eq.{status}", "select": "*", "order": "created_at"}, timeout=30)
    r.raise_for_status()
    return r.json()


def update(sid, **fields):
    r = requests.patch(f"{URL}/rest/v1/submissions", headers={**H, "Prefer": "return=minimal"},
                       params={"id": f"eq.{sid}"}, json=fields, timeout=30)
    r.raise_for_status()


def download(bucket, path, dest):
    r = requests.get(f"{URL}/storage/v1/object/{bucket}/{urllib.parse.quote(path)}", headers=H, timeout=300)
    r.raise_for_status()
    pathlib.Path(dest).write_bytes(r.content)


def upload(bucket, path, src, content_type):
    with open(src, "rb") as f:
        r = requests.post(f"{URL}/storage/v1/object/{bucket}/{urllib.parse.quote(path)}",
                          headers={**H, "Content-Type": content_type, "x-upsert": "true",
                                   "Cache-Control": "max-age=31536000"},
                          data=f, timeout=300)
    r.raise_for_status()


def remove(bucket, paths):
    if paths:
        requests.delete(f"{URL}/storage/v1/object/{bucket}", headers=H, json={"prefixes": paths}, timeout=60)


def public_url(bucket, path):
    return f"{URL}/storage/v1/object/public/{bucket}/{urllib.parse.quote(path)}"


# ---------------------------------------------------------------- transcription and review

def transcribe(path):
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        return None
    with open(path, "rb") as f:
        r = requests.post("https://api.elevenlabs.io/v1/speech-to-text", headers={"xi-api-key": key},
                          data={"model_id": os.environ.get("STT_MODEL", "scribe_v2"), "language_code": "heb",
                                "tag_audio_events": "false"},
                          files={"file": (pathlib.Path(path).name, f, "audio/mpeg")}, timeout=600)
    r.raise_for_status()
    return r.json().get("text", "").strip()


REVIEW_SYSTEM = """You help the founder of "נוֹכְחִים" review meditations that mindfulness teachers recorded for a non-partisan Israeli civic project before the 27.10.2026 Knesset elections. The project invites everyone who lives in Israel, whatever their views, to stop, breathe, digest the hard recent years, connect to their own values, and reach the moment of voting present. It never says whom to vote for.

You get the teacher's title and description and a speech-to-text transcript (it may contain recognition errors; don't penalise those). A human makes the final decision; you only advise.

Rate:
- relevance (1-5): how well it serves that purpose as a meditation (stopping, breathing, presence, digesting, values, the moment of choice).
- violations: each passage that breaks a rule, with the rule, a short quote from the transcript, and a one-sentence Hebrew explanation. Rules: (partisan) names or hints at a party, candidate, bloc, "coalition"/"opposition"; (voting_advice) says how or for whom to vote; (us_vs_them) political camps, blaming a side; (fear) a frightening future tied to an election result, "last chance"; (trauma) asks to relive traumatic events in detail, or lacks any reminder that one may stop or any grounding at the end; (promotion) workshops, phone numbers, websites, products; (offensive) insults, hate. Treat every side of the political map exactly the same. No violations: an empty list.
- suggested_tags: any of "home" (at home), "way" (on the way, eyes open), "sleep" (before sleep) that fit.
- summary_he: two short Hebrew sentences for the founder: what the meditation does, and whether anything needs a careful listen."""

REVIEW_SCHEMA = {
    "type": "object",
    "properties": {
        "relevance": {"type": "integer", "enum": [1, 2, 3, 4, 5]},
        "violations": {"type": "array", "items": {
            "type": "object",
            "properties": {
                "rule": {"type": "string", "enum": ["partisan", "voting_advice", "us_vs_them", "fear", "trauma", "promotion", "offensive"]},
                "quote": {"type": "string"},
                "explanation_he": {"type": "string"},
            },
            "required": ["rule", "quote", "explanation_he"], "additionalProperties": False}},
        "suggested_tags": {"type": "array", "items": {"type": "string", "enum": ["home", "way", "sleep"]}},
        "summary_he": {"type": "string"},
    },
    "required": ["relevance", "violations", "suggested_tags", "summary_he"],
    "additionalProperties": False,
}


def ai_review(sub, transcript):
    if not os.environ.get("ANTHROPIC_API_KEY") or not transcript:
        return None
    import anthropic
    client = anthropic.Anthropic()
    content = json.dumps({"title": sub["title"], "description": sub["description"], "transcript": transcript}, ensure_ascii=False)
    response = client.beta.messages.create(
        model="claude-opus-5-5",
        max_tokens=16000,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        output_config={"effort": "medium", "format": {"type": "json_schema", "schema": REVIEW_SCHEMA}},
        system=REVIEW_SYSTEM,
        messages=[{"role": "user", "content": content}],
    )
    if response.stop_reason == "refusal":
        return {"error": "refusal"}
    text = next(b.text for b in response.content if b.type == "text")
    return json.loads(text)


# ---------------------------------------------------------------- steps

def process_new():
    for sub in rows("uploaded"):
        sid = sub["id"]
        print("processing", sid)
        update(sid, status="processing")
        try:
            with tempfile.TemporaryDirectory() as tmp:
                src = pathlib.Path(tmp) / ("original" + pathlib.Path(sub["audio_path"]).suffix)
                download("submissions", sub["audio_path"], src)
                length = duration(src)
                if not MIN_SEC <= length <= MAX_SEC:
                    update(sid, status="failed", duration_sec=round(length),
                           status_note=f"אורך {round(length / 60, 1)} דקות, מחוץ לטווח של 3 עד 15 דקות")
                    continue
                out = pathlib.Path(tmp) / "published.mp3"
                artist = f"{sub['teacher_name']} · נוֹכְחִים"
                if sub["add_music"]:
                    total = mix(src, out, sub["title"], artist, voice_filter=VOICE_FILTER)
                else:
                    total = encode_voice_only(src, out, sub["title"], artist, voice_filter=VOICE_FILTER)
                mixed_path = f"{sub['owner_id']}/{sid}.published.mp3"
                upload("submissions", mixed_path, out, "audio/mpeg")
                notes = []
                try:
                    transcript = transcribe(out)
                except Exception as e:  # noqa: BLE001 - keep going; the founder can still listen
                    transcript, notes = None, notes + [f"התמלול נכשל: {e}"]
                try:
                    review = ai_review(sub, transcript)
                except Exception as e:  # noqa: BLE001
                    review, notes = None, notes + [f"הדירוג נכשל: {e}"]
                if transcript is None:
                    notes.append("אין תמלול")
                if review is None:
                    notes.append("אין דירוג אוטומטי")
                update(sid, status="review", duration_sec=round(total), mixed_path=mixed_path,
                       transcript=transcript, ai_review=review, status_note="; ".join(notes) or None)
        except Exception as e:  # noqa: BLE001 - leave it visible to the founder rather than stuck
            print("failed", sid, e)
            update(sid, status="failed", status_note=f"שגיאה בעיבוד: {e}"[:500])


def publish_approved():
    for sub in rows("approved"):
        sid = sub["id"]
        print("publishing", sid)
        with tempfile.TemporaryDirectory() as tmp:
            audio = pathlib.Path(tmp) / "a.mp3"
            photo = pathlib.Path(tmp) / "p"
            download("submissions", sub["mixed_path"], audio)
            download("submissions", sub["photo_path"], photo)
            ext = pathlib.Path(sub["photo_path"]).suffix.lower() or ".jpg"
            ctype = {".png": "image/png", ".webp": "image/webp"}.get(ext, "image/jpeg")
            upload("media", f"meditations/{sid}.mp3", audio, "audio/mpeg")
            upload("media", f"teachers/{sid}{ext}", photo, ctype)
        update(sid, status="published", public_audio=public_url("media", f"meditations/{sid}.mp3"),
               public_photo=public_url("media", f"teachers/{sid}{ext}"),
               published_at=dt.datetime.now(dt.timezone.utc).isoformat())


def unpublish_removed():
    for sub in rows("removed"):
        if not sub.get("public_audio"):
            continue
        sid = sub["id"]
        print("removing", sid)
        ext = pathlib.Path(sub["photo_path"]).suffix.lower() or ".jpg"
        remove("media", [f"meditations/{sid}.mp3", f"teachers/{sid}{ext}"])
        update(sid, public_audio=None, public_photo=None)


def purge_if_due():
    today = dt.datetime.now(zoneinfo.ZoneInfo("Asia/Jerusalem")).date()
    if today < PURGE_FROM:
        return
    # Originals of recordings that were never published go with the rest.
    for sub in requests.get(f"{URL}/rest/v1/submissions", headers=H,
                            params={"status": "neq.published", "select": "audio_path,photo_path,mixed_path"},
                            timeout=30).json():
        remove("submissions", [p for p in (sub.get("audio_path"), sub.get("photo_path"), sub.get("mixed_path")) if p])
    r = requests.post(f"{URL}/rest/v1/rpc/purge_personal_data", headers=H, json={}, timeout=60)
    print("purge:", r.status_code, r.text[:200])
    # Phone sign-in accounts (Supabase Auth): delete them all.
    while True:
        users = requests.get(f"{URL}/auth/v1/admin/users", headers=H, params={"per_page": 200}, timeout=30).json().get("users", [])
        if not users:
            break
        for u in users:
            requests.delete(f"{URL}/auth/v1/admin/users/{u['id']}", headers=H, timeout=30)
        print("deleted", len(users), "accounts")


if __name__ == "__main__":
    process_new()
    publish_approved()
    unpublish_removed()
    purge_if_due()
