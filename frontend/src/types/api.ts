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
  is_verified?: boolean;
}

export interface ClassroomResponse {
  id: number;
  name: string;
  teacher_names: string[];
}

export interface ContentResponse {
  id: number;
  file_path: string;
}

export interface AssignedClassResponse {
  id: number;
  classroom_id: number;
  classroom_name: string;
  subject: string | null;
}

export interface StudentCreate {
  name: string;
  classroom_id: number;
}

export interface StudentResponse {
  id: number;
  name: string;
  classroom_id: number;
}

export interface SessionCreate {
  classroom_id: number;
  content_id: number;
  start_time: string;
  duration: number;
}

export interface SessionResponse {
  id: number;
  classroom_id: number;
  content_id: number;
  start_time: string;
  duration: number;
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
