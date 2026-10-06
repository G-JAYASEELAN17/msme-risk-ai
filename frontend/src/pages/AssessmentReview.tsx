import { useState, useEffect, useCallback } from "react";
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
  HelpCircle,
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
} from "lucide-react";
import { api } from "../services/api";
import Sidebar from "../components/Sidebar";
import Button from "../components/ui/Button";
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { RiskBadge } from "../components/ui/Badge";
import ErrorMessage from "../components/ErrorMessage";
import { Skeleton } from "../components/ui/Skeleton";
import ConfirmationDialog from "../components/ui/ConfirmationDialog";
import WhatIfSimulator from "../components/WhatIfSimulator";

export default function AssessmentReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Review Form State
  const [reviewNotes, setReviewNotes] = useState("");
  const [additionalComments, setAdditionalComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState("");

  // Confirmation Dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"approved" | "rejected" | "needs_info" | null>(null);

  // What-If Modal toggle
  const [showSimulator, setShowSimulator] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"overview" | "financials" | "xai" | "history" | "report">("overview");

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
    } catch (err: any) {
      console.error("Failed to load assessment details:", err);
      setError(err.message || "Failed to load assessment details. Check analyst permissions.");
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Handle Action Execution after Confirmation
  const executeReviewDecision = async (status: "in_review" | "approved" | "rejected" | "needs_info") => {
    try {
      setSubmitting(true);
      setError("");
      setActionSuccess("");

      await api.reviewAssessment(
        assessmentId,
        status,
        reviewNotes.trim() || undefined,
        additionalComments.trim() || undefined
      );

      setActionSuccess(`Assessment status successfully updated to ${status.toUpperCase().replace("_", " ")}.`);
      await fetchDetails();
    } catch (err: any) {
      console.error("Error submitting review decision:", err);
      setError(err.message || "Failed to record review decision.");
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
      setPendingAction(null);
    }
  };

  const handleStartReview = async () => {
    await executeReviewDecision("in_review");
  };

  const handleOpenConfirm = (action: "approved" | "rejected" | "needs_info") => {
    setPendingAction(action);
    setConfirmOpen(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#030712] text-slate-100">
        <Sidebar active="Reports" />
        <main className="flex-1 p-6 max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48 bg-slate-800/50" />
          <Skeleton className="h-64 w-full bg-slate-800/40" />
          <Skeleton className="h-96 w-full bg-slate-800/40" />
        </main>
      </div>
    );
  }

  if (error && !assessment) {
    return (
      <div className="flex min-h-screen bg-[#030712] text-slate-100">
        <Sidebar active="Reports" />
        <main className="flex-1 p-6 max-w-7xl mx-auto">
          <Button variant="outline" size="sm" onClick={() => navigate("/analyst")} leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back to Queue
          </Button>
          <div className="mt-6">
            <ErrorMessage message={error} />
          </div>
        </main>
      </div>
    );
  }

  const pred = assessment?.prediction || {};
  const bus = assessment?.business || {};
  const fin = assessment?.financials || {};
  const alt = assessment?.alternative_indicators || {};
  const riskScore = Math.max(0, Math.round(100 - (pred.default_probability || 0)));
  const reviewStatus = (assessment?.review_status || "pending").toLowerCase();

  return (
    <div className="flex min-h-screen bg-[#030712] text-slate-100">
      <Sidebar active="Reports" />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto overflow-y-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/analyst")}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Queue
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-indigo-400">#{assessment.id}</span>
                <span className="text-slate-500">•</span>
                <span className="text-xs text-slate-400">
                  Submitted {new Date(assessment.created_at).toLocaleDateString()}
                </span>
                <ReviewBadge status={reviewStatus} />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 mt-0.5">
                {bus.name}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSimulator(true)}
              leftIcon={<Sliders className="w-4 h-4 text-cyan-400" />}
            >
              What-If Simulator
            </Button>
            {reviewStatus === "pending" && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleStartReview}
                disabled={submitting}
                leftIcon={<ClipboardCheck className="w-4 h-4" />}
              >
                Start Review
              </Button>
            )}
          </div>
        </div>

        {/* DECISION SUPPORT MANDATORY BANNER */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/40 via-[#0e1e38] to-slate-900 border border-indigo-500/30 flex items-start gap-3.5 shadow-lg">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
            <Info className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white tracking-wide uppercase flex items-center gap-2">
              <span>AI Risk Assessment</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono normal-case">
                Decision Support Only
              </span>
            </h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              <strong>AI-generated risk assessment for analyst review.</strong> The automated predictive engine identifies historical pattern correlations and default probabilities. The final lending authorization remains exclusively with the human underwriting team and accredited financial institution.
            </p>
          </div>
        </div>

        {/* Notification / Success / Error feedback */}
        {actionSuccess && (
          <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}
        {error && <ErrorMessage message={error} />}

        {/* Top Metric Strip: Credit Score, Default Prob, Category, Confidence */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-[#0b1528] border-[#1e293b]">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-medium">AI Health Score</span>
                <div className="text-2xl font-bold text-white mt-0.5">{riskScore}/100</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">
                {riskScore}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#0b1528] border-[#1e293b]">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-medium">Default Probability</span>
                <div className="text-2xl font-bold text-white mt-0.5 font-mono">
                  {(pred.default_probability || 0).toFixed(1)}%
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                <TrendingDown className="w-5 h-5 text-indigo-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#0b1528] border-[#1e293b]">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-medium">Risk Category</span>
                <div className="mt-1">
                  <RiskBadge level={pred.risk_level || "UNKNOWN"} />
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#0b1528] border-[#1e293b]">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-medium">Model Confidence</span>
                <div className="text-2xl font-bold text-white mt-0.5 font-mono">
                  {(pred.confidence || 0).toFixed(1)}%
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-mono">
                v{pred.model_version || "1.1.0"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-[#1e293b] pb-2 text-sm">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === "overview"
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Overview & Business
          </button>
          <button
            onClick={() => setActiveTab("financials")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === "financials"
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Financials & Indicators
          </button>
          <button
            onClick={() => setActiveTab("xai")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === "xai"
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Explainable AI Factors
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === "history"
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Prior History ({assessment.history?.length || 0})
          </button>
          {assessment.report && (
            <button
              onClick={() => setActiveTab("report")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === "report"
                  ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Generated Report
            </button>
          )}
        </div>

        {/* Tab 1: Overview & Business */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-[#0b1528] border-[#1e293b]">
              <CardHeader className="p-4 sm:p-5 border-b border-[#1e293b]">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-400" />
                  Business Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-3.5 text-sm">
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Legal Name</span>
                  <span className="font-semibold text-white">{bus.name}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Industry</span>
                  <span className="font-semibold text-white capitalize">{bus.industry}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Operating Age</span>
                  <span className="font-semibold text-white">{bus.age} Years</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Headcount</span>
                  <span className="font-semibold text-white">{bus.employees} Employees</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Location</span>
                  <span className="font-semibold text-white">{bus.location || "United States"}</span>
                </div>
                {bus.description && (
                  <div className="pt-2">
                    <span className="text-xs text-slate-400 block mb-1">Business Summary</span>
                    <p className="text-xs text-slate-300 leading-relaxed bg-[#081120] p-3 rounded-lg border border-[#1e293b]">
                      {bus.description}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-[#0b1528] border-[#1e293b]">
              <CardHeader className="p-4 sm:p-5 border-b border-[#1e293b]">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-indigo-400" />
                  Review State & Analyst Assignment
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-3.5 text-sm">
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Review Status</span>
                  <ReviewBadge status={reviewStatus} />
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Reviewed By</span>
                  <span className="font-mono text-xs text-slate-300">
                    {assessment.reviewed_by || "Unassigned"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Review Timestamp</span>
                  <span className="text-xs text-slate-300">
                    {assessment.reviewed_at ? new Date(assessment.reviewed_at).toLocaleString() : "Not finalized"}
                  </span>
                </div>
                {assessment.review_notes && (
                  <div className="pt-2">
                    <span className="text-xs text-slate-400 block mb-1">Active Review Notes</span>
                    <p className="text-xs text-slate-200 bg-[#081120] p-3 rounded-lg border border-[#1e293b]">
                      {assessment.review_notes}
                    </p>
                  </div>
                )}
                {assessment.additional_comments && (
                  <div className="pt-1">
                    <span className="text-xs text-slate-400 block mb-1">Internal Analyst Comments</span>
                    <p className="text-xs text-slate-200 bg-[#081120] p-3 rounded-lg border border-[#1e293b]">
                      {assessment.additional_comments}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab 2: Financials & Indicators */}
        {activeTab === "financials" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-[#0b1528] border-[#1e293b]">
              <CardHeader className="p-4 sm:p-5 border-b border-[#1e293b]">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  Primary Financials
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-3.5 text-sm">
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Annual Revenue</span>
                  <span className="font-semibold text-white font-mono">
                    ${(fin.annual_revenue || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Monthly Cash Flow</span>
                  <span className="font-semibold text-white font-mono">
                    ${(fin.monthly_cash_flow || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Monthly Operating Expenses</span>
                  <span className="font-semibold text-white font-mono">
                    ${(fin.monthly_expenses || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Existing Liabilities / Debt</span>
                  <span className="font-semibold text-white font-mono">
                    ${(fin.existing_debt || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Debt-to-Revenue Ratio</span>
                  <span className="font-semibold text-white font-mono">
                    {fin.annual_revenue
                      ? (((fin.existing_debt || 0) / fin.annual_revenue) * 100).toFixed(1)
                      : 0}
                    %
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#0b1528] border-[#1e293b]">
              <CardHeader className="p-4 sm:p-5 border-b border-[#1e293b]">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Alternative Credit Signals
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-3.5 text-sm">
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Digital Transactions / Month</span>
                  <span className="font-semibold text-white font-mono">
                    {alt.digital_transactions || 0}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Utility Payment Score</span>
                  <span className="font-semibold text-white font-mono">
                    {alt.utility_payment_score || 0}/100
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Invoice Payment Score</span>
                  <span className="font-semibold text-white font-mono">
                    {alt.invoice_payment_score || 0}/100
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Historical Default Incidents</span>
                  <span className="font-semibold text-white font-mono">
                    {alt.previous_defaults ?? 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab 3: Explainable AI Factors */}
        {activeTab === "xai" && (
          <div className="space-y-6">
            <Card className="bg-[#0b1528] border-[#1e293b]">
              <CardHeader className="p-4 sm:p-5 border-b border-[#1e293b]">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  SHAP Key Drivers & Top Influencing Factors
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(pred.top_factors || []).map((factor: string, i: number) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg bg-[#081120] border border-[#1e293b] flex items-center gap-2.5"
                    >
                      <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-mono text-xs font-bold shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-xs text-slate-200">
                        {typeof factor === "object" ? (factor as any)?.name || JSON.stringify(factor) : String(factor)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-[#0b1528] border-[#1e293b]">
                <CardHeader className="p-4 sm:p-5 border-b border-[#1e293b]">
                  <CardTitle className="text-base text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Positive Credit Drivers
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-2">
                  {(pred.positive_factors || []).length === 0 ? (
                    <span className="text-xs text-slate-500">None detected</span>
                  ) : (
                    (pred.positive_factors || []).map((pf: any, i: number) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2"
                      >
                        <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                        <span>{typeof pf === "object" ? (pf as any)?.name || JSON.stringify(pf) : String(pf)}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="bg-[#0b1528] border-[#1e293b]">
                <CardHeader className="p-4 sm:p-5 border-b border-[#1e293b]">
                  <CardTitle className="text-base text-rose-400 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Identified Default Risk Factors
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-2">
                  {(pred.risk_factors || []).length === 0 ? (
                    <span className="text-xs text-slate-500">No high-severity risks identified</span>
                  ) : (
                    (pred.risk_factors || []).map((rf: any, i: number) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                        <span>{typeof rf === "object" ? (rf as any)?.name || JSON.stringify(rf) : String(rf)}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Tab 4: Prior Assessment History */}
        {activeTab === "history" && (
          <Card className="bg-[#0b1528] border-[#1e293b]">
            <CardHeader className="p-4 sm:p-5 border-b border-[#1e293b]">
              <CardTitle className="text-base text-white flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-400" />
                Previous Assessment History for {bus.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(assessment.history || []).length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No prior assessment records found for this business. This is their initial underwriting cycle.
                </div>
              ) : (
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-[#081120] text-xs text-slate-400 uppercase tracking-wider border-b border-[#1e293b]">
                    <tr>
                      <th className="px-4 py-3">ID</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Annual Revenue</th>
                      <th className="px-4 py-3">Risk Level</th>
                      <th className="px-4 py-3">Default Prob</th>
                      <th className="px-4 py-3">Review Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e293b]">
                    {assessment.history.map((h: any) => (
                      <tr key={h.id} className="hover:bg-[#0f1d36]/60">
                        <td className="px-4 py-3 font-mono text-xs text-indigo-400">#{h.id}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {h.created_at ? new Date(h.created_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-white">
                          ${(h.annual_revenue || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <RiskBadge level={h.risk_level || "UNKNOWN"} />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {h.default_probability ? `${h.default_probability.toFixed(1)}%` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <ReviewBadge status={h.review_status || "pending"} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/analyst/review/${h.id}`)}
                            className="text-xs h-7 px-2"
                          >
                            Inspect
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tab 5: Generated Report */}
        {activeTab === "report" && assessment.report && (
          <Card className="bg-[#0b1528] border-[#1e293b]">
            <CardHeader className="p-4 sm:p-5 border-b border-[#1e293b]">
              <CardTitle className="text-base text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
                Structured Executive Assessment Report
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <pre className="p-4 rounded-lg bg-[#081120] border border-[#1e293b] text-xs text-slate-300 overflow-x-auto font-mono whitespace-pre-wrap">
                {JSON.stringify(assessment.report, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* ANALYST DECISION & ACTION PANEL */}
        <Card className="bg-gradient-to-b from-[#0e1a30] to-[#081120] border-indigo-500/30 shadow-xl">
          <CardHeader className="p-5 border-b border-[#1e293b]">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-indigo-400" />
              Underwriter Decision & Notes
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Record credit review observations, request additional borrower disclosures, or finalize loan authorization.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Review Notes (Shared with Borrower)
                </label>
                <textarea
                  rows={4}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Enter official credit evaluation notes, stipulations, or reasons for information requests..."
                  className="w-full p-3 bg-[#081120] border border-[#1e293b] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Additional Internal Comments (Institutional Audit Trail)
                </label>
                <textarea
                  rows={4}
                  value={additionalComments}
                  onChange={(e) => setAdditionalComments(e.target.value)}
                  placeholder="Internal underwriting notes, supervisory disclosures, or covenant recommendations..."
                  className="w-full p-3 bg-[#081120] border border-[#1e293b] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>
            </div>

            {/* Decision Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#1e293b]">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStartReview}
                  disabled={submitting || reviewStatus === "in_review"}
                  leftIcon={<Clock className="w-4 h-4 text-blue-400" />}
                >
                  Mark In Review
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenConfirm("needs_info")}
                  disabled={submitting}
                  leftIcon={<HelpCircle className="w-4 h-4 text-amber-400" />}
                >
                  Request More Info
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleOpenConfirm("rejected")}
                  disabled={submitting}
                  leftIcon={<XCircle className="w-4 h-4" />}
                >
                  Reject Assessment
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleOpenConfirm("approved")}
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                >
                  Approve Assessment
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Confirmation Modal */}
        <ConfirmationDialog
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => {
            if (pendingAction) {
              executeReviewDecision(pendingAction);
            }
          }}
          title={
            pendingAction === "approved"
              ? "Confirm Assessment Approval"
              : pendingAction === "rejected"
              ? "Confirm Assessment Rejection"
              : "Request Additional Information"
          }
          message={
            pendingAction === "approved"
              ? `Are you sure you want to APPROVE credit assessment #${assessment.id} for ${bus.name}? This will record your decision in the immutable audit log and dispatch an approval notification to the borrower.`
              : pendingAction === "rejected"
              ? `Are you sure you want to REJECT credit assessment #${assessment.id} for ${bus.name}? This decision will be logged and the borrower will be notified.`
              : `Confirm request for additional disclosures from ${bus.name}? They will be notified with your review notes.`
          }
          confirmText={
            pendingAction === "approved"
              ? "Approve Credit"
              : pendingAction === "rejected"
              ? "Reject Credit"
              : "Send Request"
          }
          variant={
            pendingAction === "approved"
              ? "primary"
              : pendingAction === "rejected"
              ? "danger"
              : "primary"
          }
          loading={submitting}
        />

        {/* Embedded What-If Simulator Modal */}
        {showSimulator && (
          <WhatIfSimulator
            assessmentId={assessmentId}
            baselineAssessment={{
              annual_revenue: fin.annual_revenue || 0,
              monthly_cash_flow: fin.monthly_cash_flow || 0,
              monthly_expenses: fin.monthly_expenses || 0,
              existing_debt: fin.existing_debt || 0,
              utility_payment_score: alt.utility_payment_score || 0,
              invoice_payment_score: alt.invoice_payment_score || 0,
              previous_defaults: alt.previous_defaults || 0,
            }}
            baselinePrediction={{
              default_probability: pred.default_probability || 0,
              risk_level: pred.risk_level || "MEDIUM",
              confidence: pred.confidence || 0,
              top_factors: pred.top_factors || [],
              positive_factors: pred.positive_factors || [],
              risk_factors: pred.risk_factors || [],
            }}
            onClose={() => setShowSimulator(false)}
          />
        )}
      </main>
    </div>
  );
}

function ReviewBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "approved") {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        Approved
      </span>
    );
  }
  if (s === "rejected") {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
        Rejected
      </span>
    );
  }
  if (s === "in_review") {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
        In Review
      </span>
    );
  }
  if (s === "needs_info") {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
        Needs Info
      </span>
    );
  }
  return (
    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700/40 text-slate-300 border border-slate-600/40">
      Pending
    </span>
  );
}
