import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import type { AssignedClassResponse } from "@/types/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Layers } from "lucide-react";

export default function TeacherClassroomManagement() {
  const navigate = useNavigate();

  const { data: classes = [], isLoading } = useQuery<AssignedClassResponse[]>({
    queryKey: ["teacher-manage-classrooms"],
    queryFn: () => api.get("/users/my-classes").then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Attendance Logs</h1>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> Assigned Classrooms
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : classes.length === 0 ? (
            <p className="text-muted-foreground">No classrooms assigned.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Classroom</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.classroom_name}</TableCell>
                    <TableCell>{entry.subject || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/teacher/classroom/${entry.classroom_id}/attendance`)}
                      >
                        View Attendance
                      </Button>
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
