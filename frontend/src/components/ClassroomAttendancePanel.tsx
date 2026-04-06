import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type {
  ClassroomAttendanceSessionWise,
  ClassroomAttendanceStudentWise,
  SessionWiseItem,
  StudentWiseItem,
} from "@/types/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ClassroomAttendancePanelProps {
  title: string;
  sessionWiseEndpoint: string;
  studentWiseEndpoint: string;
  sessionWiseQueryKey: string;
  studentWiseQueryKey: string;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function toDateOnly(dateString: string | null): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0];
}

export default function ClassroomAttendancePanel({
  title,
  sessionWiseEndpoint,
  studentWiseEndpoint,
  sessionWiseQueryKey,
  studentWiseQueryKey,
}: ClassroomAttendancePanelProps) {
  const [selectedSession, setSelectedSession] = useState<SessionWiseItem | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentWiseItem | null>(null);
  const [sessionIdSearch, setSessionIdSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [studentNameSearch, setStudentNameSearch] = useState("");

  const { data: sessionWise, isLoading: sessionLoading } = useQuery<ClassroomAttendanceSessionWise>({
    queryKey: [sessionWiseQueryKey, sessionWiseEndpoint],
    queryFn: () => api.get(sessionWiseEndpoint).then((res) => res.data),
  });

  const { data: studentWise, isLoading: studentLoading } = useQuery<ClassroomAttendanceStudentWise>({
    queryKey: [studentWiseQueryKey, studentWiseEndpoint],
    queryFn: () => api.get(studentWiseEndpoint).then((res) => res.data),
  });

  const filteredSessions = (sessionWise?.sessions ?? []).filter((item) => {
    const sessionIdMatch = sessionIdSearch.trim() === ""
      || String(item.session_id).includes(sessionIdSearch.trim());

    const itemDate = toDateOnly(item.start_time);
    const fromMatch = !fromDate || (!!itemDate && itemDate >= fromDate);
    const toMatch = !toDate || (!!itemDate && itemDate <= toDate);

    return sessionIdMatch && fromMatch && toMatch;
  });

  const filteredStudents = (studentWise?.students ?? []).filter((item) =>
    item.student_name.toLowerCase().includes(studentNameSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>

      <Tabs defaultValue="session-wise" className="space-y-4">
        <TabsList>
          <TabsTrigger value="session-wise">Session-wise Attendance</TabsTrigger>
          <TabsTrigger value="student-wise">Student-wise Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="session-wise" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>
                {sessionWise?.classroom_name ? `${sessionWise.classroom_name} Attendance by Session` : "Attendance by Session"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sessionLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : !sessionWise || sessionWise.sessions.length === 0 ? (
                <p className="text-muted-foreground">No session attendance records available.</p>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="session-id-search">Session ID</Label>
                      <Input
                        id="session-id-search"
                        placeholder="Search by session ID"
                        value={sessionIdSearch}
                        onChange={(e) => setSessionIdSearch(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="from-date">From Date</Label>
                      <Input
                        id="from-date"
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="to-date">To Date</Label>
                      <Input
                        id="to-date"
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                      />
                    </div>
                  </div>

                  {filteredSessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No sessions match the selected filters.</p>
                  ) : null}

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Session ID</TableHead>
                        <TableHead>Session</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Start Time</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Present</TableHead>
                        <TableHead>Absent</TableHead>
                        <TableHead className="text-right">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSessions.map((item) => (
                        <TableRow key={item.session_id}>
                          <TableCell className="font-medium">#{item.session_id}</TableCell>
                          <TableCell>{item.session_name || `Session #${item.session_id}`}</TableCell>
                          <TableCell>{item.subject || "-"}</TableCell>
                          <TableCell>{formatDate(item.start_time)}</TableCell>
                          <TableCell>{item.total_students}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{item.present_count}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.absent_count}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedSession(selectedSession?.session_id === item.session_id ? null : item)}
                            >
                              {selectedSession?.session_id === item.session_id ? "Hide" : "View"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {selectedSession && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Present Students ({selectedSession.present_count})</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {selectedSession.present_students.length === 0 ? (
                            <p className="text-sm text-muted-foreground">None</p>
                          ) : (
                            selectedSession.present_students.map((student) => (
                              <div key={student.id} className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm">
                                {student.name}
                                {student.confidence != null ? ` (${student.confidence.toFixed(2)}%)` : ""}
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Absent Students ({selectedSession.absent_count})</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {selectedSession.absent_students.length === 0 ? (
                            <p className="text-sm text-muted-foreground">None</p>
                          ) : (
                            selectedSession.absent_students.map((student) => (
                              <div key={student.id} className="rounded-md bg-rose-500/10 px-3 py-2 text-sm">
                                {student.name}
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="student-wise" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>
                {studentWise?.classroom_name ? `${studentWise.classroom_name} Attendance by Student` : "Attendance by Student"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {studentLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : !studentWise || studentWise.students.length === 0 ? (
                <p className="text-muted-foreground">No student attendance records available.</p>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="student-name-search">Student Name</Label>
                    <Input
                      id="student-name-search"
                      placeholder="Search by student name"
                      value={studentNameSearch}
                      onChange={(e) => setStudentNameSearch(e.target.value)}
                    />
                  </div>

                  {filteredStudents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No students match the selected filters.</p>
                  ) : null}

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Present</TableHead>
                        <TableHead>Absent</TableHead>
                        <TableHead>Attendance %</TableHead>
                        <TableHead className="text-right">Session Records</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((item) => (
                        <TableRow key={item.student_id}>
                          <TableCell className="font-medium">{item.student_name}</TableCell>
                          <TableCell>{item.present_sessions}</TableCell>
                          <TableCell>{item.absent_sessions}</TableCell>
                          <TableCell>{item.attendance_percentage.toFixed(2)}%</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedStudent(selectedStudent?.student_id === item.student_id ? null : item)}
                            >
                              {selectedStudent?.student_id === item.student_id ? "Hide" : "View"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {selectedStudent && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">{selectedStudent.student_name} Session Records</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Session ID</TableHead>
                              <TableHead>Session</TableHead>
                              <TableHead>Subject</TableHead>
                              <TableHead>Start Time</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Confidence</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedStudent.records.map((record) => (
                              <TableRow key={`${selectedStudent.student_id}-${record.session_id}`}>
                                <TableCell className="font-medium">#{record.session_id}</TableCell>
                                <TableCell>{record.session_name || `Session #${record.session_id}`}</TableCell>
                                <TableCell>{record.subject || "-"}</TableCell>
                                <TableCell>{formatDate(record.start_time)}</TableCell>
                                <TableCell>
                                  <Badge variant={record.status === "present" ? "secondary" : "outline"}>
                                    {record.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>{record.confidence != null ? `${record.confidence.toFixed(2)}%` : "-"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
