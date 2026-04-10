import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, Users, BookOpen, Calendar, FileText, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import type { ClassroomStudyMaterialsResponse } from "@/types/api";

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

  const { data: materialsData, isLoading: materialsLoading } = useQuery<ClassroomStudyMaterialsResponse>({
    queryKey: ["classroom-study-materials", data?.classroom?.id],
    queryFn: () => api.get(`/content/classroom/${data?.classroom?.id}/study-materials`).then(r => r.data),
    enabled: !!data?.classroom?.id,
  });

  const openStudyMaterial = (fileUrl: string) => {
    const baseUrl = String(api.defaults.baseURL || "").replace(/\/$/, "");
    const normalizedUrl = fileUrl.startsWith("http")
      ? fileUrl
      : `${baseUrl}${fileUrl.startsWith("/") ? "" : "/"}${fileUrl}`;

    const popup = window.open("about:blank", "_blank", "noopener,noreferrer");
    void api
      .get(normalizedUrl, { responseType: "blob" })
      .then((response) => {
        const mimeType = response.headers["content-type"] || "application/pdf";
        const blob = new Blob([response.data], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);

        if (popup) {
          popup.location.href = blobUrl;
        } else {
          window.open(blobUrl, "_blank", "noopener,noreferrer");
        }

        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      })
      .catch(() => {
        popup?.close();
      });
  };

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

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 md:w-[760px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="teachers">Teachers</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="materials">Study Materials</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
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
        </TabsContent>

        <TabsContent value="teachers">
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
        </TabsContent>

        <TabsContent value="sessions">
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
        </TabsContent>

        <TabsContent value="materials">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-accent" /> Study Materials
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {materialsLoading ? (
                <p className="text-muted-foreground">Loading study materials...</p>
              ) : !materialsData || materialsData.materials.length === 0 ? (
                <p className="text-muted-foreground">No study materials uploaded yet.</p>
              ) : (
                materialsData.materials.map((group) => (
                  <div key={group.assignment_id} className="rounded-lg border bg-background/60 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold">
                          {group.subject || "Unspecified Subject"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {group.teacher_name}
                        </div>
                      </div>
                      <Badge variant="secondary">{group.content_count} uploaded</Badge>
                    </div>

                    {group.contents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No files uploaded for this subject yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {group.contents.map((content) => (
                          <div key={content.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{content.file_name}</p>
                              <p className="text-xs text-muted-foreground">PDF study material</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => openStudyMaterial(content.file_url)}>
                              Open <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
