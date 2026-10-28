import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  api,
  UnifiedWorkspaceData,
  EvidenceItem,
  ReviewChecklistItem,
  DecisionOverrideItem,
  PolicyRuleResultItem
} from "../services/api";
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Info,
  BrainCircuit,
  FileText,
  ExternalLink,
  Sliders,
  Scale,
  Download,
  AlertOctagon,
  RefreshCw,
  HelpCircle,
  Eye,
  Send,
  UserCheck
} from "lucide-react";
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from "./ui/Card";
import Button from "./ui/Button";
import LoadingSpinner from "./LoadingSpinner";
import { useToast } from "./ui/Toast";

interface Props {
  assessmentId: number;
}

export default function CreditDecisionWorkspace({ assessmentId }: Props) {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<
    "overview" | "evidence" | "xai" | "policy" | "history"
  >("overview");

  // Modals state
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Review action form state
  const [reviewActionType, setReviewActionType] = useState("STATUS_CHANGE");
  const [reviewNewStatus, setReviewNewStatus] = useState("REVIEW_IN_PROGRESS");
  const [reviewRecommendation, setReviewRecommendation] = useState("APPROVE");
  const [reviewReasonCode, setReviewReasonCode] = useState("VERIFIED_CASH_FLOW");
  const [reviewNotes, setReviewNotes] = useState("");

  // Override form state
  const [overrideFinalDecision, setOverrideFinalDecision] = useState("APPROVE");
  const [overrideFinalRiskBand, setOverrideFinalRiskBand] = useState("LOW");
  const [overrideType, setOverrideType] = useState("DECISION_OVERRIDE");
  const [overrideReasonCode, setOverrideReasonCode] = useState(
    "SUBSTANTIAL_UNENCUMBERED_COLLATERAL"
  );
  const [overrideRationale, setOverrideRationale] = useState("");

  // Workspace Query
  const {
    data: workspace,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery<UnifiedWorkspaceData>({
    queryKey: ["credit-decision-workspace", assessmentId],
    queryFn: () => api.getAssessmentWorkspace(assessmentId),
    enabled: !!assessmentId,
    staleTime: 20 * 1000
  });

  // Re-evaluate Policy Mutation
  const evaluatePolicyMutation = useMutation({
    mutationFn: () => api.evaluatePolicy(assessmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-decision-workspace", assessmentId] });
      toast.success("Policy Re-evaluated", "Assessment evaluated against active underwriting policy.");
    },
    onError: (err: any) => {
      toast.error("Policy Evaluation Failed", err?.message || "Could not re-evaluate policy.");
    }
  });

  // Submit Review Action Mutation
  const submitReviewMutation = useMutation({
    mutationFn: () =>
      api.recordCreditReviewAction(assessmentId, {
        action_type: reviewActionType,
        new_status: reviewNewStatus,
        recommendation: reviewRecommendation,
        reason_code: reviewReasonCode,
        notes: reviewNotes.trim() || undefined,
        evidence_references: []
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-decision-workspace", assessmentId] });
      queryClient.invalidateQueries({ queryKey: ["assessment", assessmentId] });
      setShowReviewModal(false);
      setReviewNotes("");
      toast.success("Review Action Recorded", "Underwriter review action recorded successfully.");
    },
    onError: (err: any) => {
      toast.error("Action Failed", err?.message || "Could not record review action.");
    }
  });

  // Submit Override Mutation
  const submitOverrideMutation = useMutation({
    mutationFn: () =>
      api.recordDecisionOverride(assessmentId, {
        final_decision: overrideFinalDecision,
        final_risk_band: overrideFinalRiskBand,
        override_type: overrideType,
        reason_code: overrideReasonCode,
        rationale: overrideRationale.trim(),
        evidence_references: []
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-decision-workspace", assessmentId] });
      queryClient.invalidateQueries({ queryKey: ["assessment", assessmentId] });
      setShowOverrideModal(false);
      setOverrideRationale("");
      toast.success("Override Recorded", "Auditable decision override persisted successfully.");
    },
    onError: (err: any) => {
      toast.error("Override Failed", err?.message || "Could not record decision override.");
    }
  });

  // Export Report Handler
  const handleExportReport = async () => {
    try {
      const report = await api.getAssessmentReviewReport(assessmentId);
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Credit_Decision_Report_Assessment_${assessmentId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Report Exported", "Decision intelligence audit report downloaded.");
    } catch (err: any) {
      toast.error("Export Failed", err?.message || "Could not generate report export.");
    }
  };

  if (isLoading) {
    return (
      <Card className="p-8 text-center bg-[#1C1933] border-[#383154]">
        <LoadingSpinner text="Consolidating multi-source evidence, policy rules & XAI telemetry..." />
      </Card>
    );
  }

  if (isError || !workspace) {
    return (
      <Card className="p-6 bg-rose-950/20 border-rose-500/30 text-rose-300">
        <div className="flex items-center gap-2 mb-2 font-semibold">
          <AlertTriangle className="w-5 h-5 text-rose-400" />
          <span>Failed to load Unified Credit Decision Workspace</span>
        </div>
        <p className="text-xs text-rose-400/80">{(error as any)?.message || "Unknown error"}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. SEPARATE WORKFLOW STATUS BAR */}
      <div className="p-4 rounded-2xl bg-[#1C1933] border border-[#383154] shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
              Distinct Workflow Statuses:
            </div>

            {/* Model Status */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#0C0A1D] border border-[#383154] text-xs">
              <span className="text-slate-400">Model:</span>
              <span
                className={`font-semibold ${
                  workspace.model_status === "COMPLETED" ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {workspace.model_status}
              </span>
            </div>

            {/* Verification Status */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#0C0A1D] border border-[#383154] text-xs">
              <span className="text-slate-400">Verification:</span>
              <span
                className={`font-semibold ${
                  workspace.verification_status === "VERIFIED"
                    ? "text-emerald-400"
                    : workspace.verification_status === "DISCREPANCY_FLAGGED"
                    ? "text-rose-400"
                    : "text-amber-400"
                }`}
              >
                {workspace.verification_status}
              </span>
            </div>

            {/* Policy Status */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#0C0A1D] border border-[#383154] text-xs">
              <span className="text-slate-400">Policy Rules:</span>
              <span
                className={`font-semibold ${
                  workspace.policy_status === "PASS"
                    ? "text-emerald-400"
                    : workspace.policy_status === "FAIL"
                    ? "text-rose-400"
                    : "text-amber-400"
                }`}
              >
                {workspace.policy_status}
              </span>
            </div>

            {/* Human Review Status */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#0C0A1D] border border-[#8B5CF6]/40 text-xs">
              <span className="text-slate-400">Underwriter:</span>
              <span className="font-semibold text-[#A78BFA]">{workspace.human_review_status}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="w-3.5 h-3.5 text-[#A78BFA]" />}
              onClick={handleExportReport}
            >
              Export Report
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<UserCheck className="w-3.5 h-3.5 text-emerald-400" />}
              onClick={() => setShowReviewModal(true)}
            >
              Record Review
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Scale className="w-3.5 h-3.5 text-white" />}
              onClick={() => setShowOverrideModal(true)}
            >
              Decision Override
            </Button>
          </div>
        </div>

        {/* Active Override Banner if present */}
        {workspace.active_override && (
          <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <AlertOctagon className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <div className="text-amber-300 font-bold">
                Active Underwriter Override: {workspace.active_override.final_decision} (Risk Band:{" "}
                {workspace.active_override.final_risk_band})
              </div>
              <div className="text-slate-300 mt-0.5">
                Original Model Score: {workspace.active_override.original_model_output.toFixed(1)}% ({workspace.active_override.original_risk_band}) • Reason:{" "}
                <span className="font-semibold">{workspace.active_override.reason_code}</span> — {workspace.active_override.rationale}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. SUB-NAVIGATION TABS */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#383154] pb-2">
        {[
          { key: "overview", label: "Overview & Checklist" },
          { key: "evidence", label: "7-Category Evidence Summary" },
          { key: "xai", label: "TreeSHAP Risk Attribution" },
          { key: "policy", label: "Underwriting Policy Rules" },
          { key: "history", label: "Review & Override History" }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === tab.key
                ? "bg-[#8B5CF6] text-white shadow-md shadow-[#8B5CF6]/25"
                : "bg-[#1C1933] text-slate-300 hover:bg-[#252141] border border-[#383154]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW & CHECKLIST */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 bg-[#1C1933] border-[#383154]">
              <div className="text-xs text-slate-400">Default Probability</div>
              <div className="text-2xl font-bold text-white mt-1 font-mono">
                {workspace.default_probability.toFixed(1)}%
              </div>
              <div className="text-[11px] text-[#A78BFA] mt-1">
                Risk Score: <b>{workspace.risk_score} / 100</b>
              </div>
            </Card>

            <Card className="p-4 bg-[#1C1933] border-[#383154]">
              <div className="text-xs text-slate-400">Model Assigned Risk Band</div>
              <div className="text-2xl font-bold mt-1 font-mono">
                <span
                  className={
                    workspace.risk_level === "LOW"
                      ? "text-emerald-400"
                      : workspace.risk_level === "HIGH"
                      ? "text-rose-400"
                      : "text-amber-400"
                  }
                >
                  {workspace.risk_level}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Model: <b>v{workspace.model_version}</b>
              </div>
            </Card>

            <Card className="p-4 bg-[#1C1933] border-[#383154]">
              <div className="text-xs text-slate-400">Data Completeness</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">
                {workspace.data_completeness_pct.toFixed(0)}%
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Heuristic input quality index
              </div>
            </Card>

            <Card className="p-4 bg-[#1C1933] border-[#383154]">
              <div className="text-xs text-slate-400">Business Tenure & Scale</div>
              <div className="text-2xl font-bold text-white mt-1 font-mono">
                {workspace.business_age} yrs
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Workforce: <b>{workspace.employees} employees</b>
              </div>
            </Card>
          </div>

          {/* Underwriting Verification Checklist */}
          <Card className="bg-[#1C1933] border-[#383154]">
            <CardHeader className="border-b border-[#383154]">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Underwriting Verification Checklist</CardTitle>
                  <CardDescription>
                    Multi-factor operational readiness check for credit underwriting sign-off
                  </CardDescription>
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  {workspace.review_checklist.filter((c) => c.is_completed).length} of{" "}
                  {workspace.review_checklist.length} Complete
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {workspace.review_checklist.map((item) => (
                <div
                  key={item.item_id}
                  className="p-3.5 rounded-xl bg-[#0C0A1D] border border-[#383154] flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    {item.is_completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : item.status === "ACTION_REQUIRED" ? (
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="text-xs font-semibold text-white">{item.label}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{item.details}</div>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      item.is_completed
                        ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/20"
                        : item.status === "ACTION_REQUIRED"
                        ? "bg-amber-950/60 text-amber-400 border border-amber-500/20"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: 7-CATEGORY EVIDENCE SUMMARY */}
      {activeTab === "evidence" && (
        <div className="space-y-6">
          {/* Conflicting / Unverified Discrepancies Alert */}
          {workspace.evidence_summary.conflicting_unverified.length > 0 && (
            <Card className="bg-rose-950/20 border-rose-500/30">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <AlertOctagon className="w-5 h-5 text-rose-400" />
                  <CardTitle className="text-rose-300">
                    Category 4: Flagged Evidence Conflicts & Discrepancies
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                {workspace.evidence_summary.conflicting_unverified.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-[#0C0A1D] border border-rose-500/30 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-white">{item.display_name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-semibold">
                        CONFLICT DETECTED
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
                      <div>Declared: <b>{item.declared_value}</b></div>
                      <div>Document Extracted (OCR): <b>{item.extracted_ocr_value}</b> ({item.source_document})</div>
                    </div>
                    {item.notes && <div className="text-slate-400 text-[11px] mt-2">{item.notes}</div>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Derived Financial Metrics */}
          <Card className="bg-[#1C1933] border-[#383154]">
            <CardHeader className="border-b border-[#383154]">
              <CardTitle>Category 5: Derived Financial Ratios</CardTitle>
              <CardDescription>
                Calculated underwriting ratios evaluating solvency, debt service, and operating runway
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {workspace.evidence_summary.derived_financial_metrics.map((m, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-[#0C0A1D] border border-[#383154]">
                  <div className="text-[11px] text-slate-400">{m.metric}</div>
                  <div className="text-xl font-bold text-white mt-1 font-mono">{m.value}</div>
                  <div className="text-[10px] text-[#A78BFA] mt-1 font-semibold uppercase">
                    Rating: {m.assessment}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Declared vs Extracted Evidence Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category 1: Applicant Declared */}
            <Card className="bg-[#1C1933] border-[#383154]">
              <CardHeader className="border-b border-[#383154]">
                <CardTitle>Category 1: Applicant-Declared Information</CardTitle>
                <CardDescription>Self-reported borrower application data</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-left text-xs border-collapse">
                  <tbody className="divide-y divide-[#252141] text-slate-300">
                    {workspace.evidence_summary.applicant_declared.map((item, idx) => (
                      <tr key={idx} className="hover:bg-[#252141]/50">
                        <td className="py-2.5 px-4 text-slate-400">{item.field}</td>
                        <td className="py-2.5 px-4 font-mono font-medium text-white text-right">
                          {String(item.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Category 2: Document Extracted */}
            <Card className="bg-[#1C1933] border-[#383154]">
              <CardHeader className="border-b border-[#383154]">
                <CardTitle>Category 2 & 3: Document Extracted & Verified</CardTitle>
                <CardDescription>Supporting documentation telemetry</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {workspace.evidence_summary.document_extracted.length === 0 ? (
                  <div className="text-xs text-slate-400 text-center py-6">
                    No document extraction records available for this application.
                  </div>
                ) : (
                  workspace.evidence_summary.document_extracted.map((doc, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-[#0C0A1D] border border-[#383154]">
                      <div className="flex items-center justify-between text-xs font-semibold text-white">
                        <span>{doc.document_name}</span>
                        <span className="text-[10px] font-mono text-[#A78BFA]">{doc.document_type}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Status: <b>{doc.processing_status}</b> • Source: {doc.source}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 3: TREESHAP RISK ATTRIBUTION */}
      {activeTab === "xai" && (
        <div className="space-y-6">
          <Card className="bg-[#1C1933] border-[#383154]">
            <CardHeader className="border-b border-[#383154]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle>TreeSHAP Feature Attributions</CardTitle>
                  <CardDescription>
                    Exact additive decomposition of model output into baseline log-odds and feature contributions
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<ExternalLink className="w-3.5 h-3.5 text-[#A78BFA]" />}
                  onClick={() => navigate(`/explainability/${assessmentId}`)}
                >
                  Full Waterfall & Counterfactuals
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Baseline & Margin summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#0C0A1D] border border-[#383154]">
                <div>
                  <div className="text-xs text-slate-400">Baseline Expected Probability</div>
                  <div className="text-xl font-bold text-white mt-1 font-mono">
                    {(workspace.baseline_value * 100).toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Portfolio average reference expectation
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Model Raw Margin (Log-Odds)</div>
                  <div className="text-xl font-bold text-[#A78BFA] mt-1 font-mono">
                    {workspace.raw_margin.toFixed(3)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Additive sum of TreeSHAP values
                  </div>
                </div>
              </div>

              {/* Drivers columns */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Risk Drivers (Positive SHAP -> Higher Risk) */}
                <div className="space-y-3">
                  <div className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Top Factors Increasing Estimated Risk</span>
                  </div>
                  {workspace.top_positive_drivers.length === 0 ? (
                    <div className="text-xs text-slate-400 p-4 rounded-xl bg-[#0C0A1D]">
                      No significant adverse risk factors detected.
                    </div>
                  ) : (
                    workspace.top_positive_drivers.map((d, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-[#0C0A1D] border border-rose-500/20 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white">{d.display_name || d.feature}</span>
                          <span className="font-mono text-rose-400 font-bold">
                            +{d.contribution ? d.contribution.toFixed(3) : "—"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300 mt-1">
                          {d.plain_text_explanation || d.reason}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Mitigating Drivers (Negative SHAP -> Lower Risk) */}
                <div className="space-y-3">
                  <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Top Factors Decreasing Estimated Risk</span>
                  </div>
                  {workspace.top_negative_drivers.length === 0 ? (
                    <div className="text-xs text-slate-400 p-4 rounded-xl bg-[#0C0A1D]">
                      No significant mitigating factors detected.
                    </div>
                  ) : (
                    workspace.top_negative_drivers.map((d, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-[#0C0A1D] border border-emerald-500/20 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white">{d.display_name || d.feature}</span>
                          <span className="font-mono text-emerald-400 font-bold">
                            {d.contribution ? d.contribution.toFixed(3) : "—"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300 mt-1">
                          {d.plain_text_explanation || d.reason}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: UNDERWRITING POLICY RULES */}
      {activeTab === "policy" && (
        <div className="space-y-6">
          <Card className="bg-[#1C1933] border-[#383154]">
            <CardHeader className="border-b border-[#383154]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle>Institutional Credit Policy Rules</CardTitle>
                  <CardDescription>
                    Rule-engine evaluation separate from statistical ML inference
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-400">
                    Policy: {workspace.policy_evaluation?.policy_version || "1.0.0"}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<RefreshCw className={`w-3.5 h-3.5 ${evaluatePolicyMutation.isPending ? "animate-spin" : ""}`} />}
                    onClick={() => evaluatePolicyMutation.mutate()}
                    disabled={evaluatePolicyMutation.isPending}
                  >
                    Re-evaluate
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              {workspace.policy_evaluation?.rule_results?.map((rule) => (
                <div
                  key={rule.rule_id}
                  className="p-3.5 rounded-xl bg-[#0C0A1D] border border-[#383154] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{rule.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">({rule.rule_id})</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{rule.rationale}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        rule.status === "PASS"
                          ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/20"
                          : rule.status === "FAIL"
                          ? "bg-rose-950/60 text-rose-400 border border-rose-500/20"
                          : "bg-amber-950/60 text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      {rule.status}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 5: REVIEW & OVERRIDE HISTORY */}
      {activeTab === "history" && (
        <div className="space-y-6">
          {/* Overrides Table */}
          <Card className="bg-[#1C1933] border-[#383154]">
            <CardHeader className="border-b border-[#383154]">
              <CardTitle>Auditable Human Decision Overrides</CardTitle>
              <CardDescription>
                Historical overrides where authorized underwriter outcome differed from model recommendation
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {workspace.overrides.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-6">
                  No decision overrides recorded for this application.
                </div>
              ) : (
                workspace.overrides.map((ov) => (
                  <div
                    key={ov.id}
                    className="p-3.5 rounded-xl bg-[#0C0A1D] border border-[#383154] text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-300">
                        {ov.final_decision} (Risk Band: {ov.final_risk_band})
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(ov.created_at).toLocaleString()} by {ov.actor_id} ({ov.actor_role})
                      </span>
                    </div>
                    <div className="text-slate-300">
                      Reason Code: <b>{ov.reason_code}</b>
                    </div>
                    <div className="text-slate-400 text-[11px] italic">"{ov.rationale}"</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Underwriter Review Trail */}
          <Card className="bg-[#1C1933] border-[#383154]">
            <CardHeader className="border-b border-[#383154]">
              <CardTitle>Underwriter Review Audit Trail</CardTitle>
              <CardDescription>
                Chronological record of all analyst transitions and notes
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {workspace.review_history.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-6">
                  No previous review events recorded.
                </div>
              ) : (
                workspace.review_history.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-3.5 rounded-xl bg-[#0C0A1D] border border-[#383154] text-xs flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="font-semibold text-white">
                        {rev.action_type} • Status: {rev.new_status}
                      </div>
                      {rev.recommendation && (
                        <div className="text-[#A78BFA] mt-0.5">
                          Recommendation: <b>{rev.recommendation}</b>
                        </div>
                      )}
                      {rev.notes && <div className="text-slate-300 mt-1">{rev.notes}</div>}
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {new Date(rev.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL: RECORD REVIEW ACTION */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-[#1C1933] border border-[#383154] p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Record Underwriter Review Action</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">Review Workflow Action</label>
                <select
                  value={reviewNewStatus}
                  onChange={(e) => setReviewNewStatus(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#0C0A1D] border border-[#383154] text-white"
                >
                  <option value="REVIEW_IN_PROGRESS">Review In Progress</option>
                  <option value="NEEDS_MORE_INFORMATION">Needs More Information</option>
                  <option value="ESCALATED">Escalate to Senior Committee</option>
                  <option value="REVIEW_COMPLETED">Complete Underwriting Review</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Recommendation</label>
                <select
                  value={reviewRecommendation}
                  onChange={(e) => setReviewRecommendation(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#0C0A1D] border border-[#383154] text-white"
                >
                  <option value="APPROVE">Approve</option>
                  <option value="REJECT">Reject</option>
                  <option value="REFER">Refer to Senior Committee</option>
                  <option value="CONDITIONAL_APPROVAL">Conditional Approval</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Reason Code</label>
                <select
                  value={reviewReasonCode}
                  onChange={(e) => setReviewReasonCode(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#0C0A1D] border border-[#383154] text-white"
                >
                  <option value="VERIFIED_CASH_FLOW">Verified Strong Operating Cash Flow</option>
                  <option value="COLLATERAL_BACKED">Sufficient Unencumbered Collateral</option>
                  <option value="DEBT_BURDEN_CONCERN">Excessive Aggregate Debt Leverage</option>
                  <option value="UNRESOLVED_DISCREPANCY">Unresolved Document Discrepancy</option>
                  <option value="SEASONAL_CYCLE">Seasonal Portfolio Timing</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Underwriter Written Notes</label>
                <textarea
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Document formal justification, verified findings, or mitigation steps..."
                  className="w-full p-2.5 rounded-xl bg-[#0C0A1D] border border-[#383154] text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowReviewModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => submitReviewMutation.mutate()}
                disabled={submitReviewMutation.isPending}
              >
                {submitReviewMutation.isPending ? "Submitting..." : "Submit Review Action"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DECISION OVERRIDE */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-[#1C1933] border border-amber-500/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-400">
              <Scale className="w-5 h-5" />
              <h3 className="text-lg font-bold text-white">Execute Auditable Decision Override</h3>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
              Original Model Score: <b>{workspace.default_probability.toFixed(1)}% ({workspace.risk_level})</b>.
              Overrides do NOT alter historical model prediction logs. All overrides are permanently recorded in the institutional audit ledger.
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1">Final Human Decision</label>
                  <select
                    value={overrideFinalDecision}
                    onChange={(e) => setOverrideFinalDecision(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-[#0C0A1D] border border-[#383154] text-white"
                  >
                    <option value="APPROVE">Approve</option>
                    <option value="REJECT">Reject</option>
                    <option value="REFER">Refer to Credit Committee</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Final Risk Band</label>
                  <select
                    value={overrideFinalRiskBand}
                    onChange={(e) => setOverrideFinalRiskBand(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-[#0C0A1D] border border-[#383154] text-white"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Override Reason Code</label>
                <select
                  value={overrideReasonCode}
                  onChange={(e) => setOverrideReasonCode(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#0C0A1D] border border-[#383154] text-white"
                >
                  <option value="SUBSTANTIAL_UNENCUMBERED_COLLATERAL">Substantial Unencumbered Collateral Pledged</option>
                  <option value="ESTABLISHED_GROUP_GUARANTEE">Corporate Group Guarantee Executed</option>
                  <option value="SEASONAL_WORKING_CAPITAL_SURGE">Verified Seasonal Working Capital Fluctuation</option>
                  <option value="PROVEN_POST_AUDIT_DELEVERAGING">Proven Post-Filing Debt Liquidation</option>
                  <option value="POLICY_EXCEPTION_AUTHORIZED">Executive Risk Committee Policy Exception</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">
                  Mandatory Written Rationale <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={overrideRationale}
                  onChange={(e) => setOverrideRationale(e.target.value)}
                  placeholder="State the comprehensive underwriting justification and mitigating documentation references..."
                  className="w-full p-2.5 rounded-xl bg-[#0C0A1D] border border-[#383154] text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowOverrideModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => submitOverrideMutation.mutate()}
                disabled={!overrideRationale.trim() || submitOverrideMutation.isPending}
              >
                {submitOverrideMutation.isPending ? "Executing..." : "Confirm & Commit Override"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
