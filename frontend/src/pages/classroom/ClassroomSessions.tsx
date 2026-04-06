import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { SessionManageResponse } from "@/types/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function ClassroomSessions() {
  const [joinedContent, setJoinedContent] = useState<string>("");
  const [joinedSessionName, setJoinedSessionName] = useState<string>("");
  const [openDialog, setOpenDialog] = useState(false);

  const { data: sessions = [], isLoading } = useQuery<SessionManageResponse[]>({
    queryKey: ["classroom-sessions-list"],
    queryFn: () => api.get("/sessions/my-classroom/list").then((r) => r.data),
  });

  const joinSession = useMutation({
    mutationFn: async (sessionId: number) => {
      await api.post(`/attendance/capture/${sessionId}`);
      await api.post(`/ai/start/${sessionId}`);
      return api.get(`/ai/teach/${sessionId}`).then((r) => r.data);
    },
    onSuccess: (res, sessionId) => {
      const session = sessions.find((entry) => entry.id === sessionId);
      setJoinedSessionName(session?.session_name || `Session #${sessionId}`);
      setJoinedContent(res?.teaching_content || "No teaching content available.");
      setOpenDialog(true);
      toast.success("Session started with attendance captured");
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail || error?.message || "Unable to join session";
      toast.error(detail);
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Class Sessions</h1>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Sessions for My Class
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : sessions.length === 0 ? (
            <p className="text-muted-foreground">No sessions available for your class yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">{session.session_name || `Session #${session.id}`}</TableCell>
                    <TableCell>{session.subject || "-"}</TableCell>
                    <TableCell>{session.teacher_name || "-"}</TableCell>
                    <TableCell>{new Date(session.start_time).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={session.status === "live" ? "secondary" : session.status === "upcoming" ? "outline" : "destructive"}>
                        {session.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => joinSession.mutate(session.id)}
                        disabled={joinSession.isPending || session.status !== "live"}
                      >
                        {joinSession.isPending ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <PlayCircle className="mr-1 h-3.5 w-3.5" />
                        )}
                        Join
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{joinedSessionName}</DialogTitle>
            <DialogDescription>Session teaching content</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded-md bg-muted p-4 text-sm whitespace-pre-wrap">
            {joinedContent}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
