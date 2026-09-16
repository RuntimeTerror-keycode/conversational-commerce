import os
import tempfile
import subprocess

from app.config import SARVAM_API_KEY
from app.services.whatsapp import get_media_url, download_media

_sarvam = None


def _get_sarvam():
    global _sarvam

    if _sarvam is None:
        from sarvamai import SarvamAI

        if not SARVAM_API_KEY:
            raise RuntimeError("SARVAM_API_KEY is not set")

        _sarvam = SarvamAI(api_subscription_key=SARVAM_API_KEY)

    return _sarvam


def _convert_to_wav(audio_bytes, suffix=".ogg"):

    input_path = None
    wav_path = None

    if not suffix.startswith("."):
        suffix = f".{suffix}"

    with tempfile.NamedTemporaryFile(
        suffix=suffix or ".ogg",
        delete=False
    ) as temp_file:

        temp_file.write(audio_bytes)
        input_path = temp_file.name

    wav_path = os.path.splitext(input_path)[0] + ".wav"

    print("Converting audio -> WAV...")

    conversion = subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            input_path,
            "-ar",
            "16000",
            "-ac",
            "1",
            wav_path
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    if conversion.returncode != 0:

        print("FFmpeg error:")
        print(
            conversion.stderr.decode(
                errors="replace"
            )
        )

        if input_path and os.path.exists(input_path):
            os.remove(input_path)

        return None, None

    return input_path, wav_path


def _transcribe_codemix(wav_path):
    """
    Understand English, Malayalam, or a mix of both.
    """

    print("Transcribing with Sarvam (codemix, auto language)...")

    with open(wav_path, "rb") as audio_file:

        result = _get_sarvam().speech_to_text.transcribe(
            file=audio_file,
            model="saaras:v4",
            mode="codemix",
            language_code="unknown"
        )

    transcript = (result.transcript or "").strip()
    language_code = getattr(result, "language_code", None)

    print("Codemix transcript:", transcript)
    print("Detected language:", language_code)

    return transcript, language_code


SUPPORTED_TRANSLATE_SOURCES = {
    "bn-IN",
    "en-IN",
    "gu-IN",
    "hi-IN",
    "kn-IN",
    "ml-IN",
    "mr-IN",
    "od-IN",
    "pa-IN",
    "ta-IN",
    "te-IN",
    "as-IN",
    "brx-IN",
    "doi-IN",
    "kok-IN",
    "ks-IN",
    "mai-IN",
    "mni-IN",
    "ne-IN",
    "sa-IN",
    "sat-IN",
    "sd-IN",
    "ur-IN",
}


def _resolve_source_language(text, detected_language_code):
    """
    Sarvam translate rejects 'auto'. Prefer STT detection, then language ID.
    """

    if detected_language_code in SUPPORTED_TRANSLATE_SOURCES:
        return detected_language_code

    try:

        print("Identifying text language with Sarvam...")

        result = _get_sarvam().text.identify_language(input=text)
        identified = getattr(result, "language_code", None)

        print("Identified language:", identified)

        if identified in SUPPORTED_TRANSLATE_SOURCES:
            return identified

    except Exception as error:

        print("Language identification failed:", error)

    # Code-mixed Malayalam/English default for this bot.
    return "ml-IN"


def _translate_text_to_english(text, detected_language_code=None):
    """
    Translate the English/Malayalam mix transcript to English.
    """

    if not text:
        return None

    source_language_code = _resolve_source_language(
        text,
        detected_language_code
    )

    if source_language_code == "en-IN":
        print("Already English; skipping text translation.")
        return text

    print(
        "Translating transcript to English with Sarvam...",
        f"(source={source_language_code})"
    )

    try:

        result = _get_sarvam().text.translate(
            input=text,
            source_language_code=source_language_code,
            target_language_code="en-IN",
            model="sarvam-translate:v1",
            mode="formal"
        )

    except Exception as error:

        print("Text translation failed:", error)
        return None

    english = (result.translated_text or "").strip()

    print("English translation:", english)

    return english or None


def transcribe_audio_bytes(audio_bytes, suffix=".ogg"):
    """
    1. Transcribe voice as English/Malayalam mix.
    2. Translate that transcript text to English.

    Returns:
        {
            "original": str,
            "english": str,
            "language_code": str | None,
        }
        or None on failure.
    """

    if not audio_bytes:
        print("Audio bytes are empty.")
        return None

    input_path = None
    wav_path = None

    try:

        input_path, wav_path = _convert_to_wav(
            audio_bytes,
            suffix=suffix
        )

        if not wav_path:
            return None

        original, language_code = _transcribe_codemix(wav_path)

        if not original:
            return None

        english = _translate_text_to_english(
            original,
            detected_language_code=language_code
        )

        return {
            "original": original,
            "english": english,
            "language_code": language_code,
        }

    finally:

        if input_path and os.path.exists(input_path):
            os.remove(input_path)

        if wav_path and os.path.exists(wav_path):
            os.remove(wav_path)


def transcribe_audio(media_id):

    print("\nGetting audio media URL...")

    media_url = get_media_url(media_id)

    print("Downloading audio...")

    audio_bytes = download_media(media_url)

    return transcribe_audio_bytes(audio_bytes, suffix=".ogg")
