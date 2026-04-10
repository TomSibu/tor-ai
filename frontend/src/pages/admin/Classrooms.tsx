import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { ClassroomResponse, UserResponse } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LinkIcon } from "lucide-react";
import { toast } from "sonner";

export default function Classrooms() {
  const qc = useQueryClient();
  const { data: classrooms = [] } = useQuery<ClassroomResponse[]>({
    queryKey: ["classrooms"],
    queryFn: () => api.get("/classrooms/").then(r => r.data),
  });

  const { data: teachers = [] } = useQuery<UserResponse[]>({
    queryKey: ["teachers"],
    queryFn: () => api.get("/users/teachers").then(r => r.data),
  });

  const { data: subjectSuggestions = [] } = useQuery<string[]>({
    queryKey: ["subject-suggestions"],
    queryFn: () => api.get("/classrooms/subjects").then(r => r.data),
  });

  const [teacherId, setTeacherId] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const [subject, setSubject] = useState("");

  const assign = useMutation({
    mutationFn: () => api.post(`/classrooms/assign-teacher?teacher_id=${teacherId}&classroom_id=${classroomId}&subject=${encodeURIComponent(subject)}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["classrooms"] }); toast.success("Teacher assigned"); setTeacherId(""); setClassroomId(""); setSubject(""); },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Classrooms</h1>
      <Card className="glass-card">
        <CardHeader><CardTitle className="flex items-center gap-2"><LinkIcon className="h-5 w-5 text-accent" /> Assign Teacher</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Teacher</Label>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger><SelectValue placeholder="Choose a teacher or admin" /></SelectTrigger>
              <SelectContent>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={String(teacher.id)}>
                    {teacher.name} ({teacher.email}) {teacher.role === "admin" ? "- Admin" : "- Teacher"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Mathematics"
              list="subject-suggestions"
            />
            <datalist id="subject-suggestions">
              {subjectSuggestions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>
          <Button onClick={() => assign.mutate()} disabled={!teacherId || !classroomId || !subject || assign.isPending}>
            <LinkIcon className="mr-2 h-4 w-4" /> Assign
          </Button>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader><CardTitle>All Classrooms</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Teachers</TableHead></TableRow></TableHeader>
            <TableBody>
              {classrooms.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.teacher_names.length > 0 ? c.teacher_names.join(", ") : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
