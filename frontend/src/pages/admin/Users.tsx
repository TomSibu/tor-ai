import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { UserResponse, UserRole } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit3, Trash2, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";

type UserFormState = {
  id: number | null;
  name: string;
  email: string;
  password: string;
  verified: boolean;
  role: UserRole;
};

const emptyForm: UserFormState = {
  id: null,
  name: "",
  email: "",
  password: "",
  verified: false,
  role: "teacher",
};

export default function Users() {
  const qc = useQueryClient();
  const { data: users = [], isLoading } = useQuery<UserResponse[]>({
    queryKey: ["all-users"],
    queryFn: () => api.get("/users/all").then(r => r.data),
  });

  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");

  useEffect(() => {
    if (form.id === null && users.length > 0) {
      const first = users[0];
      setForm({
        id: first.id,
        name: first.name,
        email: first.email,
        password: "",
        verified: !!first.verified,
        role: first.role,
      });
    }
  }, [users, form.id]);

  const filteredUsers = users.filter((user) => {
    const matchesSearch = searchTerm === "" || 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const save = useMutation({
    mutationFn: () => api.put(`/users/${form.id}`, {
      name: form.name,
      email: form.email,
      password: form.password || undefined,
      verified: form.verified,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-users"] });
      qc.invalidateQueries({ queryKey: ["pending-users"] });
      toast.success("User updated");
      setForm((prev) => ({ ...prev, password: "" }));
    },
  });

  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-users"] });
      qc.invalidateQueries({ queryKey: ["pending-users"] });
      toast.success("User deleted");
      setForm(emptyForm);
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">All Users</h1>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UsersIcon className="h-5 w-5 text-primary" /> Users</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <Input 
                  id="search"
                  placeholder="Search by name or email..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-filter">Filter by Role</Label>
                <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as UserRole | "all")}>
                  <SelectTrigger id="role-filter"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="classroom">Classroom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {isLoading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : filteredUsers.length === 0 ? (
              <p className="text-muted-foreground">No users found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell><Badge variant="secondary">{user.role}</Badge></TableCell>
                      <TableCell>{user.verified ? "Verified" : "Pending"}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setForm({
                            id: user.id,
                            name: user.name,
                            email: user.email,
                            password: "",
                            verified: !!user.verified,
                            role: user.role,
                          })}
                        >
                          <Edit3 className="mr-1 h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => del.mutate(user.id)} disabled={del.isPending}>
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

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Edit User</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>User</Label>
              <Select
                value={form.id === null ? "" : String(form.id)}
                onValueChange={(value) => {
                  const selected = users.find((user) => String(user.id) === value);
                  if (!selected) return;
                  setForm({
                    id: selected.id,
                    name: selected.name,
                    email: selected.email,
                    password: "",
                    verified: !!selected.verified,
                    role: selected.role,
                  });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Choose a user" /></SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={String(user.id)}>{user.name} ({user.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} placeholder="Leave blank to keep current password" />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.verified ? "true" : "false"} onValueChange={(value) => setForm((prev) => ({ ...prev, verified: value === "true" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Verified</SelectItem>
                  <SelectItem value="false">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => save.mutate()} disabled={form.id === null || save.isPending}>Save Changes</Button>
              <Button variant="outline" onClick={() => setForm(emptyForm)}>Reset</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
