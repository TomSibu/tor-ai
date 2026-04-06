import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { StudentResponse } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { BookOpen, Upload, Play, CheckSquare, Send, ArrowRight } from "lucide-react";
import { toast } from "sonner";


type Phase = "setup" | "attendance" | "teaching";

export default function TeacherSessions() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [file, setFile] = useState<File | null>(null);
  const [contentId, setContentId] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const [duration, setDuration] = useState("60");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [attendance, setAttendance] = useState<Record<number, boolean>>({});
  const [aiMessages, setAiMessages] = useState<{ role: string; content: string }[]>([]);
  const [question, setQuestion] = useState("");

  const { data: students = [] } = useQuery<StudentResponse[]>({
    queryKey: ["students", classroomId],
    queryFn: () => api.get(`/students/classroom/${classroomId}`).then(r => r.data),
    enabled: phase === "attendance" && !!classroomId,
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) return;
      const fd = new FormData();
      fd.append("file", file);
      return api.post("/content/upload", fd, { headers: { "Content-Type": "multipart/form-data" } }).then(r => r.data);
    },
    onSuccess: (data) => toast.success("Uploaded! Content ID: " + (data?.id ?? data?.content_id)),
  });

  const createSession = useMutation({
    mutationFn: () => api.post("/sessions/", { classroom_id: Number(classroomId), content_id: Number(contentId), start_time: new Date().toISOString(), duration: Number(duration) }),
    onSuccess: (res) => { setSessionId(res.data.id); setPhase("attendance"); toast.success("Session created"); },
  });

  const startSession = useMutation({
    mutationFn: () => api.post(`/ai/start/${sessionId}`),
    onSuccess: (res) => {
      setAiMessages([{ role: "ai", content: res.data?.response || res.data?.message || JSON.stringify(res.data) }]);
      setPhase("teaching");
    },
  });

  const askAi = useMutation({
    mutationFn: (q: string) => api.post(`/ai/ask/${sessionId}?question=${encodeURIComponent(q)}`),
    onSuccess: (res) => {
      setAiMessages(prev => [...prev, { role: "ai", content: res.data?.response || res.data?.answer || JSON.stringify(res.data) }]);
    },
  });

  const continueAi = useMutation({
    mutationFn: () => api.post(`/ai/continue/${sessionId}`),
    onSuccess: (res) => {
      setAiMessages(prev => [...prev, { role: "ai", content: res.data?.response || res.data?.message || JSON.stringify(res.data) }]);
    },
  });

  const handleAsk = () => {
    if (!question.trim()) return;
    setAiMessages(prev => [...prev, { role: "user", content: question }]);
    askAi.mutate(question);
    setQuestion("");
  };

  if (phase === "teaching") {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Live Session #{sessionId}</h1>
        <div className="grid gap-4 lg:grid-cols-2 h-[calc(100vh-12rem)]">
          <Card className="glass-card flex flex-col">
            <CardHeader><CardTitle>📄 Content</CardTitle></CardHeader>
            <CardContent className="flex-1 overflow-auto text-sm text-muted-foreground">
              <p>Content ID: {contentId}</p>
              <p className="mt-2">PDF content is being used by the AI for teaching.</p>
            </CardContent>
          </Card>
          <Card className="glass-card flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>🤖 AI Teaching</CardTitle>
              <Button size="sm" onClick={() => continueAi.mutate()} disabled={continueAi.isPending}>
                <ArrowRight className="mr-1 h-3.5 w-3.5" /> Continue
              </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto space-y-3 text-sm">
              {aiMessages.map((m, i) => (
                <div key={i} className={`p-3 rounded-lg ${m.role === "user" ? "bg-primary/10 ml-8" : "bg-muted mr-8"}`}>
                  <span className="text-xs font-medium text-muted-foreground mb-1 block">{m.role === "user" ? "You" : "AI"}</span>
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap">{m.content}</div>
                </div>
              ))}
            </CardContent>
            <div className="p-4 border-t flex gap-2">
              <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask a question…" onKeyDown={(e) => e.key === "Enter" && handleAsk()} />
              <Button onClick={handleAsk} disabled={askAi.isPending}><Send className="h-4 w-4" /></Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (phase === "attendance") {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Take Attendance</h1>
        <Card className="glass-card">
          <CardHeader><CardTitle className="flex items-center gap-2"><CheckSquare className="h-5 w-5 text-accent" /> Students — Classroom {classroomId}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {students.length === 0 ? <p className="text-muted-foreground">No students found.</p> :
              students.map((s) => (
                <label key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                  <Checkbox checked={!!attendance[s.id]} onCheckedChange={(v) => setAttendance(prev => ({ ...prev, [s.id]: !!v }))} />
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">ID: {s.id}</span>
                </label>
              ))
            }
            <Button className="mt-4" onClick={() => startSession.mutate()} disabled={startSession.isPending}>
              <Play className="mr-2 h-4 w-4" /> Confirm Attendance & Start Session
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Sessions</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-card">
          <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-primary" /> Upload PDF</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <Button onClick={() => upload.mutate()} disabled={!file || upload.isPending}><Upload className="mr-2 h-4 w-4" /> Upload</Button>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-accent" /> New Session</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Classroom ID</Label><Input type="number" value={classroomId} onChange={(e) => setClassroomId(e.target.value)} /></div>
            <div className="space-y-2"><Label>Content ID</Label><Input type="number" value={contentId} onChange={(e) => setContentId(e.target.value)} /></div>
            <div className="space-y-2"><Label>Duration (min)</Label><Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
            <Button onClick={() => createSession.mutate()} disabled={!classroomId || !contentId || createSession.isPending}>
              <BookOpen className="mr-2 h-4 w-4" /> Create & Take Attendance
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
