import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
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
  CheckCircle2,
} from "lucide-react";
import { auth, googleProvider } from "../services/firebase";
import Brand from "../components/Brand";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";

export default function Register() {
  const navigate = useNavigate();
  const toast = useToast();

  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    label: "None",
    color: "transparent",
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate("/dashboard");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!password) {
      setPasswordStrength({ score: 0, label: "None", color: "transparent" });
      return;
    }

    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 10) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    let label = "Weak";
    let color = "bg-rose-500";

    if (score >= 4) {
      label = "Strong";
      color = "bg-emerald-500";
    } else if (score >= 2) {
      label = "Medium";
      color = "bg-amber-500";
    }

    setPasswordStrength({ score, label, color });
  }, [password]);

  const mapAuthError = (err: any): string => {
    switch (err.code) {
      case "auth/email-already-in-use":
        return "An account is already registered with this email address.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/weak-password":
        return "The password is too weak. Please use at least 6 characters with mixed characters.";
      case "auth/network-request-failed":
        return "Network connection issue. Please check your internet.";
      case "auth/popup-closed-by-user":
        return "Google sign-in popup was closed.";
      default:
        return err?.message || "Registration failed. Please try again.";
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your work email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!agreeTerms) {
      setError("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }

    try {
      setLoading(true);
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      
      if (userCredential.user) {
        await updateProfile(userCredential.user, {
          displayName: fullName.trim(),
        });
      }

      toast.success("Account created", "Welcome to MSME Risk AI!");
      navigate("/dashboard");
    } catch (err: any) {
      console.error("Registration error:", err);
      const msg = mapAuthError(err);
      setError(msg);
      toast.error("Registration failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError("");
    try {
      setGoogleLoading(true);
      await signInWithPopup(auth, googleProvider);
      toast.success("Welcome", "Workspace ready via Google sign-in.");
      navigate("/dashboard");
    } catch (err: any) {
      console.error("Google sign-in error:", err);
      const msg = mapAuthError(err);
      setError(msg);
      toast.error("Google sign-in", msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[#060b14] text-slate-100">
      {/* Left visual panel */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden border-r border-[#15253d] bg-gradient-to-br from-[#091527] via-[#0b172d] to-[#070f1c]">
        <div className="absolute top-1/3 -left-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 -right-24 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <Brand />
        </div>

        <div className="relative z-10 my-auto py-10 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-6">
            <Sparkles className="w-4 h-4" />
            Instant Underwriting Platform
          </div>

          <h1 className="text-4xl xl:text-5xl font-bold tracking-tight text-white leading-tight font-['Space_Grotesk'] mb-4">
            Transform MSME credit risk into <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">decision confidence</span>.
          </h1>

          <p className="text-slate-300 text-base leading-relaxed mb-8">
            Join financial analysts and risk officers evaluating MSME applications with machine learning, automated reporting, and explainable metrics.
          </p>

          <div className="space-y-3">
            {[
              "Automated probability-of-default calculation",
              "Alternative data & cash-flow health indicators",
              "Standardized audit-ready PDF & JSON reports",
            ].map((feat) => (
              <div key={feat} className="flex items-center gap-3 text-sm text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 pt-6 border-t border-[#16273f]">
          <span>© 2026 MSME Risk AI. Enterprise Ready.</span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            SOC-2 Compliant Storage
          </span>
        </div>
      </div>

      {/* Right registration form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <Brand />
          </div>

          <div className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-white font-['Space_Grotesk'] tracking-tight">
              Create your account
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              Get started with instant MSME credit risk intelligence.
            </p>
          </div>

          {/* Google Sign up */}
          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-[#0f1d33] hover:bg-[#152744] text-white border border-[#22395a] hover:border-[#355787] text-sm font-semibold transition-all duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed mb-5"
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
            <span>Sign up with Google</span>
          </button>

          <div className="flex items-center gap-3 my-5 text-slate-500 text-xs uppercase font-medium">
            <div className="h-px flex-1 bg-[#1a2c47]" />
            <span>or with work email</span>
            <div className="h-px flex-1 bg-[#1a2c47]" />
          </div>

          <form onSubmit={handleRegister} className="flex flex-col gap-3.5">
            <Input
              label="Full Name"
              type="text"
              placeholder="e.g. Jordan Mitchell"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={loading || googleLoading}
              required
            />

            <Input
              label="Work Email"
              type="email"
              placeholder="jordan@lendingfirm.com"
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
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || googleLoading}
                required
                autoComplete="new-password"
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

              {password && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1.5 h-1.5 bg-[#13233b] rounded-full overflow-hidden">
                    {[1, 2, 3, 4, 5].map((idx) => (
                      <div
                        key={idx}
                        className={`flex-1 transition-all duration-300 ${
                          idx <= passwordStrength.score ? passwordStrength.color : "bg-transparent"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span>Password Strength</span>
                    <span className="font-semibold text-slate-200">{passwordStrength.label}</span>
                  </div>
                </div>
              )}
            </div>

            <Input
              label="Confirm Password"
              type={showPassword ? "text" : "password"}
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading || googleLoading}
              required
              autoComplete="new-password"
            />

            <div className="pt-1">
              <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="rounded border-[#1e324e] bg-[#0a1424] text-cyan-500 mt-0.5 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  required
                />
                <span>
                  I agree to the <span className="text-cyan-400 underline cursor-pointer">Terms of Service</span> and <span className="text-cyan-400 underline cursor-pointer">Privacy Policy</span>.
                </span>
              </label>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <Lock className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              loadingText="Creating account..."
              icon={<ArrowRight className="w-4 h-4" />}
              iconPosition="right"
              className="mt-2 w-full"
            >
              Create Account
            </Button>
          </form>

          <p className="text-center text-xs sm:text-sm text-slate-400 mt-6">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
