import os
import subprocess
import uuid
import hashlib
import unicodedata
from pathlib import Path

from gtts import gTTS
from sqlalchemy.orm import Session

from app.config import PIPER_BIN, PIPER_MODEL_PATH, PIPER_CONFIG_PATH, PIPER_SPEAKER_ID
from app.models.generated_audio import GeneratedAudio

AUDIO_DIR = "audio"
os.makedirs(AUDIO_DIR, exist_ok=True)


def _to_public_audio_path(file_path: str) -> str:
    """Convert a generated local file path into a static URL path."""
    filename = Path(file_path).name
    return f"/audio/{filename}"


def _to_db_audio_url(audio_key: str) -> str:
    return f"/ai/audio/{audio_key}"


def _persist_audio_blob(db: Session, audio_key: str, mime_type: str, file_path: str) -> str:
    with open(file_path, "rb") as audio_file:
        payload = audio_file.read()

    existing = db.query(GeneratedAudio).filter(GeneratedAudio.audio_key == audio_key).first()
    if existing:
        return _to_db_audio_url(audio_key)

    db.add(GeneratedAudio(audio_key=audio_key, mime_type=mime_type, data=payload))
    db.commit()
    return _to_db_audio_url(audio_key)


def _run_piper(command: list[str], payload: bytes) -> tuple[bool, str]:
    try:
        result = subprocess.run(
            command,
            input=payload,
            capture_output=True,
            check=True,
        )
        return True, ""
    except FileNotFoundError as exc:
        raise RuntimeError(f"Piper executable not found: {PIPER_BIN}") from exc
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or b"").decode("utf-8", errors="ignore").strip()
        stdout = (exc.stdout or b"").decode("utf-8", errors="ignore").strip()
        details = stderr or stdout or f"exit code {exc.returncode}"
        return False, details


def _run_gtts(text: str, file_path: str) -> None:
    tts = gTTS(text=text, lang="en")
    tts.save(file_path)


def text_to_speech(text: str, db: Session | None = None) -> str:
    clean_text = (text or "").strip()
    if not clean_text:
        raise RuntimeError("Cannot synthesize empty text")

    # Normalize text so unusual Unicode symbols don't break downstream tools.
    clean_text = unicodedata.normalize("NFKC", clean_text)

    # Reuse audio for identical text so repeated starts are instant.
    cache_key = hashlib.sha1(clean_text.encode("utf-8", errors="ignore")).hexdigest()[:20]

    if db is not None:
        existing = db.query(GeneratedAudio).filter(GeneratedAudio.audio_key == cache_key).first()
        if existing:
            return _to_db_audio_url(cache_key)

    wav_filename = f"{cache_key}.wav"
    wav_file_path = os.path.join(AUDIO_DIR, wav_filename)

    if not PIPER_MODEL_PATH:
        raise RuntimeError("PIPER_MODEL_PATH is not configured")

    payload = (clean_text + "\n").encode("utf-8", errors="replace")

    command = [PIPER_BIN, "--model", PIPER_MODEL_PATH, "--output_file", wav_file_path]

    if PIPER_CONFIG_PATH:
        command.extend(["--config", PIPER_CONFIG_PATH])

    if PIPER_SPEAKER_ID:
        command.extend(["--speaker", PIPER_SPEAKER_ID])

    # Try configured command first.
    ok, error = _run_piper(command, payload)

    # Common Windows issue: invalid speaker id for single-speaker model.
    if not ok and PIPER_SPEAKER_ID:
        fallback_command = [PIPER_BIN, "--model", PIPER_MODEL_PATH, "--output_file", wav_file_path]
        if PIPER_CONFIG_PATH:
            fallback_command.extend(["--config", PIPER_CONFIG_PATH])
        ok, error = _run_piper(fallback_command, payload)

    # Final fallback: model only.
    if not ok:
        minimal_command = [PIPER_BIN, "--model", PIPER_MODEL_PATH, "--output_file", wav_file_path]
        ok, error = _run_piper(minimal_command, payload)

    if ok and os.path.exists(wav_file_path):
        if db is not None:
            try:
                return _persist_audio_blob(db, cache_key, "audio/wav", wav_file_path)
            finally:
                if os.path.exists(wav_file_path):
                    os.remove(wav_file_path)
        return _to_public_audio_path(wav_file_path)

    # Fallback for environments where Piper binary/model crashes on Windows.
    mp3_filename = f"{cache_key}.mp3"
    mp3_file_path = os.path.join(AUDIO_DIR, mp3_filename)
    try:
        _run_gtts(clean_text, mp3_file_path)
    except Exception as exc:
        raise RuntimeError(f"Piper synthesis failed: {error}; gTTS fallback failed: {exc}") from exc

    if not os.path.exists(mp3_file_path):
        raise RuntimeError(f"Piper synthesis failed: {error}; gTTS did not produce an audio file")

    if db is not None:
        try:
            return _persist_audio_blob(db, cache_key, "audio/mpeg", mp3_file_path)
        finally:
            if os.path.exists(mp3_file_path):
                os.remove(mp3_file_path)

    return _to_public_audio_path(mp3_file_path)