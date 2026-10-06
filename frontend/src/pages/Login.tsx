import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from "firebase/auth";
import {
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  BrainCircuit,
  Lock,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { auth, googleProvider } from "../services/firebase";
import Brand from "../components/Brand";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";

export default function Login() {
  const navigate = useNavigate();
  const toast = useToast();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate("/dashboard");
      }
    });

    const rememberedEmail = localStorage.getItem("msme_remember_email");
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }

    return () => unsubscribe();
  }, [navigate]);

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

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

      if (rememberMe) {
        localStorage.setItem("msme_remember_email", email.trim());
      } else {
        localStorage.removeItem("msme_remember_email");
      }

      toast.success("Welcome back", "Signed in successfully.");
      navigate("/dashboard");
    } catch (err: any) {
      console.error("Login error:", err);
      const msg = mapAuthError(err);
      setError(msg);
      toast.error("Sign in failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    try {
      setGoogleLoading(true);
      await signInWithPopup(auth, googleProvider);
      toast.success("Welcome", "Authenticated with Google.");
      navigate("/dashboard");
    } catch (err: any) {
      console.error("Google login error:", err);
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
      setError("Please enter your email address above to reset password.");
      return;
    }

    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, email.trim());
      setResetSent(true);
      toast.info("Password Reset", "Reset instructions have been sent to your email.");
    } catch (err: any) {
      console.error("Password reset error:", err);
      const msg = mapAuthError(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[#060b14] text-slate-100">
      {/* Left visual showcase panel - desktop only */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden border-r border-[#15253d] bg-gradient-to-br from-[#091527] via-[#0b172d] to-[#070f1c]">
        {/* Ambient background glow elements */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/3 -right-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <Brand />
        </div>

        <div className="relative z-10 my-auto py-10 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-6">
            <BrainCircuit className="w-4 h-4" />
            AI-Powered MSME Risk Analysis
          </div>

          <h1 className="text-4xl xl:text-5xl font-bold tracking-tight text-white leading-tight font-['Space_Grotesk'] mb-4">
            Underwrite MSME loans with <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">machine clarity</span>.
          </h1>

          <p className="text-slate-300 text-base leading-relaxed mb-8">
            Assess MSME creditworthiness with explainable AI, alternative financial indicators, and real-time default probability scoring.
          </p>

          {/* Value cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#0e1f38]/60 border border-[#1b355a] backdrop-blur-sm">
              <div className="flex items-center gap-2.5 text-cyan-400 text-xs font-semibold mb-1">
                <Sparkles className="w-4 h-4" />
                Explainable Signals
              </div>
              <p className="text-xs text-slate-300">
                Transparent factor breakdown for every credit decision.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#0e1f38]/60 border border-[#1b355a] backdrop-blur-sm">
              <div className="flex items-center gap-2.5 text-emerald-400 text-xs font-semibold mb-1">
                <TrendingUp className="w-4 h-4" />
                High Accuracy
              </div>
              <p className="text-xs text-slate-300">
                Trained on real MSME financial patterns and repayment history.
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 pt-6 border-t border-[#16273f]">
          <span>© 2026 MSME Risk AI. Enterprise Grade.</span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            Bank-grade Security
          </span>
        </div>
      </div>

      {/* Right sign-in form panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <Brand />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-white font-['Space_Grotesk'] tracking-tight">
              Sign in to your workspace
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              Enter your credentials to access the credit risk underwriting platform.
            </p>
          </div>

          {/* Google SSO Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-[#0f1d33] hover:bg-[#152744] text-white border border-[#22395a] hover:border-[#355787] text-sm font-semibold transition-all duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            {googleLoading ? (
              <span className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>Continue with Google</span>
          </button>

          <div className="flex items-center gap-3 my-6 text-slate-500 text-xs uppercase font-medium">
            <div className="h-px flex-1 bg-[#1a2c47]" />
            <span>or continue with email</span>
            <div className="h-px flex-1 bg-[#1a2c47]" />
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <Input
              label="Work Email"
              type="email"
              placeholder="underwriter@financial.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading || googleLoading}
              required
              autoComplete="email"
            />

            <div>
              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || googleLoading}
                required
                autoComplete="current-password"
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-white transition-colors focus:outline-none"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-[#1e324e] bg-[#0a1424] text-cyan-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <span>Remember email</span>
              </label>

              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors focus:outline-none"
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <Lock className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {resetSent && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>Password reset link sent to {email}. Check your inbox.</span>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              loadingText="Authenticating..."
              icon={<ArrowRight className="w-4 h-4" />}
              iconPosition="right"
              className="mt-2 w-full"
            >
              Sign In
            </Button>
          </form>

          <p className="text-center text-xs sm:text-sm text-slate-400 mt-6">
            Don’t have an account?{" "}
            <Link
              to="/register"
              className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
            >
              Create free workspace
            </Link>
          </p>

          <div className="mt-8 pt-6 border-t border-[#16273f] text-center text-[11px] text-slate-400">
            Protected by Firebase Auth with enterprise rate-limiting and encryption.
          </div>
        </div>
      </div>
    </div>
  );
}
