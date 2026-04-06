import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, School, BookOpen, ShieldCheck } from "lucide-react";

export default function AdminDashboard() {
  const { data: pending } = useQuery({ queryKey: ["pending-users"], queryFn: () => api.get("/users/pending-users").then(r => r.data) });
  const { data: classrooms } = useQuery({ queryKey: ["classrooms"], queryFn: () => api.get("/classrooms/").then(r => r.data) });

  const stats = [
    { label: "Pending Users", value: pending?.length ?? 0, icon: Users, color: "text-warning" },
    { label: "Classrooms", value: classrooms?.length ?? 0, icon: School, color: "text-primary" },
    { label: "Sessions", value: "—", icon: BookOpen, color: "text-accent" },
    { label: "System", value: "Online", icon: ShieldCheck, color: "text-success" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="glass-card hover:glow-primary transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
