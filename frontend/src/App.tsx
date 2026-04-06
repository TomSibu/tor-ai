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
import Classrooms from "./pages/admin/Classrooms";
import AdminSessions from "./pages/admin/AdminSessions";
import Analytics from "./pages/admin/Analytics";
import TeacherClasses from "./pages/teacher/TeacherClasses";
import TeacherSessions from "./pages/teacher/TeacherSessions";
import ClassroomDashboard from "./pages/classroom/ClassroomDashboard";
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
              <Route path="/admin/classrooms" element={<Classrooms />} />
              <Route path="/admin/sessions" element={<AdminSessions />} />
              <Route path="/admin/analytics" element={<Analytics />} />
            </Route>

            {/* Teacher routes */}
            <Route element={<ProtectedRoute roles={["teacher"]}><DashboardLayout /></ProtectedRoute>}>
              <Route path="/teacher/classes" element={<TeacherClasses />} />
              <Route path="/teacher/sessions" element={<TeacherSessions />} />
            </Route>

            {/* Classroom routes */}
            <Route element={<ProtectedRoute roles={["classroom"]}><DashboardLayout /></ProtectedRoute>}>
              <Route path="/classroom/dashboard" element={<ClassroomDashboard />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
