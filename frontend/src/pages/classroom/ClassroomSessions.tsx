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
import { useNavigate } from "react-router-dom";

type AttendanceStudent = {
  id: number;
  name: string;
  confidence?: number | null;
};

type AttendanceScanReport = {
  session_id: number;
  classroom_id: number;
  classroom_name: string;
  total_students: number;
  present_count: number;
  absent_count: number;
  present_students: AttendanceStudent[];
  absent_students: AttendanceStudent[];
  message: string;
};

export default function ClassroomSessions() {
  const navigate = useNavigate();
  const [attendanceReport, setAttendanceReport] = useState<AttendanceScanReport | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [joinedSessionName, setJoinedSessionName] = useState<string>("");
  const [openDialog, setOpenDialog] = useState(false);

  const { data: sessions = [], isLoading } = useQuery<SessionManageResponse[]>({
    queryKey: ["classroom-sessions-list"],
    queryFn: () => api.get("/sessions/my-classroom/list").then((r) => r.data),
  });

  const joinSession = useMutation({
    mutationFn: async (sessionId: number) => {
      const attendance = await api.post(`/attendance/capture/${sessionId}`).then((r) => r.data);
      return attendance as AttendanceScanReport;
    },
    onSuccess: (res, sessionId) => {
      const session = sessions.find((entry) => entry.id === sessionId);
      setJoinedSessionName(session?.session_name || `Session #${sessionId}`);
      setSelectedSessionId(sessionId);
      setAttendanceReport(res);
      setOpenDialog(true);
      toast.success("Attendance captured. Ready to start lesson");
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{joinedSessionName}</DialogTitle>
            <DialogDescription>Attendance captured before lesson start</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-md bg-muted p-3">
                <p className="text-muted-foreground">Total</p>
                <p className="text-xl font-semibold">{attendanceReport?.total_students ?? 0}</p>
              </div>
              <div className="rounded-md bg-muted p-3">
                <p className="text-muted-foreground">Present</p>
                <p className="text-xl font-semibold text-emerald-600">{attendanceReport?.present_count ?? 0}</p>
              </div>
              <div className="rounded-md bg-muted p-3">
                <p className="text-muted-foreground">Absent</p>
                <p className="text-xl font-semibold text-rose-600">{attendanceReport?.absent_count ?? 0}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border p-3 max-h-44 overflow-auto">
                <p className="mb-2 font-medium">Present Students</p>
                {attendanceReport?.present_students?.length ? (
                  <ul className="space-y-1">
                    {attendanceReport.present_students.map((student) => (
                      <li key={student.id}>{student.name}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No students detected</p>
                )}
              </div>
              <div className="rounded-md border p-3 max-h-44 overflow-auto">
                <p className="mb-2 font-medium">Absent Students</p>
                {attendanceReport?.absent_students?.length ? (
                  <ul className="space-y-1">
                    {attendanceReport.absent_students.map((student) => (
                      <li key={student.id}>{student.name}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No absentees</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenDialog(false)}>Close</Button>
              <Button
                onClick={() => {
                  if (!selectedSessionId) return;
                  setOpenDialog(false);
                  navigate(`/classroom/teaching/${selectedSessionId}`);
                }}
              >
                Start Teaching Experience
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
