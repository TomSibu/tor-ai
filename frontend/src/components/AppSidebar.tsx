import {
  LayoutDashboard, Users, School, BookOpen, GraduationCap,
  BarChart3, LogOut, Bot, Monitor
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const adminItems = [
  { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Users", url: "/admin/users", icon: Users },
  { title: "Pending Users", url: "/admin/pending", icon: Users },
  { title: "Classrooms", url: "/admin/classrooms", icon: School },
  { title: "Sessions", url: "/admin/sessions", icon: BookOpen },
  { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
];

const teacherItems = [
  { title: "My Classes", url: "/teacher/classes", icon: GraduationCap },
  { title: "Sessions", url: "/teacher/sessions", icon: BookOpen },
];

const classroomItems = [
  { title: "Dashboard", url: "/classroom/dashboard", icon: Monitor },
];

export function AppSidebar() {
  const { user, logout } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  const items = user?.role === "admin" ? adminItems
    : user?.role === "teacher" ? teacherItems
    : classroomItems;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            <Bot className="mr-2 h-4 w-4 text-primary" />
            {!collapsed && <span className="font-semibold tracking-tight">SmartClass AI</span>}
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
          <div className="mb-2 px-2 text-xs text-sidebar-foreground/60 truncate">
            {user?.name} · {user?.role}
          </div>
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
