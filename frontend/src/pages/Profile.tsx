import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const canEditSelf = useMemo(() => user?.role === "admin" || user?.role === "teacher" || user?.role === "classroom", [user?.role]);

  useEffect(() => {
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
  }, [user?.name, user?.email]);

  const handleSave = async () => {
    if (!canEditSelf) return;

    setIsSaving(true);
    try {
      const payload: { name?: string; email?: string; password?: string } = {};

      if (name.trim() && name.trim() !== (user?.name ?? "")) payload.name = name.trim();
      if (email.trim() && email.trim() !== (user?.email ?? "")) payload.email = email.trim();
      if (password.trim()) payload.password = password;

      if (Object.keys(payload).length === 0) {
        toast.info("No changes to save.");
        return;
      }

      await api.put("/users/me", payload);
      setPassword("");
      await refreshUser();
      toast.success("Profile updated successfully.");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>

      <Card className="glass-card max-w-2xl">
        <CardHeader>
          <CardTitle>User Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEditSelf || isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!canEditSelf || isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={canEditSelf ? "Enter new password (optional)" : "Not editable for this role"}
              disabled={!canEditSelf || isSaving}
            />
          </div>

          <div className="text-sm text-muted-foreground">
            Role: <span className="font-medium">{user?.role ?? "-"}</span>
          </div>

          {!canEditSelf && (
            <p className="text-sm text-muted-foreground">
              Admin, teacher, and classroom users can edit name, email, and password from this page.
            </p>
          )}

          {canEditSelf && (
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
