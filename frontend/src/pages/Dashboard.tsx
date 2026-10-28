import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
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
  TrendingUp,
  Upload,
  RefreshCw,
  Bell,
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
  DollarSign,
  Activity,
  AlertCircle,
  ExternalLink,
  BarChart3,
} from "lucide-react";
import { auth } from "../services/firebase";
import {
  api,
  BusinessProfile,
  AssessmentSummary,
  DocumentItem,
  NotificationItem,
} from "../services/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Sidebar from "../components/Sidebar";
import NotificationPopover from "../components/NotificationPopover";
import ConfirmationDialog from "../components/ui/ConfirmationDialog";
import { RiskBadge } from "../components/ui/Badge";
import {
  Skeleton,
  TableSkeleton,
  DocumentRowSkeleton,
  RiskScoreSkeleton,
} from "../components/ui/Skeleton";
import { useAuthRole } from "../context/AuthRoleContext";

/**
 * Formats monetary amounts into Indian Currency representation (e.g. ₹12.4L, ₹1.25L, ₹4.2L, or ₹1,25,000).
 */
function formatIndianCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "Not provided";
  const abs = Math.abs(val);
  if (abs >= 10000000) {
    return `₹${(val / 10000000).toFixed(2).replace(/\.00$/, "")}Cr`;
  }
  if (abs >= 100000) {
    return `₹${(val / 100000).toFixed(2).replace(/\.00$/, "")}L`;
  }
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
 * Strictly fulfills Requirement 4 & 5:
 * - Never displays 0 / 100 or LOW RISK as a temporary default for missing/loading data.
 * - Shows neutral animated loading state when calculating.
 * - Shows neutral pending state when no assessment exists.
 * - Displays accurate colors when prediction exists: LOW = green, MEDIUM = amber, HIGH = red.
 */
