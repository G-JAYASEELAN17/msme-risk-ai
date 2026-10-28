import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../services/firebase";
import { useAuthRole } from "../../context/AuthRoleContext";
import {
  Bell,
  HelpCircle,
  ChevronDown,
  ShieldCheck,
  Settings as SettingsIcon,
  KeyRound,
  LogOut,
  X,
  ExternalLink,
  LifeBuoy,
  FileCode2,
} from "lucide-react";
import { useToast } from "../../components/ui/Toast";
import ConfirmationDialog from "../../components/ui/ConfirmationDialog";

interface AdminHeaderProps {
  title?: string;
  subtitle?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

export default function AdminHeader({
  title = "Admin Control Center",
  subtitle = "Platform overview, risk intelligence, users and system health.",
  breadcrumbs,
}: AdminHeaderProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const { userProfile, user } = useAuthRole();

  const [profileOpen, setProfileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  const adminName = userProfile?.name || user?.displayName || "System Administrator";
  const adminEmail = user?.email || userProfile?.email || "admin@msmerisk.ai";
  const initials = adminName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "AD";

  const handlePasswordReset = async () => {
    if (!adminEmail) return;
    try {
      setResettingPassword(true);
      await sendPasswordResetEmail(auth, adminEmail);
      toast.success(
        "Password Reset Sent",
        `Instructions sent to ${adminEmail}. Check your inbox.`
      );
      setProfileOpen(false);
    } catch (err: any) {
      toast.error("Reset Failed", err?.message || "Failed to send reset email.");
    } finally {
      setResettingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await signOut(auth);
      toast.info("Signed Out", "Administrator session securely terminated.");
      navigate("/login/admin");
    } catch (err: any) {
      toast.error("Logout Failed", err?.message || "Failed to terminate session.");
    } finally {
      setLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 bg-[#0C0A1D]/95 backdrop-blur-md border-b border-[#383154] px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      {/* Left: Titles & Breadcrumbs */}
      <div className="flex flex-col">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-xs text-[#B7B1D1] mb-1">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.label}>
                {idx > 0 && <span className="text-[#383154]">/</span>}
                {crumb.href ? (
                  <button
                    onClick={() => navigate(crumb.href!)}
                    className="hover:text-[#A78BFA] transition-colors"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className="text-[#F5F3FF] font-medium">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F5F3FF] font-display">
            {title}
          </h1>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live System
          </span>
        </div>
        {subtitle && (
          <p className="text-xs sm:text-sm text-[#B7B1D1] mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Right: Quick Actions, Help, Notifications, Admin Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3 self-end md:self-center">
        {/* Notifications Shortcut */}
        <button
          onClick={() => navigate("/admin/notifications")}
          title="Platform Alerts"
          className="relative p-2 rounded-xl bg-[#1C1933] border border-[#383154] text-[#B7B1D1] hover:text-[#F5F3FF] hover:border-[#8B5CF6]/50 hover:bg-[#252141] transition-all"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#8B5CF6] shadow-sm shadow-[#8B5CF6]/50" />
        </button>

        {/* Help Modal Button */}
        <button
          onClick={() => setHelpOpen(true)}
          title="Admin Documentation & Support"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#1C1933] border border-[#383154] text-xs font-medium text-[#B7B1D1] hover:text-[#F5F3FF] hover:border-[#8B5CF6]/50 hover:bg-[#252141] transition-all"
        >
          <HelpCircle className="w-4 h-4 text-[#A78BFA]" />
          <span className="hidden sm:inline">Help</span>
        </button>

        {/* Admin Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-[#1C1933] border border-[#383154] hover:border-[#8B5CF6]/50 transition-all text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#7C3AED] to-[#8B5CF6] flex items-center justify-center text-white text-xs font-bold shadow">
              {initials}
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-xs font-semibold text-[#F5F3FF] max-w-[120px] truncate">
                {adminName}
              </span>
              <span className="text-[10px] text-[#A78BFA] font-medium">Administrator</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#B7B1D1]" />
          </button>

          {profileOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setProfileOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-[#1C1933] border border-[#383154] shadow-2xl z-40 p-3 animate-in fade-in zoom-in-95 duration-150">
                {/* User Info Header */}
                <div className="p-2.5 rounded-xl bg-[#151229] border border-[#383154] mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 flex items-center justify-center text-[#A78BFA] font-bold text-sm">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-[#F5F3FF] truncate">
                        {adminName}
                      </div>
                      <div className="text-[11px] text-[#B7B1D1] truncate font-mono-numeric">
                        {adminEmail}
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-[#A78BFA]">
                        <ShieldCheck className="w-3 h-3" />
                        Role: Administrator
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-[#383154] flex items-center justify-between text-[11px] text-[#B7B1D1]">
                    <span>Account Status:</span>
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Active Privileged
                    </span>
                  </div>
                </div>

                {/* Dropdown Navigation Actions */}
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      navigate("/admin/settings");
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#B7B1D1] hover:text-[#F5F3FF] hover:bg-[#252141] transition"
                  >
                    <SettingsIcon className="w-4 h-4 text-[#A78BFA]" />
                    <span>System Settings</span>
                  </button>

                  <button
                    onClick={handlePasswordReset}
                    disabled={resettingPassword}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#B7B1D1] hover:text-[#F5F3FF] hover:bg-[#252141] transition disabled:opacity-50"
                  >
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    <span>{resettingPassword ? "Sending..." : "Reset Password via Email"}</span>
                  </button>

                  <div className="my-1 border-t border-[#383154]" />

                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      setShowLogoutConfirm(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition"
                  >
                    <LogOut className="w-4 h-4 text-rose-400" />
                    <span>Terminate Session / Logout</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Help Modal */}
      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg bg-[#1C1933] border border-[#383154] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#383154]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#8B5CF6]/15 text-[#A78BFA] border border-[#8B5CF6]/30 flex items-center justify-center">
                  <LifeBuoy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#F5F3FF] font-display">
                    Administrator Operations Help
                  </h3>
                  <p className="text-xs text-[#B7B1D1]">
                    Governance guide and privileged support
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHelpOpen(false)}
                className="p-1 rounded-lg text-[#B7B1D1] hover:text-[#F5F3FF] hover:bg-[#252141]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs text-[#F5F3FF]">
              <div className="p-3 rounded-xl bg-[#151229] border border-[#383154]">
                <h4 className="font-semibold text-[#A78BFA] mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Role-Based Authorization Architecture
                </h4>
                <p className="text-[#B7B1D1] leading-relaxed">
                  Administrators have full visibility across MSME business records, assessments, analyst workloads, and platform telemetry. All mutations (such as user role changes) are strictly validated on the backend and recorded in immutable audit logs.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#151229] border border-[#383154]">
                <h4 className="font-semibold text-[#A78BFA] mb-1 flex items-center gap-1.5">
                  <FileCode2 className="w-3.5 h-3.5" />
                  Audit Trail & Compliance
                </h4>
                <p className="text-[#B7B1D1] leading-relaxed">
                  Every privileged action emits a structured audit record with actor UID, timestamp, and metadata. Audit logs cannot be modified or deleted through the interface.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#151229] border border-[#383154]">
                <h4 className="font-semibold text-emerald-300 mb-1 flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Technical Escalation & Support
                </h4>
                <p className="text-[#B7B1D1] leading-relaxed">
                  For infrastructure health incidents or database anomalies, consult the platform health probes on the Overview page or review the server application logs.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#383154] flex justify-end">
              <button
                onClick={() => setHelpOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold text-xs transition"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation */}
      <ConfirmationDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Terminate Administrator Session"
        message="Are you sure you want to log out of the Admin Control Center? Privileged session tokens will be revoked."
        confirmText="Log Out"
        variant="danger"
        loading={loggingOut}
      />
    </header>
  );
}
