import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  Building2,
  PlusCircle,
  FileText,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Upload,
  RefreshCw,
  Bell,
  Eye,
  Sparkles,
  HelpCircle,
  ChevronDown,
  LogOut,
  Settings as SettingsIcon,
  User as UserIcon,
  X,
  Phone,
  Mail,
  Shield,
  Layers,
  Check,
  ExternalLink,
} from "lucide-react";
import { auth } from "../services/firebase";
import {
  api,
  BusinessProfile,
  AssessmentSummary,
  DocumentItem,
  NotificationItem,
} from "../services/api";
import Sidebar from "../components/Sidebar";
import NotificationPopover from "../components/NotificationPopover";
import ConfirmationDialog from "../components/ui/ConfirmationDialog";
import { RiskBadge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { useAuthRole } from "../context/AuthRoleContext";

/**
 * Formats monetary amounts into Indian Rupee (₹) representation.
 */
function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "N/A";
  return `₹${Math.round(val).toLocaleString("en-IN")}`;
}

/**
 * Formats ISO date string into readable format.
 */
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Returns dynamic time-of-day greeting.
 */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Circular Risk Gauge Visualization (SVG)
 */
function CircularRiskGauge({
  score,
  level,
}: {
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH" | string;
}) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  const colorConfig = useMemo(() => {
    switch (level.toUpperCase()) {
      case "LOW":
        return {
          stroke: "#10b981", // emerald-500
          glow: "rgba(16, 185, 129, 0.3)",
          badgeBg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
          track: "#064e3b",
        };
      case "MEDIUM":
        return {
          stroke: "#f59e0b", // amber-500
          glow: "rgba(245, 158, 11, 0.3)",
          badgeBg: "bg-amber-500/15 text-amber-400 border-amber-500/30",
          track: "#78350f",
        };
      case "HIGH":
      default:
        return {
          stroke: "#f43f5e", // rose-500
          glow: "rgba(244, 63, 94, 0.3)",
          badgeBg: "bg-rose-500/15 text-rose-400 border-rose-500/30",
          track: "#881337",
        };
    }
  }, [level]);

  return (
    <div className="relative flex flex-col items-center justify-center">
      <div className="relative w-36 h-36 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 128 128">
          {/* Background circle track */}
          <circle
            cx="64"
            cy="64"
            r={radius}
            stroke="#1e293b"
            strokeWidth="10"
            fill="transparent"
          />
          {/* Colored progress arc */}
          <circle
            cx="64"
            cy="64"
            r={radius}
            stroke={colorConfig.stroke}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            style={{
              transition: "stroke-dashoffset 1s ease-in-out",
              filter: `drop-shadow(0 0 6px ${colorConfig.glow})`,
            }}
          />
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-extrabold text-white tracking-tight">
            {clampedScore}
            <span className="text-xs font-normal text-slate-400">/100</span>
          </span>
          <span
            className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full mt-1 border ${colorConfig.badgeBg}`}
          >
            {level.toUpperCase()} RISK
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, userProfile, isAnalyst } = useAuthRole();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Business owner data
  const [businesses, setBusinesses] = useState<BusinessProfile[]>([]);
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [latestAssessmentDetails, setLatestAssessmentDetails] = useState<any | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // UI interaction states
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Listen to auth state and fetch business portfolio
  useEffect(() => {
    let isMounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        navigate("/login/user");
      } else {
        if (isMounted) {
          loadUserData();
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [navigate]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      setError("");

      const [bizList, assessList, docList, notifList] = await Promise.all([
        api.getBusinesses().catch(() => [] as BusinessProfile[]),
        api.getAssessments().catch(() => [] as AssessmentSummary[]),
        api.getDocuments().catch(() => [] as DocumentItem[]),
        api.getNotifications().catch(() => [] as NotificationItem[]),
      ]);

      setBusinesses(bizList);
      setAssessments(assessList);
      setDocuments(docList);
      setNotifications(notifList);

      if (assessList.length > 0) {
        const latestId = assessList[0].id;
        try {
          const details = await api.getAssessmentDetails(latestId);
          setLatestAssessmentDetails(details);
        } catch (detailErr) {
          console.warn("Could not load latest assessment details:", detailErr);
        }
      }
    } catch (err: any) {
      console.error("Dashboard data load error:", err);
      setError(err?.message || "Failed to load business profile and assessment status.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await signOut(auth);
      navigate("/login/user");
    } catch (err) {
      console.error("Sign out failed:", err);
    } finally {
      setSigningOut(false);
      setShowSignOutConfirm(false);
    }
  };

  const primaryBusiness = businesses[0] || null;
  const latestAssessment = assessments[0] || null;

  // Name resolution
  const userName =
    userProfile?.name ||
    user?.displayName ||
    (user?.email ? user.email.split("@")[0] : "Business Owner");

  const businessName = primaryBusiness?.name || "Business Enterprise";

  // Risk Score & Probability resolution
  const defaultProb = latestAssessment ? latestAssessment.default_probability : 0;
  const riskScore =
    latestAssessmentDetails?.prediction?.risk_score ??
    (latestAssessment?.default_probability != null
      ? Math.round(latestAssessment.default_probability)
      : 0);

  const riskLevel = (latestAssessment?.risk_level || "LOW").toUpperCase();
  const healthScore = latestAssessment
    ? Math.max(0, Math.min(100, Math.round(100 - defaultProb)))
    : null;

  // Status mapping
  const assessmentStatus = useMemo(() => {
    const raw = (latestAssessment?.review_status || "").toLowerCase();
    switch (raw) {
      case "approved":
      case "completed":
        return "Completed";
      case "in_review":
        return "Under Review";
      case "needs_info":
        return "More Information Required";
      case "processing":
        return "Processing";
      case "pending":
      case "submitted":
        return "Submitted";
      default:
        return latestAssessment ? "Submitted" : "Draft";
    }
  }, [latestAssessment]);

  // Documents summary
  const verifiedDocsCount = documents.filter((d) => {
    const s = (d.processing_status || d.status || "").toUpperCase();
    return s === "VERIFIED";
  }).length;
  const totalDocsCount = documents.length;

  // Application Step States
  const applicationSteps = useMemo(() => {
    const reviewStat = (latestAssessment?.review_status || "").toLowerCase();

    const isSubmitted = !!latestAssessment;
    const isAiDone = !!latestAssessment;
    const isDocsVerified = totalDocsCount > 0 && verifiedDocsCount === totalDocsCount;
    const isDocsPartial = totalDocsCount > 0 && verifiedDocsCount > 0;
    const isAnalystReviewActive = reviewStat === "in_review";
    const isAnalystReviewNeedsInfo = reviewStat === "needs_info";
    const isAnalystReviewDone = ["approved", "rejected", "completed"].includes(reviewStat);
    const isFinalDone = ["approved", "rejected", "completed"].includes(reviewStat);

    return [
      {
        id: 1,
        title: "Application Submitted",
        isDone: isSubmitted,
        isCurrent: !isSubmitted,
        statusText: isSubmitted
          ? `Submitted on ${formatDate(latestAssessment?.created_at)}`
          : "Awaiting submission",
      },
      {
        id: 2,
        title: "AI Risk Assessment",
        isDone: isAiDone,
        isCurrent: isSubmitted && !isAiDone,
        statusText: isAiDone
          ? `Completed (${riskScore}/100 Risk Score)`
          : "Calculated upon application submission",
      },
      {
        id: 3,
        title: "Documents Verification",
        isDone: isDocsVerified,
        isCurrent: isAiDone && !isDocsVerified,
        statusText:
          totalDocsCount === 0
            ? "No documents uploaded yet"
            : isDocsVerified
            ? `All ${totalDocsCount} documents verified`
            : isDocsPartial
            ? `${verifiedDocsCount} of ${totalDocsCount} documents verified`
            : `${totalDocsCount} documents in review`,
      },
      {
        id: 4,
        title: "Analyst Review",
        isDone: isAnalystReviewDone,
        isCurrent: isAnalystReviewActive || isAnalystReviewNeedsInfo || reviewStat === "pending",
        isWarning: isAnalystReviewNeedsInfo,
        statusText: isAnalystReviewDone
          ? "Underwriter review concluded"
          : isAnalystReviewNeedsInfo
          ? "Action required: information requested"
          : isAnalystReviewActive
          ? "Analyst actively reviewing application"
          : isSubmitted
          ? "Queued for analyst review"
          : "Pending prior steps",
      },
      {
        id: 5,
        title: "Final Review",
        isDone: isFinalDone,
        isCurrent: isAnalystReviewDone && !isFinalDone,
        statusText: isFinalDone
          ? reviewStat === "approved"
            ? "Credit assessment complete (Approved)"
            : "Review decision finalized"
          : "Pending final underwriter determination",
      },
    ];
  }, [latestAssessment, totalDocsCount, verifiedDocsCount, riskScore]);

  // Plain-Language Factor Explanations (Translates factors into clear MSME language)
  const plainLanguageFactors = useMemo(() => {
    const rawPos = latestAssessmentDetails?.prediction?.positive_factors || [];
    const rawRisk = latestAssessmentDetails?.prediction?.risk_factors || [];

    const positive: string[] = [];
    const warnings: string[] = [];

    if (rawPos.length > 0) {
      rawPos.forEach((f: string) => positive.push(f));
    } else if (latestAssessment) {
      if (riskLevel === "LOW") {
        positive.push("Strong positive cash flow relative to debt");
        positive.push("Stable operating tenure and payment track record");
        positive.push("No recorded historical loan defaults");
      } else if (riskLevel === "MEDIUM") {
        positive.push("Consistent monthly business revenue");
        positive.push("Active utility and commercial digital transactions");
      }
    }

    if (rawRisk.length > 0) {
      rawRisk.forEach((f: string) => warnings.push(f));
    } else if (latestAssessment) {
      if (riskLevel === "HIGH") {
        warnings.push("High debt burden compared with annual revenue");
        warnings.push("Monthly expense volatility flagged");
      } else if (riskLevel === "MEDIUM") {
        warnings.push("Elevated debt leverage relative to cash flow reserves");
      }
    }

    return { positive, warnings };
  }, [latestAssessmentDetails, latestAssessment, riskLevel]);

  return (
    <div className="flex min-h-screen bg-[#030712] text-slate-100 font-sans antialiased selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* Left Sidebar */}
      <Sidebar
        active="Dashboard"
        businessName={primaryBusiness?.name}
        userName={userName}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3.5 bg-[#050b14]/90 backdrop-blur-md border-b border-[#14233a]">
          {/* Header Left: Dashboard Label */}
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-['Space_Grotesk']">
              Dashboard
            </h1>
            <span className="hidden sm:inline-block text-[11px] font-semibold text-cyan-400 bg-cyan-950/40 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
              Credit Control Center
            </span>
          </div>

          {/* Header Right: Actions, Notification Bell, Help, Profile Dropdown */}
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            {/* Notification Bell */}
            <div className="shrink-0">
              <NotificationPopover />
            </div>

            {/* Help Button */}
            <button
              onClick={() => setShowHelpModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-[#0b1626] hover:bg-[#11223b] border border-[#1b3252] transition-colors"
              title="Help & Guidance"
              aria-label="Help"
            >
              <HelpCircle className="w-4 h-4 text-cyan-400" />
              <span className="hidden md:inline">Help</span>
            </button>

            {/* User Profile Dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-[#0b1626] hover:bg-[#11223b] border border-[#1b3252] transition-all duration-200 text-left focus:outline-none"
                aria-expanded={userMenuOpen}
                aria-label="User Profile Menu"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-sm shadow-cyan-500/20 shrink-0">
                  {userName.substring(0, 2).toUpperCase()}
                </div>
                <div className="hidden sm:flex flex-col min-w-0 pr-1">
                  <span className="text-xs font-semibold text-white truncate max-w-[120px]">
                    {userName}
                  </span>
                  <span className="text-[10px] text-cyan-400 font-medium">
                    Business Owner
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    userMenuOpen ? "rotate-180 text-cyan-400" : ""
                  }`}
                />
              </button>

              {/* Profile Dropdown Menu */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#091424] border border-[#1b3252] shadow-2xl shadow-black/80 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2.5 border-b border-[#152740]">
                    <p className="text-xs font-bold text-white truncate">{userName}</p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {user?.email || "MSME Business Owner"}
                    </p>
                    <p className="text-[10px] text-cyan-400 font-medium mt-1 truncate">
                      {primaryBusiness?.name || "Business Profile"}
                    </p>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        setShowProfileModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors text-left"
                    >
                      <UserIcon className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Profile</span>
                    </button>

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate("/businesses");
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors text-left"
                    >
                      <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>My Business</span>
                    </button>

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate("/settings");
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors text-left"
                    >
                      <SettingsIcon className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Settings</span>
                    </button>
                  </div>

                  <div className="pt-1 border-t border-[#152740]">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        setShowSignOutConfirm(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors text-left font-medium"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard Main Workspace */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Analyst Role Notice (If user also has underwriting credentials) */}
          {isAnalyst && (
            <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between gap-4 text-xs text-indigo-200">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                <span>
                  <b>Institutional Underwriting Access:</b> You are signed in with Credit Risk Analyst privileges.
                </span>
              </div>
              <button
                onClick={() => navigate("/analyst")}
                className="px-3 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
              >
                <span>Analyst Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Section 5: Welcome Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-['Space_Grotesk']">
                {getGreeting()}, {userName} 👋
              </h2>
              <div className="text-base sm:text-lg font-bold text-cyan-400 mt-0.5">
                {businessName}
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Here's the latest update on your business credit assessment.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={loadUserData}
                disabled={loading}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-[#0c182a] hover:bg-[#12233c] border border-[#1b3252] transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
                <span>Refresh</span>
              </button>

              <button
                onClick={() => navigate("/assessment")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-md shadow-cyan-950/40 transition-all duration-200"
              >
                <PlusCircle className="w-4 h-4" />
                <span>New Assessment</span>
              </button>
            </div>
          </div>

          {/* Section 18: Responsible AI Transparency Disclosure */}
          <div className="p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 text-xs text-slate-300 flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-white">AI-Assisted Credit Risk Assessment</p>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                This system provides AI-assisted credit risk decision support and does not autonomously approve or reject loans.
                Your AI-generated risk assessment is available for analyst review alongside verified business documentation.
              </p>
            </div>
          </div>

          {/* Section 6: Business Summary Card */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[#091526]/80 backdrop-blur-md border border-[#162a47] shadow-xl shadow-black/40">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-6 w-48" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
            ) : primaryBusiness ? (
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-cyan-500/20 shrink-0 border border-cyan-400/20">
                    <Building2 className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight font-['Space_Grotesk']">
                        {primaryBusiness.name}
                      </h3>
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-cyan-300 border border-cyan-500/30">
                        {primaryBusiness.industry || "General Enterprise"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-400 mt-1.5">
                      <span className="flex items-center gap-1 text-slate-300">
                        📍 {primaryBusiness.location || "Not provided"}
                      </span>
                      <span>•</span>
                      <span>
                        📅 Established{" "}
                        {primaryBusiness.age
                          ? `${new Date().getFullYear() - primaryBusiness.age} (${primaryBusiness.age} yrs)`
                          : "Not provided"}
                      </span>
                      <span>•</span>
                      <span>
                        👥 {primaryBusiness.employees ? `${primaryBusiness.employees} Employees` : "Not provided"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => navigate("/businesses")}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-cyan-300 hover:text-white bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-500/30 transition-all duration-200"
                  >
                    Edit Business Profile
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2">
                <div>
                  <h4 className="text-base font-bold text-white">No Business Profile Registered</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Register your business details to enable automated credit scoring.
                  </p>
                </div>
                <button
                  onClick={() => navigate("/businesses")}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 transition-colors"
                >
                  Create Business Profile
                </button>
              </div>
            )}
          </div>

          {/* Section 9: Action Required Card (If analyst requested information) */}
          {latestAssessment?.review_status === "needs_info" ? (
            <div className="p-5 sm:p-6 rounded-2xl bg-amber-950/40 border border-amber-500/50 shadow-xl shadow-amber-950/30 space-y-3.5 animate-in fade-in duration-300">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/40 shadow-inner">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-amber-200">
                      Action Required: Information Requested
                    </h3>
                    <p className="text-xs text-amber-300/80">
                      Your credit analyst requested additional information to complete the assessment review.
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wider">
                  Attention Needed
                </span>
              </div>

              {/* Specific analyst instructions */}
              <div className="p-3.5 rounded-xl bg-black/50 border border-amber-500/30 text-xs text-amber-100/90 leading-relaxed">
                <p className="font-semibold text-amber-300 mb-1">Requested Items from Underwriter:</p>
                <p className="italic">
                  "{latestAssessment.review_notes ||
                    latestAssessmentDetails?.review_notes ||
                    "Please upload verified Q4 utility bills and latest 6-month bank statements to complete verification."}"
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={() => navigate("/documents")}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-black bg-amber-400 hover:bg-amber-300 transition-all flex items-center gap-1.5 shadow-md shadow-amber-950/40"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Documents</span>
                </button>
                <button
                  onClick={() => navigate("/assessment")}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-amber-200 hover:text-white bg-amber-950/50 hover:bg-amber-900/50 border border-amber-500/30 transition-all flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Update Financial Details</span>
                </button>
              </div>
            </div>
          ) : (
            /* Reassuring Catch-Up Banner */
            <div className="p-4 rounded-2xl bg-[#091526]/60 border border-[#162a47] flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-white block">You're all caught up</span>
                  <span className="text-slate-400 text-[11px]">
                    No action required from you right now. Your files and assessments are progressing smoothly.
                  </span>
                </div>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                All Clear ✓
              </span>
            </div>
          )}

          {/* Core Row 1: Latest Credit Assessment (Largest Card) + Application Status */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Section 7: Latest Credit Assessment (Largest card - 7 cols) */}
            <div className="lg:col-span-7 p-6 rounded-2xl bg-[#091526]/90 backdrop-blur-md border border-[#162a47] shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#162a47] pb-4 mb-5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-lg font-bold text-white font-['Space_Grotesk']">
                      Latest Credit Assessment
                    </h3>
                  </div>
                  {latestAssessment && (
                    <span className="text-xs text-slate-400">
                      Assessment ID: <b className="text-slate-200">#{latestAssessment.id}</b>
                    </span>
                  )}
                </div>

                {loading ? (
                  <div className="flex items-center justify-center p-8 space-y-3">
                    <Skeleton className="w-36 h-36 rounded-full" />
                  </div>
                ) : latestAssessment ? (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    {/* Circular Risk Visualization */}
                    <div className="md:col-span-5 flex justify-center py-2">
                      <CircularRiskGauge score={riskScore} level={riskLevel} />
                    </div>

                    {/* Risk Metric Highlights */}
                    <div className="md:col-span-7 space-y-3.5">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-[#050c18] border border-[#162a47]">
                          <span className="text-[11px] text-slate-400 block mb-0.5">Risk Score</span>
                          <span className="text-xl font-bold text-white">
                            {riskScore} <span className="text-xs font-normal text-slate-400">/ 100</span>
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-[#050c18] border border-[#162a47]">
                          <span className="text-[11px] text-slate-400 block mb-0.5">Risk Level</span>
                          <div className="mt-0.5">
                            <RiskBadge level={riskLevel} />
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-[#050c18] border border-[#162a47]">
                          <span className="text-[11px] text-slate-400 block mb-0.5">Default Probability</span>
                          <span className="text-xl font-bold text-white">
                            {defaultProb.toFixed(1)}%
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-[#050c18] border border-[#162a47]">
                          <span className="text-[11px] text-slate-400 block mb-0.5">Assessment Status</span>
                          <span className="text-xs font-semibold text-cyan-300 block truncate">
                            {assessmentStatus}
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                        <span>Assessment Date:</span>
                        <span className="font-medium text-slate-200">
                          {formatDate(latestAssessment.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Empty State: No Assessment Yet */
                  <div className="text-center py-8 px-4 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto border border-cyan-500/30">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <h4 className="text-base font-bold text-white">No credit assessment yet.</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                      Complete your business and financial information to generate your first AI-assisted risk assessment.
                    </p>
                    <div className="pt-2">
                      <button
                        onClick={() => navigate("/assessment")}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-md transition-all"
                      >
                        Start Assessment
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {latestAssessment && (
                <div className="pt-5 border-t border-[#162a47] mt-5 flex justify-end">
                  <button
                    onClick={() => navigate(`/reports?id=${latestAssessment.id}`)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-cyan-300 hover:text-white bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/30 transition-all duration-200"
                  >
                    <span>View Assessment</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Section 8: Application Status (Vertical Progress Card - 5 cols) */}
            <div className="lg:col-span-5 p-6 rounded-2xl bg-[#091526]/90 backdrop-blur-md border border-[#162a47] shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#162a47] pb-4 mb-5">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-lg font-bold text-white font-['Space_Grotesk']">
                      Application Status
                    </h3>
                  </div>
                  <span className="text-[11px] font-semibold text-cyan-300 px-2.5 py-0.5 rounded-full bg-cyan-950/50 border border-cyan-500/30">
                    {assessmentStatus}
                  </span>
                </div>

                {/* Vertical Progress Stepper */}
                <div className="space-y-4">
                  {applicationSteps.map((step, index) => {
                    const isLast = index === applicationSteps.length - 1;

                    return (
                      <div key={step.id} className="relative flex items-start gap-3">
                        {/* Connecting Line */}
                        {!isLast && (
                          <div
                            className={`absolute left-3.5 top-7 bottom-0 w-0.5 -ml-[1px] ${
                              step.isDone ? "bg-emerald-500/60" : "bg-slate-800"
                            }`}
                          />
                        )}

                        {/* Step Icon Badge */}
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 text-xs font-bold transition-all ${
                            step.isDone
                              ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
                              : step.isWarning
                              ? "bg-amber-500 text-black shadow-sm shadow-amber-500/30 animate-pulse"
                              : step.isCurrent
                              ? "bg-cyan-500 text-black shadow-sm shadow-cyan-500/30 ring-4 ring-cyan-500/20"
                              : "bg-[#0b172a] text-slate-500 border border-slate-800"
                          }`}
                        >
                          {step.isDone ? (
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          ) : step.isWarning ? (
                            "!"
                          ) : (
                            step.id
                          )}
                        </div>

                        {/* Step Details */}
                        <div className="flex-1 min-w-0 pb-1">
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-xs font-bold ${
                                step.isDone
                                  ? "text-white"
                                  : step.isWarning
                                  ? "text-amber-300"
                                  : step.isCurrent
                                  ? "text-cyan-300"
                                  : "text-slate-400"
                              }`}
                            >
                              {step.title}
                            </span>
                            {step.isDone && (
                              <span className="text-[10px] text-emerald-400 font-semibold">Done</span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                            {step.statusText}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-[#162a47] mt-5 flex justify-end">
                <button
                  onClick={() =>
                    navigate(latestAssessment ? `/reports?id=${latestAssessment.id}` : "/assessment")
                  }
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-[#0e1e35] hover:bg-[#142948] border border-[#1b3252] transition-colors"
                >
                  <span>View Details</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Core Row 2: Business Health + Why is my risk X? + Documents */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Section 10: Business Health Card */}
            <div className="p-6 rounded-2xl bg-[#091526]/90 backdrop-blur-md border border-[#162a47] shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#162a47] pb-3.5 mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-base font-bold text-white font-['Space_Grotesk']">
                      Business Health
                    </h3>
                  </div>
                  {healthScore !== null && (
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                      {healthScore >= 70 ? "Strong" : healthScore >= 45 ? "Moderate" : "Fragile"}
                    </span>
                  )}
                </div>

                {/* Business Health Score */}
                <div className="p-4 rounded-xl bg-[#050c18] border border-[#162a47] mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-400">Business Health Score</span>
                    <span className="text-xl font-extrabold text-white">
                      {healthScore !== null ? healthScore : "N/A"}{" "}
                      <span className="text-xs font-normal text-slate-400">/ 100</span>
                    </span>
                  </div>

                  <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        (healthScore ?? 0) >= 70
                          ? "bg-emerald-500"
                          : (healthScore ?? 0) >= 45
                          ? "bg-amber-500"
                          : "bg-rose-500"
                      }`}
                      style={{ width: `${healthScore ?? 0}%` }}
                    />
                  </div>
                </div>

                {/* 5 Specific Financial Metrics */}
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/40">
                    <span className="text-slate-400">Annual Revenue</span>
                    <span className="font-bold text-white font-mono">
                      {latestAssessment?.annual_revenue != null
                        ? formatCurrency(latestAssessment.annual_revenue)
                        : latestAssessmentDetails?.financials?.annual_revenue != null
                        ? formatCurrency(latestAssessmentDetails.financials.annual_revenue)
                        : "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/40">
                    <span className="text-slate-400">Monthly Cash Flow</span>
                    <span className="font-bold text-white font-mono">
                      {latestAssessmentDetails?.financials?.monthly_cash_flow != null
                        ? formatCurrency(latestAssessmentDetails.financials.monthly_cash_flow)
                        : "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/40">
                    <span className="text-slate-400">Existing Debt</span>
                    <span className="font-bold text-white font-mono">
                      {latestAssessmentDetails?.financials?.existing_debt != null
                        ? formatCurrency(latestAssessmentDetails.financials.existing_debt)
                        : "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/40">
                    <span className="text-slate-400">Employees</span>
                    <span className="font-semibold text-slate-200">
                      {primaryBusiness?.employees != null ? primaryBusiness.employees : "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/40">
                    <span className="text-slate-400">Business Age</span>
                    <span className="font-semibold text-slate-200">
                      {primaryBusiness?.age != null ? `${primaryBusiness.age} years` : "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 11: Why is my risk LOW/MEDIUM/HIGH? Card */}
            <div className="p-6 rounded-2xl bg-[#091526]/90 backdrop-blur-md border border-[#162a47] shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#162a47] pb-3.5 mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-base font-bold text-white font-['Space_Grotesk']">
                      Why is your risk {riskLevel}?
                    </h3>
                  </div>
                  <RiskBadge level={riskLevel} />
                </div>

                <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                  Key financial signals influencing your AI-assisted underwriting assessment:
                </p>

                {/* Factors List */}
                <div className="space-y-2 text-xs">
                  {/* Positive factors */}
                  {plainLanguageFactors.positive.map((factor, idx) => (
                    <div
                      key={`pos-${idx}`}
                      className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-slate-200 flex items-start gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="leading-snug">{factor}</span>
                    </div>
                  ))}

                  {/* Warning / Risk factors */}
                  {plainLanguageFactors.warnings.map((factor, idx) => (
                    <div
                      key={`warn-${idx}`}
                      className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/20 text-slate-200 flex items-start gap-2"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span className="leading-snug">{factor}</span>
                    </div>
                  ))}

                  {!latestAssessment && (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      Submit an assessment to see detailed risk contributors.
                    </div>
                  )}
                </div>
              </div>

              {latestAssessment && (
                <div className="pt-4 border-t border-[#162a47] mt-4 flex justify-end">
                  <button
                    onClick={() => navigate(`/reports?id=${latestAssessment.id}`)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    <span>View Detailed Assessment</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Section 12: Documents Card */}
            <div className="p-6 rounded-2xl bg-[#091526]/90 backdrop-blur-md border border-[#162a47] shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#162a47] pb-3.5 mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-base font-bold text-white font-['Space_Grotesk']">
                      Documents
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-cyan-300">
                    {verifiedDocsCount} / {totalDocsCount} verified
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden mb-4">
                  <div
                    className="bg-cyan-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${totalDocsCount > 0 ? (verifiedDocsCount / totalDocsCount) * 100 : 0}%`,
                    }}
                  />
                </div>

                {/* Documents List */}
                {totalDocsCount > 0 ? (
                  <div className="space-y-2">
                    {documents.slice(0, 4).map((doc) => {
                      const status = (doc.processing_status || doc.status || "UPLOADED").toUpperCase();
                      const isVerified = status === "VERIFIED";
                      const isNeedsReview = status === "REVIEW_REQUIRED" || status === "NEEDS_REVIEW";

                      return (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-[#050c18] border border-[#162a47] text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            {isVerified ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            ) : isNeedsReview ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            ) : (
                              <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            )}
                            <span className="truncate text-slate-200 text-xs">
                              {doc.original_filename || doc.filename}
                            </span>
                          </div>

                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                              isVerified
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                : isNeedsReview
                                ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                : "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                            }`}
                          >
                            {status === "VERIFIED"
                              ? "Verified"
                              : status === "REVIEW_REQUIRED"
                              ? "Needs Review"
                              : status === "PROCESSING"
                              ? "Processing"
                              : "Uploaded"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400 text-xs space-y-2">
                    <p>No documents uploaded yet.</p>
                    <button
                      onClick={() => navigate("/documents")}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 hover:bg-cyan-900/40 transition-colors"
                    >
                      Upload Documents
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-[#162a47] mt-4 flex justify-end">
                <button
                  onClick={() => navigate("/documents")}
                  className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <span>Manage Documents</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Core Row 3: Assessment History (Left 8 cols) + Quick Actions (Right 4 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Section 13: Assessment History Table (8 cols) */}
            <div className="lg:col-span-8 p-6 rounded-2xl bg-[#091526]/90 backdrop-blur-md border border-[#162a47] shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#162a47] pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-lg font-bold text-white font-['Space_Grotesk']">
                      Assessment History
                    </h3>
                  </div>
                  <button
                    onClick={() => navigate("/reports")}
                    className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <span>View All</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {assessments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#142640] text-slate-400 uppercase tracking-wider text-[11px]">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Risk Level</th>
                          <th className="py-2.5 px-3">Default Prob.</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#12233b]">
                        {assessments.slice(0, 5).map((a) => (
                          <tr key={a.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-3 font-medium text-slate-200">
                              {formatShortDate(a.created_at)}
                            </td>
                            <td className="py-3 px-3">
                              <RiskBadge level={a.risk_level} />
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-300">
                              {a.default_probability.toFixed(1)}%
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  a.review_status === "approved"
                                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                    : a.review_status === "in_review"
                                    ? "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                                    : a.review_status === "needs_info"
                                    ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                    : "bg-slate-700/40 text-slate-300 border border-slate-700"
                                }`}
                              >
                                {a.review_status === "approved"
                                  ? "Completed"
                                  : a.review_status === "in_review"
                                  ? "Under Review"
                                  : a.review_status === "needs_info"
                                  ? "Action Req."
                                  : "Submitted"}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => navigate(`/reports?id=${a.id}`)}
                                className="text-cyan-400 hover:text-cyan-300 font-medium inline-flex items-center gap-1 text-[11px]"
                              >
                                <span>Report</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No historical assessments recorded.
                  </div>
                )}
              </div>
            </div>

            {/* Section 14: Quick Actions (4 cols) */}
            <div className="lg:col-span-4 p-6 rounded-2xl bg-[#091526]/90 backdrop-blur-md border border-[#162a47] shadow-xl flex flex-col justify-between">
              <div>
                <div className="border-b border-[#162a47] pb-4 mb-4">
                  <h3 className="text-lg font-bold text-white font-['Space_Grotesk']">
                    Quick Actions
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Common management actions for your business
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  <button
                    onClick={() => navigate("/businesses")}
                    className="group flex items-center justify-between p-3 rounded-xl bg-[#050c18] hover:bg-[#0c182c] border border-[#162a47] hover:border-cyan-500/40 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-cyan-400 flex items-center justify-center border border-cyan-500/20 group-hover:scale-105 transition-transform">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block group-hover:text-cyan-300 transition-colors">
                          Update Business Profile
                        </span>
                        <span className="text-[10px] text-slate-400">Legal info, age, headcount</span>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                  </button>

                  <button
                    onClick={() => navigate("/documents")}
                    className="group flex items-center justify-between p-3 rounded-xl bg-[#050c18] hover:bg-[#0c182c] border border-[#162a47] hover:border-cyan-500/40 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/20 group-hover:scale-105 transition-transform">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block group-hover:text-emerald-300 transition-colors">
                          Upload Documents
                        </span>
                        <span className="text-[10px] text-slate-400">GST, bank records, invoices</span>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                  </button>

                  <button
                    onClick={() => navigate("/assessment")}
                    className="group flex items-center justify-between p-3 rounded-xl bg-[#050c18] hover:bg-[#0c182c] border border-[#162a47] hover:border-cyan-500/40 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center border border-cyan-500/20 group-hover:scale-105 transition-transform">
                        <PlusCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block group-hover:text-cyan-300 transition-colors">
                          Start New Assessment
                        </span>
                        <span className="text-[10px] text-slate-400">Evaluate fresh cycle risk</span>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                  </button>

                  <button
                    onClick={() => navigate("/reports")}
                    className="group flex items-center justify-between p-3 rounded-xl bg-[#050c18] hover:bg-[#0c182c] border border-[#162a47] hover:border-cyan-500/40 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center border border-purple-500/20 group-hover:scale-105 transition-transform">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block group-hover:text-purple-300 transition-colors">
                          View Reports
                        </span>
                        <span className="text-[10px] text-slate-400">Download risk certificates</span>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-400 transition-colors" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 15: Recent Notifications */}
          <div className="p-6 rounded-2xl bg-[#091526]/90 backdrop-blur-md border border-[#162a47] shadow-xl">
            <div className="flex items-center justify-between border-b border-[#162a47] pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-bold text-white font-['Space_Grotesk']">
                  Recent Notifications
                </h3>
              </div>
              <button
                onClick={() => navigate("/settings?tab=alerts")}
                className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {notifications.length > 0 ? (
              <div className="space-y-3">
                {notifications.slice(0, 4).map((n) => {
                  const isWarning = n.type === "warning" || n.type === "alert";
                  const isSuccess = n.type === "success";

                  return (
                    <div
                      key={n.id}
                      className="flex items-start justify-between p-3.5 rounded-xl bg-[#050c18] border border-[#162a47] gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                            isSuccess
                              ? "bg-emerald-400 ring-4 ring-emerald-500/20"
                              : isWarning
                              ? "bg-amber-400 ring-4 ring-amber-500/20"
                              : "bg-cyan-400 ring-4 ring-cyan-500/20"
                          }`}
                        />
                        <div>
                          <p className="text-xs font-bold text-white">{n.title}</p>
                          <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                            {n.message}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-500 shrink-0 whitespace-nowrap">
                        {formatShortDate(n.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>You're all caught up. No recent notifications.</span>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Section 16: User Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-[#091526] border border-[#1b3252] shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#162a47] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-cyan-400" />
                <span>Profile</span>
              </h3>
              <button
                onClick={() => setShowProfileModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Avatar & Header */}
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-cyan-900/40 border border-cyan-400/20">
                {userName.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h4 className="text-base font-bold text-white">{userName}</h4>
                <span className="text-xs font-semibold text-cyan-400">Business Owner</span>
              </div>
            </div>

            {/* Profile Attributes List */}
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#050c18] border border-[#162a47]">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-cyan-400" /> Email:
                </span>
                <span className="font-semibold text-slate-200">
                  {userProfile?.email || user?.email || "Not provided"}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#050c18] border border-[#162a47]">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-cyan-400" /> Phone:
                </span>
                <span className="font-semibold text-slate-200">
                  {user?.phoneNumber || userProfile?.settings?.phone || "Not provided"}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#050c18] border border-[#162a47]">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-cyan-400" /> Business:
                </span>
                <span className="font-semibold text-slate-200">
                  {primaryBusiness?.name || "Not provided"}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#050c18] border border-[#162a47]">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-cyan-400" /> Role:
                </span>
                <span className="font-bold text-cyan-300">MSME User</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#050c18] border border-[#162a47]">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Account Status:
                </span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Active
                </span>
              </div>
            </div>

            {/* Profile Action Buttons */}
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  navigate("/settings");
                }}
                className="w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 transition-colors"
              >
                Edit Profile
              </button>
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  navigate("/settings");
                }}
                className="w-full py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-[#0e1e35] hover:bg-[#142948] border border-[#1b3252] transition-colors"
              >
                Settings
              </button>
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  setShowSignOutConfirm(true);
                }}
                className="w-full py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl bg-[#091526] border border-[#1b3252] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#162a47] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-cyan-400" />
                <span>Borrower Guidance & Support</span>
              </h3>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
              <div className="p-3 rounded-xl bg-[#050c18] border border-[#162a47]">
                <h4 className="font-bold text-white mb-1">1. How Credit Risk is Assessed</h4>
                <p className="text-slate-400">
                  MSME Risk AI evaluates your business financials (revenue, cash flow, existing debt) alongside alternative signals (utility payment consistency, transaction frequency) using machine learning decision-support models.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#050c18] border border-[#162a47]">
                <h4 className="font-bold text-white mb-1">2. Understanding Risk Scores</h4>
                <p className="text-slate-400">
                  Scores range from 0 to 100. Lower scores indicate lower default risk:
                  <span className="block mt-1 text-emerald-300">• 0 - 30: LOW RISK (Optimal credit profile)</span>
                  <span className="block text-amber-300">• 31 - 70: MEDIUM RISK (Standard credit profile)</span>
                  <span className="block text-rose-300">• 71 - 100: HIGH RISK (Elevated scrutiny required)</span>
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#050c18] border border-[#162a47]">
                <h4 className="font-bold text-white mb-1">3. What if Action is Required?</h4>
                <p className="text-slate-400">
                  If an underwriter requests more information, check the Action Required card on this dashboard. Upload the requested GST returns or bank statements in the Documents tab.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-cyan-200">
                <h4 className="font-bold text-white mb-1">4. Human Underwriter Authority</h4>
                <p className="text-cyan-300 text-[11px]">
                  All final lending decisions remain strictly with authorized human financial credit officers. This platform provides decision-support estimation only.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sign Out Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        onConfirm={handleSignOut}
        title="Sign Out"
        message="Are you sure you want to sign out of your business credit dashboard?"
        confirmText="Sign out"
        variant="danger"
        loading={signingOut}
      />
    </div>
  );
}
