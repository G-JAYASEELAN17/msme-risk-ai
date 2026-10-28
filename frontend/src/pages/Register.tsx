import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams, Link } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Lock,
  Sparkles,
  CheckCircle2,
  Building2,
  Briefcase,
  AlertCircle,
  FileCheck,
  Send,
  HelpCircle,
} from "lucide-react";
import { auth } from "../services/firebase";
import { api } from "../services/api";
import Brand from "../components/Brand";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";

type RegisterRoleType = "user" | "analyst";

const INDUSTRIES = [
  "Manufacturing",
  "Retail & Wholesale",
  "Technology & Software",
  "Logistics & Supply Chain",
  "Healthcare & Pharma",
  "Food & Hospitality",
  "Agriculture & Processing",
  "Construction & Real Estate",
  "Professional Services",
  "Textiles & Apparel",
  "Other",
];

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  const getInitialRole = (): RegisterRoleType => {
    const roleParam = searchParams.get("role")?.toLowerCase();
    if (roleParam === "analyst" || roleParam === "user") {
      return roleParam as RegisterRoleType;
    }
    const stateRole = location.state?.role?.toLowerCase();
    if (stateRole === "analyst" || stateRole === "user") {
      return stateRole as RegisterRoleType;
    }
    return "user";
  };

  const [activeTab, setActiveTab] = useState<RegisterRoleType>(getInitialRole);

  // Sync role tab if URL query parameter or navigation state changes
  useEffect(() => {
    const roleParam = searchParams.get("role")?.toLowerCase();
    if (roleParam === "analyst" || roleParam === "user") {
      if (roleParam !== activeTab) {
        setActiveTab(roleParam as RegisterRoleType);
      }
    } else if (location.state?.role) {
      const stateRole = location.state.role.toLowerCase();
      if ((stateRole === "analyst" || stateRole === "user") && stateRole !== activeTab) {
        setActiveTab(stateRole as RegisterRoleType);
      }
    }
  }, [searchParams, location.state]);

  const handleTabSelect = (tab: RegisterRoleType) => {
    setActiveTab(tab);
    setError("");
    setDuplicateAccountError(false);
    setSearchParams({ role: tab }, { replace: true });
  };
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Common fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);

  // MSME User specific fields
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("Manufacturing");
  const [businessAge, setBusinessAge] = useState(3);
  const [employees, setEmployees] = useState(12);

  // Analyst specific fields
  const [organization, setOrganization] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [experienceYears, setExperienceYears] = useState("3-5 years");
  const [applicationReason, setApplicationReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [duplicateAccountError, setDuplicateAccountError] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    label: "None",
    color: "transparent",
  });

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

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      toast.error("Email Required", "Please enter your email address to receive password reset instructions.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetSent(true);
      toast.success("Password Reset Sent", `Password reset instructions sent to ${email.trim()}.`);
    } catch (err: any) {
      toast.error("Password Reset Error", err?.message || "Failed to send password reset email.");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setDuplicateAccountError(false);

    // Validation
    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
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

    if (activeTab === "user") {
      if (!businessName.trim()) {
        setError("Please enter your registered enterprise name.");
        return;
      }
    } else {
      if (!qualifications.trim()) {
        setError("Please state your professional qualifications (e.g. CA, CFA, MBA Finance).");
        return;
      }
      if (!applicationReason.trim() || applicationReason.trim().length < 15) {
        setError("Please provide a brief justification for requesting analyst access (at least 15 characters).");
        return;
      }
    }

    try {
      setLoading(true);

      // Pre-check for duplicate email in backend database & Firebase
      const checkRes = await api.checkEmail(email.trim());
      if (checkRes.exists) {
        setDuplicateAccountError(true);
        setError("An account with this email already exists. Please sign in or reset your password.");
        return;
      }

      // 1. Create the account with Firebase Authentication
      let userCred;
      try {
        userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      } catch (fbErr: any) {
        if (fbErr.code === "auth/email-already-in-use") {
          setDuplicateAccountError(true);
          setError("An account with this email already exists. Please sign in or reset your password.");
          return;
        }
        if (fbErr.code === "auth/invalid-email") {
          setError("Please enter a valid email address.");
          return;
        }
        if (fbErr.code === "auth/weak-password") {
          setError("The password is too weak. Please use at least 8 characters with letters and numbers.");
          return;
        }
        throw fbErr;
      }

      const fbUser = userCred.user;

      // 2. Set user display name
      try {
        await updateProfile(fbUser, { displayName: fullName.trim() });
      } catch (profErr) {
        console.warn("Could not set displayName on Firebase user:", profErr);
      }

      // 3. Send the email verification using Firebase Authentication
      try {
        await sendEmailVerification(fbUser);
      } catch (sendErr: any) {
        console.error("sendEmailVerification error:", sendErr);
        if (sendErr.code === "auth/too-many-requests") {
          throw new Error("We couldn't send the verification email due to rate limits. Please try again shortly.");
        }
        throw new Error(sendErr?.message || "Failed to dispatch verification email via Firebase.");
      }

      // 4. Record enterprise or analyst profile in backend PostgreSQL
      if (activeTab === "user") {
        await api.registerMSMEUser({
          email: email.trim(),
          password,
          name: fullName.trim(),
          phone: phone.trim() || undefined,
          business_name: businessName.trim(),
          industry,
          business_age: Number(businessAge) || 1,
          employees: Number(employees) || 1,
        });
      } else {
        await api.applyAsAnalyst({
          email: email.trim(),
          password,
          name: fullName.trim(),
          phone: phone.trim() || undefined,
          organization: organization.trim() || undefined,
          qualifications: qualifications.trim(),
          experience_years: experienceYears,
          application_reason: applicationReason.trim(),
        });
      }

      // 5. Show success message ONLY after Firebase accepts the send request!
      toast.success(
        "Verification Email Sent",
        "Verification email sent. Check your inbox and spam folder."
      );

      navigate("/verify-email", {
        state: {
          email: email.trim(),
          message:
            activeTab === "user"
              ? "Account created. Please verify your email to access the MSME Portal."
              : "Analyst registration submitted. Please verify your email before administrator review.",
        },
      });
    } catch (err: any) {
      console.error("Registration error:", err);
      const errMsg = err?.message || "";
      if (errMsg.includes("already exists") || errMsg.includes("409")) {
        setDuplicateAccountError(true);
        setError("An account with this email already exists. Please sign in or reset your password.");
      } else {
        setError(errMsg || "Registration failed. Please verify your details.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[#151229] text-slate-100">
      {/* Left visual panel */}
      <div className="hidden lg:flex lg:w-5/12 relative flex-col justify-between p-12 overflow-hidden border-r border-[#383154] bg-gradient-to-br from-[#1C1933] via-[#1C1933] to-[#0C0A1D]">
        <div className="absolute top-1/3 -left-24 w-96 h-96 bg-[#8B5CF6]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 -right-24 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <Brand />
        </div>

        <div className="relative z-10 my-auto py-8 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-[#A78BFA] text-xs font-semibold uppercase tracking-wider mb-6">
            <Sparkles className="w-4 h-4" />
            Dual-Role Enterprise Onboarding
          </div>

          <h1 className="text-3xl xl:text-4xl font-bold tracking-tight text-white leading-tight font-['Space_Grotesk'] mb-4">
            Underwrite and assess MSME credit with <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8B5CF6] to-blue-500">verifiable integrity</span>.
          </h1>

          <p className="text-slate-300 text-sm leading-relaxed mb-6">
            Designed for business enterprises seeking credit evaluation and credit risk analysts conducting institutional underwriting.
          </p>

          <div className="space-y-3.5 bg-[#1C1933]/80 border border-[#172942] rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-[#A78BFA] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">MSME Users</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Self-register your enterprise, submit financial indicators, and generate automated risk profiles instantly.
                </p>
              </div>
            </div>

            <div className="h-px bg-[#252141]" />

            <div className="flex items-start gap-3">
              <Briefcase className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Risk Analysts</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Apply for institutional underwriting access. Requires email verification and administrator authorization.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 pt-6 border-t border-[#383154]">
          <span>© 2026 MSME Risk AI. Strict RBAC.</span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            Backend-Enforced Security
          </span>
        </div>
      </div>

      {/* Right registration form */}
      <div className="w-full lg:w-7/12 flex items-center justify-center p-6 sm:p-10 overflow-y-auto">
        <div className="w-full max-w-xl py-6">
          <div className="lg:hidden mb-6">
            <Brand />
          </div>

          <div className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-white font-['Space_Grotesk'] tracking-tight">
              Create your account
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
              Select your role to complete the registration workflow.
            </p>
          </div>

          {/* Role selector tabs */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-[#1C1933] border border-[#16263e] rounded-xl mb-6">
            <button
              type="button"
              onClick={() => handleTabSelect("user")}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                activeTab === "user"
                  ? "bg-[#8B5CF6] text-white shadow-md shadow-[#8B5CF6]/20"
                  : "text-slate-400 hover:text-white hover:bg-[#101e33]"
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Register as MSME User</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabSelect("analyst")}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                activeTab === "analyst"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-[#101e33]"
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>Apply as Risk Analyst</span>
            </button>
          </div>

          {/* Duplicate Account Alert Banner with exact requirement string */}
          {duplicateAccountError && (
            <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="w-full">
                  <h4 className="text-sm font-semibold text-amber-300">
                    Account Already Registered
                  </h4>
                  <p className="text-xs text-amber-200/90 mt-1 leading-relaxed">
                    An account with this email already exists. Please sign in or reset your password.
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Link
                      to={activeTab === "analyst" ? "/login/analyst" : "/login/user"}
                      className={`px-3 py-1.5 rounded-lg ${
                        activeTab === "analyst"
                          ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                          : "bg-[#8B5CF6] hover:bg-[#7C3AED] text-white"
                      } font-semibold text-xs transition`}
                    >
                      Sign in to your account
                    </Link>

                    <button
                      type="button"
                      onClick={handlePasswordReset}
                      className="px-3 py-1.5 rounded-lg bg-[#11233d] hover:bg-[#1a3356] text-amber-300 border border-amber-500/30 font-medium text-xs transition"
                    >
                      Forgot Password?
                    </button>

                    <Link
                      to="/verify-email"
                      state={{ email }}
                      className="text-xs text-slate-300 hover:text-white underline transition"
                    >
                      Resend Verification Email
                    </Link>
                  </div>

                  {resetSent && (
                    <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Password reset email dispatched. Check your mailbox.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            {/* Common Credentials Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                type="text"
                placeholder={activeTab === "user" ? "e.g. Jordan Mitchell" : "e.g. Dr. Priya Sharma, CFA"}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
                required
              />

              <Input
                label={activeTab === "user" ? "Business Email" : "Professional Work Email"}
                type="email"
                placeholder={activeTab === "user" ? "jordan@company.com" : "priya.sharma@bank.com"}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setDuplicateAccountError(false);
                }}
                disabled={loading}
                required
                autoComplete="email"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Phone Number (Optional)"
                type="tel"
                placeholder="+1 (555) 234-5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
              />

              <div>
                <Input
                  label="Password (min 8 chars)"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
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
                  <div className="mt-1.5 space-y-1">
                    <div className="flex gap-1 h-1 bg-[#252141] rounded-full overflow-hidden">
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
                      <span>Strength</span>
                      <span className="font-semibold text-slate-200">{passwordStrength.label}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Input
              label="Confirm Password"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              required
              autoComplete="new-password"
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="text-slate-400 hover:text-white transition-colors focus:outline-none"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />

            {/* MSME Role Specific Inputs */}
            {activeTab === "user" && (
              <div className="p-4 rounded-xl bg-[#151229] border border-[#383154] space-y-3.5">
                <div className="text-xs font-semibold text-[#A78BFA] uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" />
                  Enterprise Profile Information
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Input
                    label="Enterprise / Business Name"
                    type="text"
                    placeholder="e.g. Apex Precision Engineering Ltd"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    disabled={loading}
                    required
                  />

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Industry Sector
                    </label>
                    <select
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      disabled={loading}
                      className="w-full bg-[#151229] border border-[#1a2f4d] text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]"
                    >
                      {INDUSTRIES.map((ind) => (
                        <option key={ind} value={ind}>
                          {ind}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Input
                    label="Years in Operation"
                    type="number"
                    min="0"
                    placeholder="e.g. 5"
                    value={String(businessAge)}
                    onChange={(e) => setBusinessAge(Math.max(0, parseInt(e.target.value) || 0))}
                    disabled={loading}
                    required
                  />

                  <Input
                    label="Full-Time Employees"
                    type="number"
                    min="1"
                    placeholder="e.g. 25"
                    value={String(employees)}
                    onChange={(e) => setEmployees(Math.max(1, parseInt(e.target.value) || 1))}
                    disabled={loading}
                    required
                  />
                </div>
              </div>
            )}

            {/* Analyst Role Specific Inputs */}
            {activeTab === "analyst" && (
              <div className="p-4 rounded-xl bg-[#151229] border border-[#383154] space-y-3.5">
                <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4" />
                  Analyst Credential & Experience Submission
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Input
                    label="Lending Institution / Organization"
                    type="text"
                    placeholder="e.g. Sovereign Commercial Credit Bank"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    disabled={loading}
                  />

                  <Input
                    label="Relevant Professional Qualifications"
                    type="text"
                    placeholder="e.g. CFA, CA, MBA Finance, FRM"
                    value={qualifications}
                    onChange={(e) => setQualifications(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Credit Risk & Financial Underwriting Experience
                  </label>
                  <select
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    disabled={loading}
                    className="w-full bg-[#151229] border border-[#1a2f4d] text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="1-2 years">1-2 years (Junior Risk Analyst)</option>
                    <option value="3-5 years">3-5 years (Commercial Underwriter)</option>
                    <option value="6-10 years">6-10 years (Senior Credit Risk Officer)</option>
                    <option value="10+ years">10+ years (Head of Credit / Risk Director)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Reason for Requesting Analyst Access
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe your role, target credit assessment scope, or underwriting mandate..."
                    value={applicationReason}
                    onChange={(e) => setApplicationReason(e.target.value)}
                    disabled={loading}
                    required
                    className="w-full bg-[#151229] border border-[#1a2f4d] text-white text-xs rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-200 flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>
                    Note: Analyst accounts require verification of email ownership and explicit administrative approval before accessing the Analyst Review Workspace.
                  </span>
                </div>
              </div>
            )}

            {/* Terms Consent */}
            <div className="pt-1">
              <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="rounded border-[#1e324e] bg-[#1C1933] text-[#8B5CF6] mt-0.5 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  required
                />
                <span>
                  I confirm that all provided details are authentic and agree to the{" "}
                  <Link to="/terms" className="text-[#A78BFA] underline">Terms of Service</Link> and{" "}
                  <Link to="/privacy" className="text-[#A78BFA] underline">Privacy Policy</Link>.
                </span>
              </label>
            </div>

            {error && !duplicateAccountError && (
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
              loadingText={activeTab === "user" ? "Creating MSME Account..." : "Submitting Application..."}
              icon={<ArrowRight className="w-4 h-4" />}
              iconPosition="right"
              className={`mt-2 w-full ${
                activeTab === "analyst"
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-950/40"
                  : "bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-[#0C0A1D]/40"
              }`}
            >
              {activeTab === "user" ? "Register MSME Account" : "Submit Analyst Application"}
            </Button>
          </form>

          <p className="text-center text-xs sm:text-sm text-slate-400 mt-6">
            Already have an account?{" "}
            <Link
              to={activeTab === "analyst" ? "/login/analyst" : "/login/user"}
              className={`${
                activeTab === "analyst"
                  ? "text-indigo-400 hover:text-indigo-300"
                  : "text-[#A78BFA] hover:text-[#C4B5FD]"
              } font-semibold transition-colors`}
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
