import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Pause, Play, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

type TeachingStateResponse = {
  session_id: number;
  current_sentence: string;
  progress: number;
  total_sentences: number;
  is_paused: boolean;
  is_active: boolean;
};

type QAStreamEvent = {
  type: "text" | "complete" | "error";
  content?: string;
  audio_path?: string | null;
};

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

function splitIntoSpeechChunks(text: string, maxChunkLength = 700): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const sentenceParts = normalized
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const part of sentenceParts) {
    if (!current) {
      current = part;
      continue;
    }

    if ((current.length + 1 + part.length) <= maxChunkLength) {
      current += ` ${part}`;
    } else {
      chunks.push(current);
      current = part;
    }
  }

  if (current) chunks.push(current);
  return chunks.length ? chunks : [normalized];
}

function sanitizeScript(text: string): string {
  return (text || "")
    .replace(/\[(PAUSE|SHORT PAUSE|EMPHASIS)\]/gi, "")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeScript(text: string): string[] {
  return text.match(/\S+/g) ?? [];
}

function buildWordBoundaries(text: string): Array<{ start: number; end: number; index: number }> {
  const boundaries: Array<{ start: number; end: number; index: number }> = [];
  const regex = /\S+/g;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = regex.exec(text)) !== null) {
    boundaries.push({ start: match.index, end: match.index + match[0].length, index: idx });
    idx += 1;
  }
  return boundaries;
}

function findWordIndexByChar(
  boundaries: Array<{ start: number; end: number; index: number }>,
  charIndex: number
): number {
  if (!boundaries.length) return -1;
  for (let i = 0; i < boundaries.length; i += 1) {
    if (charIndex >= boundaries[i].start && charIndex < boundaries[i].end) {
      return boundaries[i].index;
    }
  }
  return boundaries[boundaries.length - 1].index;
}

