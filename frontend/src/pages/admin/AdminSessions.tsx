import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ClassroomResponse, ContentResponse } from "@/types/api";
import { BookOpen, Upload } from "lucide-react";
import { toast } from "sonner";

export default function AdminSessions() {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [contentId, setContentId] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const [duration, setDuration] = useState("60");

  const { data: classrooms = [] } = useQuery<ClassroomResponse[]>({
    queryKey: ["classrooms"],
    queryFn: () => api.get("/classrooms/").then(r => r.data),
  });

  const { data: contents = [] } = useQuery<ContentResponse[]>({
    queryKey: ["contents"],
    queryFn: () => api.get("/content/").then(r => r.data),
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) return;
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/content/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success("Content uploaded successfully");
      qc.invalidateQueries({ queryKey: ["contents"] });
    },
  });

  const createSession = useMutation({
    mutationFn: () => api.post("/sessions/", {
      classroom_id: Number(classroomId),
      content_id: Number(contentId),
      start_time: new Date().toISOString(),
      duration: Number(duration),
    }),
    onSuccess: (res) => {
      toast.success("Session created successfully");
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Sessions</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-card">
          <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-primary" /> Upload Content (PDF)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <Button onClick={() => upload.mutate()} disabled={!file || upload.isPending}>
              <Upload className="mr-2 h-4 w-4" /> Upload
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-accent" /> Create Session</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Classroom</Label>
              <Select value={classroomId} onValueChange={setClassroomId}>
                <SelectTrigger><SelectValue placeholder="Choose a classroom" /></SelectTrigger>
                <SelectContent>
                  {classrooms.map((classroom) => (
                    <SelectItem key={classroom.id} value={String(classroom.id)}>{classroom.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Select value={contentId} onValueChange={setContentId}>
                <SelectTrigger><SelectValue placeholder="Choose uploaded content" /></SelectTrigger>
                <SelectContent>
                  {contents.map((content) => {
                    const fileName = content.file_path.split(/[\\/]/).pop() ?? content.file_path;
                    return <SelectItem key={content.id} value={String(content.id)}>{fileName}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Duration (min)</Label><Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
            <Button onClick={() => createSession.mutate()} disabled={!classroomId || !contentId || createSession.isPending}>
              <BookOpen className="mr-2 h-4 w-4" /> Create Session
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
