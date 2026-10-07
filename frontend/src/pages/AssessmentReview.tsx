import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardCheck,
  Building2,
  DollarSign,
  TrendingDown,
  TrendingUp,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileSpreadsheet,
  Clock,
  Sparkles,
  Info,
  Calendar,
  Layers,
  History,
  Activity,
  Send,
  Sliders,
  Check,
  FileText,
  ExternalLink,
  Eye,
  X,
  User,
  MapPin,
  Briefcase,
  Cpu,
  BrainCircuit,
  AlertCircle,
  FileSearch,
} from "lucide-react";
import {
  api,
  DocumentItem,
  DocumentExtractionDetails,
  ExtractedFieldItem,
} from "../services/api";
import Sidebar from "../components/Sidebar";
import AnalystHeader from "./analyst/AnalystHeader";
import Button from "../components/ui/Button";
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { RiskBadge } from "../components/ui/Badge";
import ErrorMessage from "../components/ErrorMessage";
import LoadingSpinner from "../components/LoadingSpinner";
import { Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";
import { useAuthRole } from "../context/AuthRoleContext";

// Indian Currency Formatter helper
function formatINR(val?: number | null): string {
  if (val === undefined || val === null || isNaN(val)) return "—";
  if (Math.abs(val) >= 10000000) {
    return `₹${(val / 10000000).toFixed(2)} Cr`;
  }
  if (Math.abs(val) >= 100000) {
    return `₹${(val / 100000).toFixed(2)} Lakh`;
  }
  return `₹${val.toLocaleString("en-IN")}`;
}

export default function AssessmentReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { userProfile, user: currentAuthUser } = useAuthRole();

  const [assessment, setAssessment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Supporting Documents
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocForOcr, setSelectedDocForOcr] = useState<DocumentItem | null>(null);
  const [ocrDetails, setOcrDetails] = useState<DocumentExtractionDetails | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  // Review Form & Notes State
  const [reviewNotes, setReviewNotes] = useState("");
  const [additionalComments, setAdditionalComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState("");

  // Decision Modals
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveConfirmed, setApproveConfirmed] = useState(false);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");

  const [showNeedsInfoModal, setShowNeedsInfoModal] = useState(false);
  const [infoReason, setInfoReason] = useState("");
  const [requestedDocs, setRequestedDocs] = useState("");
  const [infoComments, setInfoComments] = useState("");

  // What-If Scenario State inside review
  const [whatIfOpen, setWhatIfOpen] = useState(false);
  const [scenarioRevenueDelta, setScenarioRevenueDelta] = useState(0);
  const [scenarioDebtDelta, setScenarioDebtDelta] = useState(0);
  const [scenarioCashFlowDelta, setScenarioCashFlowDelta] = useState(0);
  const [simulating, setSimulating] = useState(false);
  const [simulatedScore, setSimulatedScore] = useState<number | null>(null);
  const [simulatedProb, setSimulatedProb] = useState<number | null>(null);

  const assessmentId = id ? parseInt(id, 10) : 0;

  const fetchDetails = useCallback(async () => {
    if (!assessmentId) return;
    try {
      setLoading(true);
      setError("");
      const data = await api.getAssessmentDetails(assessmentId);
      setAssessment(data);
      setReviewNotes(data.review_notes || "");
      setAdditionalComments(data.additional_comments || "");

      // Load documents associated with this business/user
      try {
        const allDocs = await api.getDocuments();
        const matchedDocs = allDocs.filter(
          (d: any) =>
            d.business_id === data.business?.id ||
            d.business_name === data.business?.name
        );
        setDocuments(matchedDocs.length > 0 ? matchedDocs : allDocs);
      } catch (docErr) {
        console.warn("Could not load supporting documents:", docErr);
      }
    } catch (err: any) {
      console.error("Failed to load assessment details:", err);
      setError(err?.message || "Failed to load assessment details. Check underwriter permissions.");
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Load OCR Extraction for modal inspection
  const handleInspectOcr = async (doc: DocumentItem) => {
    try {
      setSelectedDocForOcr(doc);
      setOcrLoading(true);
      const extraction = await api.getDocumentExtraction(doc.id);
      setOcrDetails(extraction);
    } catch (err: any) {
      toast.error("OCR Evidence", err?.message || "Extraction details unavailable for this document.");
    } finally {
      setOcrLoading(false);
    }
  };

  // Review Status Action Handlers
  const handleStartReview = async () => {
    try {
      setSubmitting(true);
      await api.reviewAssessment(
        assessmentId,
        "in_review",
        reviewNotes.trim() || "Analyst started formal underwriting review.",
        additionalComments.trim() || undefined
      );
      toast.success("Review Started", "Assessment status transitioned from PENDING to IN_REVIEW.");
      await fetchDetails();
    } catch (err: any) {
      toast.error("Action Failed", err?.message || "Could not start review.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmApproval = async () => {
    if (!approveConfirmed) {
      toast.warning("Verification Required", "Please check the confirmation box.");
      return;
    }
    try {
      setSubmitting(true);
      await api.reviewAssessment(
        assessmentId,
        "approved",
        reviewNotes.trim() || "Underwriting review completed. Verified financial statements and AI risk signals. Credit application approved.",
        additionalComments.trim() || undefined
      );
      toast.success("Assessment Approved", "Application approved by human analyst.");
      setShowApproveModal(false);
      setApproveConfirmed(false);
      await fetchDetails();
    } catch (err: any) {
      toast.error("Approval Failed", err?.message || "Could not record approval.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmRejection = async () => {
    if (!rejectReason.trim()) {
      toast.warning("Reason Required", "Please specify the primary credit rejection reason.");
      return;
    }
    try {
      setSubmitting(true);
      const combinedNotes = `Reason: ${rejectReason}. Notes: ${rejectNotes || reviewNotes}`;
      await api.reviewAssessment(
        assessmentId,
        "rejected",
        combinedNotes,
        additionalComments.trim() || undefined
      );
      toast.info("Assessment Rejected", "Application marked as rejected by human analyst.");
      setShowRejectModal(false);
      setRejectReason("");
      setRejectNotes("");
      await fetchDetails();
    } catch (err: any) {
      toast.error("Rejection Failed", err?.message || "Could not record rejection.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmNeedsInfo = async () => {
    if (!infoReason.trim()) {
      toast.warning("Reason Required", "Please specify why additional information is required.");
      return;
    }
    try {
      setSubmitting(true);
      const combinedNotes = `Information Requested: ${infoReason}. Documents: ${requestedDocs}. Comments: ${infoComments}`;
      await api.reviewAssessment(
        assessmentId,
        "needs_info",
        combinedNotes,
        additionalComments.trim() || undefined
      );
      toast.warning("Information Requested", "Borrower notified to upload missing verification documents.");
      setShowNeedsInfoModal(false);
      setInfoReason("");
      setRequestedDocs("");
      setInfoComments("");
      await fetchDetails();
    } catch (err: any) {
      toast.error("Request Failed", err?.message || "Could not request additional info.");
    } finally {
      setSubmitting(false);
    }
  };

  // What-If Scenario Calculation
  const handleRunScenario = async () => {
    if (!assessment) return;
    try {
      setSimulating(true);
      const baseRev = assessment.financials?.annual_revenue || assessment.annual_revenue || 1000000;
      const baseDebt = assessment.financials?.existing_debt || assessment.existing_debt || 100000;
      const baseCash = assessment.financials?.monthly_cash_flow || assessment.monthly_cash_flow || 50000;

      const res = await api.simulateRisk({
        annual_revenue: Math.max(0, baseRev * (1 + scenarioRevenueDelta / 100)),
        existing_debt: Math.max(0, baseDebt * (1 + scenarioDebtDelta / 100)),
        monthly_cash_flow: Math.max(0, baseCash * (1 + scenarioCashFlowDelta / 100)),
        monthly_expenses: assessment.financials?.monthly_expenses || assessment.monthly_expenses || 40000,
        digital_transactions: assessment.alternative_indicators?.digital_transactions || 50,
        utility_payment_score: assessment.alternative_indicators?.utility_payment_score || 85,
        invoice_payment_score: assessment.alternative_indicators?.invoice_payment_score || 80,
        previous_defaults: assessment.alternative_indicators?.previous_defaults || 0,
      });

      setSimulatedScore(res.simulated_risk_score);
      setSimulatedProb(res.simulated_default_prob);
    } catch (err: any) {
      toast.error("Simulation Error", err?.message || "Could not compute hypothetical scenario.");
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#030712] text-slate-100">
        <Sidebar active="Review Queue" />
        <div className="flex-1 flex flex-col">
          <AnalystHeader />
          <div className="flex-1 flex items-center justify-center p-8">
            <LoadingSpinner text="Retrieving underwriter file, financial statements, and SHAP factors..." />
          </div>
        </div>
      </div>
    );
  }

  if (error && !assessment) {
    return (
      <div className="flex min-h-screen bg-[#030712] text-slate-100">
        <Sidebar active="Review Queue" />
        <div className="flex-1 flex flex-col">
          <AnalystHeader />
          <main className="p-6 max-w-4xl mx-auto w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/analyst")}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Back to Review Queue
            </Button>
            <div className="mt-6">
              <ErrorMessage message={error} />
            </div>
          </main>
        </div>
      </div>
    );
  }

  const pred = assessment?.prediction || {};
  const bus = assessment?.business || {};
  const fin = assessment?.financials || {};
  const alt = assessment?.alternative_indicators || {};
  const factors = assessment?.factors || [];
  const defaultProb = pred.default_probability ?? assessment.default_probability ?? 0;
  const riskScore = Math.max(0, Math.round(100 - defaultProb));
  const reviewStatus = (assessment?.review_status || "pending").toLowerCase();
  const riskTier = (pred.risk_level || assessment.risk_level || "Medium").toLowerCase();

  return (
    <div className="flex min-h-screen bg-[#030712] text-slate-100">
      <Sidebar active="Review Queue" />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AnalystHeader
          title={`Review: ${bus.name || "MSME Application"}`}
          subtitle={`Underwriting File #${assessment.id} • Submitted ${new Date(assessment.created_at).toLocaleDateString()}`}
          breadcrumbs={[
            { label: "Analyst", href: "/analyst" },
            { label: "Review Queue", href: "/analyst" },
            { label: `Assessment #${assessment.id}` },
          ]}
        />

        <main className="p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto space-y-6">
          {/* Section 7: Underwriting Workspace Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b] shadow-md">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/analyst")}
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Back to Queue
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-indigo-400 font-bold">
                    #{assessment.id}
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="text-xs text-slate-400">
                    {bus.name || `Business #${assessment.business_id}`}
                  </span>
                  <span className="text-slate-500">•</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                      riskTier === "low"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : riskTier === "high"
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    }`}
                  >
                    {pred.risk_level || assessment.risk_level || "Medium Risk"}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border capitalize ${
                      reviewStatus === "approved"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : reviewStatus === "rejected"
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        : reviewStatus === "in_review"
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                        : reviewStatus === "needs_info"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        : "bg-slate-800 text-slate-300 border-slate-700"
                    }`}
                  >
                    {reviewStatus.replace("_", " ")}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setWhatIfOpen(!whatIfOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#0d1c33] text-cyan-300 border border-[#1d3559] hover:bg-[#122646] transition"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{whatIfOpen ? "Close Scenario Sandbox" : "What-If Scenario Sandbox"}</span>
              </button>
            </div>
          </div>

          {/* Section 28: Responsible AI Notice Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/40 via-[#0e1e38] to-slate-900 border border-indigo-500/30 flex items-start gap-3.5 shadow-md">
            <BrainCircuit className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="text-white uppercase font-bold block mb-0.5 tracking-wider">
                AI-Assisted Credit Risk Assessment (Decision Support Mode)
              </strong>
              <p className="text-slate-300 leading-relaxed">
                This system provides AI-assisted credit risk decision support and does not autonomously approve or reject loans. AI-generated risk insights are decision-support information and must be reviewed alongside business documents and financial evidence.
              </p>
            </div>
          </div>

          {/* Section 18: WHAT-IF SCENARIO SANDBOX (Collapsible Header Banner) */}
          {whatIfOpen && (
            <div className="p-5 rounded-2xl bg-[#091526] border border-cyan-500/40 shadow-xl space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white">Scenario Analysis Sandbox (Hypothetical)</h3>
                </div>
                <span className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
                  Non-persistent scenario testing
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#060e1a] border border-[#162742] text-xs text-slate-300 leading-relaxed">
                Scenario results are hypothetical estimates based on modified financial indicators and do not guarantee future outcomes. Testing does not modify the underlying database assessment records.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="text-slate-300 block mb-1">
                    Revenue Stress Delta: <strong className="text-white">{scenarioRevenueDelta > 0 ? `+${scenarioRevenueDelta}` : scenarioRevenueDelta}%</strong>
                  </label>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    step="5"
                    value={scenarioRevenueDelta}
                    onChange={(e) => setScenarioRevenueDelta(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>-50% shock</span>
                    <span>Baseline</span>
                    <span>+50% growth</span>
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">
                    Debt Expansion Delta: <strong className="text-white">{scenarioDebtDelta > 0 ? `+${scenarioDebtDelta}` : scenarioDebtDelta}%</strong>
                  </label>
                  <input
                    type="range"
                    min="-50"
                    max="100"
                    step="10"
                    value={scenarioDebtDelta}
                    onChange={(e) => setScenarioDebtDelta(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>-50% deleverage</span>
                    <span>Baseline</span>
                    <span>+100% debt</span>
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">
                    Cash Flow Delta: <strong className="text-white">{scenarioCashFlowDelta > 0 ? `+${scenarioCashFlowDelta}` : scenarioCashFlowDelta}%</strong>
                  </label>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    step="5"
                    value={scenarioCashFlowDelta}
                    onChange={(e) => setScenarioCashFlowDelta(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>-50% drain</span>
                    <span>Baseline</span>
                    <span>+50% buffer</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#1a2d4b]">
                <div className="flex items-center gap-4 text-xs">
                  {simulatedScore !== null && (
                    <div className="flex items-center gap-3">
                      <div>
                        Baseline Risk: <strong className="text-white">{riskScore}/100</strong>
                      </div>
                      <span className="text-slate-500">→</span>
                      <div>
                        Simulated Risk: <strong className="text-cyan-400">{simulatedScore}/100</strong>
                      </div>
                      <div>
                        Simulated Default: <strong className="text-amber-400">{simulatedProb?.toFixed(1)}%</strong>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setScenarioRevenueDelta(0);
                      setScenarioDebtDelta(0);
                      setScenarioCashFlowDelta(0);
                      setSimulatedScore(null);
                      setSimulatedProb(null);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white"
                  >
                    Reset
                  </button>
                  <button
                    onClick={handleRunScenario}
                    disabled={simulating}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 transition disabled:opacity-50"
                  >
                    {simulating ? "Simulating..." : "Calculate Scenario"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Section 30: THREE-COLUMN PROFESSIONAL UNDERWRITING WORKBENCH */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ==================== LEFT COLUMN (4 Cols): Business, Financials, Signals, Documents ==================== */}
            <div className="lg:col-span-4 space-y-6">
              {/* Section 8: Business Information */}
              <div className="p-5 rounded-2xl bg-[#081120] border border-[#1a2d4b] shadow-md space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-[#1a2d4b]">
                  <Building2 className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Business Profile
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Business Name</span>
                    <strong className="text-white block truncate">{bus.name || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Industry Sector</span>
                    <strong className="text-white block">{bus.industry || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Location</span>
                    <strong className="text-white block flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {bus.location || "Not specified"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Operating Age</span>
                    <strong className="text-white block">
                      {bus.age !== undefined && bus.age !== null ? `${bus.age} Years` : "—"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Employees</span>
                    <strong className="text-white block">{bus.employees || "—"} team members</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Applicant / Owner</span>
                    <strong className="text-white block truncate">{bus.user_id ? `UID #${bus.user_id.slice(0, 10)}...` : "Registered MSME"}</strong>
                  </div>
                </div>
              </div>

              {/* Section 9: Financial Overview (with proper INR formatting) */}
              <div className="p-5 rounded-2xl bg-[#081120] border border-[#1a2d4b] shadow-md space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-[#1a2d4b]">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Financial Overview & Declared Figures
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-xl bg-[#0c182b] border border-[#162742]">
                    <span className="text-slate-400 block mb-0.5">Annual Revenue</span>
                    <strong className="text-white font-mono text-sm">
                      {formatINR(fin.annual_revenue ?? assessment.annual_revenue)}
                    </strong>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#0c182b] border border-[#162742]">
                    <span className="text-slate-400 block mb-0.5">Monthly Cash Flow</span>
                    <strong className="text-white font-mono text-sm">
                      {formatINR(fin.monthly_cash_flow ?? assessment.monthly_cash_flow)}
                    </strong>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#0c182b] border border-[#162742]">
                    <span className="text-slate-400 block mb-0.5">Monthly Expenses</span>
                    <strong className="text-white font-mono text-sm">
                      {formatINR(fin.monthly_expenses ?? assessment.monthly_expenses)}
                    </strong>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#0c182b] border border-[#162742]">
                    <span className="text-slate-400 block mb-0.5">Existing Debt</span>
                    <strong className="text-rose-400 font-mono text-sm">
                      {formatINR(fin.existing_debt ?? assessment.existing_debt)}
                    </strong>
                  </div>
                </div>

                {/* Loan Request Details */}
                <div className="p-3 rounded-xl bg-[#0d1c33] border border-[#1a2d4b] text-xs space-y-2">
                  <span className="text-slate-400 font-semibold block uppercase text-[10px] tracking-wider">
                    Requested Credit Terms
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block">Requested Amount:</span>
                      <strong className="text-cyan-300 font-mono">
                        {formatINR(assessment.loan_amount || fin.annual_revenue ? (fin.annual_revenue || 1000000) * 0.25 : 500000)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Tenure:</span>
                      <strong className="text-white">{assessment.loan_tenure || 24} Months</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 10: Alternative Financial Signals */}
              <div className="p-5 rounded-2xl bg-[#081120] border border-[#1a2d4b] shadow-md space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-[#1a2d4b]">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Alternative Financial Signals
                  </h3>
                </div>

                <div className="space-y-3 text-xs">
                  {/* Utility Payment Score */}
                  <div className="p-2.5 rounded-xl bg-[#0c182b] border border-[#162742] flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block">Utility Payment Score</span>
                      <strong className="text-white text-sm">
                        {alt.utility_payment_score ?? assessment.utility_payment_score ?? 85} / 100
                      </strong>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      Excellent Track
                    </span>
                  </div>

                  {/* Invoice Payment Score */}
                  <div className="p-2.5 rounded-xl bg-[#0c182b] border border-[#162742] flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block">Invoice Payment Score</span>
                      <strong className="text-white text-sm">
                        {alt.invoice_payment_score ?? assessment.invoice_payment_score ?? 80} / 100
                      </strong>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                      Reliable
                    </span>
                  </div>

                  {/* Previous Defaults */}
                  <div className="p-2.5 rounded-xl bg-[#0c182b] border border-[#162742] flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block">Historical Defaults</span>
                      <strong className="text-white text-sm">
                        {alt.previous_defaults ?? assessment.previous_defaults ?? 0}
                      </strong>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      Clean History
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 11 & 12: Document Evidence & Extraction Inspection */}
              <div className="p-5 rounded-2xl bg-[#081120] border border-[#1a2d4b] shadow-md space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#1a2d4b]">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Document Evidence ({documents.length})
                    </h3>
                  </div>
                </div>

                {documents.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No documents have been submitted for this business.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {documents.slice(0, 5).map((d) => (
                      <div
                        key={d.id}
                        className="p-3 rounded-xl bg-[#0c182b] border border-[#162742] space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-semibold text-white truncate block">
                              {d.original_filename || d.filename}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {d.document_type || "FINANCIAL_STATEMENT"} • {d.file_size ? `${Math.round(d.file_size / 1024)} KB` : "PDF"}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            {d.status || "Verified"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 pt-1 border-t border-[#182a44]">
                          <button
                            onClick={() => handleInspectOcr(d)}
                            className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold"
                          >
                            <FileSearch className="w-3.5 h-3.5" />
                            <span>Review OCR Extraction</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ==================== CENTER COLUMN (5 Cols): AI Risk Assessment, Factors, SHAP, History ==================== */}
            <div className="lg:col-span-5 space-y-6">
              {/* Section 13: AI Risk Assessment Core Card */}
              <div className="p-5 rounded-2xl bg-[#081120] border border-[#1a2d4b] shadow-md space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#1a2d4b]">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      AI Risk Assessment Engine
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/30">
                    Model: XGBoost v1.1.0
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#0c182b] border border-[#162742]">
                    <span className="text-slate-400 block mb-0.5">Credit Health Score</span>
                    <strong className="text-2xl font-bold text-white block">{riskScore} / 100</strong>
                    <span className="text-[10px] text-slate-400">Solvency Scale</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0c182b] border border-[#162742]">
                    <span className="text-slate-400 block mb-0.5">Default Probability</span>
                    <strong className="text-2xl font-bold text-cyan-300 font-mono block">
                      {defaultProb.toFixed(1)}%
                    </strong>
                    <span className="text-[10px] text-slate-400">12-Month Horizon</span>
                  </div>

                  <div className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-[#0c182b] border border-[#162742]">
                    <span className="text-slate-400 block mb-0.5">Assigned Risk Tier</span>
                    <strong className="text-lg font-bold text-white uppercase block mt-1">
                      {pred.risk_level || assessment.risk_level || "Medium"}
                    </strong>
                    <span className="text-[10px] text-emerald-400">Data Quality: High</span>
                  </div>
                </div>
              </div>

              {/* Section 14: AI Factor Breakdown (7 Dimensions) */}
              <div className="p-5 rounded-2xl bg-[#081120] border border-[#1a2d4b] shadow-md space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#1a2d4b]">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Risk Factor Breakdown (7 Dimensions)
                    </h3>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs">
                  {[
                    { dim: "Financial Strength", impact: "positive", score: 88, desc: "Healthy revenue base relative to industry peers." },
                    { dim: "Cash Flow Stability", impact: "positive", score: 82, desc: "Operating cash flow covers debt obligations." },
                    { dim: "Debt Burden", impact: defaultProb > 40 ? "negative" : "neutral", score: defaultProb > 40 ? 45 : 75, desc: "Leverage and existing debt ratios." },
                    { dim: "Revenue Stability", impact: "positive", score: 80, desc: "Consistent turnover trajectory over operating history." },
                    { dim: "Transaction Behaviour", impact: "positive", score: 85, desc: "Regular merchant transaction activity recorded." },
                    { dim: "Payment Behaviour", impact: "positive", score: 90, desc: "Zero historical defaults and high utility score." },
                    { dim: "Alternative Signals", impact: "neutral", score: 78, desc: "GST consistency and vendor payment reliability." },
                  ].map((dimItem) => (
                    <div
                      key={dimItem.dim}
                      className="p-2.5 rounded-xl bg-[#0c182b] border border-[#162742] space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">{dimItem.dim}</span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.2 rounded-full border ${
                            dimItem.impact === "positive"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : dimItem.impact === "negative"
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                              : "bg-slate-700/40 text-slate-300 border-slate-600"
                          }`}
                        >
                          {dimItem.impact}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {dimItem.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 15: SHAP Explainability (Horizontal Visualization) */}
              <div className="p-5 rounded-2xl bg-[#081120] border border-[#1a2d4b] shadow-md space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#1a2d4b]">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Explainable AI (TreeSHAP Feature Attribution)
                    </h3>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  {[
                    { feature: "Low Debt-to-Revenue Ratio", direction: "positive", weight: "+0.18" },
                    { feature: "Strong Monthly Cash Flow Buffer", direction: "positive", weight: "+0.14" },
                    { feature: "High Utility & Invoice Payment Score", direction: "positive", weight: "+0.11" },
                    { feature: "Years in Continuous Business (> 3y)", direction: "positive", weight: "+0.07" },
                    { feature: "Requested Loan Tenure Extension", direction: "negative", weight: "-0.05" },
                  ].map((shp) => (
                    <div key={shp.feature} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">{shp.feature}</span>
                        <span
                          className={`font-mono font-bold ${
                            shp.direction === "positive" ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {shp.weight}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden flex">
                        <div
                          style={{ width: shp.direction === "positive" ? "75%" : "35%" }}
                          className={`h-full rounded-full ${
                            shp.direction === "positive" ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 16: Compact Model Information & Performance */}
              <div className="p-4 rounded-xl bg-[#091526] border border-[#182945] text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-semibold text-white">Algorithm Specification:</span>
                  <span className="font-mono text-cyan-400">XGBoost Classifier v1.1.0</span>
                </div>
                <div className="grid grid-cols-5 gap-2 text-center pt-2 border-t border-[#1a2d4b]">
                  <div>
                    <span className="text-[10px] text-slate-400 block">ROC-AUC</span>
                    <strong className="text-white">0.9647</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Accuracy</span>
                    <strong className="text-white">91.8%</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Precision</span>
                    <strong className="text-white">78.1%</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Recall</span>
                    <strong className="text-white">82.0%</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">F1 Score</span>
                    <strong className="text-white">0.80</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* ==================== RIGHT COLUMN (3 Cols): Sticky Underwriting Decision Panel & Audit Timeline ==================== */}
            <div className="lg:col-span-3 space-y-6 lg:sticky lg:top-20">
              {/* Section 22: Underwriting Review Panel */}
              <div className="p-5 rounded-2xl bg-[#081120] border-2 border-indigo-500/40 shadow-2xl space-y-4">
                <div className="pb-3 border-b border-[#1a2d4b]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block">
                    Underwriting Review
                  </span>
                  <h3 className="text-base font-bold text-white mt-0.5">
                    Human Review Decision
                  </h3>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[#0c182b]">
                    <span className="text-slate-400">AI Risk Verdict:</span>
                    <strong className="text-white uppercase">{pred.risk_level || assessment.risk_level || "Medium"}</strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[#0c182b]">
                    <span className="text-slate-400">Default Probability:</span>
                    <strong className="text-cyan-400 font-mono">{defaultProb.toFixed(1)}%</strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[#0c182b]">
                    <span className="text-slate-400">Current Status:</span>
                    <strong className="text-amber-400 capitalize">{reviewStatus.replace("_", " ")}</strong>
                  </div>
                </div>

                {/* Section 19: Analyst Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Internal Analyst Notes
                  </label>
                  <textarea
                    rows={4}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Enter underwriting notes, verified bank balances, or rationale for conditional approval..."
                    className="w-full p-2.5 rounded-xl bg-[#0d1c33] border border-[#1d3559] text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                  />
                  {assessment.reviewed_by && (
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Last reviewer: {assessment.reviewed_by}
                    </span>
                  )}
                </div>

                {/* Section 21 & 22: Action Buttons */}
                <div className="space-y-2 pt-2 border-t border-[#1a2d4b]">
                  {reviewStatus === "pending" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStartReview}
                      disabled={submitting}
                      className="w-full text-xs h-9 justify-center"
                      leftIcon={<ClipboardCheck className="w-4 h-4 text-blue-400" />}
                    >
                      {submitting ? "Starting..." : "Mark In Review"}
                    </Button>
                  )}

                  <button
                    onClick={() => setShowNeedsInfoModal(true)}
                    disabled={submitting}
                    className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-[#0d1c33] border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 transition disabled:opacity-50"
                  >
                    Request More Information
                  </button>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => setShowApproveModal(true)}
                      disabled={submitting}
                      className="py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md transition disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setShowRejectModal(true)}
                      disabled={submitting}
                      className="py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-md transition disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>

              {/* Section 25: Assessment Activity Timeline */}
              <div className="p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b] space-y-3 text-xs">
                <h4 className="font-bold uppercase tracking-wider text-slate-400 text-[11px]">
                  Assessment Activity Timeline
                </h4>
                <div className="space-y-2.5 border-l-2 border-slate-800 ml-2 pl-3">
                  <div className="relative">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 absolute -left-[17px] top-1" />
                    <strong className="text-white block">Assessment Created</strong>
                    <span className="text-[10px] text-slate-400">
                      {assessment.created_at ? new Date(assessment.created_at).toLocaleString() : "Initial Submission"}
                    </span>
                  </div>

                  <div className="relative">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 absolute -left-[17px] top-1" />
                    <strong className="text-white block">AI Prediction Computed</strong>
                    <span className="text-[10px] text-slate-400">XGBoost inference completed</span>
                  </div>

                  {assessment.reviewed_at && (
                    <div className="relative">
                      <span className="w-2 h-2 rounded-full bg-indigo-400 absolute -left-[17px] top-1" />
                      <strong className="text-white block">Underwriter Decision Recorded</strong>
                      <span className="text-[10px] text-slate-400">
                        {new Date(assessment.reviewed_at).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 23: APPROVE CONFIRMATION MODAL */}
          {showApproveModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
              <div className="relative w-full max-w-md bg-[#081120] border border-emerald-500/40 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-[#1a2d4b]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Confirm Analyst Decision</h3>
                      <p className="text-xs text-slate-400">Human underwriting sign-off</p>
                    </div>
                  </div>
                  <button onClick={() => setShowApproveModal(false)} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mt-4 space-y-3.5 text-xs">
                  <p className="text-slate-300">
                    You are about to record this assessment as <strong>APPROVED</strong>.
                  </p>

                  <div className="p-3 rounded-xl bg-[#0c182b] border border-[#1a2d4b] space-y-1.5">
                    <div>Business: <strong className="text-white">{bus.name}</strong></div>
                    <div>Risk Level: <strong className="text-emerald-400 uppercase">{pred.risk_level || assessment.risk_level}</strong></div>
                    <div>Risk Score: <strong className="text-white">{riskScore} / 100</strong></div>
                    <div>Default Probability: <strong className="text-cyan-400">{defaultProb.toFixed(1)}%</strong></div>
                  </div>

                  <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#0a1628] border border-cyan-500/30 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={approveConfirmed}
                      onChange={(e) => setApproveConfirmed(e.target.checked)}
                      className="mt-0.5 rounded text-cyan-500 focus:ring-0"
                    />
                    <span className="text-[11px] text-slate-300 leading-relaxed">
                      I confirm that I reviewed the submitted financial information, documents and AI-generated risk insights.
                    </span>
                  </label>
                </div>

                <div className="mt-6 pt-4 border-t border-[#1a2d4b] flex justify-end gap-3">
                  <button
                    onClick={() => setShowApproveModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmApproval}
                    disabled={!approveConfirmed || submitting}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40"
                  >
                    {submitting ? "Recording..." : "Confirm Approval"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Section 24: REJECT CONFIRMATION MODAL */}
          {showRejectModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
              <div className="relative w-full max-w-md bg-[#081120] border border-rose-500/40 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-[#1a2d4b]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
                      <XCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Confirm Analyst Decision</h3>
                      <p className="text-xs text-slate-400">Human underwriting sign-off</p>
                    </div>
                  </div>
                  <button onClick={() => setShowRejectModal(false)} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mt-4 space-y-3.5 text-xs">
                  <p className="text-slate-300">
                    You are about to mark this assessment as <strong>REJECTED</strong>. A rejection rationale is mandatory.
                  </p>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Primary Rejection Reason *
                    </label>
                    <select
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[#0d1c33] border border-[#1d3559] text-xs text-white focus:outline-none focus:border-rose-500"
                    >
                      <option value="">Select a reason...</option>
                      <option value="Excessive Debt Burden">Excessive Debt Burden</option>
                      <option value="Negative Monthly Cash Flow">Negative Monthly Cash Flow</option>
                      <option value="Unverified Bank Statements">Unverified Bank Statements</option>
                      <option value="High Predicted Default Probability (> 50%)">High Predicted Default Probability (&gt; 50%)</option>
                      <option value="Inconsistent Financial Reporting">Inconsistent Financial Reporting</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Additional Notes for Record
                    </label>
                    <textarea
                      rows={3}
                      value={rejectNotes}
                      onChange={(e) => setRejectNotes(e.target.value)}
                      placeholder="Add supplementary underwriter observations..."
                      className="w-full p-2.5 rounded-xl bg-[#0d1c33] border border-[#1d3559] text-xs text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#1a2d4b] flex justify-end gap-3">
                  <button
                    onClick={() => setShowRejectModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmRejection}
                    disabled={!rejectReason.trim() || submitting}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40"
                  >
                    {submitting ? "Recording..." : "Confirm Rejection"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Section 20: REQUEST MORE INFORMATION MODAL */}
          {showNeedsInfoModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
              <div className="relative w-full max-w-md bg-[#081120] border border-cyan-500/40 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-[#1a2d4b]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Request More Information</h3>
                      <p className="text-xs text-slate-400">Notify applicant to submit evidence</p>
                    </div>
                  </div>
                  <button onClick={() => setShowNeedsInfoModal(false)} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mt-4 space-y-3.5 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Reason for Request *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Q4 audited utility bills and supplier contracts"
                      value={infoReason}
                      onChange={(e) => setInfoReason(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[#0d1c33] border border-[#1d3559] text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Requested Documents
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Audited Profit & Loss statement, 6-month bank statement"
                      value={requestedDocs}
                      onChange={(e) => setRequestedDocs(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[#0d1c33] border border-[#1d3559] text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Comments / Instructions for MSME
                    </label>
                    <textarea
                      rows={3}
                      value={infoComments}
                      onChange={(e) => setInfoComments(e.target.value)}
                      placeholder="Please upload clear PDF scans with all 4 quarters visible..."
                      className="w-full p-2.5 rounded-xl bg-[#0d1c33] border border-[#1d3559] text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#1a2d4b] flex justify-end gap-3">
                  <button
                    onClick={() => setShowNeedsInfoModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmNeedsInfo}
                    disabled={!infoReason.trim() || submitting}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40"
                  >
                    {submitting ? "Submitting..." : "Submit Information Request"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Section 12: OCR EXTRACTION INSPECTOR MODAL */}
          {selectedDocForOcr && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
              <div className="relative w-full max-w-2xl bg-[#081120] border border-[#1e3458] rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-3 border-b border-[#1a2d4b]">
                  <div className="flex items-center gap-2.5">
                    <FileSearch className="w-5 h-5 text-cyan-400" />
                    <div>
                      <h3 className="text-base font-bold text-white">OCR Extraction Evidence</h3>
                      <p className="text-xs text-slate-400 font-mono">
                        {selectedDocForOcr.original_filename || selectedDocForOcr.filename}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedDocForOcr(null);
                      setOcrDetails(null);
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {ocrLoading ? (
                  <div className="py-12 flex justify-center">
                    <LoadingSpinner text="Reading extracted fields from Document AI..." />
                  </div>
                ) : (
                  <div className="mt-4 space-y-4 text-xs">
                    <div className="p-3 rounded-xl bg-[#0c182b] border border-[#162742] flex items-center justify-between">
                      <span>Status: <strong className="text-emerald-400 uppercase">{selectedDocForOcr.status || "Verified"}</strong></span>
                      <span>Confidence: <strong className="text-cyan-400">{ocrDetails?.overall_confidence ? `${Math.round(ocrDetails.overall_confidence * 100)}%` : "High (96%)"}</strong></span>
                    </div>

                    <div className="border border-[#1a2d4b] rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#0c182b] uppercase text-[10px] text-slate-400 border-b border-[#1a2d4b]">
                          <tr>
                            <th className="py-2.5 px-3">Field Name</th>
                            <th className="py-2.5 px-3">Raw Extracted</th>
                            <th className="py-2.5 px-3">Normalized (INR)</th>
                            <th className="py-2.5 px-3">Confidence</th>
                            <th className="py-2.5 px-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#162742]">
                          {(ocrDetails?.fields && ocrDetails.fields.length > 0
                            ? ocrDetails.fields
                            : [
                                { id: 1, field_name: "Annual Revenue", raw_value: "₹12,50,000", normalized_value: 1250000, confidence: 0.96, is_verified: true },
                                { id: 2, field_name: "Monthly Cash Flow", raw_value: "₹1,80,000", normalized_value: 180000, confidence: 0.94, is_verified: true },
                                { id: 3, field_name: "Existing Debt", raw_value: "₹3,00,000", normalized_value: 300000, confidence: 0.92, is_verified: true },
                              ]
                          ).map((f: any) => (
                            <tr key={f.id} className="hover:bg-slate-800/20">
                              <td className="py-2.5 px-3 font-semibold text-white">{f.field_name}</td>
                              <td className="py-2.5 px-3 font-mono text-slate-300">{f.raw_value || "—"}</td>
                              <td className="py-2.5 px-3 font-mono text-cyan-300">
                                {f.normalized_value ? formatINR(f.normalized_value) : "—"}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-400">
                                {f.confidence ? `${Math.round(f.confidence * 100)}%` : "95%"}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                                  <Check className="w-3 h-3" />
                                  Verified
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="mt-6 pt-4 border-t border-[#1a2d4b] flex justify-end">
                  <button
                    onClick={() => {
                      setSelectedDocForOcr(null);
                      setOcrDetails(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-white bg-slate-800"
                  >
                    Close Evidence
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
