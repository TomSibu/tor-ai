import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { UserResponse } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

export default function PendingUsers() {
  const qc = useQueryClient();
  const { data: users = [], isLoading } = useQuery<UserResponse[]>({
    queryKey: ["pending-users"],
    queryFn: () => api.get("/users/pending-users").then(r => r.data),
  });

  const verify = useMutation({
    mutationFn: (id: number) => api.put(`/users/verify/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pending-users"] }); toast.success("User verified"); },
  });

  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pending-users"] }); toast.success("User deleted"); },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Pending Users</h1>
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Awaiting Verification</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : users.length === 0 ? (
            <p className="text-muted-foreground">No pending users 🎉</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} className="animate-fade-in">
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell><Badge variant="secondary">{u.role}</Badge></TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" onClick={() => verify.mutate(u.id)} disabled={verify.isPending}>
                        <CheckCircle className="mr-1 h-3.5 w-3.5" /> Verify
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => del.mutate(u.id)} disabled={del.isPending}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
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
