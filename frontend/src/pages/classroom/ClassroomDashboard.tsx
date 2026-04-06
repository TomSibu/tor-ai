import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, Users, BookOpen, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface DashboardData {
  classroom: {
    id: number;
    name: string;
    user_id: number;
  };
  teachers: Array<{
    id: number;
    teacher_id: number;
    teacher_name: string;
    subject: string | null;
  }>;
  sessions: Array<{
    id: number;
    start_time: string | null;
    expires_at: string | null;
    duration: number;
    status: "upcoming" | "live" | "expired";
  }>;
  student_count: number;
  total_teachers: number;
  total_sessions: number;
}

export default function ClassroomDashboard() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["classroom-dashboard"],
    queryFn: () => api.get("/classrooms/my-dashboard").then(r => r.data),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Classroom Dashboard</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Classroom Dashboard</h1>
        <p className="text-muted-foreground">No classroom data available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Classroom Dashboard</h1>

      {/* Classroom Overview */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-primary" /> {data.classroom.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Students</span>
              </div>
              <div className="text-2xl font-bold">{data.student_count}</div>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Teachers</span>
              </div>
              <div className="text-2xl font-bold">{data.total_teachers}</div>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Sessions</span>
              </div>
              <div className="text-2xl font-bold">{data.total_sessions}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Teachers */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-accent" /> Assigned Teachers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.teachers.length === 0 ? (
            <p className="text-muted-foreground">No teachers assigned yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher Name</TableHead>
                  <TableHead>Subject</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.teachers.map((teacher) => (
                  <TableRow key={teacher.id}>
                    <TableCell className="font-medium">{teacher.teacher_name}</TableCell>
                    <TableCell>{teacher.subject || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Sessions */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-accent" /> Recent Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.sessions.length === 0 ? (
            <p className="text-muted-foreground">No sessions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Start Time</TableHead>
                  <TableHead>Expires At</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>{session.start_time ? new Date(session.start_time).toLocaleString() : "-"}</TableCell>
                    <TableCell>{session.expires_at ? new Date(session.expires_at).toLocaleString() : "-"}</TableCell>
                    <TableCell>{session.duration} min</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          session.status === "live" ? "secondary" : session.status === "upcoming" ? "outline" : "destructive"
                        }
                      >
                        {session.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
