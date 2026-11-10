import json
import os
import re
import shutil
import subprocess
import sys
import time

ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")
ERROR_CHARS = 240
DOWNLOAD_WAIT_SECONDS = 180
FAILED_EXIT_WAIT_SECONDS = 5
STABLE_SECONDS = 2.0


def brief(text: str) -> str:
    lines = [ANSI.sub("", line).strip() for line in text.replace("\r", "\n").split("\n")]
    lines = [line for line in lines if line]
    if not lines:
        return "no output"
    recent = lines[-6:]
    pick = next(
        (line for line in reversed(recent) if re.search(r"error|failed|exception|unable|not found", line, re.I)),
        lines[-1],
    )
    return pick if len(pick) <= ERROR_CHARS else pick[: ERROR_CHARS - 3] + "..."


def find_spotdl() -> list[str]:
    exe = shutil.which("spotdl")
    if exe:
        return [exe]
    candidates = [
        r"C:\Python313\Scripts\spotdl.exe",
        os.path.join(os.path.dirname(sys.executable), "Scripts", "spotdl.exe"),
        os.path.join(os.path.dirname(sys.executable), "spotdl.exe"),
    ]
    for c in candidates:
        if os.path.isfile(c):
            return [c]
    return [sys.executable, "-m", "spotdl"]


def extract_metadata(mp3_path: str, out_jpg: str) -> dict:
    title = ""
    channel = ""
    duration_sec = 0.0
    try:
        from mutagen.id3 import ID3
        from mutagen.mp3 import MP3

        audio = MP3(mp3_path)
        duration_sec = float(audio.info.length or 0.0)
        tags = ID3(mp3_path)
        if "TIT2" in tags and tags["TIT2"].text:
            title = str(tags["TIT2"].text[0]).strip()
        if "TPE1" in tags and tags["TPE1"].text:
            channel = str(tags["TPE1"].text[0]).strip()
        for key, frame in tags.items():
            if key.startswith("APIC") and getattr(frame, "data", None):
                os.makedirs(os.path.dirname(os.path.abspath(out_jpg)), exist_ok=True)
                with open(out_jpg, "wb") as f:
                    f.write(frame.data)
                break
    except Exception:
        pass
    if not title:
        base = os.path.splitext(os.path.basename(mp3_path))[0]
        if " - " in base:
            parts = base.split(" - ", 1)
            channel = channel or parts[0].strip()
            title = parts[1].strip()
        else:
            title = base
    return {
        "title": title,
        "channel": channel,
        "durationSec": round(duration_sec, 2),
        "hasCover": os.path.isfile(out_jpg),
    }


def find_mp3s(folder: str) -> list[str]:
    return [
        os.path.join(root, name)
        for root, _dirs, names in os.walk(folder)
        for name in names
        if name.lower().endswith(".mp3")
    ]


def wait_for_mp3(folder: str, seconds: float) -> str | None:
    """spotdl can exit before the file is fully written, so the newest MP3 counts once its size stops changing."""
    deadline = time.monotonic() + seconds
    last_size = -1
    stable_since = time.monotonic()
    while time.monotonic() < deadline:
        mp3s = find_mp3s(folder)
        if mp3s:
            newest = max(mp3s, key=os.path.getmtime)
            size = os.path.getsize(newest)
            if size != last_size:
                last_size = size
                stable_since = time.monotonic()
            elif size > 0 and time.monotonic() - stable_since >= STABLE_SECONDS:
                return newest
        time.sleep(0.5)
    return None


def remove_tree(folder: str) -> None:
    for _ in range(10):
        if not os.path.exists(folder):
            return
        try:
            shutil.rmtree(folder)
            return
        except OSError:
            time.sleep(1)


def cmd_download(spotify_url: str, out_mp3: str, out_jpg: str) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(out_mp3)), exist_ok=True)
    if os.path.isfile(out_mp3) and os.path.getsize(out_mp3) >= 1024:
        print(json.dumps(extract_metadata(out_mp3, out_jpg), ensure_ascii=False))
        return
    stem = os.path.splitext(os.path.basename(out_mp3))[0]
    tmp_dir = os.path.join(os.path.dirname(os.path.abspath(out_mp3)), f"tmp_{stem}")
    os.makedirs(tmp_dir, exist_ok=True)
    try:
        # spotdl reads --output as a file name template; with {output-ext} the file gets a known name.
        template = os.path.join(tmp_dir, "track.{output-ext}")
        proc = subprocess.run(
            [*find_spotdl(), "download", spotify_url, "--output", template],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        wait = DOWNLOAD_WAIT_SECONDS if proc.returncode == 0 else FAILED_EXIT_WAIT_SECONDS
        downloaded = wait_for_mp3(tmp_dir, wait)
        if downloaded is None:
            raise RuntimeError(f"spotdl wrote no MP3 (exit {proc.returncode}): {brief(proc.stderr or proc.stdout or '')}")
        meta = extract_metadata(downloaded, out_jpg)
        shutil.move(downloaded, out_mp3)
        print(json.dumps(meta, ensure_ascii=False))
    finally:
        remove_tree(tmp_dir)


def cmd_transcribe(audio_path: str, accepted: str, model_size: str = "large-v3-turbo") -> None:
    from faster_whisper import WhisperModel

    try:
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"
    except Exception:
        device = "cpu"
    compute_type = "float16" if device == "cuda" else "int8"
    model = WhisperModel(model_size, device=device, compute_type=compute_type)
    # Whisper forced to a language it does not hear writes the speech in that language's spelling, so the language is detected instead.
    segments, info = model.transcribe(
        audio_path,
        language=None,
        beam_size=5,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=400),
    )
    wanted = [code for code in accepted.split(",") if code]
    cues = []
    if not wanted or info.language in wanted:
        for seg in segments:
            text = seg.text.strip()
            if not text:
                continue
            start = round(float(seg.start), 2)
            dur = round(max(0.2, float(seg.end) - float(seg.start)), 2)
            cues.append({"start": start, "dur": dur, "text": text})
    print(
        json.dumps(
            {
                "language": info.language,
                "durationSec": round(float(info.duration or 0.0), 2),
                "cues": cues,
            },
            ensure_ascii=False,
        )
    )


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) < 2:
        sys.exit("Usage: spotify_helper.py <download|transcribe|check> ...")
    action = sys.argv[1]
    if action == "check":
        ok = False
        try:
            import faster_whisper  # noqa: F401
            ok = True
        except Exception:
            ok = False
        print(json.dumps({"whisper": ok}))
    elif action == "download":
        if len(sys.argv) < 5:
            sys.exit("Usage: spotify_helper.py download <spotify_url> <out_mp3> <out_jpg>")
        cmd_download(sys.argv[2], sys.argv[3], sys.argv[4])
    elif action == "transcribe":
        if len(sys.argv) < 4:
            sys.exit("Usage: spotify_helper.py transcribe <audio_path> <languages,comma-separated> [model_size]")
        model_size = sys.argv[4] if len(sys.argv) >= 5 else "large-v3-turbo"
        cmd_transcribe(sys.argv[2], sys.argv[3], model_size)
    else:
        sys.exit(f"Unknown action: {action}")


if __name__ == "__main__":
    try:
        main()
    except Exception as err:
        print(f"error: {brief(str(err))}", file=sys.stderr)
        sys.exit(1)
