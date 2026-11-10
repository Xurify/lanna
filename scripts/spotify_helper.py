import json
import os
import shutil
import subprocess
import sys


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


def cmd_download(spotify_url: str, out_mp3: str, out_jpg: str) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(out_mp3)), exist_ok=True)
    if not os.path.isfile(out_mp3) or os.path.getsize(out_mp3) < 1024:
        tmp_dir = os.path.join(
            os.path.dirname(os.path.abspath(out_mp3)),
            f".tmp_{os.path.splitext(os.path.basename(out_mp3))[0]}",
        )
        os.makedirs(tmp_dir, exist_ok=True)
        try:
            cmd = [*find_spotdl(), "download", spotify_url, "--output", tmp_dir]
            proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
            mp3s = [
                os.path.join(tmp_dir, f)
                for f in os.listdir(tmp_dir)
                if f.lower().endswith(".mp3")
            ]
            if not mp3s:
                raise RuntimeError(
                    f"spotdl did not produce an MP3 file (exit {proc.returncode}): {(proc.stderr or proc.stdout).strip()[-400:]}"
                )
            downloaded = max(mp3s, key=os.path.getmtime)
            meta = extract_metadata(downloaded, out_jpg)
            shutil.move(downloaded, out_mp3)
            print(json.dumps(meta, ensure_ascii=False))
            return
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)
    meta = extract_metadata(out_mp3, out_jpg)
    print(json.dumps(meta, ensure_ascii=False))


def cmd_transcribe(audio_path: str, lang: str, model_size: str = "large-v3-turbo") -> None:
    from faster_whisper import WhisperModel

    try:
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"
    except Exception:
        device = "cpu"
    compute_type = "float16" if device == "cuda" else "int8"
    model = WhisperModel(model_size, device=device, compute_type=compute_type)
    segments, info = model.transcribe(
        audio_path,
        language=lang if lang else None,
        beam_size=5,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=400),
    )
    cues = []
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
            sys.exit("Usage: spotify_helper.py transcribe <audio_path> <lang> [model_size]")
        model_size = sys.argv[4] if len(sys.argv) >= 5 else "large-v3-turbo"
        cmd_transcribe(sys.argv[2], sys.argv[3], model_size)
    else:
        sys.exit(f"Unknown action: {action}")


if __name__ == "__main__":
    main()
