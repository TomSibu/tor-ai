import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/Users";
import PendingUsers from "./pages/admin/PendingUsers";
import ClassroomManagement from "./pages/admin/ClassroomManagement";
import ClassroomDetail from "./pages/admin/ClassroomDetail";
import AdminSessions from "@/pages/admin/AdminSessions";
import AdminClassroomSessions from "./pages/admin/AdminClassroomSessions";
import Analytics from "./pages/admin/Analytics";
import TeacherClasses from "./pages/teacher/TeacherClasses";
import TeacherClassroomManagement from "./pages/teacher/TeacherClassroomManagement";
import TeacherClassroomAttendance from "./pages/teacher/TeacherClassroomAttendance";
import TeacherSessions from "@/pages/teacher/TeacherSessions";
import TeacherClassroomSessions from "./pages/teacher/TeacherClassroomSessions";
import ClassroomDashboard from "./pages/classroom/ClassroomDashboard";
import ClassroomSessions from "./pages/classroom/ClassroomSessions";
import ClassroomAttendance from "./pages/classroom/ClassroomAttendance";
import ClassroomTeachingDashboard from "./pages/classroom/ClassroomTeachingDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Admin routes */}
            <Route element={<ProtectedRoute roles={["admin"]}><DashboardLayout /></ProtectedRoute>}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/pending" element={<PendingUsers />} />
              <Route path="/admin/classroom-management" element={<ClassroomManagement />} />
              <Route path="/admin/classroom/:classroomId" element={<ClassroomDetail />} />
              <Route path="/admin/sessions" element={<AdminSessions />} />
              <Route path="/admin/sessions/classroom/:classroomId" element={<AdminClassroomSessions />} />
              <Route path="/admin/analytics" element={<Analytics />} />
            </Route>

            {/* Teacher routes */}
            <Route element={<ProtectedRoute roles={["teacher"]}><DashboardLayout /></ProtectedRoute>}>
              <Route path="/teacher/classes" element={<TeacherClasses />} />
              <Route path="/teacher/classroom-management" element={<TeacherClassroomManagement />} />
              <Route path="/teacher/classroom/:classroomId/attendance" element={<TeacherClassroomAttendance />} />
              <Route path="/teacher/sessions" element={<TeacherSessions />} />
              <Route path="/teacher/sessions/classroom/:classroomId" element={<TeacherClassroomSessions />} />
            </Route>

            {/* Classroom routes */}
            <Route element={<ProtectedRoute roles={["classroom"]}><DashboardLayout /></ProtectedRoute>}>
              <Route path="/classroom/dashboard" element={<ClassroomDashboard />} />
              <Route path="/classroom/sessions" element={<ClassroomSessions />} />
              <Route path="/classroom/attendance" element={<ClassroomAttendance />} />
                          <Route path="/classroom/teaching/:sessionId" element={<ClassroomTeachingDashboard />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
