"""Make the hero video's eased ping-pong loop (step 1 of 2).

Usage: python3 tech/tools/video-pingpong.py SRC.mp4 half.mp4
Writes the forward half: speed eases to zero at both ends, colour muted toward
the sand/sage palette. Step 2 (ffmpeg) appends the reversed half and encodes:
  N=$(ffprobe -v error -count_frames -select_streams v -show_entries stream=nb_read_frames -of csv=p=0 half.mp4); M=$((N-1))
  ffmpeg -i half.mp4 -filter_complex "[0]split[a][b];[a]trim=end_frame=$M,setpts=PTS-STARTPTS[f];[b]reverse,trim=end_frame=$M,setpts=PTS-STARTPTS[r];[f][r]concat=n=2:v=1[o]" -map "[o]" -c:v libx264 -crf 8 loop.mp4
  ffmpeg -i loop.mp4 -vf scale=960:540 -c:v libx264 -crf 30 -preset slow -pix_fmt yuv420p -movflags +faststart -an site/assets/video/hero.mp4
  ffmpeg -i loop.mp4 -vf scale=960:540 -c:v libvpx-vp9 -crf 42 -b:v 0 -an site/assets/video/hero.webm
Needs ffmpeg and numpy."""
import subprocess, sys, math
import numpy as np

SRC, OUT = sys.argv[1], sys.argv[2]
W, H, FPS = 1280, 720, 30000 / 1001
START, END = 0.3, 13.7          # usable span of the source, seconds
RAMP = 1.8                      # seconds of ease at each turn

# colour: mute the saturated yellow/orange toward sand + sage (design-v0 §7)
VF = f"scale={W}:{H},eq=saturation=0.55:brightness=0.02:gamma=1.05,colorbalance=rs=-0.04:bs=0.03:rm=-0.03:bm=0.02"
dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", SRC, "-vf", VF, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                       stdout=subprocess.PIPE)
frames = []
fs = W * H * 3
while True:
    b = dec.stdout.read(fs)
    if len(b) < fs: break
    frames.append(np.frombuffer(b, np.uint8).reshape(H, W, 3))
dec.wait()
n = len(frames)
print("source frames", n)

L = END - START
half = L + RAMP                  # output duration of one direction
def pos(t):                      # source seconds travelled after t output seconds
    if t < RAMP:                 # v = (1-cos(pi t/R))/2
        return t / 2 - RAMP / (2 * math.pi) * math.sin(math.pi * t / RAMP)
    if t < half - RAMP:
        return RAMP / 2 + (t - RAMP)
    return L - pos(half - t)

out_n = int(round(half * FPS))
enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                        "-r", "30000/1001", "-i", "-", "-c:v", "libx264", "-crf", "10", "-preset", "fast",
                        "-pix_fmt", "yuv420p", OUT], stdin=subprocess.PIPE)
for k in range(out_n + 1):       # include the final frame (the turn point)
    t = k * half / out_n
    s = (START + pos(t)) * FPS
    i = min(int(s), n - 2); a = s - i
    f = frames[i] if a < 0.02 else (frames[i] * (1 - a) + frames[i + 1] * a).astype(np.uint8)
    enc.stdin.write(f.tobytes())
enc.stdin.close(); enc.wait()
print("half frames", out_n + 1, "half seconds", round(half, 2))
