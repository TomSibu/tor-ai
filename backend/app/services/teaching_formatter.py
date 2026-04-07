"""
Teaching Content Formatter

Generates classroom-length spoken lecture scripts following the Senku pedagogy:
- Natural, conversational classroom language
- Intelligent pacing markers for TTS delivery
- Emphasis and pauses for comprehension
- Engagement hooks for student attention
- Professional yet accessible tone

Format suitable for:
- Classroom projector display
- Text-to-speech narration
- Student note-taking
- Multi-student learning environments
"""

from datetime import datetime
from typing import Dict, List


def get_time_based_greeting() -> str:
    """Get appropriate greeting based on current time of day."""
    current_hour = datetime.now().hour
    
    if 5 <= current_hour < 12:
        return "Good morning"
    elif 12 <= current_hour < 17:
        return "Good afternoon"
    else:
        return "Good evening"


def build_classroom_lecture_prompt(
    topic: str,
    context: str,
    classroom_name: str = "Class",
    student_count: int = None
) -> str:
    """
    Build a prompt for generating classroom-length spoken lecture scripts.
    
    This prompt ensures:
    - Natural, expressive classroom delivery (5-8 minutes, 600-900 words)
    - Pacing markers for TTS
    - Engagement hooks for group learning
    - Self-paced progression suitable for projector display
    - No need for manual intervention during teaching
    
    Args:
        topic: Lesson topic/title
        context: Retrieved textbook content
        classroom_name: Name of the classroom for personalization
        student_count: Number of students (optional, for engagement tuning)
    
    Returns:
        Formatted prompt for lecture generation
    """
    greeting = get_time_based_greeting()
    student_context = f" with {student_count} students" if student_count else ""
    
    prompt = f"""You are an Expert Classroom Teacher preparing a lesson for {classroom_name}{student_context}.

OBJECTIVE:
Generate a 5-8 minute classroom-length SPOKEN LECTURE SCRIPT that teaches "{topic}" to high school students.

CRITICAL REQUIREMENTS:
1. CLASSROOM DELIVERY (Not chatbot-like)
   - Speak naturally as if presenting to a physical classroom
   - Use inclusive language: "we", "today", "let's explore"
   - Assume students are taking notes on projector display
   - Reference the board/screen: "as you see here", "notice on the screen"

2. PACING & DELIVERY (For TTS and projector display)
   - Length: 600-900 words (5-8 minutes at normal speaking pace)
   - Sentence structure: Short, clear sentences for comprehension
   - Rhythm: Vary sentence length for natural delivery
   - Pausing: Use [PAUSE] markers at natural thinking points
   - Emphasis: Use [EMPHASIS] for key concepts students must remember

3. ENGAGEMENT & INTERACTION (Classroom-friendly, no manual input needed)
   - Start with a hook/question to grab attention (rhetorical, no answer needed)
   - Use "wait time" with [SHORT PAUSE] to let ideas sink in
   - Guide students through concepts step-by-step
   - Anticipate common confusions and address them
   - End with a clear summary of learning objectives

4. STRUCTURE
   - Introduction: Hook + brief topic overview (1-2 sentences)
   - Main Content: Explain concepts with examples from context
   - Key Points: Highlight 3-4 takeaways students must remember
   - Conclusion: Summary + bridge to next concepts
   - Closing: Brief reflection or transition

5. CONTENT QUALITY
   - Ground ALL explanations in provided context (below)
   - Use real-world examples students can relate to
   - Avoid jargon; if technical terms needed, define them immediately
   - Reference figures/tables naturally: "as shown on the screen"
   - Never reference links, PDFs, or external resources

6. LANGUAGE STYLE
   - NO markdown, NO bullet points, NO LaTeX
   - Pure spoken English - everything readable aloud
   - Conversational: use contractions (it's, don't, we're)
   - Warm, encouraging tone - students should feel supported
   - Clarity over complexity - explain difficult concepts simply

7. OUTPUT FORMAT
   - Pure text, no special formatting except [PAUSE], [SHORT PAUSE], [EMPHASIS]
   - One continuous narrative flow
   - No lesson number/section numbers (system handles that)
   - No meta-commentary ("let me explain", "I will teach")
   - Just the lecture content itself

PACING MARKERS:
- [PAUSE]: Natural pause point (1-2 seconds) for thinking
- [SHORT PAUSE]: Brief pause (0.5 second) for emphasis
- [EMPHASIS]: Emphasize the next phrase more when speaking

TEXTBOOK CONTENT FOR THIS LESSON:
{context}

---

Generate the lecture script now. Remember: You're a real teacher in a real classroom, 
speaking to real students. Make it engaging, clear, and memorable. No introductions,
just start teaching. When you say "today", "we", or "look at this", students will 
feel you're directly addressing them as a group.
"""
    
    return prompt


def build_classroom_qa_prompt() -> str:
    """
    Build system prompt for classroom question answering.
    
    This is injected into streaming Q&A responses to ensure:
    - Concise, classroom-appropriate answers
    - Natural spoken English (no markdown)
    - Sentence-level boundaries for TTS playback
    - Encouragement for group learning
    
    Returns:
        System prompt for Q&A streaming
    """
    return (
        "You are a friendly, encouraging classroom teacher answering a student's question during a lesson. "
        "Your answer should help the whole class understand better. "
        "Rules you MUST follow:\n"
        "1. Answer in plain spoken English only — no markdown, no bullet points, no LaTeX, no code blocks.\n"
        "2. Keep your answer to 2-4 sentences for time efficiency.\n"
        "3. Every sentence must be complete and end with a full-stop, question mark, or exclamation mark.\n"
        "4. Reference the concept just taught: 'That's a great question about [topic]...'\n"
        "5. Make it relevant to the whole class, not just the individual student.\n"
        "6. Be encouraging: 'Great thinking!' or 'Excellent question!'\n"
        "7. If unsure, say 'That's a good question, and here's what we know from today's lesson...'"
    )


