"""Mix meditation voice tracks with a quiet music bed and write stanza timings.

Usage (from the repo root):  python3 tech/tools/mix-meditation-audio.py <voice-dir> [<id> ...]
<voice-dir> holds <id>.voice.mp3 files (any prefix before the id is fine).
With ids, only those meditations are mixed; without, every <id>.voice.mp3 in <voice-dir>
that has a script in site/content/meditations/<id>.md.
Writes site/content/meditations/audio/<id>.mp3 and <id>.json. Needs ffmpeg.
Stanza timings come from silence detection: gaps of 1.5 s or more must match
the script's stanza breaks (blank lines / [שקט] markers), or the script stops."""
import subprocess, re, json, sys, pathlib
U = pathlib.Path(sys.argv[1])
OUT = pathlib.Path("site/content/meditations/audio"); OUT.mkdir(parents=True, exist_ok=True)
PRE, TAIL = 3.0, 6.0
# soft D-A-E-F#-D pad with slow breath-like swells (same chord as the in-browser pad)
notes = [(146.83, .050, -4), (220.0, .073, 4), (329.63, .096, -4), (369.99, .119, 4), (293.66, .142, -4)]
expr = "+".join(f"0.18*sin(2*PI*{f*(2**(c/1200)):.3f}*t)*(0.6+0.4*sin(2*PI*{l}*t+{i}))" for i, (f, l, c) in enumerate(notes))

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

names = sys.argv[2:] or sorted({m.group(1) for f in U.glob("*.voice.mp3")
                                 for m in [re.search(r"([a-z0-9-]+)\.voice\.mp3$", f.name)]
                                 if m and pathlib.Path(f"site/content/meditations/{m.group(1)}.md").exists()})
for name in names:
    src = next(U.glob(f"*{name}.voice.mp3"))
    dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src]))
    log = subprocess.run(["ffmpeg", "-v", "info", "-i", src, "-af", "silencedetect=n=-45dB:d=1.5", "-f", "null", "-"], capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", log)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
    sil = [(a, b) for a, b in zip(starts, ends) if a > 0.3 and b < dur - 0.3]   # interior gaps only
    st = stanzas(name)
    assert len(sil) == len(st) - 1, (name, len(sil), len(st))
    bounds = [0.0] + [x for a, b in sil for x in (a, b)] + [dur]
    timings = [{"start": round(bounds[2*i] + PRE, 2), "end": round(bounds[2*i+1] + PRE, 2), "text": t} for i, t in enumerate(st)]
    total = PRE + dur + TAIL
    subprocess.run(["ffmpeg", "-v", "error", "-y",
        "-f", "lavfi", "-i", f"aevalsrc='{expr}':s=44100:d={total}",
        "-i", str(src),
        "-filter_complex",
        f"[0]lowpass=f=900,loudnorm=I=-37:TP=-6:LRA=7,afade=t=in:d=4,afade=t=out:st={total-6}:d=6[m];"
        f"[1]adelay={int(PRE*1000)},apad=whole_dur={total}[v];"
        "[v][m]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95",
        "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "80k",
        "-metadata", "title=" + name, "-metadata", "artist=נוכחים (קול: ElevenLabs)",
        str(OUT / f"{name}.mp3")], check=True)
    (OUT / f"{name}.json").write_text(json.dumps({"duration": round(total, 2), "stanzas": timings}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(name, round(total, 1), "s", len(timings), "stanzas")
