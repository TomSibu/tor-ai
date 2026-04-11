export type UserRole = "admin" | "teacher" | "classroom";

export interface UserCreate {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface UserResponse {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  verified: boolean;
  profile_pic?: string | null;
}

export interface ClassroomResponse {
  id: number;
  name: string;
  teacher_names: string[];
}

export interface ContentResponse {
  id: number;
  teacher_id: number;
  classroom_id?: number | null;
  classroom_name?: string | null;
  file_path: string;
  file_name?: string | null;
  file_url?: string | null;
}

export interface StudyMaterialContent {
  id: number;
  file_name: string;
  file_path: string;
  file_url: string;
}

export interface StudyMaterialGroup {
  assignment_id: number;
  subject: string | null;
  teacher_id: number;
  teacher_name: string;
  content_count: number;
  contents: StudyMaterialContent[];
}

export interface ClassroomStudyMaterialsResponse {
  classroom_id: number;
  classroom_name: string;
  materials: StudyMaterialGroup[];
}

export interface AssignedClassResponse {
  id: number;
  classroom_id: number;
  classroom_name: string;
  subject: string | null;
}

export interface StudentCreate {
  name: string;
  roll_number?: string;
  email?: string;
  phone?: string;
  classroom_id: number;
}

export interface StudentResponse {
  id: number;
  name: string;
  roll_number?: string;
  email?: string;
  phone?: string;
  photo_path?: string;
  classroom_id: number;
}

export interface SessionCreate {
  classroom_id: number;
  content_id: number;
  start_time: string;
  duration: number;
  expires_at: string;
}

export interface SessionResponse {
  id: number;
  classroom_id: number;
  content_id: number;
  start_time: string;
  duration: number;
  expires_at: string;
  teaching_content?: string | null;
}

export interface SessionManageResponse extends SessionResponse {
  classroom_name?: string | null;
  content_file_path?: string | null;
  teacher_id?: number | null;
  teacher_name?: string | null;
  subject?: string | null;
  session_name?: string | null;
  expires_at: string;
  teaching_content?: string | null;
  status: "live" | "upcoming" | "expired";
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user?: UserResponse;
}

export interface AttendanceRecord {
  student_id: number;
  present: boolean;
}

export interface SessionWiseStudent {
  id: number;
  name: string;
  confidence?: number | null;
}

export interface SessionWiseItem {
  session_id: number;
  session_name?: string | null;
  subject?: string | null;
  teacher_name?: string | null;
  start_time: string | null;
  total_students: number;
  present_count: number;
  absent_count: number;
  present_students: SessionWiseStudent[];
  absent_students: SessionWiseStudent[];
}

export interface ClassroomAttendanceSessionWise {
  classroom_id: number;
  classroom_name: string;
  total_students: number;
  sessions: SessionWiseItem[];
}

export interface StudentSessionRecord {
  session_id: number;
  session_name?: string | null;
  subject?: string | null;
  start_time: string | null;
  status: "present" | "absent";
  confidence?: number | null;
}

export interface StudentWiseItem {
  student_id: number;
  student_name: string;
  present_sessions: number;
  absent_sessions: number;
  attendance_percentage: number;
  records: StudentSessionRecord[];
}

export interface ClassroomAttendanceStudentWise {
  classroom_id: number;
  classroom_name: string;
  total_sessions: number;
  students: StudentWiseItem[];
}