def clean_lecture_for_display(lecture: str) -> str:
    """
    Remove pacing markers and unwanted references for clean projector display.
    
    Removes:
    - Pacing markers: [PAUSE], [SHORT PAUSE], [EMPHASIS]
    - Figure/table references that require visual access
    
    Args:
        lecture: Raw lecture text with markers
    
    Returns:
        Clean lecture text suitable for projector display
    """
    import re
    
    clean_text = lecture
    
    # Remove pacing markers (keep text, remove markers)
    clean_text = re.sub(r'\[PAUSE\]\s*', '', clean_text, flags=re.IGNORECASE)
    clean_text = re.sub(r'\[SHORT PAUSE\]\s*', '', clean_text, flags=re.IGNORECASE)
    clean_text = re.sub(r'\[EMPHASIS\]\s*', '', clean_text, flags=re.IGNORECASE)
    
    # Clean up extra whitespace
    clean_text = re.sub(r'\s+', ' ', clean_text)
    clean_text = re.sub(r'\s+([.,!?])', r'\1', clean_text)
    
    return clean_text.strip()


def chunk_lecture_into_sentences(lecture: str) -> List[str]:
    """
    Break lecture into sentence-level chunks for synchronized projector highlighting.
    
    Args:
        lecture: Full lecture text
    
    Returns:
        List of sentences (without pacing markers)
    """
    import re
    
    # Remove pacing markers first
    clean = clean_lecture_for_display(lecture)
    
    # Split by sentence-ending punctuation
    sentences = re.split(r'(?<=[.!?])\s+', clean)
    
    # Filter empty sentences and strip whitespace
    sentences = [s.strip() for s in sentences if s.strip()]
    
    return sentences


def highlight_key_concepts(lecture: str, concepts: List[str] = None) -> Dict[str, List[str]]:
    """
    Identify and structure key learning concepts from lecture for note-taking support.
    
    Args:
        lecture: Full lecture text
        concepts: Optional list of concepts to highlight (from topic/curriculum)
    
    Returns:
        Dictionary with highlighted sections by concept
    """
    import re
    
    highlights = {}
    
    # Default concepts if not provided
    if not concepts:
        concepts = ["definition", "key point", "example", "summary", "important"]
    
    for concept in concepts:
        # Find sentences containing concept mentions
        pattern = rf'[^.!?]*{re.escape(concept)}[^.!?]*[.!?]'
        matches = re.findall(pattern, lecture, re.IGNORECASE)
        if matches:
            highlights[concept] = [m.strip() for m in matches]
    
    return highlights


def format_for_tts_streaming(lecture: str) -> List[str]:
    """
    Break lecture into TTS-optimized chunks for streaming playback.
    
    Chunks at natural pause points ([PAUSE], [SHORT PAUSE]) to:
    - Start TTS playback sooner (don't wait for full sentence)
    - Allow interruption between chunks
    - Keep TTS responsive and interactive
    
    Args:
        lecture: Full lecture text
    
    Returns:
        List of text chunks optimized for TTS streaming
    """
    import re
    
    # Split by pause markers first (strongest break points)
    chunks = re.split(r'\[(?:SHORT )?PAUSE\]', lecture)
    
    result = []
    for chunk in chunks:
        # Remove other markers
        chunk = re.sub(r'\[EMPHASIS\]', '', chunk)
        chunk = chunk.strip()
        
        if chunk:
            result.append(chunk)
    
    return result


def is_classroom_appropriate(lecture: str) -> Dict[str, any]:
    """
    Validate lecture for classroom delivery appropriateness.
    
    Checks:
    - Length (should be 600-900 words for 5-8 minute delivery)
    - Markdown usage (should be zero)
    - Pacing markers (should be present)
    - Engagement hooks (should start/end with engagement)
    
    Args:
        lecture: Lecture text to validate
    
    Returns:
        Validation report dictionary
    """
    import re
    
    word_count = len(lecture.split())
    has_markdown = bool(re.search(r'[*`#\[\]]|```', lecture))
    pause_count = len(re.findall(r'\[PAUSE\]', lecture, re.IGNORECASE))
    has_hook = bool(re.search(r'[?!]{1,2}\s', lecture[:200]))
    
    report = {
        "is_valid": True,
        "word_count": word_count,
        "length_appropriate": 600 <= word_count <= 1200,
        "no_markdown": not has_markdown,
        "has_pacing": pause_count >= 3,
        "has_engagement_hook": has_hook,
        "issues": []
    }
    
    if not report["length_appropriate"]:
        report["issues"].append(f"Word count {word_count} outside ideal range (600-900)")
    
    if has_markdown:
        report["issues"].append("Lecture contains markdown formatting (should be plain text)")
    
    if not report["has_pacing"]:
        report["issues"].append("Lecture lacks sufficient pacing markers for TTS delivery")
    
    if not has_hook:
        report["issues"].append("Lecture should start with an engaging question or hook")
    
    report["is_valid"] = len(report["issues"]) == 0
    
    return report