export default function ClassroomTeachingDashboard() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [teachingScript, setTeachingScript] = useState("");
  const [sessionState, setSessionState] = useState<TeachingStateResponse | null>(null);
  const [isNarrating, setIsNarrating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(-1);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [answerAudioUrl, setAnswerAudioUrl] = useState<string | null>(null);
  const [answerAudioDialogOpen, setAnswerAudioDialogOpen] = useState(false);
  const [answerAudioLoadError, setAnswerAudioLoadError] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lectureAudioUrl, setLectureAudioUrl] = useState<string | null>(null);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [currentAudioTime, setCurrentAudioTime] = useState(0);
  const [isPreparingAudio, setIsPreparingAudio] = useState(false);

  const lectureAudioRef = useRef<HTMLAudioElement | null>(null);
  const answerAudioRef = useRef<HTMLAudioElement | null>(null);
  const pausedTimeRef = useRef<number>(0);

  const cleanedScript = useMemo(() => sanitizeScript(teachingScript), [teachingScript]);
  const scriptWords = useMemo(() => tokenizeScript(cleanedScript), [cleanedScript]);
  const wordBoundaries = useMemo(() => buildWordBoundaries(cleanedScript), [cleanedScript]);

  const fetchTeachingContent = async () => {
    if (!sessionId) return "";
    const response = await api.get(`/ai/teach/${sessionId}`);
    const script = response.data?.teaching_content ?? "";
    setTeachingScript(script);
    return script as string;
  };

  const fetchSessionState = async () => {
    if (!sessionId) return;
    try {
      const response = await api.get(`/ai/teaching/session/${sessionId}/state`);
      setSessionState(response.data as TeachingStateResponse);
      setIsPaused(Boolean(response.data?.is_paused));
    } catch {
      // no-op
    }
  };

  const stopNarration = () => {
    if (lectureAudioRef.current) {
      lectureAudioRef.current.pause();
    }
    setIsNarrating(false);
  };

  const stopAnswerAudio = () => {
    if (answerAudioRef.current) {
      answerAudioRef.current.pause();
      answerAudioRef.current.src = "";
      answerAudioRef.current = null;
    }
  };

  const continueLectureAfterAnswer = async () => {
    setAnswerAudioDialogOpen(false);
    stopAnswerAudio();
    setAnswerAudioUrl(null);
    setAnswerAudioLoadError(false);
    setIsAnswering(false);
    // Resume lecture audio from where it was paused
    if (lectureAudioRef.current && !lectureAudioRef.current.paused) {
      void lectureAudioRef.current.play();
    }
  };

  const playPendingAnswerAudio = async () => {
    if (!answerAudioRef.current || answerAudioLoadError) return;

    try {
      setAnswerAudioDialogOpen(false);
      // Pause lecture audio while answer plays
      if (lectureAudioRef.current) {
        lectureAudioRef.current.pause();
      }
      await answerAudioRef.current.play();
    } catch {
      toast.warning("The answer audio could not start. You can continue the lecture instead.");
      setAnswerAudioDialogOpen(true);
    }
  };

  const pauseNarration = async () => {
    // Save current playback position before pausing
    if (lectureAudioRef.current) {
      pausedTimeRef.current = lectureAudioRef.current.currentTime;
      lectureAudioRef.current.pause();
    }
    setIsNarrating(false);
    setIsPaused(true);
    
    if (sessionId) {
      try {
        await api.post(`/ai/teaching/session/${sessionId}/pause`);
      } catch {
        // no-op
      }
    }
  };

  const resumeNarration = async () => {
    if (!lectureAudioRef.current || !isAudioReady) return;

    try {
      setIsPaused(false);
      // Restore saved playback position before playing
      lectureAudioRef.current.currentTime = pausedTimeRef.current;
      await lectureAudioRef.current.play();
      setIsNarrating(true);
      
      if (sessionId) {
        try {
          await api.post(`/ai/teaching/session/${sessionId}/pause`);
        } catch {
          // no-op
        }
      }
    } catch {
      toast.warning("Could not resume audio playback");
      setIsNarrating(false);
    }
  };

  const startTeachingExperience = async () => {
    if (!sessionId) return;
    setError(null);
    setIsPreparingAudio(true);
    setIsAudioReady(false);

    try {
      const response = await api.post(`/ai/teaching/session/${sessionId}/start`);
      toast.success("Autonomous lesson started");

      // Get audio path from response
      const audioPath = response.data?.audio_path;
      if (audioPath) {
        const normalizedAudioPath = audioPath.replace(/\\/g, "/");
        const audioUrl = audioPath.startsWith("http")
          ? normalizedAudioPath
          : `${api.defaults.baseURL?.replace(/\/$/, "") ?? ""}/${normalizedAudioPath.replace(/^\//, "")}`;

        setLectureAudioUrl(audioUrl);
        setIsAudioReady(false);
        
        // Create and configure audio element
        if (lectureAudioRef.current) {
          lectureAudioRef.current.pause();
          lectureAudioRef.current.src = "";
        }
        
        const audio = new Audio(audioUrl);
        audio.preload = "auto";
        lectureAudioRef.current = audio;

        let attemptedAutoplay = false;

        audio.oncanplay = () => {
          setIsPreparingAudio(false);
          setIsAudioReady(true);
          setSpeechSupported(true);
          if (!attemptedAutoplay) {
            attemptedAutoplay = true;
            pausedTimeRef.current = 0;
            audio.currentTime = 0;
            void audio.play().catch(() => {
              setIsPaused(true);
              setIsNarrating(false);
              toast.warning("Audio is ready. Click Resume to start playback if your browser blocked autoplay.");
            });
          }
        };

        audio.onplay = () => {
          setIsPaused(false);
          setIsNarrating(true);
        };

        audio.onpause = () => {
          if (!audio.ended) {
            pausedTimeRef.current = audio.currentTime;
            setIsNarrating(false);
          }
        };

        audio.ontimeupdate = () => {
          setCurrentAudioTime(audio.currentTime);
          // Update highlighted word based on audio progress
          updateWordHighlightFromAudioTime(audio.currentTime);
        };

        audio.onended = () => {
          setIsNarrating(false);
          toast.success("Lecture complete");
        };

        audio.onerror = () => {
          setIsPreparingAudio(false);
          setSpeechSupported(false);
          toast.warning("The lecture audio could not be loaded in this browser.");
        };

        audio.load();
      } else {
        setIsPreparingAudio(false);
        setSpeechSupported(false);
        toast.warning("No audio available for this lecture session");
      }

      // Load script and state in parallel after audio setup so playback can begin sooner.
      await Promise.all([fetchTeachingContent(), fetchSessionState()]);
    } catch (err: any) {
      setIsPreparingAudio(false);
      setError(err?.response?.data?.detail || err?.message || "Failed to start lesson.");
    }
  };

  const updateWordHighlightFromAudioTime = (audioTime: number) => {
    if (!cleanedScript || wordBoundaries.length === 0) return;

    const duration = lectureAudioRef.current?.duration;
    if (!duration || !Number.isFinite(duration) || duration <= 0) return;

    // Map the current playback timestamp directly to script progress.
    const highlightLeadSeconds = 0.08;
    const clampedTime = Math.min(Math.max(audioTime + highlightLeadSeconds, 0), duration);
    const progress = clampedTime / duration;
    const charIndex = Math.min(
      cleanedScript.length - 1,
      Math.floor(progress * cleanedScript.length)
    );

    const wordIndex = findWordIndexByChar(wordBoundaries, charIndex);
    if (wordIndex >= 0) {
      setCurrentWordIndex(wordIndex);
    }
  };

  const askQuestionAndStreamAnswer = async (question: string) => {
    if (!sessionId || !question.trim() || isAnswering) return;

    // Save lecture audio position and pause
    if (lectureAudioRef.current) {
      pausedTimeRef.current = lectureAudioRef.current.currentTime;
      lectureAudioRef.current.pause();
    }
    setIsNarrating(false);

    setIsAnswering(true);
    setError(null);
    setAnswerAudioUrl(null);

    let audioHandled = false;

    try {
      const token = localStorage.getItem("token");
      const apiBase = String(api.defaults.baseURL || "").replace(/\/$/, "");
      const response = await fetch(`${apiBase}/ai/teaching/session/${sessionId}/question`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Unable to stream answer right now.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let bufferedAnswer = "";
      let streamRemainder = "";
      let completeAudioPath: string | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        streamRemainder += decoder.decode(value, { stream: true });

        const lines = streamRemainder.split("\n");
        streamRemainder = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as QAStreamEvent;

          if (event.type === "text" && event.content) {
            bufferedAnswer += event.content.replace(/\*/g, "");
          } else if (event.type === "complete") {
            completeAudioPath = event.audio_path || null;
          } else if (event.type === "error") {
            throw new Error(event.content || "Question handling failed.");
          }
        }
      }

      if (streamRemainder.trim()) {
        const event = JSON.parse(streamRemainder) as QAStreamEvent;
        if (event.type === "text" && event.content) {
          bufferedAnswer += event.content.replace(/\*/g, "");
        } else if (event.type === "complete") {
          completeAudioPath = event.audio_path || null;
        }
      }

      const cleanAnswer = sanitizeScript(bufferedAnswer);
      if (cleanAnswer) {
        setChatMessages((prev) => [...prev, { role: "assistant", text: cleanAnswer }]);
      }

      if (completeAudioPath) {
        const normalizedAudioPath = completeAudioPath.replace(/\\/g, "/");
        const audioUrl = completeAudioPath.startsWith("http")
          ? normalizedAudioPath
          : `${api.defaults.baseURL?.replace(/\/$/, "") ?? ""}/${normalizedAudioPath.replace(/^\//, "")}`;

        setAnswerAudioUrl(audioUrl);
        setAnswerAudioLoadError(false);
        stopAnswerAudio();

        const audio = new Audio(audioUrl);
        audio.preload = "auto";
        answerAudioRef.current = audio;
        audioHandled = true;

        audio.oncanplaythrough = () => {
          toast.success("Answer audio is ready.");
          setAnswerAudioDialogOpen(true);
          setIsAnswering(false);
        };

        audio.onended = () => {
          void continueLectureAfterAnswer();
        };

        audio.onerror = () => {
          setAnswerAudioLoadError(true);
          setAnswerAudioDialogOpen(true);
          setIsAnswering(false);
          toast.warning("Answer audio could not load in this browser.");
        };

        audio.load();
      }
    } catch (err: any) {
      setError(err?.message || "Failed to process question.");
      setChatMessages((prev) => [...prev, { role: "assistant", text: "I could not answer that right now. Please try again." }]);
    } finally {
      if (!audioHandled) {
        setIsAnswering(false);
        // Resume lecture from saved position
        if (lectureAudioRef.current && isAudioReady) {
          lectureAudioRef.current.currentTime = pausedTimeRef.current;
          void lectureAudioRef.current.play().then(() => {
            setIsNarrating(true);
          });
        }
      }
    }
  };

  const handleSendQuestion = () => {
    const question = chatInput.trim();
    if (!question || isAnswering) return;
    setChatMessages((prev) => [...prev, { role: "user", text: question }]);
    setChatInput("");
    void askQuestionAndStreamAnswer(question);
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (!sessionId || !mounted) return;
      await fetchTeachingContent();
      await fetchSessionState();
    };

    void init();

    return () => {
      mounted = false;
      stopNarration();
      stopAnswerAudio();
    };
  }, [sessionId]);

  const renderScriptWithHighlight = () => {
    if (!scriptWords.length) {
      return <p className="text-sm text-muted-foreground">No teaching content yet.</p>;
    }

    return (
      <div className="leading-8 text-[1.04rem] text-slate-100 break-words whitespace-normal">
        {scriptWords.map((word, index) => (
          <span
            key={`${word}-${index}`}
            className={[
              "mr-1 rounded px-1 py-0.5 transition-colors duration-150",
              index === currentWordIndex ? "bg-cyan-300 text-slate-900 font-semibold" : "text-slate-200",
            ].join(" ")}
          >
            {word}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-[calc(100vh-1rem)] bg-[radial-gradient(circle_at_20%_20%,#17324d,transparent_45%),radial-gradient(circle_at_80%_10%,#0e5f5f,transparent_40%),linear-gradient(120deg,#0a1220,#111827_55%,#0a1220)] p-6 text-white">
      <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between">
        <Button variant="outline" className="border-slate-400 bg-slate-900/70 text-slate-100 hover:bg-slate-800" onClick={() => navigate("/classroom/sessions")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back To Sessions
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-indigo-700 text-white">{isNarrating ? "Teaching" : isPaused ? "Paused" : "Idle"}</Badge>
          <Badge variant="secondary" className="bg-emerald-700 text-white">{isAnswering ? "Answering" : "Chat Ready"}</Badge>
        </div>
      </div>

      <div className="mx-auto mt-6 grid w-full max-w-[1280px] grid-cols-1 gap-6 lg:[grid-template-columns:420px_minmax(0,1fr)]">
        <Card className="relative overflow-hidden border-slate-700 bg-slate-950/75 p-6 min-w-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(56,189,248,0.15),transparent_60%)]" />
          <div className="relative z-10">
            <p className="mb-2 flex items-center gap-2 text-sm text-cyan-200"><Sparkles className="h-4 w-4" /> AI Classroom Mentor</p>
            <div className="mx-auto mt-4 flex h-72 w-72 items-center justify-center rounded-full border border-cyan-500/40 bg-slate-900/80 shadow-[0_0_90px_rgba(56,189,248,0.25)]">
              <div
                className={[
                  "h-56 w-56 rounded-full bg-gradient-to-b from-cyan-300 via-cyan-500 to-blue-700",
                  isNarrating || isAnswering ? "animate-pulse" : "",
                ].join(" ")}
              >
                <div className="mx-auto mt-16 h-8 w-24 rounded-full bg-slate-900/80" />
                <div className="mx-auto mt-8 flex w-28 items-end justify-center gap-2">
                  <span className={isNarrating || isAnswering ? "h-8 w-2 animate-bounce rounded bg-white" : "h-3 w-2 rounded bg-white/70"} />
                  <span className={isNarrating || isAnswering ? "h-10 w-2 animate-bounce rounded bg-white" : "h-3 w-2 rounded bg-white/70"} />
                  <span className={isNarrating || isAnswering ? "h-6 w-2 animate-bounce rounded bg-white" : "h-3 w-2 rounded bg-white/70"} />
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3 text-sm text-slate-200">
              <p>Type questions in chat while the lesson continues.</p>
              {isAnswering && (
                <Alert className="border-sky-500/70 bg-sky-700/20 text-sky-100">
                  <AlertDescription>Processing your question, please wait...</AlertDescription>
                </Alert>
              )}
              {isPreparingAudio && (
                <Alert className="border-cyan-500/70 bg-cyan-700/20 text-cyan-100">
                  <AlertDescription>Preparing audio...</AlertDescription>
                </Alert>
              )}
              {answerAudioUrl && isAnswering && (
                <Alert className="border-indigo-500/70 bg-indigo-700/20 text-indigo-100">
                  <AlertDescription>Playing answer audio...</AlertDescription>
                </Alert>
              )}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Button onClick={() => void startTeachingExperience()} className="bg-cyan-600 hover:bg-cyan-500">
                <Play className="mr-2 h-4 w-4" /> Start Autonomous Teaching
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (isPaused) {
                    void resumeNarration();
                  } else {
                    void pauseNarration();
                  }
                }}
              >
                {isPaused ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
                {isPaused ? "Resume" : "Pause"}
              </Button>
            </div>

            <div className="mt-4 text-xs text-slate-400">
              {!speechSupported && "Speech synthesis is unavailable in this browser."}
            </div>

            <div className="mt-4 rounded-md border border-slate-700 bg-slate-900/70 p-3">
              <p className="mb-2 text-sm font-medium text-cyan-100">Class Q/A Chat</p>
              <div className="max-h-56 space-y-2 overflow-auto rounded border border-slate-700 bg-slate-950/60 p-2">
                {chatMessages.length === 0 ? (
                  <p className="text-xs text-slate-400">No questions yet.</p>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div
                      key={`${msg.role}-${idx}`}
                      className={[
                        "rounded px-2 py-1 text-sm",
                        msg.role === "user" ? "bg-cyan-700/30 text-cyan-100" : "bg-indigo-700/30 text-indigo-100",
                      ].join(" ")}
                    >
                      <span className="mr-1 font-semibold">{msg.role === "user" ? "You:" : "AI:"}</span>
                      {msg.text}
                    </div>
                  ))
                )}
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  placeholder="Ask a question..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSendQuestion();
                    }
                  }}
                />
                <Button onClick={handleSendQuestion} disabled={isAnswering || !chatInput.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-slate-700 bg-slate-900/80 p-6 min-w-0">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-cyan-100">Live Teaching Content</h2>
            <div className="text-sm text-slate-300">
              {sessionState ? `${Math.round((sessionState.progress || 0) * 100)}%` : "0%"}
            </div>
          </div>
          <div className="h-[72vh] overflow-auto rounded-lg border border-slate-700 bg-slate-950/70 p-5">
            {renderScriptWithHighlight()}
          </div>
        </Card>
      </div>

      <Dialog open={answerAudioDialogOpen} onOpenChange={setAnswerAudioDialogOpen}>
        <DialogContent className="border-slate-700 bg-slate-950 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Answer audio is ready</DialogTitle>
            <DialogDescription className="text-slate-300">
              {answerAudioLoadError
                ? "The audio file could not load in this browser. You can continue the lecture without audio."
                : "The audio file is ready. You can play it now, or continue the lecture."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800" onClick={() => void continueLectureAfterAnswer()}>
              Continue Lecture
            </Button>
            <Button className="bg-cyan-600 hover:bg-cyan-500" onClick={() => void playPendingAnswerAudio()} disabled={answerAudioLoadError || !answerAudioUrl}>
              Play Answer Audio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
