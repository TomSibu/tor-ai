import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { ClassroomResponse } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { School, Plus, LinkIcon } from "lucide-react";
import { toast } from "sonner";

export default function Classrooms() {
  const qc = useQueryClient();
  const { data: classrooms = [] } = useQuery<ClassroomResponse[]>({
    queryKey: ["classrooms"],
    queryFn: () => api.get("/classrooms/").then(r => r.data),
  });

  const [name, setName] = useState("");
  const [userId, setUserId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const [subject, setSubject] = useState("");

  const create = useMutation({
    mutationFn: () => api.post(`/classrooms/?name=${encodeURIComponent(name)}&user_id=${userId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["classrooms"] }); toast.success("Classroom created"); setName(""); setUserId(""); },
  });

  const assign = useMutation({
    mutationFn: () => api.post(`/classrooms/assign-teacher?teacher_id=${teacherId}&classroom_id=${classroomId}&subject=${encodeURIComponent(subject)}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["classrooms"] }); toast.success("Teacher assigned"); setTeacherId(""); setClassroomId(""); setSubject(""); },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Classrooms</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-card">
          <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /> Create Classroom</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Classroom Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Room 101" /></div>
            <div className="space-y-2"><Label>Classroom User ID</Label><Input type="number" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID with classroom role" /></div>
            <Button onClick={() => create.mutate()} disabled={!name || !userId || create.isPending}>
              <School className="mr-2 h-4 w-4" /> Create
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader><CardTitle className="flex items-center gap-2"><LinkIcon className="h-5 w-5 text-accent" /> Assign Teacher</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Teacher ID</Label><Input type="number" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} placeholder="Teacher user ID" /></div>
            <div className="space-y-2"><Label>Classroom ID</Label><Input type="number" value={classroomId} onChange={(e) => setClassroomId(e.target.value)} placeholder="Classroom ID" /></div>
            <div className="space-y-2"><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Mathematics" /></div>
            <Button onClick={() => assign.mutate()} disabled={!teacherId || !classroomId || !subject || assign.isPending}>
              <LinkIcon className="mr-2 h-4 w-4" /> Assign
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader><CardTitle>All Classrooms</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Teacher ID</TableHead></TableRow></TableHeader>
            <TableBody>
              {classrooms.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.id}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.teacher_id ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
