from google import genai
from openai import OpenAI
import requests
from typing import Generator

from app.config import GEMINI_API_KEY, MISTRAL_API_KEY

# Setup Gemini
gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# Setup Mistral (via OpenAI-compatible API)
mistral_client = OpenAI(
    api_key=MISTRAL_API_KEY,
    base_url="https://api.mistral.ai/v1"
)

# Ollama endpoint (local)
OLLAMA_API_URL = "http://localhost:11434/api/generate"


def generate_with_gemini(prompt: str, system: str = None) -> str:
    """Generate content using Google Gemini API."""
    if not gemini_client:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    contents = f"{system}\n\n{prompt}" if system else prompt
    response = gemini_client.models.generate_content(
        model="gemini-2.0-flash",
        contents=contents,
    )

    if not response.text:
        raise RuntimeError("Gemini returned an empty response")

    return response.text


def generate_with_mistral(prompt: str, system: str = None) -> str:
    """Generate content using Mistral API."""
    messages = []
    
    if system:
        messages.append({"role": "system", "content": system})
    
    messages.append({"role": "user", "content": prompt})
    
    response = mistral_client.chat.completions.create(
        model="mistral-medium",
        messages=messages
    )
    return response.choices[0].message.content


def generate_with_ollama(
    prompt: str,
    model: str = "mistral",
    system: str = None,
    num_predict: int = 256,
    temperature: float = 0.7,
    top_p: float = 0.9,
) -> str:
    """
    Generate content using local Ollama model.
    
    Args:
        prompt: User prompt
        model: Ollama model name (default: mistral)
        system: System prompt
        num_predict: Max tokens to generate
        temperature: Creativity level (0.0-1.0)
        top_p: Nucleus sampling parameter
    
    Returns:
        Generated text
    """
    full_prompt = prompt
    if system:
        full_prompt = f"{system}\n\n{prompt}"
    
    try:
        response = requests.post(
            OLLAMA_API_URL,
            json={
                "model": model,
                "prompt": full_prompt,
                "stream": False,
                "temperature": temperature,
                "top_p": top_p,
                "num_predict": num_predict,
            },
            timeout=60,
        )
        response.raise_for_status()
        return response.json().get("response", "")
    except Exception as e:
        print(f"Ollama generation failed: {e}")
        raise


def generate_with_ollama_streaming(
    prompt: str,
    model: str = "mistral",
    system: str = None,
    num_predict: int = 256,
    temperature: float = 0.7,
    top_p: float = 0.9,
) -> Generator[str, None, None]:
    """
    Generate content using local Ollama model with streaming.
    
    Yields tokens as they're generated for real-time display.
    
    Args:
        prompt: User prompt
        model: Ollama model name
        system: System prompt
        num_predict: Max tokens to generate
        temperature: Creativity level
        top_p: Nucleus sampling parameter
    
    Yields:
        Generated tokens one at a time
    """
    full_prompt = prompt
    if system:
        full_prompt = f"{system}\n\n{prompt}"
    
    try:
        response = requests.post(
            OLLAMA_API_URL,
            json={
                "model": model,
                "prompt": full_prompt,
                "stream": True,
                "temperature": temperature,
                "top_p": top_p,
                "num_predict": num_predict,
            },
            stream=True,
            timeout=300,
        )
        response.raise_for_status()
        
        for line in response.iter_lines():
            if line:
                try:
                    data = __import__('json').loads(line)
                    if "response" in data:
                        yield data["response"]
                except Exception as e:
                    print(f"Error parsing streaming response: {e}")
                    continue
    
    except Exception as e:
        print(f"Ollama streaming generation failed: {e}")
        raise


def generate_teaching_content(prompt: str) -> str:
    """Fallback teaching content generation."""
    try:
        return generate_with_gemini(prompt)
    except Exception as e:
        print("Gemini failed, switching to Mistral:", e)
        return generate_with_mistral(prompt)


def build_teaching_prompt(
    content: str,
    topic: str = "the topic",
    classroom_name: str = "the classroom",
    student_count: int = None,
) -> str:
    """
    Build classroom-format teaching prompt using new formatter.
    
    CLASSROOM PEDAGOGY:
    - Natural, conversational delivery suitable for projector + speaker
    - 5-8 minute lectures with pacing markers
    - Engagement hooks for group learning
    - No manual intervention needed
    
    Args:
        content: Extracted textbook content
        topic: Topic/chapter title
        classroom_name: Name of classroom (for personalization)
        student_count: Number of students (for engagement tuning)
    
    Returns:
        Formatted prompt for Gemini/Ollama
    """
    from app.services.teaching_formatter import build_classroom_lecture_prompt
    
    return build_classroom_lecture_prompt(
        topic=topic,
        context=content[:5000],  # Limit context for model efficiency
        classroom_name=classroom_name,
        student_count=student_count,
    )


def build_legacy_teaching_prompt(content: str) -> str:
    """Legacy prompt format (kept for backwards compatibility)."""
    return f"""
You are an expert teacher.

Teach the following content step by step in simple language, in human understandable format, shed the asterisks.

Break it into:
- Introduction
- Key Concepts
- Examples
- Summary

Pause naturally for student questions.

Content:
{content[:3000]}
"""


def split_into_chunks(text: str, chunk_size: int = 500):
    return [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]


def generate_teaching_step(chunk: str) -> str:
    prompt = f"""
You are a teacher.

Explain this part clearly and simply.
End naturally so students can ask questions.

Content:
{chunk}
"""
    return generate_teaching_content(prompt)