import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3 } from "lucide-react";
import type { ClassroomResponse } from "@/types/api";

export default function Analytics() {
  const { data: classrooms = [] } = useQuery<ClassroomResponse[]>({
    queryKey: ["classrooms"],
    queryFn: () => api.get("/classrooms/").then(r => r.data),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> Classrooms & Teachers</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Classroom</TableHead><TableHead>Teachers</TableHead></TableRow></TableHeader>
            <TableBody>
              {classrooms.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.teacher_names.length > 0 ? c.teacher_names.join(", ") : "Unassigned"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
