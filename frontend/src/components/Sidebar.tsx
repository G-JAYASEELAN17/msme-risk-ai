import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../services/firebase";
import { api } from "../services/api";
import {
  LayoutDashboard,
  PlusCircle,
  FileSpreadsheet,
  LogOut,
  X,
  Menu,
  ChevronRight,
  Building2,
  FileText,
  Settings as SettingsIcon,
  ClipboardCheck,
  ClipboardList,
  History,
  Activity,
  Sliders,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Users,
  Briefcase,
  BarChart3,
  Bot,
  Brain,
  Bell,
} from "lucide-react";
import Brand from "./Brand";
import ConfirmationDialog from "./ui/ConfirmationDialog";
import NotificationPopover from "./NotificationPopover";
import { useAuthRole } from "../context/AuthRoleContext";

interface SidebarProps {
  active?: string;
  businessName?: string;
  userName?: string;
}

export default function Sidebar({ active, businessName, userName }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [resolvedBizName, setResolvedBizName] = useState<string>(businessName || "");

  const { isUser, isAnalyst, isAdmin, userProfile } = useAuthRole();

  const currentUser = auth.currentUser;
  const userDisplayName =
    userName ||
    userProfile?.name ||
    currentUser?.displayName ||
    currentUser?.email?.split("@")[0] ||
    (isAdmin ? "System Administrator" : isUser ? "Business Owner" : "Risk Officer");
  const userInitials = userDisplayName.substring(0, 2).toUpperCase();

  // Lazy load business name for MSME user if not provided in props
  useEffect(() => {
    if (businessName) {
      setResolvedBizName(businessName);
    } else if (isUser && !resolvedBizName) {
      api.getBusinesses()
        .then((biz) => {
          if (biz && biz.length > 0) {
            setResolvedBizName(biz[0].name);
          }
        })
        .catch(() => {});
    }
  }, [businessName, isUser, resolvedBizName]);

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Sign out failed:", error);
    } finally {
      setSigningOut(false);
      setShowSignOutConfirm(false);
    }
  };

  // 1. Navigation for MSME User / Business Owner Portal
  const userNavItems = [
    {
      label: "Dashboard",
      path: "/dashboard",
      icon: LayoutDashboard,
      active: active === "Overview" || active === "Dashboard" || location.pathname === "/dashboard",
    },
    {
      label: "My Business",
      path: "/businesses",
      icon: Building2,
      active: active === "Businesses" || active === "My Business" || location.pathname.startsWith("/businesses"),
    },
    {
      label: "Assessments",
      path: "/assessment",
      icon: PlusCircle,
      active: active === "New assessment" || active === "Assessments" || location.pathname === "/assessment",
    },
    {
      label: "Documents",
      path: "/documents",
      icon: FileText,
      active: active === "Documents" || location.pathname.startsWith("/documents"),
    },
    {
      label: "Reports",
      path: "/reports",
      icon: FileSpreadsheet,
      active: active === "Reports" || location.pathname.startsWith("/reports"),
    },
    {
      label: "Notifications",
      path: "/settings?tab=alerts",
      icon: Bell,
      active: active === "Notifications" || location.search.includes("tab=alerts"),
    },
    {
      label: "Settings",
      path: "/settings",
      icon: SettingsIcon,
      active: active === "Settings" || (location.pathname.startsWith("/settings") && !location.search.includes("tab=alerts")),
    },
  ];

  // 2. Navigation for Analyst / Institutional Underwriting Portal
  const analystNavItems = [
    {
      label: "Analyst Dashboard",
      path: "/analyst",
      icon: LayoutDashboard,
      active:
        (active === "Analyst" || location.pathname === "/analyst") &&
        !location.search.includes("tab=queue"),
    },
    {
      label: "Review Queue",
      path: "/analyst/reviews",
      icon: ClipboardCheck,
      active:
        active === "Review Queue" ||
        location.pathname === "/analyst/reviews" ||
        (location.pathname === "/analyst" && location.search.includes("tab=queue")),
    },
    {
      label: "Assessments",
      path: "/assessment",
      icon: PlusCircle,
      active: active === "New assessment" || active === "Assessments" || location.pathname === "/assessment",
    },
    {
      label: "Documents",
      path: "/documents",
      icon: FileText,
      active: active === "Documents" || location.pathname.startsWith("/documents"),
    },
    {
      label: "Risk Intelligence",
      path: "/prediction",
      icon: Activity,
      active:
        (active === "Risk results" || active === "Risk Intelligence" || location.pathname === "/prediction") &&
        !location.search.includes("simulator=open"),
    },
    {
      label: "Prediction History",
      path: "/prediction-history",
      icon: History,
      active: active === "Prediction history" || location.pathname.startsWith("/prediction-history"),
    },
    {
      label: "What-If Analysis",
      path: "/prediction?simulator=open",
      icon: Sliders,
      active: active === "What-If Analysis" || location.search.includes("simulator=open"),
    },
    {
      label: "Notifications",
      path: "/settings?tab=alerts",
      icon: Bell,
      active: active === "Notifications" || location.search.includes("tab=alerts"),
    },
    {
      label: "Settings",
      path: "/settings",
      icon: SettingsIcon,
      active: active === "Settings" || (location.pathname.startsWith("/settings") && !location.search.includes("tab=alerts")),
    },
  ];

  // 3. Navigation for Admin / Enterprise Control Center
  const adminNavItems = [
    {
      label: "Overview",
      path: "/admin",
      icon: LayoutDashboard,
      active: location.pathname === "/admin" || active === "Overview",
    },
    {
      label: "Users",
      path: "/admin/users",
      icon: Users,
      active: location.pathname.startsWith("/admin/users") || active === "Users",
    },
    {
      label: "MSME Businesses",
      path: "/admin/businesses",
      icon: Building2,
      active: location.pathname.startsWith("/admin/businesses") || active === "MSME Businesses" || active === "Businesses",
    },
    {
      label: "Assessments",
      path: "/admin/assessments",
      icon: ClipboardList,
      active: location.pathname.startsWith("/admin/assessments") || active === "Assessments",
    },
    {
      label: "Analysts",
      path: "/admin/analysts",
      icon: Briefcase,
      active: location.pathname.startsWith("/admin/analysts") || active === "Analysts",
    },
    {
      label: "Risk Intelligence",
      path: "/admin/risk-intelligence",
      icon: BarChart3,
      active: location.pathname.startsWith("/admin/risk-intelligence") || active === "Risk Intelligence",
    },
    {
      label: "Model Monitoring",
      path: "/admin/model-monitoring",
      icon: Bot,
      active: location.pathname.startsWith("/admin/model-monitoring") || active === "Model monitoring",
    },
    {
      label: "Model Card",
      path: "/admin/model-card",
      icon: Brain,
      active: location.pathname.startsWith("/admin/model-card") || active === "Model card",
    },
    {
      label: "Documents",
      path: "/admin/documents",
      icon: FileText,
      active: location.pathname.startsWith("/admin/documents") || active === "Documents",
    },
    {
      label: "Notifications",
      path: "/admin/notifications",
      icon: Bell,
      active: location.pathname.startsWith("/admin/notifications") || active === "Notifications",
    },
    {
      label: "Audit Logs",
      path: "/admin/audit-logs",
      icon: Shield,
      active: location.pathname.startsWith("/admin/audit-logs") || active === "Audit Logs",
    },
    {
      label: "System Settings",
      path: "/admin/settings",
      icon: SettingsIcon,
      active: location.pathname.startsWith("/admin/settings") || active === "System Settings" || active === "Settings",
    },
  ];

  // Pick navigation items strictly based on role: Admin first, then Analyst, else MSME User
  const navItems = isAdmin ? adminNavItems : isAnalyst ? analystNavItems : userNavItems;

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between p-4 sm:p-5 bg-[#081120] border-r border-[#1a2d4b]">
      {/* Top section: Brand & Portal Workspace Badge */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Brand />
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Portal-Specific Workspace Badge */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0d1c33] border border-[#1d3559]">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                isAdmin
                  ? "bg-purple-600/20 text-purple-400 border-purple-500/30"
                  : isAnalyst
                  ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/30"
                  : "bg-cyan-600/20 text-cyan-400 border-cyan-500/30"
              }`}
            >
              {isAdmin ? (
                <ShieldCheck className="w-4 h-4" />
              ) : isAnalyst ? (
                <ClipboardCheck className="w-4 h-4" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-semibold text-slate-100 truncate">
                {isAdmin
                  ? "Admin Control Center"
                  : isAnalyst
                  ? "Analyst Portal"
                  : "MSME Risk AI"}
              </span>
              <span
                className={`text-[10px] flex items-center gap-1 font-medium ${
                  isAdmin
                    ? "text-purple-400"
                    : isAnalyst
                    ? "text-indigo-400"
                    : "text-cyan-400"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isAdmin
                      ? "bg-purple-400"
                      : isAnalyst
                      ? "bg-indigo-400"
                      : "bg-cyan-400"
                  }`}
                />
                {isAdmin
                  ? "System Administration"
                  : isAnalyst
                  ? "Credit Risk Analyst"
                  : "AI-Assisted Credit Risk"}
              </span>
            </div>
          </div>

          <div className="shrink-0 pl-1">
            <NotificationPopover />
          </div>
        </div>

        {/* Portal Section Label */}
        <div className="px-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          {isAdmin
            ? "Admin Control Center"
            : isAnalyst
            ? "Risk Underwriting Navigation"
            : "Business Navigation"}
        </div>

        {/* Navigation list */}
        <nav className="flex flex-col gap-1.5" aria-label="Main Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={() => {
                  navigate(item.path);
                  setMobileOpen(false);
                }}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 text-left ${
                  item.active
                    ? "bg-gradient-to-r from-blue-600/20 to-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/10 font-semibold"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    item.active ? "text-cyan-400" : "text-slate-400"
                  }`}
                />
                <span className="flex-1 truncate">{item.label}</span>
                {item.active && <ChevronRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom section: User profile & Logout */}
      <div className="pt-4 border-t border-[#172740] flex flex-col gap-3">
        <div
          onClick={() => navigate("/settings")}
          className="flex items-center gap-3 p-2.5 rounded-xl bg-[#0c182a]/70 hover:bg-[#12233c] cursor-pointer transition-colors border border-[#182a44]"
        >
          <div
            className={`w-10 h-10 rounded-full text-white font-semibold text-xs flex items-center justify-center shrink-0 shadow-md ${
              isAdmin
                ? "bg-gradient-to-tr from-purple-600 to-indigo-600"
                : isAnalyst
                ? "bg-gradient-to-tr from-indigo-600 to-cyan-600"
                : "bg-gradient-to-tr from-cyan-600 to-blue-600"
            }`}
          >
            {userInitials}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-semibold text-white truncate">{userDisplayName}</span>
            <span className="text-[11px] text-cyan-400 font-medium truncate">
              {isAdmin ? "Super Admin" : isAnalyst ? "Credit Risk Analyst" : "Business Owner"}
            </span>
            {isUser && (
              <span className="text-[10px] text-slate-400 truncate mt-0.5">
                {resolvedBizName || "My Business"}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setShowSignOutConfirm(true)}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors w-full border border-slate-800/80 hover:border-rose-500/30"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Navbar with Hamburger */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[#081120]/95 backdrop-blur-md border-b border-[#1a2d4b]">
        <Brand />
        <div className="flex items-center gap-2">
          <NotificationPopover />
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg bg-slate-800/80 text-slate-200 hover:text-white border border-slate-700 focus:outline-none"
            aria-label="Open mobile navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-64 h-screen sticky top-0 shrink-0 z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-out Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[80vw] h-full bg-[#081120] z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Sign Out Confirmation Modal */}
      <ConfirmationDialog
        isOpen={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        onConfirm={handleSignOut}
        title="Sign Out"
        message="Are you sure you want to sign out of your risk assessment workspace?"
        confirmText="Sign out"
        variant="danger"
        loading={signingOut}
      />
    </>
  );
}
