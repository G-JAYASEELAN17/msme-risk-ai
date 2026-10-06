import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../services/firebase";
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
} from "lucide-react";
import Brand from "./Brand";
import ConfirmationDialog from "./ui/ConfirmationDialog";
import NotificationPopover from "./NotificationPopover";

interface SidebarProps {
  active?: "Overview" | "New assessment" | "Reports" | "Risk results" | "Businesses" | "Documents" | "Settings" | "Analyst";
}

export default function Sidebar({ active }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const currentUser = auth.currentUser;
  const userDisplayName = currentUser?.displayName || currentUser?.email?.split("@")[0] || "Risk Officer";
  const userInitials = (userDisplayName.substring(0, 2)).toUpperCase();

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

  const navItems = [
    {
      label: "Dashboard",
      path: "/dashboard",
      icon: LayoutDashboard,
      active: active === "Overview" || location.pathname === "/dashboard",
    },
    {
      label: "New Assessment",
      path: "/assessment",
      icon: PlusCircle,
      active: active === "New assessment" || location.pathname === "/assessment",
    },
    {
      label: "Analyst Queue",
      path: "/analyst",
      icon: ClipboardCheck,
      active: active === "Analyst" || location.pathname.startsWith("/analyst"),
    },
    {
      label: "Businesses",
      path: "/businesses",
      icon: Building2,
      active: active === "Businesses" || location.pathname.startsWith("/businesses"),
    },
    {
      label: "Documents OCR",
      path: "/documents",
      icon: FileText,
      active: active === "Documents" || location.pathname.startsWith("/documents"),
    },
    {
      label: "Reports & History",
      path: "/reports",
      icon: FileSpreadsheet,
      active: active === "Reports" || location.pathname.startsWith("/reports"),
    },
    {
      label: "Settings & Security",
      path: "/settings",
      icon: SettingsIcon,
      active: active === "Settings" || location.pathname.startsWith("/settings"),
    },
  ];

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between p-4 sm:p-5 bg-[#081120] border-r border-[#1a2d4b]">
      {/* Top section: Brand & Workspace */}
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

        {/* Organization / Workspace Badge + Notification Center */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0d1c33] border border-[#1d3559]">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-semibold text-slate-100 truncate">MSME Lending Hub</span>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Live Workspace
              </span>
            </div>
          </div>
          
          <div className="shrink-0 pl-1">
            <NotificationPopover />
          </div>
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
                <Icon className={`w-4 h-4 shrink-0 ${item.active ? "text-cyan-400" : "text-slate-400"}`} />
                <span className="flex-1">{item.label}</span>
                {item.active && <ChevronRight className="w-3.5 h-3.5 text-cyan-400" />}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom section: User profile & Logout */}
      <div className="pt-4 border-t border-[#172740] flex flex-col gap-3">
        <div 
          onClick={() => navigate("/settings")}
          className="flex items-center gap-3 p-2 rounded-xl bg-[#0c182a]/60 hover:bg-[#12233c] cursor-pointer transition-colors border border-[#182a44]"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 text-white font-semibold text-xs flex items-center justify-center shrink-0 shadow-md">
            {userInitials}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-semibold text-white truncate">{userDisplayName}</span>
            <span className="text-[11px] text-slate-400 truncate">{currentUser?.email || "Underwriter"}</span>
          </div>
        </div>

        <button
          onClick={() => setShowSignOutConfirm(true)}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors w-full"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Sign out</span>
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
