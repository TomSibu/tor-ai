import ClassroomAttendancePanel from "@/components/ClassroomAttendancePanel";

export default function ClassroomAttendance() {
  return (
    <ClassroomAttendancePanel
      title="Attendance Logs"
      sessionWiseEndpoint="/attendance/my-classroom/session-wise"
      studentWiseEndpoint="/attendance/my-classroom/student-wise"
      sessionWiseQueryKey="classroom-attendance-session-wise"
      studentWiseQueryKey="classroom-attendance-student-wise"
    />
  );
}
