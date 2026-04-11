import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import api from "@/lib/api";
import type { StudentResponse, UserResponse } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, Upload, Trash2, Plus, LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { useState, useRef } from "react";
import ClassroomAttendancePanel from "@/components/ClassroomAttendancePanel";

const MAX_STUDENT_PHOTO_BYTES = 10 * 1024 * 1024;
const STUDENT_PHOTO_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,.bmp,.tif,.tiff,image/jpeg,image/png,image/webp,image/gif,image/bmp,image/tiff";

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error && "response" in error) {
    const apiError = error as AxiosError<{ detail?: string }>;
    return apiError.response?.data?.detail ?? fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function isSupportedPhotoFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type === "image/jpeg" ||
    file.type === "image/png" ||
    file.type === "image/webp" ||
    file.type === "image/gif" ||
    file.type === "image/bmp" ||
    file.type === "image/tiff" ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp") ||
    name.endsWith(".gif") ||
    name.endsWith(".bmp") ||
    name.endsWith(".tif") ||
    name.endsWith(".tiff")
  );
}

interface ClassroomDetails {
  classroom: { id: number; name: string };
  students: StudentResponse[];
  teachers: Array<{ id: number; teacher_id: number; teacher_name: string; subject: string }>;
}

type StudentFormState = {
  name: string;
  roll_number: string;
  email: string;
  phone: string;
  photo: File | null;
};

const emptyForm: StudentFormState = {
  name: "",
  roll_number: "",
  email: "",
  phone: "",
  photo: null,
};

