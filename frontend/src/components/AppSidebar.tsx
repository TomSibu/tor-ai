import {
  LayoutDashboard, Users, BookOpen, GraduationCap,
  BarChart3, LogOut, Bot, Monitor, Layers, UserCircle2
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const adminItems = [
  { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Users", url: "/admin/users", icon: Users },
  { title: "Pending Users", url: "/admin/pending", icon: Users },
  { title: "Manage Classrooms", url: "/admin/classroom-management", icon: Layers },
  { title: "Sessions", url: "/admin/sessions", icon: BookOpen },
  { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
];

const teacherItems = [
  { title: "My Classes", url: "/teacher/classes", icon: GraduationCap },
  { title: "Attendance Logs", url: "/teacher/classroom-management", icon: Layers },
  { title: "Sessions", url: "/teacher/sessions", icon: BookOpen },
];

const classroomItems = [
  { title: "Dashboard", url: "/classroom/dashboard", icon: Monitor },
  { title: "Sessions", url: "/classroom/sessions", icon: BookOpen },
  { title: "Attendance", url: "/classroom/attendance", icon: BarChart3 },
];

export function AppSidebar() {
  const { user, logout } = useAuth();
  const { state } = useSidebar();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";

  const items = user?.role === "admin" ? adminItems
    : user?.role === "teacher" ? teacherItems
    : classroomItems;

  const profileUrl = user?.role === "admin"
    ? "/admin/profile"
    : user?.role === "teacher"
      ? "/teacher/profile"
      : "/classroom/profile";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            <Bot className="mr-2 h-4 w-4 text-primary" />
            {!collapsed && <span className="font-semibold tracking-tight">TUTOR AI</span>}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent/50 transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        {!collapsed && (
          <button
            type="button"
            onClick={() => navigate(profileUrl)}
            className="mb-2 w-full rounded-md px-2 py-2 text-left hover:bg-sidebar-accent/40"
          >
            <div className="flex items-center gap-2">
              <UserCircle2 className="h-4 w-4 text-sidebar-foreground/80" />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-sidebar-foreground">{user?.name || "User"}</div>
                <div className="text-xs text-sidebar-foreground/60">{user?.role || "-"}</div>
              </div>
            </div>
          </button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="w-full justify-start text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && "Logout"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
