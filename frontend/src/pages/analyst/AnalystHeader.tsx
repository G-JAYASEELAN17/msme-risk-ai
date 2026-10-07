import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../services/firebase";
import { useAuthRole } from "../../context/AuthRoleContext";
import {
  Bell,
  HelpCircle,
  ChevronDown,
  ClipboardCheck,
  Settings as SettingsIcon,
  KeyRound,
  LogOut,
  X,
  LifeBuoy,
  FileCheck,
  ShieldCheck,
} from "lucide-react";
import { useToast } from "../../components/ui/Toast";
import ConfirmationDialog from "../../components/ui/ConfirmationDialog";

interface AnalystHeaderProps {
  title?: string;
  subtitle?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

export default function AnalystHeader({
  title = "Analyst Dashboard",
  subtitle = "Review MSME applications and make evidence-based credit risk decisions.",
  breadcrumbs,
}: AnalystHeaderProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const { userProfile, user } = useAuthRole();

  const [profileOpen, setProfileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  const analystName = userProfile?.name || user?.displayName || "Credit Risk Analyst";
  const analystEmail = user?.email || userProfile?.email || "analyst@msmerisk.ai";
  const initials = analystName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "AN";

  const handlePasswordReset = async () => {
    if (!analystEmail) return;
    try {
      setResettingPassword(true);
      await sendPasswordResetEmail(auth, analystEmail);
      toast.success(
        "Password Reset Sent",
        `Instructions sent to ${analystEmail}. Please check your inbox.`
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
      toast.info("Signed Out", "Analyst underwriting session securely closed.");
      navigate("/login/analyst");
    } catch (err: any) {
      toast.error("Logout Failed", err?.message || "Failed to sign out.");
    } finally {
      setLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 bg-[#081120]/95 backdrop-blur-md border-b border-[#1a2d4b] px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      {/* Left: Titles & Breadcrumbs */}
      <div className="flex flex-col">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.label}>
                {idx > 0 && <span className="text-slate-600">/</span>}
                {crumb.href ? (
                  <button
                    onClick={() => navigate(crumb.href!)}
                    className="hover:text-cyan-400 transition-colors"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className="text-slate-200 font-medium">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            {title}
          </h1>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Underwriting Active
          </span>
        </div>
        {subtitle && (
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Right: Notifications, Help, Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3 self-end md:self-center">
        {/* Notifications Shortcut */}
        <button
          onClick={() => navigate("/settings?tab=alerts")}
          title="Underwriting Alerts"
          className="relative p-2 rounded-xl bg-[#0d1c33] border border-[#1e3458] text-slate-300 hover:text-white hover:border-cyan-500/50 hover:bg-[#132747] transition-all"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50" />
        </button>

        {/* Help Modal Button */}
        <button
          onClick={() => setHelpOpen(true)}
          title="Underwriting Guidelines & Help"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#0d1c33] border border-[#1e3458] text-xs font-medium text-slate-300 hover:text-white hover:border-cyan-500/50 hover:bg-[#132747] transition-all"
        >
          <HelpCircle className="w-4 h-4 text-cyan-400" />
          <span className="hidden sm:inline">Help</span>
        </button>

        {/* Analyst Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-[#0d1c33] border border-[#1e3458] hover:border-indigo-500/50 transition-all text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-cyan-600 flex items-center justify-center text-white text-xs font-bold shadow">
              {initials}
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-xs font-semibold text-slate-100 max-w-[120px] truncate">
                {analystName}
              </span>
              <span className="text-[10px] text-indigo-400 font-medium">Credit Analyst</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {profileOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setProfileOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-[#0c182b] border border-[#1e3458] shadow-2xl z-40 p-3 animate-in fade-in zoom-in-95 duration-150">
                {/* User Info Header */}
                <div className="p-2.5 rounded-xl bg-[#12233c] border border-[#1d3559] mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-sm">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate">
                        {analystName}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {analystEmail}
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-indigo-400">
                        <ClipboardCheck className="w-3 h-3" />
                        Role: Credit Risk Analyst
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-[#1d3559] flex items-center justify-between text-[11px] text-slate-400">
                    <span>Account Status:</span>
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Active Underwriter
                    </span>
                  </div>
                </div>

                {/* Dropdown Navigation Actions */}
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      navigate("/settings");
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition"
                  >
                    <SettingsIcon className="w-4 h-4 text-cyan-400" />
                    <span>Account Settings</span>
                  </button>

                  <button
                    onClick={handlePasswordReset}
                    disabled={resettingPassword}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition disabled:opacity-50"
                  >
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    <span>{resettingPassword ? "Sending..." : "Reset Password via Email"}</span>
                  </button>

                  <div className="my-1 border-t border-slate-800" />

                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      setShowLogoutConfirm(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition"
                  >
                    <LogOut className="w-4 h-4 text-rose-400" />
                    <span>Sign Out</span>
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
          <div className="relative w-full max-w-lg bg-[#081120] border border-[#1e3458] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#1a2d4b]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                  <LifeBuoy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Credit Underwriting Protocol & SLA
                  </h3>
                  <p className="text-xs text-slate-400">
                    Standard operating procedures for human credit decisions
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHelpOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs text-slate-300">
              <div className="p-3 rounded-xl bg-[#0d1c33] border border-[#1a2d4b]">
                <h4 className="font-semibold text-cyan-300 mb-1 flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5" />
                  Human-in-the-Loop Requirement
                </h4>
                <p className="text-slate-400 leading-relaxed">
                  AI predictions and SHAP factor weights are strictly advisory decision-support signals. All credit approvals, conditional offers, and rejections are legally rendered by you, the human underwriter.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#0d1c33] border border-[#1a2d4b]">
                <h4 className="font-semibold text-indigo-300 mb-1 flex items-center gap-1.5">
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  Verification & Evidence Checking
                </h4>
                <p className="text-slate-400 leading-relaxed">
                  Always inspect bank statements, GST returns, and utility receipts. Verify that extracted values match declared financial figures before confirming approvals.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#0d1c33] border border-[#1a2d4b]">
                <h4 className="font-semibold text-amber-300 mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Turnaround SLA
                </h4>
                <p className="text-slate-400 leading-relaxed">
                  High-priority queue applications require initial assessment review within 24 hours. If supporting evidence is incomplete, use the &quot;Request More Information&quot; action.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#1a2d4b] flex justify-end">
              <button
                onClick={() => setHelpOpen(false)}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs transition"
              >
                Understood
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
        title="Sign Out of Analyst Workspace"
        message="Are you sure you want to end your credit review session? Any unsaved review notes will be cleared."
        confirmText="Sign Out"
        variant="danger"
        loading={loggingOut}
      />
    </header>
  );
}