export default function ClassroomDetail() {
  const { classroomId } = useParams<{ classroomId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [studentForm, setStudentForm] = useState<StudentFormState>(emptyForm);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState("");
  const [subject, setSubject] = useState("");

  const cid = parseInt(classroomId || "0");

  const { data: details, isLoading, isError, error } = useQuery<ClassroomDetails>({
    queryKey: ["classroom-detail", cid],
    queryFn: () => api.get(`/classrooms/details/${cid}`).then(r => r.data),
    enabled: !!cid,
    retry: false,
  });

  const { data: teachers = [] } = useQuery<UserResponse[]>({
    queryKey: ["teachers"],
    queryFn: () => api.get("/users/teachers").then(r => r.data),
  });

  const { data: subjectSuggestions = [] } = useQuery<string[]>({
    queryKey: ["subject-suggestions"],
    queryFn: () => api.get("/classrooms/subjects").then(r => r.data),
  });

  const addStudent = useMutation({
    mutationFn: async () => {
      if (studentForm.photo) {
        if (!isSupportedPhotoFile(studentForm.photo)) {
          throw new Error("Only JPEG, PNG, GIF, WEBP, BMP, or TIFF images are allowed");
        }

        if (studentForm.photo.size > MAX_STUDENT_PHOTO_BYTES) {
          throw new Error("Student photos must be 10 MB or smaller");
        }
      }

      const student = await api.post("/students/", {
        name: studentForm.name,
        roll_number: studentForm.roll_number || undefined,
        email: studentForm.email || undefined,
        phone: studentForm.phone || undefined,
        classroom_id: cid,
      });
      
      if (studentForm.photo) {
        const fd = new FormData();
        fd.append("file", studentForm.photo);
        await api.post(`/students/${student.data.id}/photo`, fd, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      }
      
      return student.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classroom-detail", cid] });
      toast.success("Student added successfully");
      setStudentForm(emptyForm);
      setPhotoPreview(null);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Unable to add student"));
    },
  });

  const deleteStudent = useMutation({
    mutationFn: (studentId: number) => api.delete(`/students/${studentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classroom-detail", cid] });
      toast.success("Student deleted");
    },
  });

  const assignTeacher = useMutation({
    mutationFn: () => 
      api.post(`/classrooms/assign-teacher?teacher_id=${teacherId}&classroom_id=${cid}&subject=${encodeURIComponent(subject)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classroom-detail", cid] });
      toast.success("Teacher assigned");
      setTeacherId("");
      setSubject("");
    },
  });

  const removeTeacher = useMutation({
    mutationFn: (assignmentId: number) => api.delete(`/classrooms/assignments/${assignmentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classroom-detail", cid] });
      toast.success("Teacher removed");
    },
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!isSupportedPhotoFile(file)) {
        toast.error("Only JPEG, PNG, GIF, WEBP, BMP, or TIFF images are allowed");
        e.target.value = "";
        setStudentForm(prev => ({ ...prev, photo: null }));
        setPhotoPreview(null);
        return;
      }

      if (file.size > MAX_STUDENT_PHOTO_BYTES) {
        toast.error("Student photos must be 10 MB or smaller");
        e.target.value = "";
        setStudentForm(prev => ({ ...prev, photo: null }));
        setPhotoPreview(null);
        return;
      }

      setStudentForm(prev => ({ ...prev, photo: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;

  if (isError) {
    const apiError = error as AxiosError<{ detail?: string }>;
    const detail = apiError.response?.data?.detail || "Unable to load classroom details";
    return <div className="p-8 text-destructive">{detail}</div>;
  }

  if (!details) return <div className="p-8 text-muted-foreground">Classroom not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate("/admin/classroom-management")}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">{details.classroom.name}</h1>
      </div>

      <Tabs defaultValue="students" className="space-y-4">
        <TabsList>
          <TabsTrigger value="students">Add Students</TabsTrigger>
          <TabsTrigger value="teachers">Assign Teachers</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="space-y-4">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-primary" /> Add New Student
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Student Name *</Label>
                  <Input
                    id="name"
                    value={studentForm.name}
                    onChange={(e) => setStudentForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter student name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="roll">Roll Number</Label>
                  <Input
                    id="roll"
                    value={studentForm.roll_number}
                    onChange={(e) => setStudentForm(prev => ({ ...prev, roll_number: e.target.value }))}
                    placeholder="e.g., A001"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={studentForm.email}
                    onChange={(e) => setStudentForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="student@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={studentForm.phone}
                    onChange={(e) => setStudentForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+1 234 567 8900"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="photo">Photo for Facial Recognition *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="photo"
                      type="file"
                      accept={STUDENT_PHOTO_ACCEPT}
                      onChange={handlePhotoChange}
                      ref={fileInputRef}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1"
                    >
                      {studentForm.photo ? studentForm.photo.name : "Choose Photo"}
                    </Button>
                  </div>
                  {photoPreview && (
                    <img src={photoPreview} alt="Preview" className="h-32 w-32 rounded-lg object-cover" />
                  )}
                  <p className="text-xs text-muted-foreground">JPEG, PNG, GIF, WEBP, BMP, or TIFF only, up to 10 MB.</p>
                </div>

                <Button
                  onClick={() => addStudent.mutate()}
                  disabled={!studentForm.name || !studentForm.photo || addStudent.isPending}
                  className="w-full"
                >
                  <Upload className="mr-2 h-4 w-4" /> Add Student
                </Button>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Students ({details.students.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {details.students.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No students added yet</p>
                ) : (
                  <div className="space-y-2">
                    {details.students.map((student) => (
                      <div key={student.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="min-w-0">
                          <p className="font-medium">{student.name}</p>
                          {student.roll_number && <p className="text-xs text-muted-foreground">Roll: {student.roll_number}</p>}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteStudent.mutate(student.id)}
                          disabled={deleteStudent.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="teachers" className="space-y-4">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="h-5 w-5 text-primary" /> Assign Teacher
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Teacher *</Label>
                  <Select value={teacherId} onValueChange={setTeacherId}>
                    <SelectTrigger><SelectValue placeholder="Choose a teacher or admin" /></SelectTrigger>
                    <SelectContent>
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={String(teacher.id)}>
                          {teacher.name} ({teacher.email}) {teacher.role === "admin" ? "- Admin" : "- Teacher"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Subject *</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., Mathematics"
                    list="subject-suggestions"
                  />
                  <datalist id="subject-suggestions">
                    {subjectSuggestions.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                </div>

                <Button
                  onClick={() => assignTeacher.mutate()}
                  disabled={!teacherId || !subject || assignTeacher.isPending}
                  className="w-full"
                >
                  <LinkIcon className="mr-2 h-4 w-4" /> Assign Teacher
                </Button>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Teachers ({details.teachers.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {details.teachers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No teachers assigned yet</p>
                ) : (
                  <div className="space-y-2">
                    {details.teachers.map((teacher) => (
                      <div key={teacher.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{teacher.teacher_name}</p>
                          <p className="text-xs text-muted-foreground">{teacher.subject}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeTeacher.mutate(teacher.id)}
                          disabled={removeTeacher.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
          <ClassroomAttendancePanel
            title={`Attendance Logs - ${details.classroom.name}`}
            sessionWiseEndpoint={`/attendance/classroom/${cid}/session-wise`}
            studentWiseEndpoint={`/attendance/classroom/${cid}/student-wise`}
            sessionWiseQueryKey="admin-classroom-attendance-session-wise"
            studentWiseQueryKey="admin-classroom-attendance-student-wise"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
