import { useParams } from "react-router-dom";
import ClassroomAttendancePanel from "@/components/ClassroomAttendancePanel";

export default function TeacherClassroomAttendance() {
  const { classroomId } = useParams<{ classroomId: string }>();
  const cid = Number(classroomId || 0);

  if (!cid) {
    return <div className="p-8 text-muted-foreground">Invalid classroom selected.</div>;
  }

  return (
    <ClassroomAttendancePanel
      title="Classroom Attendance Logs"
      sessionWiseEndpoint={`/attendance/classroom/${cid}/session-wise`}
      studentWiseEndpoint={`/attendance/classroom/${cid}/student-wise`}
      sessionWiseQueryKey="teacher-classroom-attendance-session-wise"
      studentWiseQueryKey="teacher-classroom-attendance-student-wise"
    />
  );
}
