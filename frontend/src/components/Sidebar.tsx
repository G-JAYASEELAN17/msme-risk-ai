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
  BrainCircuit,
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

let cachedGlobalBizName = "";

export function clearSidebarCache() {
  cachedGlobalBizName = "";
}

export default function Sidebar({ active, businessName, userName }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [resolvedBizName, setResolvedBizName] = useState<string>(() => businessName || cachedGlobalBizName || "");

  const { isUser, isAnalyst, isAdmin, userProfile } = useAuthRole();

  const currentUser = auth.currentUser;
  const userDisplayName =
    userName ||
    userProfile?.name ||
    currentUser?.displayName ||
    currentUser?.email?.split("@")[0] ||
    (isAdmin ? "System Administrator" : isUser ? "Business Owner" : "Risk Officer");
  const userInitials = userDisplayName.substring(0, 2).toUpperCase();

  // Lazy load business name for MSME user if not provided in props (with module cache)
  useEffect(() => {
    if (businessName) {
      cachedGlobalBizName = businessName;
      setResolvedBizName(businessName);
    } else if (cachedGlobalBizName) {
      if (!resolvedBizName) {
        setResolvedBizName(cachedGlobalBizName);
      }
    } else if (isUser && !resolvedBizName) {
      api.getBusinesses()
        .then((biz) => {
          if (biz && biz.length > 0) {
            cachedGlobalBizName = biz[0].name;
            setResolvedBizName(biz[0].name);
          }
        })
        .catch(() => {});
    }
  }, [businessName, isUser, resolvedBizName]);

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      cachedGlobalBizName = "";
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
      active: active === "New assessment" || active === "Assessments" || active === "Risk results" || location.pathname === "/assessment" || location.pathname === "/prediction",
    },
    {
      label: "Financial Intelligence",
      path: "/financial-intelligence",
      icon: BarChart3,
      active: active === "Financial Intelligence" || location.pathname.startsWith("/financial-intelligence"),
    },
    {
      label: "Explainable AI",
      path: "/explainability",
      icon: BrainCircuit,
      active: active === "Explainable AI" || location.pathname.startsWith("/explainability"),
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
      active: active === "New assessment" || active === "Assessments" || active === "Risk results" || location.pathname === "/assessment" || location.pathname === "/prediction",
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
      label: "Financial Intelligence",
      path: "/analyst/financial-intelligence",
      icon: BarChart3,
      active: active === "Financial Intelligence" || location.pathname.startsWith("/analyst/financial-intelligence"),
    },
    {
      label: "Explainable AI",
      path: "/explainability",
      icon: BrainCircuit,
      active: active === "Explainable AI" || location.pathname.startsWith("/explainability") || location.pathname.startsWith("/analyst/explainability"),
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
      label: "Financial Intelligence",
      path: "/admin/financial-intelligence",
      icon: BarChart3,
      active: location.pathname.startsWith("/admin/financial-intelligence") || active === "Financial Intelligence",
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
      label: "Explainable AI",
      path: "/explainability",
      icon: BrainCircuit,
      active: active === "Explainable AI" || location.pathname.startsWith("/explainability") || location.pathname.startsWith("/analyst/explainability"),
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
    <div className="h-full flex flex-col justify-between p-4 bg-[#0C0A1D] border-r border-[#383154] select-none">
      {/* Top section: Brand & Portal Workspace Badge */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-1">
          <Brand />
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-xl text-[#B7B1D1] hover:text-[#F5F3FF] hover:bg-[#1C1933] border border-transparent hover:border-[#383154]"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Portal-Specific Workspace Badge */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#1C1933] border border-[#383154]">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border bg-[#8B5CF6]/15 text-[#A78BFA] border-[#8B5CF6]/30">
              <ShieldCheck className="w-3.5 h-3.5 text-[#8B5CF6]" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-semibold text-[#F5F3FF] truncate">
                {isAdmin
                  ? "Admin Control"
                  : isAnalyst
                  ? "Analyst Terminal"
                  : "MSME Portal"}
              </span>
              <span className="text-[10px] flex items-center gap-1 font-mono-numeric text-[#A78BFA]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
                {isAdmin
                  ? "System Admin"
                  : isAnalyst
                  ? "Risk Underwriter"
                  : "Active Facility"}
              </span>
            </div>
          </div>

          <div className="shrink-0 pl-1">
            <NotificationPopover />
          </div>
        </div>

        {/* Portal Section Label */}
        <div className="px-2 pt-1 text-[10px] font-semibold text-[#B7B1D1] uppercase tracking-widest font-mono-numeric">
          {isAdmin
            ? "Platform Control"
            : isAnalyst
            ? "Underwriting Operations"
            : "Commercial Operations"}
        </div>

        {/* Navigation list */}
        <nav className="flex flex-col gap-1 overflow-y-auto max-h-[calc(100vh-270px)] pr-0.5" aria-label="Main Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={() => {
                  navigate(item.path);
                  setMobileOpen(false);
                }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 text-left ${
                  item.active
                    ? "bg-[#252141] text-[#F5F3FF] border border-[#8B5CF6]/40 shadow-sm shadow-[#8B5CF6]/15 font-semibold"
                    : "text-[#B7B1D1] hover:text-[#F5F3FF] hover:bg-[#1C1933] border border-transparent hover:border-[#383154]"
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 shrink-0 ${
                    item.active ? "text-[#8B5CF6]" : "text-[#B7B1D1]"
                  }`}
                />
                <span className="flex-1 truncate">{item.label}</span>
                {item.active && <ChevronRight className="w-3 h-3 text-[#A78BFA] shrink-0" />}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom section: User profile & Logout */}
      <div className="pt-3 border-t border-[#383154] flex flex-col gap-2">
        <div
          onClick={() => navigate(isAdmin ? "/admin/settings" : "/settings")}
          className="flex items-center gap-2.5 p-2 rounded-xl bg-[#1C1933] hover:bg-[#252141] cursor-pointer transition-colors border border-[#383154] hover:border-[#8B5CF6]/40"
        >
          <div className="w-7 h-7 rounded-lg text-[#F5F3FF] font-semibold text-[11px] font-mono-numeric flex items-center justify-center shrink-0 border bg-[#8B5CF6]/20 text-[#A78BFA] border-[#8B5CF6]/40">
            {userInitials}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-semibold text-[#F5F3FF] truncate">{userDisplayName}</span>
            <span className="text-[10px] text-[#B7B1D1] font-mono-numeric truncate">
              {isAdmin ? "Super Admin" : isAnalyst ? "Risk Officer" : (resolvedBizName || "MSME Owner")}
            </span>
          </div>
        </div>

        <button
          onClick={() => setShowSignOutConfirm(true)}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#B7B1D1] hover:text-[#F87171] hover:bg-rose-500/10 transition-colors w-full border border-[#383154] hover:border-rose-500/30"
        >
          <LogOut className="w-3 h-3 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Navbar with Hamburger */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[#0C0A1D]/95 backdrop-blur-md border-b border-[#383154]">
        <Brand />
        <div className="flex items-center gap-2">
          <NotificationPopover />
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl bg-[#1C1933] text-[#F5F3FF] hover:text-white border border-[#383154] focus:outline-none"
            aria-label="Open mobile navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-[268px] min-w-[268px] h-screen sticky top-0 shrink-0 z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-out Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-[#0C0A1D]/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-[275px] max-w-[80vw] h-full bg-[#0C0A1D] z-10 shadow-2xl animate-in slide-in-from-left duration-200">
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
