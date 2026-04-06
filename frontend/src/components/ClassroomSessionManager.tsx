import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { AssignedClassResponse, ContentResponse, SessionManageResponse } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, BookOpen, CalendarDays, Edit3, Loader2, MoreHorizontal, Play, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface ClassroomSessionManagerProps {
  classroomId: number;
  backPath: string;
  scope: "admin" | "teacher";
}

type SessionFormState = {
  contentId: string;
  startTime: string;
  duration: string;
  expiresAt: string;
};

const emptySessionForm: SessionFormState = {
  contentId: "",
  startTime: "",
  duration: "60",
  expiresAt: "",
};

function toLocalDateTimeInputValue(isoValue: string): string {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function ClassroomSessionManager({ classroomId, backPath, scope }: ClassroomSessionManagerProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [sessionForm, setSessionForm] = useState<SessionFormState>(emptySessionForm);
  const [teachingContent, setTeachingContent] = useState<string>("");
  const [teachingSessionName, setTeachingSessionName] = useState<string>("");
  const [showTeachingDialog, setShowTeachingDialog] = useState(false);

  const { data: myClasses = [] } = useQuery<AssignedClassResponse[]>({
    queryKey: ["my-classes", scope],
    queryFn: () => api.get("/users/my-classes").then((r) => r.data),
  });

  const classroomName = useMemo(
    () => myClasses.find((c) => c.classroom_id === classroomId)?.classroom_name ?? `Classroom #${classroomId}`,
    [myClasses, classroomId]
  );

  const { data: materials = [], isLoading: materialsLoading } = useQuery<ContentResponse[]>({
    queryKey: ["classroom-materials", classroomId, scope],
    queryFn: () => api.get(`/content/classroom/${classroomId}`).then((r) => r.data),
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<SessionManageResponse[]>({
    queryKey: ["classroom-sessions", classroomId, scope],
    queryFn: () => api.get(`/sessions/classroom/${classroomId}`).then((r) => r.data),
  });

  const uploadMaterial = useMutation({
    mutationFn: async () => {
      if (!file) return;
      const fd = new FormData();
      fd.append("classroom_id", String(classroomId));
      fd.append("file", file);
      return api.post("/content/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: () => {
      toast.success("Study material uploaded");
      setFile(null);
      setShowMaterialForm(false);
      qc.invalidateQueries({ queryKey: ["classroom-materials", classroomId, scope] });
    },
  });

  const deleteMaterial = useMutation({
    mutationFn: (contentId: number) => api.delete(`/content/${contentId}`),
    onSuccess: () => {
      toast.success("Study material deleted");
      qc.invalidateQueries({ queryKey: ["classroom-materials", classroomId, scope] });
      qc.invalidateQueries({ queryKey: ["classroom-sessions", classroomId, scope] });
    },
  });

  const createSession = useMutation({
    mutationFn: () => api.post("/sessions/", {
      classroom_id: classroomId,
      content_id: Number(sessionForm.contentId),
      start_time: new Date(sessionForm.startTime).toISOString(),
      duration: Number(sessionForm.duration),
      expires_at: new Date(sessionForm.expiresAt).toISOString(),
    }),
    onSuccess: () => {
      toast.success("Session created");
      setShowSessionForm(false);
      setSessionForm(emptySessionForm);
      qc.invalidateQueries({ queryKey: ["classroom-sessions", classroomId, scope] });
    },
  });

  const updateSession = useMutation({
    mutationFn: () => {
      if (!editingSessionId) return;
      return api.put(`/sessions/${editingSessionId}`, {
        content_id: Number(sessionForm.contentId),
        start_time: new Date(sessionForm.startTime).toISOString(),
        duration: Number(sessionForm.duration),
        expires_at: new Date(sessionForm.expiresAt).toISOString(),
      });
    },
    onSuccess: () => {
      toast.success("Session updated");
      setEditingSessionId(null);
      setShowSessionForm(false);
      setSessionForm(emptySessionForm);
      qc.invalidateQueries({ queryKey: ["classroom-sessions", classroomId, scope] });
    },
  });

  const deleteSession = useMutation({
    mutationFn: (sessionId: number) => api.delete(`/sessions/${sessionId}`),
    onSuccess: () => {
      toast.success("Session deleted");
      qc.invalidateQueries({ queryKey: ["classroom-sessions", classroomId, scope] });
    },
  });

  const startSession = useMutation({
    mutationFn: async (sessionId: number) => {
      await api.post(`/ai/start/${sessionId}`);
      return api.get(`/ai/teach/${sessionId}`).then((r) => r.data);
    },
    onSuccess: (res, sessionId) => {
      const session = sessions.find((s) => s.id === sessionId);
      setTeachingSessionName(session?.session_name || `Session #${sessionId}`);
      setTeachingContent(res?.teaching_content || "No teaching content available.");
      setShowTeachingDialog(true);
      toast.success("Session started for testing");
      qc.invalidateQueries({ queryKey: ["classroom-sessions", classroomId, scope] });
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail || error?.message || "Failed to start session";
      toast.error(detail);
    },
  });

  const openCreateSession = () => {
    setEditingSessionId(null);
    setSessionForm(emptySessionForm);
    setShowSessionForm(true);
  };

  const openEditSession = (session: SessionManageResponse) => {
    setEditingSessionId(session.id);
    setSessionForm({
      contentId: String(session.content_id),
      startTime: toLocalDateTimeInputValue(session.start_time),
      duration: String(session.duration),
      expiresAt: toLocalDateTimeInputValue(session.expires_at),
    });
    setShowSessionForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate(backPath)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">{classroomName} - Manage Sessions</h1>
      </div>

      <Tabs defaultValue="materials" className="space-y-4">
        <TabsList>
          <TabsTrigger value="materials">Study Materials</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="materials" className="space-y-4">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" /> Study Materials
              </CardTitle>
              <Button size="sm" onClick={() => setShowMaterialForm((prev) => !prev)}>
                <Plus className="mr-2 h-4 w-4" /> {showMaterialForm ? "Cancel" : "Add Study Material"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {showMaterialForm && (
                <Card>
                  <CardContent className="pt-6 space-y-3">
                    <div className="space-y-2">
                      <Label>Upload PDF</Label>
                      <Input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                    </div>
                    <Button onClick={() => uploadMaterial.mutate()} disabled={!file || uploadMaterial.isPending}>
                      <Upload className="mr-2 h-4 w-4" /> Upload
                    </Button>
                  </CardContent>
                </Card>
              )}

              {materialsLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : materials.length === 0 ? (
                <p className="text-muted-foreground">No study materials uploaded for this classroom yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materials.map((item) => {
                      const fileName = item.file_path.split(/[\\/]/).pop() ?? item.file_path;
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{fileName}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteMaterial.mutate(item.id)}
                              disabled={deleteMaterial.isPending}
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-accent" /> Sessions
              </CardTitle>
              <Button size="sm" onClick={openCreateSession}>
                <Plus className="mr-2 h-4 w-4" /> Create Session
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {showSessionForm && (
                <Card>
                  <CardContent className="pt-6 space-y-3">
                    <div className="space-y-2">
                      <Label>Study Material</Label>
                      <Select
                        value={sessionForm.contentId}
                        onValueChange={(value) => setSessionForm((prev) => ({ ...prev, contentId: value }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Select study material" /></SelectTrigger>
                        <SelectContent>
                          {materials.map((item) => {
                            const fileName = item.file_path.split(/[\\/]/).pop() ?? item.file_path;
                            return (
                              <SelectItem key={item.id} value={String(item.id)}>
                                {fileName}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Start Time</Label>
                      <Input
                        type="datetime-local"
                        value={sessionForm.startTime}
                        onChange={(e) => setSessionForm((prev) => ({ ...prev, startTime: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Duration (minutes)</Label>
                      <Input
                        type="number"
                        min="1"
                        value={sessionForm.duration}
                        onChange={(e) => setSessionForm((prev) => ({ ...prev, duration: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Expires At</Label>
                      <Input
                        type="datetime-local"
                        value={sessionForm.expiresAt}
                        onChange={(e) => setSessionForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => (editingSessionId ? updateSession.mutate() : createSession.mutate())}
                        disabled={!sessionForm.contentId || !sessionForm.startTime || !sessionForm.duration || !sessionForm.expiresAt || createSession.isPending || updateSession.isPending}
                      >
                        {editingSessionId ? "Update Session" : "Create Session"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowSessionForm(false);
                          setEditingSessionId(null);
                          setSessionForm(emptySessionForm);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {sessionsLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : sessions.length === 0 ? (
                <p className="text-muted-foreground">No sessions created for this classroom yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Start Time</TableHead>
                      <TableHead>Expires At</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((item) => {
                      const fileName = item.content_file_path?.split(/[\\/]/).pop() ?? `Content #${item.content_id}`;
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.session_name || `Session #${item.id}`}</TableCell>
                          <TableCell>{item.subject || "-"}</TableCell>
                          <TableCell>{item.teacher_name || "-"}</TableCell>
                          <TableCell>{fileName}</TableCell>
                          <TableCell>{new Date(item.start_time).toLocaleString()}</TableCell>
                          <TableCell>{new Date(item.expires_at).toLocaleString()}</TableCell>
                          <TableCell>{item.duration} min</TableCell>
                          <TableCell>
                            <Badge variant={item.status === "live" ? "secondary" : item.status === "upcoming" ? "outline" : "destructive"}>
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              size="sm"
                              onClick={() => startSession.mutate(item.id)}
                              disabled={startSession.isPending || item.status === "expired"}
                            >
                              {startSession.isPending ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Play className="mr-1 h-3.5 w-3.5" />
                              )}
                              {item.status === "upcoming" ? "Start Early" : "Start"}
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="outline">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditSession(item)}>
                                  <Edit3 className="mr-2 h-4 w-4" /> Edit Session
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => deleteSession.mutate(item.id)}
                                  disabled={deleteSession.isPending}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete Session
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showTeachingDialog} onOpenChange={setShowTeachingDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{teachingSessionName}</DialogTitle>
            <DialogDescription>Session teaching content (Testing Mode)</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded-md bg-muted p-4 text-sm whitespace-pre-wrap">
            {teachingContent}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
