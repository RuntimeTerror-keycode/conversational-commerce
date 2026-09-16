import os

from fastapi import APIRouter, File, Form, UploadFile

from app.config import TEST_PHONE_NUMBER
from app.handlers import handle_audio
from app.routers.deps import run_action
from app.schemas import AudioMediaRequest
from app.services.audio import transcribe_audio_bytes


router = APIRouter(tags=["Audio"])


@router.post(
    "/audio",
    summary="Upload an audio file, transcribe it, and optionally reply on WhatsApp",
)
async def trigger_audio_file(
    destination: str = Form(
        default=TEST_PHONE_NUMBER or ...,
        examples=["918618198675"],
        description="WhatsApp number with country code, no +."
    ),
    send_reply: bool = Form(True),
    file: UploadFile = File(...),
):

    contents = await file.read()
    suffix = os.path.splitext(file.filename or "audio.ogg")[1] or ".ogg"

    if send_reply:

        result = run_action(
            lambda: handle_audio(
                sender=destination,
                audio_bytes=contents,
                suffix=suffix
            )
        )

        return {
            "destination": destination,
            **result
        }

    transcribed = transcribe_audio_bytes(contents, suffix=suffix)

    return {
        "destination": destination,
        "action": "audio",
        "understood": bool(transcribed),
        "result": transcribed
    }


@router.post(
    "/audio/media",
    summary="Transcribe a WhatsApp media id and reply on WhatsApp",
)
def trigger_audio_media(body: AudioMediaRequest):

    result = run_action(
        lambda: handle_audio(
            sender=body.destination,
            media_id=body.media_id,
            message_id=body.message_id
        )
    )

    return {
        "destination": body.destination,
        **result
    }
