import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  sendEmailVerification,
  signOut,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  Mail,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  LogOut,
  ShieldCheck,
  Send,
  XCircle,
  HelpCircle,
  Lock,
  KeyRound,
} from "lucide-react";
import { auth } from "../services/firebase";
import { api, UserProfile } from "../services/api";
import Brand from "../components/Brand";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";
import { useAuthRole, clearAuthProfileCache } from "../context/AuthRoleContext";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { refreshProfile } = useAuthRole();

  const [currentUser, setCurrentUser] = useState(() => auth.currentUser);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // In case user landed here without active session, allow quick inline login
  const initialEmail = (location.state as any)?.email || currentUser?.email || "";
  const initialNotice = (location.state as any)?.message || null;
  const [loginEmail, setLoginEmail] = useState(initialEmail);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Cooldown countdown effect
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const loadStatus = useCallback(async () => {
    const user = auth.currentUser;
    setCurrentUser(user);
    if (!user) return;

    try {
      setLoading(true);
      await user.reload();
      const p = await api.getUserProfile(true);
      setProfile(p);
    } catch (err: any) {
      console.warn("Could not retrieve profile status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleInlineLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      toast.error("Credentials Required", "Please enter both email and password.");
      return;
    }
    try {
      setLoginLoading(true);
      const cred = await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      setCurrentUser(cred.user);
      toast.success("Authenticated", "Session restored. You can now verify or resend email.");
      await loadStatus();
    } catch (err: any) {
      toast.error("Sign In Failed", err?.message || "Invalid credentials.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleResendVerification = async () => {
    const user = auth.currentUser;
    if (!user) {
      toast.error("Session Required", "Please sign in to resend the verification email.");
      return;
    }

    // Check whether the email is already verified
    if (user.emailVerified || profile?.email_verified) {
      toast.info("Already Verified", "Your email is already verified. Click Continue to proceed.");
      setStatusMessage("Your email is already verified. Click Continue to proceed.");
      return;
    }

    try {
      setResending(true);
      await sendEmailVerification(user);
      setCooldown(60);
      toast.success("Verification Sent", "Verification email sent. Check your inbox and spam folder.");
      setStatusMessage("Verification email sent. Check your inbox and spam folder.");
    } catch (err: any) {
      console.error("Resend verification error:", err);
      if (err.code === "auth/too-many-requests") {
        toast.error("Rate Limit Exceeded", "We couldn't send the verification email. Please try again shortly.");
        setStatusMessage("We couldn't send the verification email. Please try again shortly.");
        setCooldown(60);
      } else if (err.code === "auth/network-request-failed") {
        toast.error("Network Error", "Network connection failure. Please check your internet connection.");
        setStatusMessage("Network connection failure. Please check your internet connection.");
      } else {
        toast.error("Failed to Send", "We couldn't send the verification email. Please try again shortly.");
        setStatusMessage("We couldn't send the verification email. Please try again shortly.");
      }
    } finally {
      setResending(false);
    }
  };

  const handleCheckVerification = async () => {
    const user = auth.currentUser;
    if (!user) {
      toast.error("Session Required", "Please sign in to confirm verification.");
      return;
    }

    try {
      setChecking(true);
      // 1. Reload the current Firebase user's authentication state using user.reload()
      await user.reload();
      const updatedUser = auth.currentUser;

      // 2. Obtain refreshed user and check emailVerified
      const isVerified = updatedUser?.emailVerified === true;

      if (!isVerified) {
        // Exact required prompt string
        const unverifiedMsg = "Your email has not been verified yet. Open the verification link in your email, then try again.";
        toast.warning("Email Not Verified", unverifiedMsg);
        setStatusMessage(unverifiedMsg);
        return;
      }

      // 3. If verified, refresh the ID token using getIdToken(true)
      await updatedUser?.getIdToken(true);

      // 4. Call existing backend /api/users/me endpoint with refreshed token
      clearAuthProfileCache();
      const userProfile = await api.getUserProfile(true);
      setProfile(userProfile);
      await refreshProfile();

      const role = (userProfile.role || "user").toLowerCase();
      const approval = userProfile.approval_status || "active";

      // 5. Confirm account is active and role and approval requirements are satisfied
      if (role === "admin") {
        toast.success("Email Verified", "System administrator access verified.");
        navigate("/admin", { replace: true });
        return;
      }

      if (role === "analyst") {
        if (approval === "pending_admin_approval") {
          setStatusMessage("Your analyst application is awaiting administrator approval. You will receive an update when a decision is made.");
          return;
        }
        if (approval === "rejected") {
          setStatusMessage("Your analyst application was not approved. Contact the administrator if you need further information.");
          return;
        }
        if (approval === "suspended") {
          setStatusMessage("Your account is currently unavailable. Contact the administrator for assistance.");
          return;
        }
        if (approval === "approved" || approval === "active") {
          toast.success("Analyst Portal Ready", "Your analyst account has been approved. You can now access the Analyst Portal.");
          navigate("/analyst", { replace: true });
          return;
        }
      }

      // Default MSME user
      if (approval === "suspended") {
        setStatusMessage("Your account is currently unavailable. Contact the administrator for assistance.");
        return;
      }

      toast.success("Email Verified", "Welcome to the MSME Risk AI Portal!");
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      console.error("Check verification error:", err);
      toast.error("Check Failed", err?.message || "Could not verify email status.");
    } finally {
      setChecking(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      clearAuthProfileCache();
      navigate("/login");
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  const isAnalyst = profile?.role === "analyst";
  const approvalStatus = profile?.approval_status || "pending_email_verification";
  const emailVerified = currentUser?.emailVerified || profile?.email_verified;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0C0A1D] p-4 text-slate-100">
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-[#8B5CF6]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg bg-[#1C1933] border border-[#1a2f4d] rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10">
        <div className="flex items-center justify-between border-b border-[#383154] pb-5 mb-6">
          <Brand />
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-[#A78BFA] text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            Security Verification
          </span>
        </div>

        {/* State Banner 1: Pending Admin Approval */}
        {emailVerified && approvalStatus === "pending_admin_approval" && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-amber-300">
                  Application Under Administrative Review
                </h4>
                <p className="text-xs text-amber-200/90 mt-1 leading-relaxed">
                  Your analyst application is awaiting administrator approval. You will receive an update when a decision is made.
                </p>
                <div className="mt-3 text-[11px] text-slate-400">
                  Account: <span className="text-white font-mono">{currentUser?.email}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* State Banner 2: Rejected */}
        {approvalStatus === "rejected" && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-rose-300">Application Decision</h4>
                <p className="text-xs text-rose-200/90 mt-1 leading-relaxed">
                  Your analyst application was not approved. Contact the administrator if you need further information.
                </p>
                {profile?.rejection_reason && (
                  <div className="mt-2 text-xs bg-rose-950/40 p-2.5 rounded border border-rose-900/50 text-rose-200">
                    <span className="font-semibold text-rose-300">Reason: </span>
                    {profile.rejection_reason}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* State Banner 3: Suspended */}
        {approvalStatus === "suspended" && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-rose-300">Account Unavailable</h4>
                <p className="text-xs text-rose-200/90 mt-1 leading-relaxed">
                  Your account is currently unavailable. Contact the administrator for assistance.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Default Verification Header */}
        {!emailVerified && (
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 flex items-center justify-center text-[#A78BFA] mb-4 shadow-inner">
              <Mail className="w-8 h-8" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white font-['Space_Grotesk']">
              Verify Your Email Address
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-sm mx-auto">
              To safeguard financial credit evaluations, ownership of this mailbox must be verified before platform access is granted.
            </p>
          </div>
        )}

        {/* Target Email Callout */}
        <div className="p-3.5 rounded-xl bg-[#0C0A1D] border border-[#383154] text-center mb-5">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
            Registered Email Address
          </div>
          <div className="text-sm sm:text-base font-semibold text-[#A78BFA] font-mono break-all">
            {currentUser?.email || initialEmail || "No active session"}
          </div>
        </div>

        {/* If user has no active session, show quick inline sign-in */}
        {!currentUser && (
          <form onSubmit={handleInlineLogin} className="mb-6 p-4 rounded-xl bg-[#0C0A1D] border border-[#8B5CF6]/30 space-y-3">
            <div className="text-xs font-semibold text-[#C4B5FD] flex items-center gap-1.5">
              <KeyRound className="w-4 h-4" />
              <span>Sign in to verify or resend email</span>
            </div>
            <Input
              label="Email"
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={loginLoading}
              loadingText="Signing in..."
              className="w-full"
            >
              Sign In to Continue
            </Button>
          </form>
        )}

        {/* Workflow Steps Indicator */}
        <div className="mb-6 space-y-2">
          <div className="flex items-center gap-2.5 text-xs">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              emailVerified ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-[#8B5CF6]/20 text-[#A78BFA] border border-[#8B5CF6]/40"
            }`}>
              {emailVerified ? "✓" : "1"}
            </span>
            <span className={emailVerified ? "text-emerald-300 font-medium" : "text-white font-medium"}>
              Email Verification Link Confirmation
            </span>
          </div>

          {isAnalyst && (
            <div className="flex items-center gap-2.5 text-xs">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                approvalStatus === "approved" || approvalStatus === "active"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : emailVerified
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                  : "bg-slate-800 text-slate-500"
              }`}>
                {approvalStatus === "approved" || approvalStatus === "active" ? "✓" : "2"}
              </span>
              <span className={
                approvalStatus === "approved" || approvalStatus === "active"
                  ? "text-emerald-300 font-medium"
                  : emailVerified
                  ? "text-amber-300 font-medium"
                  : "text-slate-500"
              }>
                Administrator Underwriting Credential Approval
              </span>
            </div>
          )}
        </div>

        {statusMessage && (
          <div className="mb-5 p-3 rounded-lg bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 text-[#DDD6FE] text-xs flex items-center gap-2">
            <HelpCircle className="w-4 h-4 shrink-0 text-[#A78BFA]" />
            <span>{statusMessage}</span>
          </div>
        )}

        {initialNotice && !statusMessage && (
          <div className="mb-5 p-3 rounded-lg bg-blue-950/40 border border-blue-800/40 text-blue-200 text-xs flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0 text-blue-400" />
            <span>{initialNotice}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="primary"
            size="lg"
            loading={checking}
            loadingText="Checking verification status..."
            onClick={handleCheckVerification}
            icon={<RefreshCw className="w-4 h-4" />}
            className="w-full"
          >
            I've Verified My Email — Continue
          </Button>

          <Button
            type="button"
            variant="outline"
            size="md"
            disabled={resending || cooldown > 0}
            loading={resending}
            loadingText="Sending email..."
            onClick={handleResendVerification}
            icon={<Send className="w-3.5 h-3.5 mr-1" />}
            className="w-full text-xs"
          >
            {cooldown > 0 ? `Resend Link (${cooldown}s cooldown)` : "Resend Verification Email"}
          </Button>
        </div>

        {/* Footer links */}
        <div className="flex items-center justify-between border-t border-[#383154] pt-4 mt-6 text-xs text-slate-400">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-1.5 hover:text-slate-200 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out / Switch Account</span>
          </button>

          <Link
            to="/login"
            className="text-[#A78BFA] hover:text-[#C4B5FD] font-medium transition-colors"
          >
            Back to Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
