import { useParams } from "react-router-dom";
import ClassroomSessionManager from "@/components/ClassroomSessionManager";

export default function AdminClassroomSessions() {
  const { classroomId } = useParams<{ classroomId: string }>();
  const cid = Number(classroomId || 0);

  if (!cid) {
    return <div className="p-8 text-muted-foreground">Invalid classroom selected.</div>;
  }

  return <ClassroomSessionManager classroomId={cid} backPath="/admin/sessions" scope="admin" />;
}
