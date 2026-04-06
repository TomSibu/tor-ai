import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users as UsersIcon, BookOpen, Users as StudentsIcon, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import type { ClassroomResponse, UserResponse } from "@/types/api";

interface ClassroomUserInfo {
  user_id: number | null;
  user_name: string;
  user_email: string;
  classroom_id: number;
  classroom_name: string;
  student_count: number;
  teacher_count: number;
}

export default function ClassroomManagement() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: classrooms = [], isLoading, isError } = useQuery<ClassroomUserInfo[]>({
    queryKey: ["classroom-users"],
    queryFn: async () => {
      try {
        const primary = await api.get("/classrooms/users-with-classrooms");
        if (Array.isArray(primary.data) && primary.data.length > 0) {
          return primary.data;
        }
      } catch {
        // Fallback to legacy endpoints if the new endpoint is unavailable.
      }

      const [classroomsRes, usersRes] = await Promise.all([
        api.get<ClassroomResponse[]>("/classrooms/"),
        api.get<UserResponse[]>("/users/all"),
      ]);

      const classroomUsers = usersRes.data.filter((u) => u.role === "classroom");

      return classroomsRes.data.map((c) => {
        const owner = classroomUsers.find(
          (u) => u.name.trim().toLowerCase() === c.name.trim().toLowerCase()
        );

        return {
          user_id: owner?.id ?? null,
          user_name: owner?.name ?? "Unlinked classroom user",
          user_email: owner?.email ?? "—",
          classroom_id: c.id,
          classroom_name: c.name,
          student_count: 0,
          teacher_count: c.teacher_names?.length ?? 0,
        };
      });
    },
  });

  const filteredClassrooms = classrooms.filter((c) =>
    c.classroom_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.user_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Manage Classrooms</h1>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Classroom Users
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <Input 
              id="search"
              placeholder="Search by classroom name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : isError ? (
            <p className="text-destructive">Failed to load classrooms. Please refresh and try again.</p>
          ) : filteredClassrooms.length === 0 ? (
            <p className="text-muted-foreground">No classrooms found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Classroom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">Students</TableHead>
                  <TableHead className="text-center">Teachers</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClassrooms.map((classroom) => (
                  <TableRow key={classroom.classroom_id}>
                    <TableCell className="font-medium">{classroom.classroom_name}</TableCell>
                    <TableCell>{classroom.user_name} ({classroom.user_email})</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="gap-1">
                        <StudentsIcon className="h-3 w-3" />
                        {classroom.student_count}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="gap-1">
                        <UsersIcon className="h-3 w-3" />
                        {classroom.teacher_count}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/admin/classroom/${classroom.classroom_id}`)}
                      >
                        Manage <ChevronRight className="ml-1 h-3.5 w-3.5" />
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
