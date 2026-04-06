import google.generativeai as genai
from openai import OpenAI

from app.config import GEMINI_API_KEY, MISTRAL_API_KEY

# Setup Gemini
genai.configure(api_key=GEMINI_API_KEY)

# Setup Mistral (via OpenAI-compatible API)
mistral_client = OpenAI(
    api_key=MISTRAL_API_KEY,
    base_url="https://api.mistral.ai/v1"
)


def generate_with_gemini(prompt: str) -> str:
    model = genai.GenerativeModel("gemini-pro")
    response = model.generate_content(prompt)
    return response.text


def generate_with_mistral(prompt: str) -> str:
    response = mistral_client.chat.completions.create(
        model="mistral-medium",
        messages=[
            {"role": "user", "content": prompt}
        ]
    )
    return response.choices[0].message.content


def generate_teaching_content(prompt: str) -> str:
    try:
        return generate_with_gemini(prompt)
    except Exception as e:
        print("Gemini failed, switching to Mistral:", e)
        return generate_with_mistral(prompt)
    
def build_teaching_prompt(content: str) -> str:
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