import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor } from "lucide-react";

export default function ClassroomDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["classroom-dashboard"],
    queryFn: () => api.get("/classrooms/my-dashboard").then(r => r.data),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Classroom Dashboard</h1>
      <Card className="glass-card">
        <CardHeader><CardTitle className="flex items-center gap-2"><Monitor className="h-5 w-5 text-primary" /> My Classroom</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Loading…</p> :
            data ? (
              <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto">{JSON.stringify(data, null, 2)}</pre>
            ) : <p className="text-muted-foreground">No classroom data available.</p>
          }
        </CardContent>
      </Card>
    </div>
  );
}
