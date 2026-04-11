from io import BytesIO

from openai import OpenAI

client = OpenAI()

def speech_to_text(audio_file_bytes: bytes) -> str:
    transcript = client.audio.transcriptions.create(
        model="whisper-1",
        file=BytesIO(audio_file_bytes)
    )
    return transcript.text