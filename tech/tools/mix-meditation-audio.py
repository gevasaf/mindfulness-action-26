"""Mix meditation voice tracks with a quiet music bed and write stanza timings.

Usage (from the repo root):  python3 tech/tools/mix-meditation-audio.py <voice-dir>
<voice-dir> holds <id>.voice.mp3 files (any prefix before the id is fine).
Writes site/content/meditations/audio/<id>.mp3 and <id>.json. Needs ffmpeg.
Stanza timings come from silence detection: gaps of 1.5 s or more must match
the script's stanza breaks (blank lines / [שקט] markers), or the script stops."""
import subprocess, re, json, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
U = pathlib.Path(sys.argv[1])
OUT = pathlib.Path("site/content/meditations/audio"); OUT.mkdir(parents=True, exist_ok=True)
from meditation_mix import PRE, TAIL, duration, mix  # shared with the v2 worker

def stanzas(name):
    s = open(f"site/content/meditations/{name}.md", encoding="utf-8").read().split("\n---\n", 1)[1]
    out, cur = [], []
    for l in s.split("\n"):
        l = l.strip()
        if not l or l.startswith("[שקט"):
            if cur: out.append("\n".join(cur)); cur = []
        else: cur.append(l)
    if cur: out.append("\n".join(cur))
    return out

for name in ["behind-the-curtain", "clarity-in-the-noise", "on-the-way-to-vote"]:
    src = next(U.glob(f"*{name}.voice.mp3"))
    dur = duration(src)
    log = subprocess.run(["ffmpeg", "-v", "info", "-i", src, "-af", "silencedetect=n=-45dB:d=1.5", "-f", "null", "-"], capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", log)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
    sil = [(a, b) for a, b in zip(starts, ends) if a > 0.3 and b < dur - 0.3]   # interior gaps only
    st = stanzas(name)
    assert len(sil) == len(st) - 1, (name, len(sil), len(st))
    bounds = [0.0] + [x for a, b in sil for x in (a, b)] + [dur]
    timings = [{"start": round(bounds[2*i] + PRE, 2), "end": round(bounds[2*i+1] + PRE, 2), "text": t} for i, t in enumerate(st)]
    total = mix(src, OUT / f"{name}.mp3", name, "נוכחים (קול: ElevenLabs)")
    (OUT / f"{name}.json").write_text(json.dumps({"duration": round(total, 2), "stanzas": timings}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(name, round(total, 1), "s", len(timings), "stanzas")
