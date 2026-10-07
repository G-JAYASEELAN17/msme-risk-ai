import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import {
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  ClipboardCheck,
  Building2,
  Lock,
  ArrowLeft,
  AlertTriangle,
  Info,
} from "lucide-react";
import { auth, googleProvider } from "../services/firebase";
import { api } from "../services/api";
import Brand from "../components/Brand";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";

export type PortalType = "user" | "analyst" | "admin";

interface PortalLoginProps {
  portal: PortalType;
}

export function PortalLogin({ portal }: PortalLoginProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [redirectNotice, setRedirectNotice] = useState<string>("");
  const [resetSent, setResetSent] = useState(false);

  // Configuration per portal
  const portalConfig = {
    user: {
      title: "MSME User Login",
      subtitle: "Access your business credit risk assessment.",
      badge: "MSME Business Owner",
      icon: Building2,
      accentBorder: "focus:border-cyan-500",
      primaryButtonClass: "bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-950/40",
      showGoogle: true,
      showRegisterLink: true,
      allowedRole: "user",
    },
    analyst: {
      title: "Credit Risk Analyst Login",
      subtitle: "Access the MSME underwriting review workspace.",
      badge: "Credit Risk Analyst",
      icon: ClipboardCheck,
      accentBorder: "focus:border-indigo-500",
      primaryButtonClass: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-950/40",
      showGoogle: false,
      showRegisterLink: false,
      allowedRole: "analyst",
    },
    admin: {
      title: "Administrator Login",
      subtitle: "Secure system administration access.",
      badge: "Administrator",
      icon: ShieldAlert,
      accentBorder: "focus:border-purple-500",
      primaryButtonClass: "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-950/40",
      showGoogle: false,
      showRegisterLink: false,
      allowedRole: "admin",
    },
  }[portal];

  const PortalIcon = portalConfig.icon;

  useEffect(() => {
    // Check if incoming from a redirected login attempt with an explanation message
    if (location.state?.message) {
      setRedirectNotice(location.state.message);
    } else if (location.state?.error) {
      setError(location.state.error);
    }

    const rememberedEmail = localStorage.getItem(`msme_${portal}_email`);
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, [portal, location.state]);

  const mapAuthError = (err: any): string => {
    switch (err.code) {
      case "auth/invalid-email":
        return "Please provide a valid email address.";
      case "auth/user-disabled":
        return "This account has been temporarily disabled.";
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Incorrect email or password. Please verify and try again.";
      case "auth/too-many-requests":
        return "Too many failed attempts. Please wait a few minutes before trying again.";
      case "auth/network-request-failed":
        return "Network connection issue. Please check your internet connection.";
      case "auth/popup-closed-by-user":
        return "Google sign-in window was closed.";
      case "auth/popup-blocked":
        return "Sign-in popup was blocked by your browser. Please allow popups.";
      default:
        return err?.message || "Authentication failed. Please try again.";
    }
  };

  /**
   * Authoritative backend role validation.
   * Compares the user's backend role against the current login portal.
   */
  const validateRoleAndRedirect = async () => {
    try {
      const profile = await api.getUserProfile();
      const userRole = (profile.role || "user").toLowerCase();

      if (rememberMe) {
        localStorage.setItem(`msme_${portal}_email`, email.trim());
      } else {
        localStorage.removeItem(`msme_${portal}_email`);
      }

      // Handle Portal 1: MSME User Login (/login/user)
      if (portal === "user") {
        if (userRole === "user") {
          toast.success("Welcome back", "Signed in as MSME Business Owner.");
          navigate("/dashboard", { replace: true });
          return;
        }

        if (userRole === "analyst") {
          await signOut(auth);
          const msg = "This account belongs to an Analyst. Please use Analyst Login.";
          toast.warning("Analyst Account Detected", msg);
          navigate("/login/analyst", { replace: true, state: { message: msg } });
          return;
        }

        if (userRole === "admin") {
          await signOut(auth);
          const msg = "This account belongs to an Administrator. Please use Admin Login.";
          toast.warning("Administrator Account Detected", msg);
          navigate("/login/admin", { replace: true, state: { message: msg } });
          return;
        }
      }

      // Handle Portal 2: Credit Risk Analyst Login (/login/analyst)
      if (portal === "analyst") {
        if (userRole === "analyst") {
          toast.success("Welcome back", "Signed in to Analyst Review Workspace.");
          navigate("/analyst", { replace: true });
          return;
        }

        if (userRole === "admin") {
          toast.success("Welcome back", "Signed in as Administrator with Underwriting privileges.");
          navigate("/analyst", { replace: true });
          return;
        }

        // Any unauthorized role (e.g. user)
        await signOut(auth);
        const msg = "Access denied. This portal is restricted to Credit Risk Analysts.";
        setError(msg);
        toast.error("Access Denied", msg);
        return;
      }

      // Handle Portal 3: Administrator Login (/login/admin)
      if (portal === "admin") {
        if (userRole === "admin") {
          toast.success("Welcome, Administrator", "System access granted.");
          navigate("/admin", { replace: true });
          return;
        }

        // Any non-admin role
        await signOut(auth);
        const msg = "Access denied. Administrator privileges are required.";
        setError(msg);
        toast.error("Access Denied", msg);
        return;
      }
    } catch (profileErr: any) {
      console.error("Failed to verify backend authorization:", profileErr);
      await signOut(auth);
      setError("Unable to verify account authorization with risk service. Please try again.");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setRedirectNotice("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      await validateRoleAndRedirect();
    } catch (err: any) {
      console.error("Login failure:", err);
      const msg = mapAuthError(err);
      setError(msg);
      toast.error("Sign in failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setRedirectNotice("");
    try {
      setGoogleLoading(true);
      await signInWithPopup(auth, googleProvider);
      await validateRoleAndRedirect();
    } catch (err: any) {
      console.error("Google login failure:", err);
      const msg = mapAuthError(err);
      setError(msg);
      toast.error("Google Sign-In", msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError("");
    setResetSent(false);

    if (!email.trim()) {
      setError("Please enter your email address above to reset your password.");
      return;
    }

    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, email.trim());
      setResetSent(true);
      toast.info("Password Reset", "Password reset instructions have been sent to your email.");
    } catch (err: any) {
      console.error("Password reset failure:", err);
      const msg = mapAuthError(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-[#040812] text-slate-100 relative overflow-hidden font-sans">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-gradient-to-b from-blue-600/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none" />

      {/* Top Navbar */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between border-b border-[#112038]">
        <Brand />
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700/60 hover:border-slate-600 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Switch account type</span>
        </Link>
      </header>

      {/* Form Container */}
      <main className="relative z-10 w-full max-w-md mx-auto px-6 py-10 flex-1 flex flex-col justify-center">
        <div className="p-8 rounded-2xl bg-[#091322]/95 backdrop-blur-md border border-[#172740] shadow-2xl space-y-6">
          {/* Header */}
          <div className="space-y-2 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700/80 mx-auto">
              <PortalIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span>{portalConfig.badge}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-['Space_Grotesk']">
              {portalConfig.title}
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              {portalConfig.subtitle}
            </p>
          </div>

          {/* Cross-portal Redirect Explanation Banner */}
          {redirectNotice && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5 animate-fade-in">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{redirectNotice}</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-shake">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Password Reset Success */}
          {resetSent && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Password reset link sent. Please check your inbox.</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              autoComplete="email"
              placeholder={
                portal === "user"
                  ? "owner@yourcompany.com"
                  : portal === "analyst"
                  ? "analyst@financialhub.com"
                  : "admin@msmerisk.ai"
              }
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-slate-300">Password</label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full px-3.5 py-2.5 bg-[#060c18] border border-[#1a2d4b] rounded-xl text-slate-200 text-sm placeholder-slate-500 focus:outline-none ${portalConfig.accentBorder} transition-colors pr-10`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                />
                <span>Remember email</span>
              </label>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              loadingText="Authenticating..."
              icon={<ArrowRight className="w-4 h-4" />}
              iconPosition="right"
              className={`w-full ${portalConfig.primaryButtonClass}`}
            >
              Sign In to {portalConfig.badge}
            </Button>
          </form>

          {/* Google Sign In option (only on MSME user portal if configured) */}
          {portalConfig.showGoogle && (
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="relative flex justify-center text-[10px] uppercase tracking-wider text-slate-500">
                <span className="bg-[#091322] px-2 font-medium">Or continue with</span>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading || loading}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-700/80 bg-slate-900/60 hover:bg-slate-800 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2.5 transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 14.5s.7 4.8 1.9 7.2l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 17C3.7 20.7 7.5 24 12 24z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>
          )}

          {/* Registration link for MSME Users */}
          {portalConfig.showRegisterLink && (
            <p className="text-center text-xs text-slate-400 pt-2 border-t border-slate-800">
              New MSME borrower?{" "}
              <Link to="/register" className="text-cyan-400 hover:text-cyan-300 font-semibold">
                Create MSME Account
              </Link>
            </p>
          )}

          {/* Switch Account Type Option */}
          <div className="pt-2 text-center">
            <Link
              to="/login"
              className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center gap-1"
            >
              <span>← Switch account type</span>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-[#112038] bg-[#03060f]/80 py-5 px-6 text-center text-xs text-slate-400 space-y-1">
        <p className="font-semibold text-slate-300 text-xs">
          AI-Assisted Credit Risk Assessment
        </p>
        <p className="text-[11px] text-slate-400 max-w-xl mx-auto">
          AI-generated risk insights are decision-support information and do not autonomously approve or reject loans.
        </p>
      </footer>
    </div>
  );
}

// Named exports for routes
export function UserLoginPage() {
  return <PortalLogin portal="user" />;
}

export function AnalystLoginPage() {
  return <PortalLogin portal="analyst" />;
}

export function AdminLoginPage() {
  return <PortalLogin portal="admin" />;
}
