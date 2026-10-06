"""The music bed and mix shared by every meditation on the site.

Used by tech/tools/mix-meditation-audio.py (the three computer-voiced
meditations) and by the recordings worker (teachers who tick "להוסיף מוזיקת רקע",
design-v2 §9: the same music and the same settings). Needs ffmpeg."""
import subprocess

PRE, TAIL = 3.0, 6.0  # seconds of music before the voice, and quiet ending after it
# soft D-A-E-F#-D pad with slow breath-like swells (same chord as the in-browser pad)
NOTES = [(146.83, .050, -4), (220.0, .073, 4), (329.63, .096, -4), (369.99, .119, 4), (293.66, .142, -4)]
EXPR = "+".join(f"0.18*sin(2*PI*{f*(2**(c/1200)):.3f}*t)*(0.6+0.4*sin(2*PI*{l}*t+{i}))" for i, (f, l, c) in enumerate(NOTES))
ENCODE = ["-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "80k"]


def duration(path):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)]))


def mix(voice, out, title, artist, voice_filter=None):
    """voice + music bed -> mono 80 kbps MP3. Returns the total length in seconds.
    voice_filter: optional ffmpeg filter for the voice first (e.g. loudness for uploads)."""
    total = PRE + duration(voice) + TAIL
    v = f"[1]{voice_filter + ',' if voice_filter else ''}adelay={int(PRE*1000)},apad=whole_dur={total}[v];"
    subprocess.run(["ffmpeg", "-v", "error", "-y",
        "-f", "lavfi", "-i", f"aevalsrc='{EXPR}':s=44100:d={total}",
        "-i", str(voice),
        "-filter_complex",
        f"[0]lowpass=f=900,loudnorm=I=-37:TP=-6:LRA=7,afade=t=in:d=4,afade=t=out:st={total-6}:d=6[m];"
        + v +
        "[v][m]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95",
        *ENCODE, "-metadata", "title=" + title, "-metadata", "artist=" + artist,
        str(out)], check=True)
    return total


def encode_voice_only(voice, out, title, artist, voice_filter=None):
    """No music: just the (optionally filtered) voice as mono 80 kbps MP3."""
    args = ["ffmpeg", "-v", "error", "-y", "-i", str(voice)]
    if voice_filter:
        args += ["-af", voice_filter]
    subprocess.run(args + [*ENCODE, "-metadata", "title=" + title, "-metadata", "artist=" + artist, str(out)], check=True)
    return duration(out)
