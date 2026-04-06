import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GraduationCap } from "lucide-react";
import type { AssignedClassResponse } from "@/types/api";

export default function TeacherClasses() {
  const { data: classes = [], isLoading } = useQuery<AssignedClassResponse[]>({
    queryKey: ["my-classes"],
    queryFn: () => api.get("/users/my-classes").then(r => r.data),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">My Classes</h1>
      <Card className="glass-card">
        <CardHeader><CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary" /> Assigned Classes</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Loading…</p> :
            Array.isArray(classes) && classes.length > 0 ? (
              <Table>
                <TableHeader><TableRow><TableHead>Classroom</TableHead><TableHead>Subject</TableHead></TableRow></TableHeader>
                <TableBody>
                  {classes.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.classroom_name}</TableCell>
                      <TableCell>{c.subject || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <p className="text-muted-foreground">No classes assigned yet.</p>
          }
        </CardContent>
      </Card>
    </div>
  );
}
