#!/usr/bin/env python3
"""
Spotify Audio Downloader & Transcriber
Downloads a Spotify track via spotdl and transcribes it using faster-whisper.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


def ensure_utf8_io():
    """Ensure standard streams support UTF-8 encoding on Windows."""
    if sys.platform == "win32":
        os.environ["PYTHONIOENCODING"] = "utf-8"
        os.environ["PYTHONUTF8"] = "1"
        try:
            if hasattr(sys.stdout, "reconfigure"):
                sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            if hasattr(sys.stderr, "reconfigure"):
                sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass


def ensure_deno_in_path():
    """Ensure spotdl's downloaded Deno binary is in PATH if present."""
    spotdl_dir = Path.home() / ".spotdl"
    if spotdl_dir.exists():
        path_env = os.environ.get("PATH", "")
        if str(spotdl_dir) not in path_env:
            os.environ["PATH"] = str(spotdl_dir) + os.pathsep + path_env


def format_timestamp_srt(seconds: float) -> str:
    """Format seconds into SRT timestamp HH:MM:SS,mmm"""
    hours, remainder = divmod(seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    millis = int((secs - int(secs)) * 1000)
    return f"{int(hours):02d}:{int(minutes):02d}:{int(secs):02d},{millis:03d}"


def download_spotify_track(url: str, output_dir: Path) -> Path:
    """Downloads a Spotify track using spotdl to output_dir and returns the downloaded audio file path."""
    output_dir.mkdir(parents=True, exist_ok=True)
    existing_files = set(output_dir.glob("*.mp3"))

    print(f"[1/2] Downloading Spotify track: {url}...")
    cmd = [
        sys.executable,
        "-m",
        "spotdl",
        "download",
        url,
        "--output",
        str(output_dir),
    ]

    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"

    proc = subprocess.run(cmd, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if proc.returncode != 0:
        # Check if error is benign logging or critical
        err_msg = proc.stderr or proc.stdout
        # Check if file was actually downloaded despite exit code
        new_files = [f for f in output_dir.glob("*.mp3") if f not in existing_files]
        if not new_files:
            raise RuntimeError(f"spotdl failed:\n{err_msg}")
        print("Note: spotdl exited with a warning, but download succeeded.")
    else:
        new_files = [f for f in output_dir.glob("*.mp3") if f not in existing_files]

    if not new_files:
        # Check any mp3 modified recently
        all_mp3s = sorted(output_dir.glob("*.mp3"), key=os.path.getmtime, reverse=True)
        if all_mp3s:
            downloaded = all_mp3s[0]
        else:
            raise FileNotFoundError("Could not find downloaded audio file in output directory.")
    else:
        downloaded = new_files[0]

    print(f"Downloaded audio: {downloaded.name} ({downloaded.stat().st_size / (1024*1024):.2f} MB)")
    return downloaded


def transcribe_audio(
    audio_path: Path,
    output_dir: Path,
    model_name: str = "base",
    language: str | None = None,
    device: str | None = None,
    export_formats: list[str] | None = None,
):
    """Transcribes the audio file using faster-whisper and writes txt, srt, and json transcripts."""
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        raise ImportError("faster-whisper is not installed. Install via: pip install faster-whisper")

    if export_formats is None or "all" in export_formats:
        export_formats = ["txt", "srt", "json"]

    if device is None:
        try:
            import torch
            device = "cuda" if torch.cuda.is_available() else "cpu"
        except ImportError:
            device = "cpu"

    compute_type = "float16" if device == "cuda" else "int8"
    print(f"[2/2] Loading Whisper model '{model_name}' on {device} ({compute_type})...")
    model = WhisperModel(model_name, device=device, compute_type=compute_type)

    print(f"Transcribing {audio_path.name}...")
    transcribe_kwargs = {}
    if language:
        transcribe_kwargs["language"] = language

    segments_gen, info = model.transcribe(str(audio_path), **transcribe_kwargs)
    print(f"Detected language: {info.language} (probability: {info.language_probability:.2f}), duration: {info.duration:.1f}s")

    base_name = audio_path.stem
    txt_path = output_dir / f"{base_name}.txt"
    srt_path = output_dir / f"{base_name}.srt"
    json_path = output_dir / f"{base_name}.json"

    segments_list = []
    txt_lines = []
    srt_lines = []

    for idx, s in enumerate(segments_gen, start=1):
        text = s.text.strip()
        txt_lines.append(text)
        segments_list.append({
            "id": idx,
            "start": round(s.start, 2),
            "end": round(s.end, 2),
            "text": text,
        })
        start_ts = format_timestamp_srt(s.start)
        end_ts = format_timestamp_srt(s.end)
        srt_lines.append(f"{idx}\n{start_ts} --> {end_ts}\n{text}\n")

    saved_files = {}

    if "txt" in export_formats:
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write("\n".join(txt_lines) + "\n")
        saved_files["txt"] = txt_path

    if "srt" in export_formats:
        with open(srt_path, "w", encoding="utf-8") as f:
            f.write("\n".join(srt_lines) + "\n")
        saved_files["srt"] = srt_path

    if "json" in export_formats:
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "audio_file": audio_path.name,
                    "language": info.language,
                    "duration": info.duration,
                    "segments": segments_list,
                },
                f,
                ensure_ascii=False,
                indent=2,
            )
        saved_files["json"] = json_path

    print("\n--- Transcription Complete ---")
    for fmt, p in saved_files.items():
        print(f"Saved {fmt.upper()}: {p}")

    return {
        "audio_path": audio_path,
        "language": info.language,
        "duration": info.duration,
        "segments": segments_list,
        "files": saved_files,
    }


def main():
    ensure_utf8_io()
    ensure_deno_in_path()

    parser = argparse.ArgumentParser(
        description="Download a track from Spotify and transcribe it with Whisper."
    )
    parser.add_argument("url", help="Spotify track, album, or playlist URL")
    parser.add_argument(
        "--output-dir",
        "-o",
        default="./transcripts",
        help="Directory to save MP3 and transcripts (default: ./transcripts)",
    )
    parser.add_argument(
        "--model",
        "-m",
        default="base",
        choices=["tiny", "base", "small", "medium", "large-v3"],
        help="Whisper model size (default: base)",
    )
    parser.add_argument(
        "--language",
        "-l",
        default=None,
        help="Language code (e.g. ru, en, sk). If omitted, auto-detected.",
    )
    parser.add_argument(
        "--device",
        "-d",
        default=None,
        choices=["cuda", "cpu"],
        help="Device to run Whisper on (default: auto-detected)",
    )
    parser.add_argument(
        "--format",
        "-f",
        nargs="+",
        default=["all"],
        choices=["txt", "srt", "json", "all"],
        help="Transcript formats to produce (default: all)",
    )

    args = parser.parse_args()
    out_dir = Path(args.output_dir).resolve()

    audio_path = download_spotify_track(args.url, out_dir)
    transcribe_audio(
        audio_path=audio_path,
        output_dir=out_dir,
        model_name=args.model,
        language=args.language,
        device=args.device,
        export_formats=args.format,
    )


if __name__ == "__main__":
    main()
