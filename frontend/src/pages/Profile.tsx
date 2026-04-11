import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera } from "lucide-react";
import { toast } from "sonner";

const MAX_PROFILE_PICTURE_BYTES = 5 * 1024 * 1024;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isPicDialogOpen, setIsPicDialogOpen] = useState(false);
  const [isSavingProfilePic, setIsSavingProfilePic] = useState(false);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const profilePicInputRef = useRef<HTMLInputElement>(null);

  const canEditSelf = useMemo(() => user?.role === "admin" || user?.role === "teacher" || user?.role === "classroom", [user?.role]);

  useEffect(() => {
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
    setProfilePic(user?.profile_pic ?? null);
  }, [user?.name, user?.email, user?.profile_pic]);

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

  const handleProfilePicSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!canEditSelf) return;

    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(selectedFile.type)) {
      toast.error("Profile picture must be JPEG, PNG, WEBP, or GIF");
      event.target.value = "";
      return;
    }

    if (selectedFile.size > MAX_PROFILE_PICTURE_BYTES) {
      toast.error("Profile picture must be 5 MB or smaller");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) {
        toast.error("Unable to read selected image");
        return;
      }

      setIsSavingProfilePic(true);
      try {
        await api.put("/users/me", { profile_pic: dataUrl });
        await refreshUser();
        setProfilePic(dataUrl);
        toast.success(profilePic ? "Profile picture updated" : "Profile picture added");
        setIsPicDialogOpen(false);
      } catch (err: any) {
        toast.error(err?.response?.data?.detail || "Failed to update profile picture");
      } finally {
        setIsSavingProfilePic(false);
        event.target.value = "";
      }
    };
    reader.onerror = () => {
      toast.error("Unable to read selected image");
      event.target.value = "";
    };

    reader.readAsDataURL(selectedFile);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <Card className="glass-card">
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

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Profile Picture</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={() => setIsPicDialogOpen(true)}
              className="group rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              disabled={!canEditSelf}
            >
              <Avatar className="h-40 w-40 border shadow-sm transition group-hover:scale-[1.02]">
                {profilePic ? <AvatarImage src={profilePic} alt={user?.name || "Profile"} /> : null}
                <AvatarFallback className="text-3xl font-semibold">{getInitials(user?.name ?? "User")}</AvatarFallback>
              </Avatar>
            </button>
            <p className="text-center text-sm text-muted-foreground">
              Click the circle to {profilePic ? "edit" : "add"} your profile picture.
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isPicDialogOpen} onOpenChange={setIsPicDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{profilePic ? "Edit Profile Picture" : "Add Profile Picture"}</DialogTitle>
            <DialogDescription>
              Upload a JPEG, PNG, WEBP, or GIF image up to 5 MB.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 pt-2">
            <Avatar className="h-28 w-28 border">
              {profilePic ? <AvatarImage src={profilePic} alt={user?.name || "Profile"} /> : null}
              <AvatarFallback className="text-2xl font-semibold">{getInitials(user?.name ?? "User")}</AvatarFallback>
            </Avatar>

            <Input
              ref={profilePicInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif"
              onChange={handleProfilePicSelect}
              disabled={isSavingProfilePic}
              className="hidden"
            />
            <Button
              type="button"
              onClick={() => profilePicInputRef.current?.click()}
              disabled={isSavingProfilePic}
              className="w-full"
            >
              <Camera className="mr-2 h-4 w-4" />
              {isSavingProfilePic
                ? "Saving..."
                : profilePic
                  ? "Edit Profile Picture"
                  : "Add Profile Picture"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