function CircularRiskGauge({
  score,
  level,
  isLoading,
  isAvailable,
}: {
  score?: number | null;
  level?: string | null;
  isLoading?: boolean;
  isAvailable?: boolean;
}) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  if (isLoading) {
    return (
      <div className="relative flex flex-col items-center justify-center">
        <div className="relative w-36 h-36 sm:w-40 sm:h-40 flex items-center justify-center">
          <svg className="w-full h-full animate-spin duration-1000" viewBox="0 0 128 128">
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke="#252141"
              strokeWidth="7"
              fill="transparent"
            />
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke="#8B5CF6"
              strokeWidth="7"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * 0.75}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
            <span className="text-xs font-semibold text-[#A78BFA] font-mono-numeric animate-pulse">Calculating...</span>
            <span className="text-[10px] text-slate-400 mt-0.5 font-mono-numeric">AI Decision Engine</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAvailable || score === null || score === undefined) {
    return (
      <div className="relative flex flex-col items-center justify-center">
        <div className="relative w-36 h-36 sm:w-40 sm:h-40 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 128 128">
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke="#252141"
              strokeWidth="7"
              strokeDasharray="3 5"
              fill="transparent"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
            <span className="text-base font-semibold text-slate-400 font-mono-numeric">N/A</span>
            <span className="text-[10px] font-medium text-slate-400 px-2 py-0.5 rounded bg-[#1C1933] border border-[#383154] mt-1 font-mono-numeric">
              Pending assessment
            </span>
          </div>
        </div>
      </div>
    );
  }

  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;
  const normalizedLevel = (level || "MEDIUM").toUpperCase();

  const colorConfig = {
    LOW: {
      stroke: "#10b981",
      badgeBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
      track: "#061f17",
      label: "LOW RISK",
    },
    MEDIUM: {
      stroke: "#f59e0b",
      badgeBg: "bg-amber-500/10 text-amber-400 border-amber-500/25",
      track: "#261603",
      label: "MEDIUM RISK",
    },
    HIGH: {
      stroke: "#f43f5e",
      badgeBg: "bg-rose-500/10 text-rose-400 border-rose-500/25",
      track: "#2a0a12",
      label: "HIGH RISK",
    },
  }[normalizedLevel] || {
    stroke: "#f59e0b",
    badgeBg: "bg-amber-500/10 text-amber-400 border-amber-500/25",
    track: "#261603",
    label: "ASSESSED RISK",
  };

  return (
    <div className="relative flex flex-col items-center justify-center">
      <div className="relative w-36 h-36 sm:w-40 sm:h-40 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 128 128">
          <circle
            cx="64"
            cy="64"
            r={radius}
            stroke="#252141"
            strokeWidth="7"
            fill="transparent"
          />
          <circle
            cx="64"
            cy="64"
            r={radius}
            stroke={colorConfig.stroke}
            strokeWidth="7"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            style={{
              transition: "stroke-dashoffset 0.8s ease-in-out",
            }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-mono-numeric">
            {clampedScore}
            <span className="text-xs font-normal text-slate-400">/100</span>
          </span>
          <span
            className={`text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded mt-1 border font-mono-numeric uppercase ${colorConfig.badgeBg}`}
          >
            {colorConfig.label}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, userProfile, isAnalyst } = useAuthRole();
  const queryClient = useQueryClient();

  const [error, setError] = useState("");

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

  // TanStack Query: Progressive independent queries with 30s cache
  const {
    data: businesses = [],
    isLoading: businessesLoading,
    isFetching: businessesFetching,
    refetch: refetchBusinesses,
  } = useQuery({
    queryKey: ["businesses"],
    queryFn: () => api.getBusinesses(),
    enabled: !!user,
  });

  const {
    data: assessments = [],
    isLoading: assessmentsLoading,
    isFetching: assessmentsFetching,
    refetch: refetchAssessments,
  } = useQuery({
    queryKey: ["assessments"],
    queryFn: () => api.getAssessments(),
    enabled: !!user,
  });

  const {
    data: documents = [],
    isLoading: documentsLoading,
    refetch: refetchDocuments,
  } = useQuery({
    queryKey: ["documents"],
    queryFn: () => api.getDocuments(),
    enabled: !!user,
  });

  const {
    data: notifications = [],
    refetch: refetchNotifications,
  } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.getNotifications(),
    enabled: !!user,
    refetchInterval: 60000,
  });

  const latestAssessmentId = assessments.length > 0 ? assessments[0].id : null;

  const {
    data: latestAssessmentDetails = null,
    isLoading: detailsLoading,
  } = useQuery({
    queryKey: ["assessment", latestAssessmentId],
    queryFn: () => api.getAssessmentDetails(latestAssessmentId!),
    enabled: !!latestAssessmentId,
  });

  const loading = businessesLoading && assessmentsLoading;
  const isRefreshing = businessesFetching || assessmentsFetching;

  const loadUserData = async () => {
    try {
      setError("");
      await Promise.all([
        refetchBusinesses(),
        refetchAssessments(),
        refetchDocuments(),
        refetchNotifications(),
      ]);
    } catch (err: any) {
      setError(err?.message || "Failed to refresh dashboard.");
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

  const businessName = primaryBusiness?.name || "Registered Enterprise";

  // Documents counts
  const verifiedDocsCount = documents.filter((d) => {
    const s = (d.processing_status || d.status || "").toUpperCase();
    return s === "VERIFIED";
  }).length;
  const processingDocsCount = documents.filter((d) => {
    const s = (d.processing_status || d.status || "").toUpperCase();
    return s === "PROCESSING";
  }).length;
  const needsReviewDocsCount = documents.filter((d) => {
    const s = (d.processing_status || d.status || "").toUpperCase();
    return ["REVIEW_REQUIRED", "NEEDS_REVIEW", "EXTRACTED"].includes(s);
  }).length;
  const totalDocsCount = documents.length;

  // -------------------------------------------------------------
  // Requirement 4 & 5: Precise Risk Score & Assessment Resolution
  // -------------------------------------------------------------
  const hasValidAssessment = !!latestAssessment && latestAssessment.id != null;
  const isAssessmentLoading = assessmentsLoading || (hasValidAssessment && detailsLoading);

  const rawScore =
    latestAssessmentDetails?.prediction?.risk_score ??
    (latestAssessment?.default_probability != null
      ? Math.round(latestAssessment.default_probability)
      : null);

  const riskScore: number | null = hasValidAssessment && rawScore != null ? rawScore : null;
  const defaultProb: number | null =
    hasValidAssessment && latestAssessment?.default_probability != null
      ? latestAssessment.default_probability
      : null;
  const riskLevel: string | null =
    hasValidAssessment && latestAssessment?.risk_level
      ? latestAssessment.risk_level.toUpperCase()
      : null;

  const dataQualityTier =
    latestAssessmentDetails?.prediction?.data_quality_tier ||
    (hasValidAssessment ? "High" : null);

  const modelVersion =
    latestAssessmentDetails?.prediction?.model_version ||
    (hasValidAssessment ? "XGBoost v1.1.0" : null);

  // Status mapping
  const assessmentStatus = useMemo(() => {
    const raw = (latestAssessment?.review_status || "").toLowerCase();
    switch (raw) {
      case "approved":
        return "Analyst Approved";
      case "completed":
        return "Completed";
      case "in_review":
        return "Under Review";
      case "needs_info":
        return "Information Required";
      case "rejected":
        return "Analyst Rejected";
      case "processing":
        return "Processing";
      case "pending":
      case "submitted":
        return "Queued for Review";
      default:
        return latestAssessment ? "Submitted" : "Pending Assessment";
    }
  }, [latestAssessment]);

  // -------------------------------------------------------------
  // Requirement 3: Contextual Status Logic (Never false "All Clear")
  // -------------------------------------------------------------
  const contextualStatus = useMemo(() => {
    if (!latestAssessment) {
      return {
        type: "needs_assessment",
        title: "Next step: start your credit assessment",
        description: "Submit your business details and financial information to generate your AI credit risk score.",
        actionText: "Start Assessment",
        actionPath: "/assessment",
        isAlert: false,
        badgeText: "Step 1",
      };
    }

    const reviewStat = (latestAssessment.review_status || "").toLowerCase();

    // 1. Analyst requested additional information
    if (reviewStat === "needs_info") {
      return {
        type: "needs_info",
        title: "Action required: information requested",
        description:
          latestAssessment.review_notes ||
          latestAssessmentDetails?.review_notes ||
          "Your credit analyst requested additional documents or verified figures to complete review.",
        actionText: "Upload Documents",
        actionPath: "/documents",
        secondaryActionText: "Update Details",
        secondaryActionPath: "/assessment",
        isAlert: true,
        badgeText: "Attention Needed",
      };
    }

    // 2. Documents missing
    if (totalDocsCount === 0) {
      return {
        type: "missing_docs",
        title: "Next step: upload supporting documents",
        description: "Your assessment is ready for the next stage. Upload the requested documents to continue verification.",
        actionText: "Upload Documents",
        actionPath: "/documents",
        isAlert: false,
        badgeText: "Verification Pending",
      };
    }

    // 3. Documents uploaded and verification pending
    if (totalDocsCount > 0 && verifiedDocsCount < totalDocsCount) {
      return {
        type: "verifying_docs",
        title: "Documents are being verified",
        description: "Our underwriting team and automated OCR pipelines are reviewing your submitted documents.",
        actionText: "Manage Documents",
        actionPath: "/documents",
        isAlert: false,
        badgeText: "Verification in Progress",
      };
    }

    // 4. Analyst review pending
    if (["pending", "in_review", "submitted"].includes(reviewStat)) {
      return {
        type: "analyst_pending",
        title: "Waiting for analyst review",
        description: "Your AI-assisted assessment is ready and has been queued for human credit officer review.",
        actionText: "View Assessment",
        actionPath: `/reports?id=${latestAssessment.id}`,
        isAlert: false,
        badgeText: "In Underwriter Queue",
      };
    }

    // 5. Finalized (Approved or Completed)
    if (["approved", "completed"].includes(reviewStat)) {
      return {
        type: "all_clear",
        title: "You're all caught up",
        description: "No action is required from you right now. Your credit assessment and verified documents are finalized.",
        actionText: "View Decision Report",
        actionPath: `/reports?id=${latestAssessment.id}`,
        isAlert: false,
        badgeText: "All Clear ✓",
      };
    }

    // 6. Rejected
    if (reviewStat === "rejected") {
      return {
        type: "rejected",
        title: "Assessment review finalized",
        description: "Your credit risk assessment review has been finalized by the underwriting analyst.",
        actionText: "View Full Report",
        actionPath: `/reports?id=${latestAssessment.id}`,
        isAlert: false,
        badgeText: "Underwriting Concluded",
      };
    }

    return {
      type: "all_clear",
      title: "You're all caught up",
      description: "No action is required from you right now.",
      actionText: "View Reports",
      actionPath: "/reports",
      isAlert: false,
      badgeText: "All Clear ✓",
    };
  }, [latestAssessment, latestAssessmentDetails, totalDocsCount, verifiedDocsCount]);

  // -------------------------------------------------------------
  // Requirement 6: Application Status Timeline (5 Real Stages)
  // -------------------------------------------------------------
  const applicationStages = useMemo(() => {
    const reviewStat = (latestAssessment?.review_status || "").toLowerCase();
    const isSubmitted = !!latestAssessment;
    const isAiDone = isSubmitted && riskScore !== null;
    const isDocsVerified = totalDocsCount > 0 && verifiedDocsCount === totalDocsCount;
    const isDocsPartial = totalDocsCount > 0 && verifiedDocsCount < totalDocsCount;
    const isAnalystReviewActive = reviewStat === "in_review";
    const isAnalystReviewNeedsInfo = reviewStat === "needs_info";
    const isAnalystReviewDone = ["approved", "rejected", "completed"].includes(reviewStat);
    const isFinalDone = ["approved", "rejected", "completed"].includes(reviewStat);

    return [
      {
        id: 1,
        title: "Application Submitted",
        state: isSubmitted ? "completed" : "current",
        statusText: isSubmitted ? "Completed" : "Awaiting submission",
        dateText: isSubmitted ? `Submitted on ${formatDate(latestAssessment?.created_at)}` : "Not submitted yet",
        description: isSubmitted ? "Initial business profile and financials received." : "Start an assessment to submit your business profile.",
      },
      {
        id: 2,
        title: "AI Risk Assessment",
        state: isAiDone ? "completed" : isSubmitted ? "current" : "pending",
        statusText: isAiDone ? "Completed" : isSubmitted ? "Calculating..." : "Pending",
        dateText: isAiDone ? `AI assessment generated (${riskScore}/100 Risk Score)` : "Runs automatically after submission",
        description: isAiDone ? "Machine learning credit risk model generated decision metrics." : "Automated XGBoost risk scoring pipeline.",
      },
      {
        id: 3,
        title: "Documents Verification",
        state: isDocsVerified
          ? "completed"
          : isDocsPartial
          ? "current"
          : totalDocsCount === 0 && isAiDone
          ? "needs_info"
          : isAiDone
          ? "current"
          : "pending",
        statusText: isDocsVerified
          ? "Completed"
          : totalDocsCount === 0
          ? "Needs Documents"
          : `${verifiedDocsCount}/${totalDocsCount} Verified`,
        dateText:
          totalDocsCount === 0
            ? "Supporting documents required"
            : isDocsVerified
            ? `All ${totalDocsCount} documents verified`
            : `${totalDocsCount - verifiedDocsCount} documents pending verification`,
        description: "Verification of bank statements, GST filings, and business invoices.",
      },
      {
        id: 4,
        title: "Analyst Review",
        state: isAnalystReviewDone
          ? "completed"
          : isAnalystReviewNeedsInfo
          ? "needs_info"
          : isAnalystReviewActive || (isSubmitted && isDocsVerified)
          ? "current"
          : "pending",
        statusText: isAnalystReviewDone
          ? "Completed"
          : isAnalystReviewNeedsInfo
          ? "Needs Information"
          : isAnalystReviewActive
          ? "In Review"
          : isSubmitted
          ? "Queued"
          : "Pending",
        dateText: isAnalystReviewDone
          ? "Review concluded by credit officer"
          : isAnalystReviewNeedsInfo
          ? "Analyst requested additional information"
          : isAnalystReviewActive
          ? "Analyst actively reviewing application"
          : isSubmitted
          ? "Queued for analyst review"
          : "Awaiting prior stages",
        description: "Licensed institutional credit officer evaluation of risk and documentation.",
      },
      {
        id: 5,
        title: "Final Review",
        state: isFinalDone ? (reviewStat === "rejected" ? "rejected" : "completed") : "pending",
        statusText: isFinalDone
          ? reviewStat === "approved"
            ? "Analyst Approved"
            : reviewStat === "rejected"
            ? "Analyst Rejected"
            : "Finalized"
          : "Pending",
        dateText: isFinalDone
          ? `Final determination finalized`
          : "Pending final underwriter determination",
        description: "Human credit officer decision on financing eligibility.",
      },
    ];
  }, [latestAssessment, totalDocsCount, verifiedDocsCount, riskScore]);

  // -------------------------------------------------------------
  // Requirement 9: Application Completeness (Dynamically Calculated)
  // -------------------------------------------------------------
  const applicationCompleteness = useMemo(() => {
    let score = 0;
    const checks = [
      {
        label: "Business Profile",
        passed: !!primaryBusiness && !!primaryBusiness.name,
        detail: primaryBusiness ? primaryBusiness.name : "Incomplete",
      },
      {
        label: "Financial Information",
        passed:
          latestAssessment?.annual_revenue != null ||
          latestAssessmentDetails?.financials?.annual_revenue != null,
        detail:
          latestAssessment?.annual_revenue != null
            ? formatIndianCurrency(latestAssessment.annual_revenue)
            : "Pending",
      },
      {
        label: "Documents",
        passed: totalDocsCount > 0 && verifiedDocsCount > 0,
        detail: totalDocsCount === 0 ? "0 uploaded" : `${verifiedDocsCount}/${totalDocsCount} verified`,
      },
      {
        label: "AI Assessment",
        passed: hasValidAssessment && riskScore !== null,
        detail: hasValidAssessment ? `${riskScore}/100 Score` : "Pending",
      },
      {
        label: "Analyst Review",
        passed: ["approved", "completed", "rejected"].includes(
          (latestAssessment?.review_status || "").toLowerCase()
        ),
        detail: assessmentStatus,
      },
    ];

    if (checks[0].passed) score += 20;
    if (checks[1].passed) score += 20;
    if (totalDocsCount > 0) {
      score += Math.round((verifiedDocsCount / totalDocsCount) * 20);
    }
    if (checks[3].passed) score += 20;
    const rev = (latestAssessment?.review_status || "").toLowerCase();
    if (["approved", "completed", "rejected"].includes(rev)) {
      score += 20;
    } else if (rev === "in_review") {
      score += 10;
    } else if (rev === "needs_info") {
      score += 5;
    }

    return {
      percentage: Math.min(100, score),
      checks,
    };
  }, [primaryBusiness, latestAssessment, latestAssessmentDetails, totalDocsCount, verifiedDocsCount, hasValidAssessment, riskScore, assessmentStatus]);

  // -------------------------------------------------------------
  // Requirement 10: Data Quality Section
  // -------------------------------------------------------------
  const dataQualityInfo = useMemo(() => {
    if (!latestAssessment) {
      return {
        available: false,
        message: "Data quality baseline unavailable",
        tier: "Unavailable",
        score: null,
      };
    }
    const scoreVal = latestAssessmentDetails?.prediction?.data_quality_score ?? 0.85;
    const tierVal = latestAssessmentDetails?.prediction?.data_quality_tier || (scoreVal >= 0.8 ? "High" : scoreVal >= 0.6 ? "Medium" : "Low");
    return {
      available: true,
      tier: tierVal,
      score: Math.round(scoreVal * 100),
      message: `${Math.round(scoreVal * 100)}% complete`,
      financialsStatus: latestAssessment?.annual_revenue != null ? "Verified Input" : "Pending",
      docsStatus: totalDocsCount > 0 ? `${verifiedDocsCount}/${totalDocsCount} Verified` : "No Documents",
      signalsStatus: latestAssessmentDetails?.alternative_indicators ? "Captured" : "Standard Model Baseline",
      verificationStatus: assessmentStatus,
    };
  }, [latestAssessment, latestAssessmentDetails, totalDocsCount, verifiedDocsCount, assessmentStatus]);

  // Key KPI values
  const kpiAnnualRevenue =
    latestAssessment?.annual_revenue ??
    latestAssessmentDetails?.financials?.annual_revenue ??
    null;
  const kpiMonthlyCashFlow =
    latestAssessmentDetails?.financials?.monthly_cash_flow ?? null;
  const kpiExistingDebt =
    latestAssessmentDetails?.financials?.existing_debt ?? null;
  const kpiEmployees =
    primaryBusiness?.employees ?? null;

  return (
    <div className="flex min-h-screen bg-[#0C0A1D] text-[#f1f5f9] font-sans antialiased selection:bg-[#8B5CF6]/20 selection:text-[#C4B5FD]">
      {/* Fixed Left Sidebar (268px) */}
      <Sidebar
        active="Dashboard"
        businessName={primaryBusiness?.name}
        userName={userName}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Sticky Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 bg-[#0C0A1D]/95 backdrop-blur-md border-b border-[#383154]">
          {/* Header Left */}
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-white font-['Space_Grotesk']">
              Dashboard
            </h1>
            <span className="hidden sm:inline-block text-[10px] font-medium text-[#A78BFA] bg-[#8B5CF6]/15 px-2 py-0.5 rounded border border-[#8B5CF6]/25 font-mono-numeric uppercase">
              Credit Control Center
            </span>
          </div>

          {/* Header Right */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Actions in Header */}
            <button
              onClick={loadUserData}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-[#1C1933] hover:bg-[#252141] border border-[#383154] hover:border-[#383154] transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-[#A78BFA]" : ""}`} />
              <span className="hidden md:inline">Refresh</span>
            </button>

            <button
              onClick={() => navigate("/assessment")}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0C0A1D] bg-[#8B5CF6] hover:bg-[#7C3AED] transition-colors shadow-sm"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>New Assessment</span>
            </button>

            {/* Notification Bell */}
            <div className="shrink-0">
              <NotificationPopover />
            </div>

            {/* Help Button */}
            <button
              onClick={() => setShowHelpModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-[#1C1933] hover:bg-[#252141] border border-[#383154] hover:border-[#383154] transition-colors"
              title="Help & Guidance"
              aria-label="Help"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#A78BFA]" />
              <span className="hidden md:inline">Help</span>
            </button>

            {/* User Profile Dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-[#1C1933] hover:bg-[#252141] border border-[#383154] hover:border-[#383154] transition-colors text-left focus:outline-none"
                aria-expanded={userMenuOpen}
                aria-label="User Profile Menu"
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 flex items-center justify-center text-[#C4B5FD] font-medium text-xs font-mono-numeric shrink-0">
                  {userName.substring(0, 2).toUpperCase()}
                </div>
                <div className="hidden sm:flex flex-col min-w-0 pr-0.5">
                  <span className="text-xs font-medium text-slate-200 truncate max-w-[120px]">
                    {userName}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono-numeric">
                    Business Owner
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                    userMenuOpen ? "rotate-180 text-[#A78BFA]" : ""
                  }`}
                />
              </button>

              {/* Profile Dropdown Menu */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[#1C1933] border border-[#383154] shadow-xl py-1.5 z-50 animate-popover-in">
                  <div className="px-3 py-2 border-b border-[#383154]">
                    <p className="text-xs font-semibold text-white truncate">{userName}</p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5 font-mono-numeric">
                      {user?.email || "MSME Business Owner"}
                    </p>
                    <p className="text-[10px] text-[#A78BFA] font-medium mt-1 truncate">
                      {primaryBusiness?.name || "Business Profile"}
                    </p>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        setShowProfileModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-[#252141] transition-colors text-left"
                    >
                      <UserIcon className="w-3.5 h-3.5 text-[#A78BFA]" />
                      <span>Profile</span>
                    </button>

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate("/businesses");
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-[#252141] transition-colors text-left"
                    >
                      <Building2 className="w-3.5 h-3.5 text-[#A78BFA]" />
                      <span>My Business</span>
                    </button>

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate("/settings");
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-[#252141] transition-colors text-left"
                    >
                      <SettingsIcon className="w-3.5 h-3.5 text-[#A78BFA]" />
                      <span>Settings</span>
                    </button>
                  </div>

                  <div className="pt-1 border-t border-[#383154]">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        setShowSignOutConfirm(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors text-left font-medium"
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

        {/* Dashboard Main Workspace (Responsive max-width: 1600px with calc(100% - 40px)) */}
        <main className="w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:px-8 lg:py-6 space-y-6">
          {/* Institutional Underwriting Notice if user also holds Analyst role */}
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
                className="px-3 py-1 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
              >
                <span>Analyst Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Welcome Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-['Space_Grotesk']">
                {getGreeting()}, {userName} 👋
              </h2>
              <div className="text-base sm:text-lg font-bold text-[#A78BFA] mt-0.5">
                {businessName}
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Credit Control Center: real-time MSME risk underwriting intelligence & decision support.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => navigate("/financial-intelligence")}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-[#252141] hover:bg-[#30294D] border border-[#383154] hover:border-[#8B5CF6] transition-colors shadow-sm"
              >
                <BarChart3 className="w-4 h-4 text-[#8B5CF6]" />
                <span>Financial Intelligence</span>
              </button>
              <button
                onClick={() => navigate("/assessment")}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-[#0C0A1D] bg-[#8B5CF6] hover:bg-[#7C3AED] transition-colors shadow-sm"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Start New Assessment</span>
              </button>
            </div>
          </div>

          {/* Section 14: Responsible AI Transparency Disclosure */}
          <div className="p-3 rounded-lg bg-[#1C1933] border border-[#383154] text-xs text-slate-300 flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#A78BFA] shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-white mr-1.5">AI-Assisted Risk Model:</span>
              <span className="text-slate-400 text-xs leading-relaxed">
                This system provides AI-assisted credit risk decision support and does not autonomously approve or reject loans. Your AI-generated risk assessment is reviewed by authorized credit analysts alongside verified financial records.
              </span>
            </div>
          </div>

          {/* Section 3: Contextual Status Banner (Never false "All Clear") */}
          <div
            className={`p-3.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-all ${
              contextualStatus.isAlert
                ? "bg-amber-950/30 border-amber-500/30 text-amber-200"
                : contextualStatus.type === "all_clear"
                ? "bg-[#1C1933] border-emerald-500/25 text-emerald-200"
                : "bg-[#1C1933] border-[#383154] text-slate-200"
            }`}
          >
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                  contextualStatus.isAlert
                    ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                    : contextualStatus.type === "all_clear"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                    : "bg-[#8B5CF6]/10 text-[#A78BFA] border-[#8B5CF6]/25"
                }`}
              >
                {contextualStatus.isAlert ? (
                  <AlertTriangle className="w-4 h-4" />
                ) : contextualStatus.type === "all_clear" ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Clock className="w-4 h-4" />
                )}
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-white text-xs sm:text-sm capitalize">
                    {contextualStatus.title}
                  </span>
                  <span
                    className={`text-[10px] font-medium font-mono-numeric px-2 py-0.5 rounded border ${
                      contextualStatus.isAlert
                        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                        : contextualStatus.type === "all_clear"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                        : "bg-[#8B5CF6]/10 text-[#C4B5FD] border-[#8B5CF6]/25"
                    }`}
                  >
                    {contextualStatus.badgeText}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed font-normal">
                  {contextualStatus.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
              {contextualStatus.secondaryActionText && (
                <button
                  onClick={() => navigate(contextualStatus.secondaryActionPath!)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-[#1C1933] border border-[#383154] hover:border-[#383154] transition-colors"
                >
                  {contextualStatus.secondaryActionText}
                </button>
              )}
              {contextualStatus.actionText && (
                <button
                  onClick={() => navigate(contextualStatus.actionPath)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    contextualStatus.isAlert
                      ? "bg-amber-400 hover:bg-amber-300 text-[#0C0A1D]"
                      : "bg-[#8B5CF6] hover:bg-[#7C3AED] text-[#0C0A1D]"
                  }`}
                >
                  <span>{contextualStatus.actionText}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Section 7: Business Profile Card */}
          <div className="p-4 sm:p-5 rounded-xl bg-[#1C1933] border border-[#383154] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
            {businessesLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-48" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              </div>
            ) : primaryBusiness ? (
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-[#252141] border border-[#383154] flex items-center justify-center text-[#A78BFA] shadow-sm shrink-0">
                    <Building2 className="w-5 h-5 text-[#A78BFA]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-semibold text-white tracking-tight font-['Space_Grotesk']">
                        {primaryBusiness.name}
                      </h3>
                      <span className="text-[10px] font-medium font-mono-numeric px-2 py-0.5 rounded bg-[#8B5CF6]/10 text-[#C4B5FD] border border-[#8B5CF6]/20">
                        {primaryBusiness.industry || "Commercial Enterprise"}
                      </span>
                    </div>

                    {/* Metadata Pills */}
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className="text-xs px-2 py-0.5 rounded bg-[#1C1933] border border-[#383154] text-slate-300 font-mono-numeric">
                        Location: {primaryBusiness.location || "Not specified"}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-[#1C1933] border border-[#383154] text-slate-300 font-mono-numeric">
                        Age: {primaryBusiness.age != null ? `${primaryBusiness.age} yrs` : "N/A"}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-[#1C1933] border border-[#383154] text-slate-300 font-mono-numeric">
                        Headcount: {primaryBusiness.employees != null ? `${primaryBusiness.employees} FTE` : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => navigate("/businesses")}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#C4B5FD] hover:text-white bg-[#252141] hover:bg-[#383154] border border-[#383154] transition-colors"
                  >
                    Edit Business Profile
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-1">
                <div>
                  <h4 className="text-sm font-semibold text-white">No Business Profile Registered</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Register your commercial identity to enable credit risk models.
                  </p>
                </div>
                <button
                  onClick={() => navigate("/businesses")}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#0C0A1D] bg-[#8B5CF6] hover:bg-[#7C3AED] transition-colors"
                >
                  Create Business Profile
                </button>
              </div>
            )}
          </div>

          {/* Row 1: Section 5 - Redesigned Risk Score Card (7 cols) + Section 6 - Application Status (5 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Section 5: Redesigned Risk Score Card (7 cols) */}
            <div className="lg:col-span-7 p-5 rounded-xl bg-[#1C1933] border border-[#383154] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] flex flex-col justify-between">
              <div>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#383154] pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#A78BFA]" />
                    <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wider uppercase font-mono-numeric">
                      AI Credit Risk Assessment
                    </h3>
                  </div>
                  {latestAssessment && (
                    <span className="text-[11px] text-slate-400 font-mono-numeric">
                      Ref: <b className="text-slate-200">#MSME-{latestAssessment.id}24</b>
                    </span>
                  )}
                </div>

                {isAssessmentLoading ? (
                  <div className="flex items-center justify-center p-6">
                    <RiskScoreSkeleton />
                  </div>
                ) : hasValidAssessment ? (
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
                    {/* Left: Large Circular Risk Gauge */}
                    <div className="sm:col-span-5 flex justify-center py-1">
                      <CircularRiskGauge
                        score={riskScore}
                        level={riskLevel}
                        isLoading={isAssessmentLoading}
                        isAvailable={hasValidAssessment}
                      />
                    </div>

                    {/* Center & Right: Structured Breakdown */}
                    <div className="sm:col-span-7 space-y-2.5">
                      <div className="grid grid-cols-2 gap-2.5">
                        {/* Center: Risk Score */}
                        <div className="p-2.5 rounded-lg bg-[#1C1933] border border-[#383154]">
                          <span className="text-[10px] text-slate-400 font-mono-numeric block mb-0.5 uppercase tracking-wider">Score</span>
                          <span className="text-lg font-bold text-white font-mono-numeric">
                            {riskScore !== null ? riskScore : "N/A"}{" "}
                            {riskScore !== null && (
                              <span className="text-xs font-normal text-slate-400">/ 100</span>
                            )}
                          </span>
                        </div>

                        {/* Center: Risk Level */}
                        <div className="p-2.5 rounded-lg bg-[#1C1933] border border-[#383154]">
                          <span className="text-[10px] text-slate-400 font-mono-numeric block mb-0.5 uppercase tracking-wider">Classification</span>
                          <div className="mt-0.5">
                            {riskLevel ? (
                              <RiskBadge level={riskLevel} size="sm" />
                            ) : (
                              <span className="text-xs text-slate-400 font-mono-numeric">Pending</span>
                            )}
                          </div>
                        </div>

                        {/* Right: Default Probability */}
                        <div className="p-2.5 rounded-lg bg-[#1C1933] border border-[#383154]">
                          <span className="text-[10px] text-slate-400 font-mono-numeric block mb-0.5 uppercase tracking-wider">Default Prob.</span>
                          <span className="text-lg font-bold text-white font-mono-numeric">
                            {defaultProb !== null ? `${defaultProb.toFixed(1)}%` : "N/A"}
                          </span>
                        </div>

                        {/* Right: Data Quality */}
                        <div className="p-2.5 rounded-lg bg-[#1C1933] border border-[#383154]">
                          <span className="text-[10px] text-slate-400 font-mono-numeric block mb-0.5 uppercase tracking-wider">Data Quality</span>
                          <span className="text-xs font-medium text-[#C4B5FD] block truncate font-mono-numeric mt-1">
                            {dataQualityTier || "Standard"}
                          </span>
                        </div>
                      </div>

                      {/* Right Sub-row: Model Version & Assessment Date */}
                      <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1 border-t border-[#383154]/80">
                        <span>Model: <b className="text-slate-300 font-mono-numeric">{modelVersion || "XGBoost v1.1.0"}</b></span>
                        <span>Date: <b className="text-slate-300 font-mono-numeric">{formatDate(latestAssessment.created_at)}</b></span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Clean Empty State */
                  <div className="text-center py-8 px-4 space-y-2.5">
                    <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 text-[#A78BFA] flex items-center justify-center mx-auto border border-[#8B5CF6]/20">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-semibold text-white">AI risk assessment has not been generated yet</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                      Submit business profile and cash flow metrics to generate your credit evaluation.
                    </p>
                    <div className="pt-1.5">
                      <button
                        onClick={() => navigate("/assessment")}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#0C0A1D] bg-[#8B5CF6] hover:bg-[#7C3AED] shadow-sm transition-colors"
                      >
                        Start Assessment
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Below Footnote */}
              <div className="pt-3 border-t border-[#383154] mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-400">
                <span className="text-[10px] text-slate-400 font-mono-numeric">
                  Decision support engine · Human underwriter determination required
                </span>
                {hasValidAssessment && (
                  <button
                    onClick={() => navigate(`/reports?id=${latestAssessment.id}`)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-[#C4B5FD] hover:text-white bg-[#1C1933] border border-[#383154] hover:border-[#383154] transition-colors self-end"
                  >
                    <span>View Dossier</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Section 6: Application Status Redesign (5 cols) */}
            <div className="lg:col-span-5 p-6 rounded-2xl bg-[#1C1933] border border-[#383154] shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#383154] pb-4 mb-5">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-[#A78BFA]" />
                    <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wider uppercase font-mono-numeric">
                      Application Timeline
                    </h3>
                  </div>
                  <span className="text-[10px] font-medium font-mono-numeric text-[#C4B5FD] px-2 py-0.5 rounded bg-[#1C1933] border border-[#383154]">
                    {assessmentStatus}
                  </span>
                </div>

                {/* 5 Stages Vertical Timeline */}
                <div className="space-y-3.5">
                  {applicationStages.map((stage, idx) => {
                    const isLast = idx === applicationStages.length - 1;
                    const isCompleted = stage.state === "completed";
                    const isCurrent = stage.state === "current";
                    const isNeedsInfo = stage.state === "needs_info";
                    const isRejected = stage.state === "rejected";

                    return (
                      <div key={stage.id} className="relative flex items-start gap-3">
                        {!isLast && (
                          <div
                            className={`absolute left-3 top-6 bottom-0 w-px ${
                              isCompleted ? "bg-emerald-500/40" : "bg-[#383154]"
                            }`}
                          />
                        )}

                        {/* Icon Indicator */}
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 text-[10px] font-bold font-mono-numeric transition-all ${
                            isCompleted
                              ? "bg-emerald-500 text-[#0C0A1D] shadow-sm"
                              : isNeedsInfo
                              ? "bg-amber-400 text-[#0C0A1D] animate-pulse"
                              : isCurrent
                              ? "bg-[#8B5CF6] text-[#0C0A1D] ring-2 ring-[#8B5CF6]/30"
                              : isRejected
                              ? "bg-rose-500 text-white"
                              : "bg-[#1C1933] text-slate-400 border border-[#383154]"
                          }`}
                        >
                          {isCompleted ? (
                            <Check className="w-3 h-3 stroke-[3]" />
                          ) : isNeedsInfo ? (
                            "!"
                          ) : isRejected ? (
                            "✕"
                          ) : (
                            stage.id
                          )}
                        </div>

                        {/* Stage details */}
                        <div className="flex-1 min-w-0 pb-0.5">
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-xs font-semibold ${
                                isCompleted
                                  ? "text-slate-200"
                                  : isNeedsInfo
                                  ? "text-amber-300"
                                  : isCurrent
                                  ? "text-[#C4B5FD]"
                                  : isRejected
                                  ? "text-rose-400"
                                  : "text-slate-400"
                              }`}
                            >
                              {stage.title}
                            </span>
                            <span
                              className={`text-[9px] font-mono-numeric px-1.5 py-0.2 rounded ${
                                isCompleted
                                  ? "text-emerald-400 bg-emerald-500/10"
                                  : isNeedsInfo
                                  ? "text-amber-300 bg-amber-500/10"
                                  : isCurrent
                                  ? "text-[#C4B5FD] bg-[#8B5CF6]/10"
                                  : "text-slate-400"
                              }`}
                            >
                              {stage.statusText}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug font-normal">
                            {stage.dateText}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-[#383154] mt-4 flex justify-end">
                <button
                  onClick={() =>
                    navigate(latestAssessment ? `/reports?id=${latestAssessment.id}` : "/assessment")
                  }
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-[#1C1933] border border-[#383154] hover:border-[#383154] transition-colors"
                >
                  <span>View Details</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Section 8: Dashboard KPI Area (Clean KPI row below primary assessment) */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-semibold text-slate-300 tracking-wider uppercase font-mono-numeric">
                Financial Baseline & Underwriting KPIs
              </h3>
              <span className="text-[10px] text-slate-400 font-mono-numeric">Ledger Metrics</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Annual Revenue */}
              <div className="p-4 rounded-xl bg-[#1C1933] border border-[#383154] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] flex flex-col justify-between">
                <span className="text-xs text-slate-400 font-medium">Annual Revenue</span>
                <div className="mt-2">
                  <span className="text-xl sm:text-2xl font-bold text-white font-mono-numeric tabular-nums block">
                    {formatIndianCurrency(kpiAnnualRevenue)}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono-numeric mt-1 inline-flex items-center gap-1">
                    Operating Turnover
                  </span>
                </div>
              </div>

              {/* Monthly Cash Flow */}
              <div className="p-4 rounded-xl bg-[#1C1933] border border-[#383154] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] flex flex-col justify-between">
                <span className="text-xs text-slate-400 font-medium">Monthly Cash Flow</span>
                <div className="mt-2">
                  <span className="text-xl sm:text-2xl font-bold text-white font-mono-numeric tabular-nums block">
                    {formatIndianCurrency(kpiMonthlyCashFlow)}
                  </span>
                  <span className="text-[10px] text-[#A78BFA] font-mono-numeric mt-1 inline-flex items-center gap-1">
                    Liquidity Generation
                  </span>
                </div>
              </div>

              {/* Existing Debt */}
              <div className="p-4 rounded-xl bg-[#1C1933] border border-[#383154] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] flex flex-col justify-between">
                <span className="text-xs text-slate-400 font-medium">Existing Debt</span>
                <div className="mt-2">
                  <span className="text-xl sm:text-2xl font-bold text-white font-mono-numeric tabular-nums block">
                    {formatIndianCurrency(kpiExistingDebt)}
                  </span>
                  <span className="text-[10px] text-amber-400 font-mono-numeric mt-1 inline-flex items-center gap-1">
                    Active Facility Balance
                  </span>
                </div>
              </div>

              {/* Employees */}
              <div className="p-4 rounded-xl bg-[#1C1933] border border-[#383154] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] flex flex-col justify-between">
                <span className="text-xs text-slate-400 font-medium">Headcount</span>
                <div className="mt-2">
                  <span className="text-xl sm:text-2xl font-bold text-white font-mono-numeric tabular-nums block">
                    {kpiEmployees != null ? kpiEmployees : "N/A"}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono-numeric mt-1 inline-flex items-center gap-1">
                    Full-Time Staff
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Section 9 - Application Completeness + Section 10 - Data Quality + Section 11 - Document Verification */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Section 9: Application Completeness Card */}
            <div className="p-6 rounded-2xl bg-[#1C1933] border border-[#383154] shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#383154] pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#A78BFA]" />
                    <h3 className="text-base font-bold text-white font-['Space_Grotesk']">
                      Application Completeness
                    </h3>
                  </div>
                  <span className="text-base font-bold font-mono text-[#A78BFA]">
                    {applicationCompleteness.percentage}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-[#0C0A1D] h-2 rounded-full overflow-hidden border border-[#383154] mb-4">
                  <div
                    className="bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] h-full rounded-full transition-all duration-500"
                    style={{ width: `${applicationCompleteness.percentage}%` }}
                  />
                </div>

                {/* Breakdown List */}
                <div className="space-y-2.5 text-xs">
                  {applicationCompleteness.checks.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded-xl bg-[#0C0A1D] border border-[#383154]"
                    >
                      <span className="text-slate-300 font-medium">{c.label}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 text-[11px]">{c.detail}</span>
                        {c.passed ? (
                          <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                            ✓
                          </span>
                        ) : (
                          <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center text-[10px]">
                            -
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-[#383154] mt-4 flex justify-end">
                <button
                  onClick={() => navigate("/assessment")}
                  className="text-xs font-semibold text-[#A78BFA] hover:text-[#C4B5FD] flex items-center gap-1"
                >
                  <span>Continue Application</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Section 10: Data Quality Section */}
            <div className="p-6 rounded-2xl bg-[#1C1933] border border-[#383154] shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#383154] pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#A78BFA]" />
                    <h3 className="text-base font-bold text-white font-['Space_Grotesk']">
                      Data Quality
                    </h3>
                  </div>
                  {dataQualityInfo.available ? (
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                      {dataQualityInfo.tier}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Baseline Unavailable</span>
                  )}
                </div>

                {dataQualityInfo.available ? (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-[#0C0A1D] border border-[#383154] flex items-center justify-between">
                      <span className="text-xs text-slate-400">Underwriting Integrity</span>
                      <span className="text-sm font-bold text-white font-mono">
                        {dataQualityInfo.message}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-[#0C0A1D] border border-[#383154]">
                        <span className="text-slate-400">Financial Data</span>
                        <span className="font-medium text-slate-200">
                          {dataQualityInfo.financialsStatus}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-[#0C0A1D] border border-[#383154]">
                        <span className="text-slate-400">Documents</span>
                        <span className="font-medium text-slate-200">
                          {dataQualityInfo.docsStatus}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-[#0C0A1D] border border-[#383154]">
                        <span className="text-slate-400">Alternative Signals</span>
                        <span className="font-medium text-slate-200">
                          {dataQualityInfo.signalsStatus}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-[#0C0A1D] border border-[#383154]">
                        <span className="text-slate-400">Verification Status</span>
                        <span className="font-medium text-[#C4B5FD]">
                          {dataQualityInfo.verificationStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-400 text-xs space-y-2">
                    <p>Data quality baseline unavailable</p>
                    <p className="text-[11px] text-slate-400">
                      Submit financial information to evaluate underwriting confidence score.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-[#383154] mt-4 flex justify-end">
                <button
                  onClick={() => navigate("/documents")}
                  className="text-xs font-semibold text-[#A78BFA] hover:text-[#C4B5FD] flex items-center gap-1"
                >
                  <span>Improve Data Quality</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Section 11: Document Verification Status Card */}
            <div className="p-6 rounded-2xl bg-[#1C1933] border border-[#383154] shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#383154] pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#A78BFA]" />
                    <h3 className="text-base font-bold text-white font-['Space_Grotesk']">
                      Document Verification
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-[#C4B5FD] font-mono">
                    {verifiedDocsCount} / {totalDocsCount} verified
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-[#0C0A1D] h-1.5 rounded-full overflow-hidden border border-[#383154] mb-4">
                  <div
                    className="bg-[#8B5CF6] h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${totalDocsCount > 0 ? (verifiedDocsCount / totalDocsCount) * 100 : 0}%`,
                    }}
                  />
                </div>

                {/* Status Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div className="p-2 rounded-xl bg-[#0C0A1D] border border-[#383154] text-center">
                    <span className="text-[10px] text-slate-400 block">Verified</span>
                    <span className="text-base font-bold text-emerald-400 font-mono">
                      {verifiedDocsCount}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-[#0C0A1D] border border-[#383154] text-center">
                    <span className="text-[10px] text-slate-400 block">Processing</span>
                    <span className="text-base font-bold text-[#A78BFA] font-mono">
                      {processingDocsCount}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-[#0C0A1D] border border-[#383154] text-center">
                    <span className="text-[10px] text-slate-400 block">Needs Review</span>
                    <span className="text-base font-bold text-amber-400 font-mono">
                      {needsReviewDocsCount}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-[#0C0A1D] border border-[#383154] text-center">
                    <span className="text-[10px] text-slate-400 block">Missing</span>
                    <span className="text-base font-bold text-slate-300 font-mono">
                      {Math.max(0, 3 - totalDocsCount)}
                    </span>
                  </div>
                </div>

                {/* Recent documents snippet or empty state */}
                {totalDocsCount === 0 ? (
                  <div className="text-center py-4 text-slate-400 text-xs space-y-2">
                    <p>No documents uploaded yet.</p>
                    <button
                      onClick={() => navigate("/documents")}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#C4B5FD] bg-[#1C1933] border border-[#8B5CF6]/30 hover:bg-[#252141] transition-colors"
                    >
                      Upload Documents
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 text-center">
                    Verified records are automatically incorporated into credit models.
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-[#383154] mt-4 flex justify-end">
                <button
                  onClick={() => navigate("/documents")}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#A78BFA] hover:text-[#C4B5FD] transition-colors"
                >
                  <span>Manage Documents</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Row 3: Section 12 - Recent Assessments (8 cols) + Section 13 - Quick Actions (4 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Section 12: Recent Assessments Table (8 cols) */}
            <div className="lg:col-span-8 p-5 rounded-xl bg-[#1C1933] border border-[#383154] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#383154] pb-3 mb-3.5">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-[#A78BFA]" />
                    <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wider uppercase font-mono-numeric">
                      Recent Assessments
                    </h3>
                  </div>
                  <button
                    onClick={() => navigate("/reports")}
                    className="text-xs font-medium text-[#A78BFA] hover:text-[#C4B5FD] flex items-center gap-1 font-mono-numeric"
                  >
                    <span>View All Dossiers</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {assessmentsLoading ? (
                  <TableSkeleton rows={4} />
                ) : assessments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#383154] text-slate-400 uppercase tracking-wider text-[10px] font-mono-numeric">
                          <th className="py-2 px-2.5">Dossier ID</th>
                          <th className="py-2 px-2.5">Date</th>
                          <th className="py-2 px-2.5">Score</th>
                          <th className="py-2 px-2.5">Risk Level</th>
                          <th className="py-2 px-2.5">Default Prob.</th>
                          <th className="py-2 px-2.5">Review Status</th>
                          <th className="py-2 px-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#383154]/80">
                        {assessments.slice(0, 5).map((a) => (
                          <tr key={a.id} className="hover:bg-[#252141] transition-colors">
                            <td className="py-2.5 px-2.5 font-medium text-slate-200 font-mono-numeric">
                              #MSME-{a.id}24
                            </td>
                            <td className="py-2.5 px-2.5 text-slate-300 font-mono-numeric">
                              {formatShortDate(a.created_at)}
                            </td>
                            <td className="py-2.5 px-2.5 font-mono-numeric font-semibold text-white tabular-nums">
                              {Math.round(a.default_probability)}/100
                            </td>
                            <td className="py-2.5 px-2.5">
                              <RiskBadge level={a.risk_level} size="sm" />
                            </td>
                            <td className="py-2.5 px-2.5 font-mono-numeric text-slate-300 tabular-nums">
                              {a.default_probability.toFixed(1)}%
                            </td>
                            <td className="py-2.5 px-2.5">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono-numeric font-medium uppercase ${
                                  a.review_status === "approved"
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                                    : a.review_status === "in_review"
                                    ? "bg-blue-500/10 text-blue-300 border border-blue-500/25"
                                    : a.review_status === "needs_info"
                                    ? "bg-amber-500/10 text-amber-300 border border-amber-500/25"
                                    : a.review_status === "rejected"
                                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/25"
                                    : "bg-slate-800/40 text-slate-400 border border-slate-700/50"
                                }`}
                              >
                                {a.review_status === "approved"
                                  ? "Approved"
                                  : a.review_status === "in_review"
                                  ? "Under Review"
                                  : a.review_status === "needs_info"
                                  ? "Needs Info"
                                  : a.review_status === "rejected"
                                  ? "Rejected"
                                  : "Submitted"}
                              </span>
                            </td>
                            <td className="py-2.5 px-2.5 text-right">
                              <button
                                onClick={() => navigate(`/reports?id=${a.id}`)}
                                className="text-[#A78BFA] hover:text-[#C4B5FD] font-medium inline-flex items-center gap-1 text-[11px] font-mono-numeric"
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
                  <div className="py-8 text-center text-slate-400 text-xs font-mono-numeric">
                    No historical assessments recorded.
                  </div>
                )}
              </div>
            </div>

            {/* Section 13: Quick Actions (4 cols) */}
            <div className="lg:col-span-4 p-5 rounded-xl bg-[#1C1933] border border-[#383154] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] flex flex-col justify-between">
              <div>
                <div className="border-b border-[#383154] pb-3 mb-3.5">
                  <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wider uppercase font-mono-numeric">
                    Quick Actions
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Fast shortcuts to core underwriting features
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => navigate("/businesses")}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[#1C1933] hover:bg-[#252141] border border-[#383154] hover:border-[#383154] transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-[#252141] text-[#A78BFA] flex items-center justify-center border border-[#383154]">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="text-xs font-medium text-white block">
                          Update Business Profile
                        </span>
                        <span className="text-[10px] text-slate-400">Legal entity & industry baseline</span>
                      </div>
                    </div>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                  </button>

                  <button
                    onClick={() => navigate("/documents")}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[#1C1933] hover:bg-[#252141] border border-[#383154] hover:border-[#383154] transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-emerald-950/40 text-emerald-400 flex items-center justify-center border border-emerald-500/25">
                        <Upload className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="text-xs font-medium text-white block">
                          Upload Financial Documents
                        </span>
                        <span className="text-[10px] text-slate-400">GST, bank statements & invoices</span>
                      </div>
                    </div>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                  </button>

                  <button
                    onClick={() => navigate("/assessment")}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[#1C1933] hover:bg-[#252141] border border-[#383154] hover:border-[#383154] transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-[#8B5CF6]/10 text-[#A78BFA] flex items-center justify-center border border-[#8B5CF6]/25">
                        <PlusCircle className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="text-xs font-medium text-white block">
                          Start New Assessment
                        </span>
                        <span className="text-[10px] text-slate-400">Submit fresh ML risk prediction cycle</span>
                      </div>
                    </div>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                  </button>

                  <button
                    onClick={() => navigate("/reports")}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[#1C1933] hover:bg-[#252141] border border-[#383154] hover:border-[#383154] transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-purple-950/40 text-purple-400 flex items-center justify-center border border-purple-500/25">
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="text-xs font-medium text-white block">
                          View Risk Reports
                        </span>
                        <span className="text-[10px] text-slate-400">Export audited decision dossiers</span>
                      </div>
                    </div>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* User Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl bg-[#1C1933] border border-[#383154] shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#383154] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-[#A78BFA]" />
                <span>Profile Details</span>
              </h3>
              <button
                onClick={() => setShowProfileModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#7C3AED] to-[#8B5CF6] flex items-center justify-center text-white font-bold text-xl shadow-md border border-[#8B5CF6]/20">
                {userName.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h4 className="text-base font-bold text-white">{userName}</h4>
                <span className="text-xs font-semibold text-[#A78BFA]">Business Owner</span>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0C0A1D] border border-[#383154]">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#A78BFA]" /> Email:
                </span>
                <span className="font-semibold text-slate-200">
                  {userProfile?.email || user?.email || "Not provided"}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0C0A1D] border border-[#383154]">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#A78BFA]" /> Phone:
                </span>
                <span className="font-semibold text-slate-200">
                  {user?.phoneNumber || userProfile?.settings?.phone || "Not provided"}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0C0A1D] border border-[#383154]">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#A78BFA]" /> Business:
                </span>
                <span className="font-semibold text-slate-200">
                  {primaryBusiness?.name || "Not provided"}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0C0A1D] border border-[#383154]">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#A78BFA]" /> Role:
                </span>
                <span className="font-bold text-[#C4B5FD]">MSME User</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  navigate("/settings");
                }}
                className="w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] transition-colors"
              >
                Edit Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-2xl bg-[#1C1933] border border-[#383154] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#383154] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#A78BFA]" />
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
              <div className="p-3 rounded-xl bg-[#0C0A1D] border border-[#383154]">
                <h4 className="font-bold text-white mb-1">1. How Credit Risk is Assessed</h4>
                <p className="text-slate-400">
                  MSME Risk AI evaluates verified financials (revenue, cash flow, debt) alongside alternative signals (utility payment consistency, transaction frequency) using machine learning decision-support models.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#0C0A1D] border border-[#383154]">
                <h4 className="font-bold text-white mb-1">2. Understanding Risk Scores</h4>
                <p className="text-slate-400">
                  Scores range from 0 to 100. Lower scores indicate lower default risk:
                  <span className="block mt-1 text-emerald-300">• 0 - 30: LOW RISK (Optimal credit profile)</span>
                  <span className="block text-amber-300">• 31 - 70: MEDIUM RISK (Standard credit profile)</span>
                  <span className="block text-rose-300">• 71 - 100: HIGH RISK (Elevated scrutiny required)</span>
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#0C0A1D] border border-[#383154]">
                <h4 className="font-bold text-white mb-1">3. What if Action is Required?</h4>
                <p className="text-slate-400">
                  If an underwriter requests more information, check the Action Required banner on this dashboard. Upload the requested GST returns or bank statements in the Documents tab.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-[#DDD6FE]">
                <h4 className="font-bold text-white mb-1">4. Human Underwriter Authority</h4>
                <p className="text-[#C4B5FD] text-[11px]">
                  All final lending decisions remain strictly with authorized human financial credit officers. This platform provides decision-support estimation only.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] transition-colors"
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
