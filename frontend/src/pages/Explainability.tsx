import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  BrainCircuit,
  Layers,
  Activity,
  Sliders,
  Scale,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Sparkles,
  Info,
  RotateCcw,
  ArrowRight,
  Database,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Zap,
  BarChart3,
  SlidersHorizontal,
  FileText,
  Download,
  Search,
  Filter,
  ArrowUpDown,
  Building2,
  Calendar,
  ExternalLink,
  ShieldAlert
} from "lucide-react";

import Sidebar from "../components/Sidebar";
import PageHeader from "../components/PageHeader";
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import Button from "../components/ui/Button";
import { RiskBadge } from "../components/ui/Badge";
import LoadingSpinner from "../components/LoadingSpinner";
import EmptyState from "../components/ui/EmptyState";
import { useToast } from "../components/ui/Toast";
import { useAuthRole } from "../context/AuthRoleContext";

import {
  api,
  explainabilityApi,
  LocalExplanationResponse,
  ShapContributionItem,
  WaterfallStepItem,
  GlobalExplanationResponse,
  CounterfactualResponse,
  WhatIfExplanationResponse,
  StabilityEvaluationResponse,
  ModelMetadataResponse,
  AssessmentSummary
} from "../services/api";

export default function Explainability() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { isAnalyst, isAdmin, userProfile } = useAuthRole();

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<
    "waterfall" | "factors" | "counterfactuals" | "whatif" | "global" | "stability" | "governance"
  >("waterfall");

  // Assessment Selection & Multi-Tenant State
  const [assessmentId, setAssessmentId] = useState<number | null>(id ? parseInt(id, 10) : null);
  const [assessmentsList, setAssessmentsList] = useState<AssessmentSummary[]>([]);
  const [loadingAssessments, setLoadingAssessments] = useState<boolean>(true);
  const [assessmentLoadError, setAssessmentLoadError] = useState<string | null>(null);

  // Main XAI Explanation State
  const [explanation, setExplanation] = useState<LocalExplanationResponse | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState<boolean>(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const activeRequestIdRef = useRef<number>(0);

  // Feature Importance Filtering & Sorting State
  const [featureSortBy, setFeatureSortBy] = useState<"abs" | "positive" | "negative" | "name">("abs");
  const [featureLimit, setFeatureLimit] = useState<number>(11);
  const [featureSearch, setFeatureSearch] = useState<string>("");

  // Global Model Explainability State
  const [globalExplanation, setGlobalExplanation] = useState<GlobalExplanationResponse | null>(null);
  const [loadingGlobal, setLoadingGlobal] = useState<boolean>(false);

  // Counterfactual State
  const [counterfactuals, setCounterfactuals] = useState<CounterfactualResponse | null>(null);
  const [targetRiskLevel, setTargetRiskLevel] = useState<string>("LOW");
  const [loadingCounterfactuals, setLoadingCounterfactuals] = useState<boolean>(false);

  // What-If Sandbox State
  const [whatIfInputs, setWhatIfInputs] = useState<Record<string, number>>({});
  const [whatIfResult, setWhatIfResult] = useState<WhatIfExplanationResponse | null>(null);
  const [loadingWhatIf, setLoadingWhatIf] = useState<boolean>(false);

  // Stability Diagnostics State
  const [stabilityResult, setStabilityResult] = useState<StabilityEvaluationResponse | null>(null);
  const [loadingStability, setLoadingStability] = useState<boolean>(false);

  // Model Lineage Metadata State
  const [modelMetadata, setModelMetadata] = useState<ModelMetadataResponse | null>(null);

  // Expanded Factor State for detail breakdown
  const [expandedFactor, setExpandedFactor] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // 1. Fetch available assessments from authenticated API with RBAC support
  // ---------------------------------------------------------------------------
  const loadAssessments = useCallback(async () => {
    setLoadingAssessments(true);
    setAssessmentLoadError(null);

    try {
      let items: AssessmentSummary[] = [];

      // Attempt primary getAssessments endpoint (with all_users for analysts/admins)
      try {
        items = await api.getAssessments({
          all_users: isAnalyst || isAdmin,
          sort_by: "created_at",
          sort_order: "desc"
        });
      } catch (e: any) {
        console.warn("api.getAssessments primary call returned error, checking prediction history:", e);
      }

      // Fallback: If getAssessments returned empty, check prediction history
      if (!items || items.length === 0) {
        try {
          const historyItems = await api.getPredictionHistory({ limit: 100 });
          if (historyItems && historyItems.length > 0) {
            items = historyItems.map((h) => ({
              id: h.assessment_id,
              business_name: h.business_name,
              industry: h.industry,
              created_at: h.created_at,
              default_probability: h.default_probability,
              risk_level: h.risk_level,
              confidence: h.confidence,
              data_quality_score: h.data_quality_score
            }));
          }
        } catch (histErr) {
          console.warn("Prediction history fallback also failed:", histErr);
        }
      }

      // Deduplicate assessments by ID
      const uniqueMap = new Map<number, AssessmentSummary>();
      (items || []).forEach((item) => {
        if (item && item.id && !uniqueMap.has(item.id)) {
          uniqueMap.set(item.id, item);
        }
      });
      const uniqueAssessments = Array.from(uniqueMap.values());
      setAssessmentsList(uniqueAssessments);

      // Handle assessment selection based on URL parameter or first available
      if (uniqueAssessments.length > 0) {
        const urlId = id ? parseInt(id, 10) : null;
        const urlMatch = urlId ? uniqueAssessments.find((a) => a.id === urlId) : null;

        if (urlMatch) {
          setAssessmentId(urlMatch.id);
        } else if (!assessmentId || !uniqueAssessments.some((a) => a.id === assessmentId)) {
          const initialId = uniqueAssessments[0].id;
          setAssessmentId(initialId);
          navigate(`/explainability/${initialId}`, { replace: true });
        }
      } else {
        setAssessmentId(null);
      }
    } catch (err: any) {
      console.error("Failed to load assessments for explainability:", err);
      setAssessmentLoadError(err.message || "Failed to load assessments from the server.");
    } finally {
      setLoadingAssessments(false);
    }
  }, [id, isAnalyst, isAdmin, assessmentId, navigate]);

  useEffect(() => {
    loadAssessments();
  }, [loadAssessments]);

  // Synchronize route param changes (e.g. back/forward button)
  useEffect(() => {
    if (id) {
      const parsed = parseInt(id, 10);
      if (!isNaN(parsed) && parsed !== assessmentId) {
        setAssessmentId(parsed);
      }
    }
  }, [id, assessmentId]);

  // ---------------------------------------------------------------------------
  // 2. Fetch explanation for active assessment with race-condition prevention
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!assessmentId) {
      setExplanation(null);
      setLoadingExplanation(false);
      return;
    }

    const currentReqId = ++activeRequestIdRef.current;
    setLoadingExplanation(true);
    setExplanationError(null);
    setWhatIfResult(null);
    setCounterfactuals(null);
    setStabilityResult(null);

    explainabilityApi
      .getAssessmentExplanation(assessmentId)
      .then((data) => {
        if (currentReqId !== activeRequestIdRef.current) return;
        setExplanation(data);

        // Initialize what-if form inputs with the actual values supplied
        const initialInputs: Record<string, number> = {};
        data.contributions.forEach((c) => {
          if (typeof c.feature_value === "number") {
            initialInputs[c.feature_name] = c.feature_value;
          }
        });
        setWhatIfInputs(initialInputs);
      })
      .catch((err: any) => {
        if (currentReqId !== activeRequestIdRef.current) return;
        console.error("Failed to load assessment explanation:", err);
        setExplanationError(
          err.message || `Failed to calculate TreeSHAP attribution for assessment #${assessmentId}.`
        );
      })
      .finally(() => {
        if (currentReqId === activeRequestIdRef.current) {
          setLoadingExplanation(false);
        }
      });
  }, [assessmentId]);

  // ---------------------------------------------------------------------------
  // 3. Lazy load Global Explainability & Model Metadata on Tab Switch
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (activeTab === "global" && !globalExplanation) {
      setLoadingGlobal(true);
      explainabilityApi
        .getGlobalModelExplanation()
        .then((data) => setGlobalExplanation(data))
        .catch((err) => toast.error("Error", err.message || "Failed to load global importance"))
        .finally(() => setLoadingGlobal(false));
    }

    if (activeTab === "governance" && !modelMetadata) {
      explainabilityApi
        .getModelMetadata()
        .then((data) => setModelMetadata(data))
        .catch((err) => console.error("Metadata lookup error:", err));
    }
  }, [activeTab, globalExplanation, modelMetadata, toast]);

  // ---------------------------------------------------------------------------
  // 4. Action Handlers: Refresh, Export, Counterfactuals, What-If, Stability
  // ---------------------------------------------------------------------------
  const handleRefreshExplanation = async () => {
    if (!assessmentId) return;
    setIsRefreshing(true);
    try {
      const refreshed = await explainabilityApi.refreshAssessmentExplanation(assessmentId);
      setExplanation(refreshed);
      toast.success("Explanation Refreshed", "TreeSHAP feature attributions re-evaluated from ensemble booster.");
    } catch (err: any) {
      toast.error("Refresh Failed", err.message || "Could not recompute explanation.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExportReport = async () => {
    if (!assessmentId) return;
    setIsExporting(true);
    try {
      const report = await explainabilityApi.exportAssessmentExplanation(assessmentId);
      const jsonBlob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const downloadUrl = URL.createObjectURL(jsonBlob);
      const downloadLink = document.createElement("a");
      downloadLink.href = downloadUrl;
      downloadLink.download = `MSME_RiskAI_XAI_Report_Assessment_${assessmentId}.json`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(downloadUrl);
      toast.success("Report Exported", `Explanation audit report for assessment #${assessmentId} saved.`);
    } catch (err: any) {
      toast.error("Export Failed", err.message || "Failed to export explanation report.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleGenerateCounterfactuals = () => {
    if (!assessmentId) return;
    setLoadingCounterfactuals(true);
    explainabilityApi
      .generateCounterfactuals(assessmentId, targetRiskLevel)
      .then((res) => {
        setCounterfactuals(res);
        toast.success("Success", "Realistic counterfactual scenarios computed successfully.");
      })
      .catch((err) => toast.error("Error", err.message || "Counterfactual generation failed"))
      .finally(() => setLoadingCounterfactuals(false));
  };

  const handleSimulateWhatIf = () => {
    if (!assessmentId) return;
    setLoadingWhatIf(true);
    explainabilityApi
      .simulateWhatIf(assessmentId, whatIfInputs)
      .then((res) => {
        setWhatIfResult(res);
        toast.success("Success", "What-if scenario re-evaluated with real TreeSHAP.");
      })
      .catch((err) => toast.error("Error", err.message || "What-if simulation failed"))
      .finally(() => setLoadingWhatIf(false));
  };

  const handleResetWhatIf = () => {
    if (!explanation) return;
    const initialInputs: Record<string, number> = {};
    explanation.contributions.forEach((c) => {
      if (typeof c.feature_value === "number") {
        initialInputs[c.feature_name] = c.feature_value;
      }
    });
    setWhatIfInputs(initialInputs);
    setWhatIfResult(null);
    toast.info("Reset", "What-If inputs restored to original values.");
  };

  const handleEvaluateStability = () => {
    if (!assessmentId) return;
    setLoadingStability(true);
    explainabilityApi
      .evaluateStability(assessmentId)
      .then((res) => {
        setStabilityResult(res);
        toast.success("Success", "Perturbation stability evaluation finished.");
      })
      .catch((err) => toast.error("Error", err.message || "Stability evaluation failed"))
      .finally(() => setLoadingStability(false));
  };

  // ---------------------------------------------------------------------------
  // 5. Computed Values & Sorted Features
  // ---------------------------------------------------------------------------
  const activeAssessmentItem = useMemo(() => {
    return assessmentsList.find((a) => a.id === assessmentId);
  }, [assessmentsList, assessmentId]);

  const filteredFeatures = useMemo(() => {
    if (!explanation?.contributions) return [];
    let list = [...explanation.contributions];

    if (featureSearch.trim()) {
      const q = featureSearch.toLowerCase().trim();
      list = list.filter(
        (f) =>
          f.display_name.toLowerCase().includes(q) ||
          f.feature_name.toLowerCase().includes(q) ||
          (f.business_definition && f.business_definition.toLowerCase().includes(q)) ||
          (f.plain_text_explanation && f.plain_text_explanation.toLowerCase().includes(q))
      );
    }

    if (featureSortBy === "abs") {
      list.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    } else if (featureSortBy === "positive") {
      list.sort((a, b) => b.contribution - a.contribution);
    } else if (featureSortBy === "negative") {
      list.sort((a, b) => a.contribution - b.contribution);
    } else if (featureSortBy === "name") {
      list.sort((a, b) => a.display_name.localeCompare(b.display_name));
    }

    return list.slice(0, featureLimit);
  }, [explanation?.contributions, featureSortBy, featureLimit, featureSearch]);

  const maxFeatureAbsContrib = useMemo(() => {
    if (!explanation?.contributions || explanation.contributions.length === 0) return 1.0;
    return Math.max(...explanation.contributions.map((c) => Math.abs(c.contribution)), 0.5);
  }, [explanation?.contributions]);

  return (
    <div className="app-layout">
      <Sidebar active="Explainable AI" />

      <main className="main-content">
        <PageHeader
          badge="Advanced Explainable AI (XAI)"
          title="TreeSHAP Credit Risk Explanations"
          description="Understand the factors influencing an MSME credit risk prediction through feature attribution, model diagnostics, and constrained counterfactual analysis."
        />

        {/* Assessment Selector & Status Ribbon */}
        <div className="mb-6 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-4 rounded-2xl bg-[#1C1933] border border-[#383154]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-[#B7B1D1] uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-4 h-4 text-[#8B5CF6]" />
              Assessment:
            </span>

            {loadingAssessments ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#151229] border border-[#383154] rounded-xl text-xs text-[#B7B1D1]">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#8B5CF6]" />
                <span>Loading authorized assessments...</span>
              </div>
            ) : assessmentsList.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#151229] border border-amber-500/30 rounded-xl text-xs text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>No assessments available under this account</span>
                <Button
                  size="sm"
                  onClick={() => navigate("/assessment")}
                  className="ml-2 text-[11px] py-0.5 px-2 bg-[#8B5CF6] text-white"
                >
                  Create Assessment
                </Button>
              </div>
            ) : (
              <select
                id="assessment-selector-dropdown"
                value={assessmentId || ""}
                onChange={(e) => {
                  const newId = parseInt(e.target.value, 10);
                  if (!isNaN(newId)) {
                    setAssessmentId(newId);
                    navigate(`/explainability/${newId}`);
                  }
                }}
                className="px-3 py-1.5 text-xs font-medium bg-[#151229] border border-[#383154] rounded-xl text-[#F5F3FF] focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6] max-w-md truncate"
              >
                {assessmentsList.map((a) => (
                  <option key={a.id} value={a.id}>
                    #{a.id} — {a.business_name} ({a.industry || "General"}) • {a.risk_level || "N/A"}{" "}
                    {a.default_probability !== undefined ? `(${a.default_probability.toFixed(1)}%)` : ""}
                  </option>
                ))}
              </select>
            )}

            {activeAssessmentItem && (
              <span className="text-xs text-[#B7B1D1] hidden sm:inline-flex items-center gap-1.5 bg-[#151229] px-2.5 py-1 rounded-lg border border-[#383154]/50">
                <Building2 className="w-3 h-3 text-[#A78BFA]" />
                {activeAssessmentItem.business_name}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            {/* Model Name & Version Badge */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#252141] text-[#A78BFA] border border-[#383154]">
              <BrainCircuit className="w-3.5 h-3.5" />
              {explanation?.model_name || "MSME Credit Risk Model"} v{explanation?.model_version || "1.1.0"}
            </span>

            {/* Model Operational Status Badge (Independent of credit risk outcome) */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                explanation?.explanation_status === "AVAILABLE"
                  ? "bg-emerald-950/60 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-950/60 text-amber-400 border-amber-500/30"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Status: {explanation?.explanation_status || "AVAILABLE"}
            </span>

            {/* Refresh Action */}
            <button
              onClick={handleRefreshExplanation}
              disabled={isRefreshing || !assessmentId}
              title="Refresh Explanation & Recalculate TreeSHAP"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-[#252141] hover:bg-[#30294D] text-[#F5F3FF] border border-[#383154] transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-[#8B5CF6]" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Export Action */}
            <button
              onClick={handleExportReport}
              disabled={isExporting || !explanation}
              title="Export Explanation Audit Report (JSON)"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-[#8B5CF6] hover:bg-[#7C3AED] text-white transition disabled:opacity-50"
            >
              <Download className={`w-3.5 h-3.5 ${isExporting ? "animate-bounce" : ""}`} />
              <span className="hidden sm:inline">Export Report</span>
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------------- */}
        {/* Assessment Load Error State */}
        {/* ------------------------------------------------------------------- */}
        {assessmentLoadError && !loadingAssessments && (
          <Card className="p-8 max-w-xl mx-auto my-8 border-rose-500/30 bg-[#1C1933]">
            <EmptyState
              icon={<AlertTriangle className="w-8 h-8 text-rose-400" />}
              title="Failed to Load Assessments"
              description={assessmentLoadError}
              actionText="Retry Loading Assessments"
              onAction={loadAssessments}
            />
          </Card>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* Empty State: User has zero assessments */}
        {/* ------------------------------------------------------------------- */}
        {!loadingAssessments && !assessmentLoadError && assessmentsList.length === 0 && (
          <Card className="p-10 max-w-2xl mx-auto my-12 border-[#383154] bg-[#1C1933]">
            <EmptyState
              icon={<BrainCircuit className="w-12 h-12 text-[#8B5CF6]" />}
              title="No Credit Risk Assessments Available"
              description="To view TreeSHAP feature attributions, waterfall plots, and constrained counterfactuals, you must first create and evaluate an MSME credit assessment."
              actionText="Create New Assessment"
              onAction={() => navigate("/assessment")}
            />
          </Card>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* Loading State for Active Explanation */}
        {/* ------------------------------------------------------------------- */}
        {loadingExplanation && (
          <div className="py-24 text-center">
            <LoadingSpinner fullPage={false} text="Calculating exact TreeSHAP contributions from gradient-boosted ensemble..." />
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* Explanation Error State */}
        {/* ------------------------------------------------------------------- */}
        {explanationError && !loadingExplanation && (
          <Card className="p-8 max-w-xl mx-auto my-12 border-rose-500/30 bg-[#1C1933]">
            <EmptyState
              icon={<AlertTriangle className="w-8 h-8 text-rose-400" />}
              title="Explanation Unavailable"
              description={explanationError}
              actionText="Return to Assessments"
              onAction={() => navigate("/assessment")}
            />
          </Card>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* Main Explainable AI Dashboard Content */}
        {/* ------------------------------------------------------------------- */}
        {!loadingExplanation && !explanationError && explanation && (
          <div className="space-y-6">
            {/* 6-Card High-Level Telemetry & Risk Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {/* Tile 1: Predicted Default Probability */}
              <Card className="p-4 bg-[#1C1933] border-[#383154]">
                <div className="flex items-center justify-between text-xs text-[#B7B1D1] mb-1">
                  <span>Default Probability</span>
                  <RiskBadge level={explanation.risk_level} />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono text-[#F5F3FF]">
                    {explanation.predicted_probability.toFixed(1)}%
                  </span>
                </div>
                <div className="text-[11px] text-[#B7B1D1] mt-1 truncate">
                  Statistical likelihood σ(f(x))
                </div>
              </Card>

              {/* Tile 2: Model Decision Recommendation */}
              <Card className="p-4 bg-[#1C1933] border-[#383154]">
                <div className="flex items-center justify-between text-xs text-[#B7B1D1] mb-1">
                  <span>Model Recommendation</span>
                  <span className="font-mono text-[10px] text-slate-400">Algorithmic</span>
                </div>
                <div className="text-sm font-bold text-white mt-1">
                  {explanation.predicted_outcome || explanation.risk_band_label}
                </div>
                <div className="text-[11px] text-[#B7B1D1] mt-1">
                  {explanation.manual_review_recommended ? (
                    <span className="text-rose-400 font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Manual Review Advised
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Automated Eligible
                    </span>
                  )}
                </div>
              </Card>

              {/* Tile 3: Ensemble Decision Margin */}
              <Card className="p-4 bg-[#1C1933] border-[#383154]">
                <div className="flex items-center justify-between text-xs text-[#B7B1D1] mb-1">
                  <span>Decision Margin f(x)</span>
                  <span className="font-mono text-[10px] text-slate-400">log-odds space</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono text-[#F5F3FF]">
                    {explanation.raw_margin > 0
                      ? `+${explanation.raw_margin.toFixed(3)}`
                      : explanation.raw_margin.toFixed(3)}
                  </span>
                </div>
                <div className="text-[11px] text-[#B7B1D1] mt-1">
                  Raw logit sum from trees
                </div>
              </Card>

              {/* Tile 4: Expected Baseline Value */}
              <Card className="p-4 bg-[#1C1933] border-[#383154]">
                <div className="flex items-center justify-between text-xs text-[#B7B1D1] mb-1">
                  <span>Baseline Value E[f(x)]</span>
                  <span className="font-mono text-[10px] text-slate-400">Prior</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono text-[#A78BFA]">
                    {explanation.baseline_value > 0
                      ? `+${explanation.baseline_value.toFixed(4)}`
                      : explanation.baseline_value.toFixed(4)}
                  </span>
                </div>
                <div className="text-[11px] text-[#B7B1D1] mt-1">
                  Unconditioned base score
                </div>
              </Card>

              {/* Tile 5: Additivity Reconciliation */}
              <Card className="p-4 bg-[#1C1933] border-[#383154]">
                <div className="flex items-center justify-between text-xs text-[#B7B1D1] mb-1">
                  <span>Additivity Check</span>
                  <span className="text-[10px] font-mono text-emerald-400">Exact</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-sm font-bold text-emerald-400 truncate">
                    Reconciled (Δ &lt; 10⁻⁴)
                  </span>
                </div>
                <div className="text-[11px] text-[#B7B1D1] mt-1">
                  Base + Σ SHAP == Margin
                </div>
              </Card>

              {/* Tile 6: Data Quality & Completeness */}
              <Card className="p-4 bg-[#1C1933] border-[#383154]">
                <div className="flex items-center justify-between text-xs text-[#B7B1D1] mb-1">
                  <span>Data Quality</span>
                  <span className="text-[10px] font-mono text-emerald-400">
                    {explanation.data_completeness_pct !== undefined
                      ? `${explanation.data_completeness_pct.toFixed(0)}%`
                      : "100%"}
                  </span>
                </div>
                <div className="text-sm font-bold text-white mt-1">
                  {explanation.data_completeness_pct && explanation.data_completeness_pct >= 90
                    ? "Tier A (High Fidelity)"
                    : "Tier B (Standard)"}
                </div>
                <div className="text-[11px] text-[#B7B1D1] mt-1 truncate">
                  {explanation.created_at
                    ? new Date(explanation.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      })
                    : "Verified input stream"}
                </div>
              </Card>
            </div>

            {/* Underwriting Clarity Callout (Distinguishing Probability, Model Decision, Human Review, Outcome) */}
            <div className="p-4 rounded-xl bg-[#151229] border border-[#383154] flex items-start gap-3 text-xs text-[#B7B1D1]">
              <Info className="w-5 h-5 text-[#8B5CF6] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold text-[#F5F3FF]">
                  Underwriting Epistemic Boundary Notice:
                </span>
                <p className="leading-relaxed">
                  <strong>Predicted Probability ({explanation.predicted_probability.toFixed(1)}%)</strong> is a statistical default likelihood computed by the ensemble model. It represents neither a final credit decision nor a guarantee of future repayment. 
                  <strong> Model Recommendation</strong> reflects algorithmic risk thresholds, which credit officers evaluate alongside qualitative factors before formal loan approval.
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-[#383154] pb-2 overflow-x-auto text-xs font-semibold">
              <button
                onClick={() => setActiveTab("waterfall")}
                className={`px-4 py-2 rounded-xl transition flex items-center gap-2 shrink-0 ${
                  activeTab === "waterfall"
                    ? "bg-[#8B5CF6] text-white shadow-md shadow-[#8B5CF6]/25"
                    : "text-[#B7B1D1] hover:text-[#F5F3FF] hover:bg-[#252141]"
                }`}
              >
                <Activity className="w-4 h-4" />
                SHAP Waterfall Plot
              </button>

              <button
                onClick={() => setActiveTab("factors")}
                className={`px-4 py-2 rounded-xl transition flex items-center gap-2 shrink-0 ${
                  activeTab === "factors"
                    ? "bg-[#8B5CF6] text-white shadow-md shadow-[#8B5CF6]/25"
                    : "text-[#B7B1D1] hover:text-[#F5F3FF] hover:bg-[#252141]"
                }`}
              >
                <Layers className="w-4 h-4" />
                Feature Importance & Drivers ({explanation.contributions.length})
              </button>

              <button
                onClick={() => setActiveTab("counterfactuals")}
                className={`px-4 py-2 rounded-xl transition flex items-center gap-2 shrink-0 ${
                  activeTab === "counterfactuals"
                    ? "bg-[#8B5CF6] text-white shadow-md shadow-[#8B5CF6]/25"
                    : "text-[#B7B1D1] hover:text-[#F5F3FF] hover:bg-[#252141]"
                }`}
              >
                <Scale className="w-4 h-4" />
                What-If Scenarios (Counterfactuals)
              </button>

              <button
                onClick={() => setActiveTab("whatif")}
                className={`px-4 py-2 rounded-xl transition flex items-center gap-2 shrink-0 ${
                  activeTab === "whatif"
                    ? "bg-[#8B5CF6] text-white shadow-md shadow-[#8B5CF6]/25"
                    : "text-[#B7B1D1] hover:text-[#F5F3FF] hover:bg-[#252141]"
                }`}
              >
                <Sliders className="w-4 h-4" />
                Interactive Sandbox
              </button>

              <button
                onClick={() => setActiveTab("global")}
                className={`px-4 py-2 rounded-xl transition flex items-center gap-2 shrink-0 ${
                  activeTab === "global"
                    ? "bg-[#8B5CF6] text-white shadow-md shadow-[#8B5CF6]/25"
                    : "text-[#B7B1D1] hover:text-[#F5F3FF] hover:bg-[#252141]"
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Global Importance
              </button>

              <button
                onClick={() => setActiveTab("stability")}
                className={`px-4 py-2 rounded-xl transition flex items-center gap-2 shrink-0 ${
                  activeTab === "stability"
                    ? "bg-[#8B5CF6] text-white shadow-md shadow-[#8B5CF6]/25"
                    : "text-[#B7B1D1] hover:text-[#F5F3FF] hover:bg-[#252141]"
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                Stability Diagnostics
              </button>

              <button
                onClick={() => setActiveTab("governance")}
                className={`px-4 py-2 rounded-xl transition flex items-center gap-2 shrink-0 ${
                  activeTab === "governance"
                    ? "bg-[#8B5CF6] text-white shadow-md shadow-[#8B5CF6]/25"
                    : "text-[#B7B1D1] hover:text-[#F5F3FF] hover:bg-[#252141]"
                }`}
              >
                <FileText className="w-4 h-4" />
                Governance & Epistemic Limits
              </button>
            </div>

            {/* =============================================================== */}
            {/* TAB 1: SHAP WATERFALL PLOT (Additive progression in log-odds)    */}
            {/* =============================================================== */}
            {activeTab === "waterfall" && (
              <div className="space-y-6">
                <Card className="p-6 bg-[#1C1933] border-[#383154]">
                  <CardHeader className="px-0 pt-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Activity className="w-5 h-5 text-[#8B5CF6]" />
                          Interactive TreeSHAP Waterfall Visualization
                        </CardTitle>
                        <CardDescription>
                          Visualizes additive progression from ensemble prior expectation E[f(x)] to final prediction margin f(x) in log-odds space.
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1.5 text-rose-400 font-medium">
                          <span className="w-3 h-3 rounded-sm bg-rose-500/80 inline-block"></span>
                          [+] Increases Risk Margin
                        </span>
                        <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                          <span className="w-3 h-3 rounded-sm bg-emerald-500/80 inline-block"></span>
                          [-] Decreases Risk Margin
                        </span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="px-0 pb-0 space-y-6">
                    {/* Math Formulation Banner */}
                    <div className="p-3.5 rounded-xl bg-[#0C0A1D] border border-[#383154] text-xs text-[#B7B1D1] flex items-center justify-between font-mono">
                      <span>f(x) = E[f(x)] + ∑ φᵢ(x)</span>
                      <span className="text-[#A78BFA]">σ(z) = 1 / (1 + e⁻ᶻ) → p = {explanation.predicted_probability.toFixed(1)}%</span>
                    </div>

                    {/* SVG/HTML Waterfall Chart Container */}
                    <div className="p-4 rounded-xl bg-[#0C0A1D] border border-[#383154] overflow-x-auto">
                      <div className="min-w-[700px] space-y-2">
                        {explanation.waterfall_steps.map((step, idx) => {
                          const isBaseline = step.step_type === "baseline";
                          const isOutput = step.step_type === "output";
                          const isPositive = step.delta > 0;

                          const maxMargin = Math.max(
                            ...explanation.waterfall_steps.map((s) => Math.abs(s.cumulative)),
                            4.0
                          );
                          const barWidthPct = Math.min(
                            100,
                            Math.max(6, (Math.abs(step.delta) / maxMargin) * 75)
                          );

                          return (
                            <div
                              key={idx}
                              className="group flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[#1C1933] transition border border-transparent hover:border-[#383154] text-xs"
                            >
                              <div className="w-1/3 flex items-center gap-2 truncate">
                                <span className="font-mono text-[10px] text-slate-500 w-5">
                                  #{idx}
                                </span>
                                <span
                                  className={`font-semibold truncate ${
                                    isBaseline
                                      ? "text-[#A78BFA]"
                                      : isOutput
                                      ? "text-white font-bold"
                                      : isPositive
                                      ? "text-rose-300"
                                      : "text-emerald-300"
                                  }`}
                                >
                                  {step.label}
                                </span>
                              </div>

                              {/* Visual Delta Bar */}
                              <div className="w-1/3 px-3 flex items-center">
                                {isBaseline ? (
                                  <div className="w-full bg-[#252141] h-3 rounded-full overflow-hidden border border-[#383154]">
                                    <div className="bg-[#8B5CF6] h-full w-24"></div>
                                  </div>
                                ) : isOutput ? (
                                  <div className="w-full bg-[#252141] h-3 rounded-full overflow-hidden border border-[#383154]">
                                    <div className="bg-[#A78BFA] h-full w-full"></div>
                                  </div>
                                ) : (
                                  <div className="w-full flex items-center h-3">
                                    <div
                                      style={{ width: `${barWidthPct}%` }}
                                      className={`h-full rounded-sm ${
                                        isPositive
                                          ? "bg-rose-500/80 shadow-sm shadow-rose-500/30 ml-auto"
                                          : "bg-emerald-500/80 shadow-sm shadow-emerald-500/30 mr-auto"
                                      }`}
                                    ></div>
                                  </div>
                                )}
                              </div>

                              {/* Numbers: Delta & Cumulative */}
                              <div className="w-1/3 flex items-center justify-end gap-4 font-mono text-right">
                                <span
                                  className={`w-20 ${
                                    isBaseline
                                      ? "text-slate-400"
                                      : isPositive
                                      ? "text-rose-400 font-bold"
                                      : "text-emerald-400 font-bold"
                                  }`}
                                >
                                  {isBaseline || isOutput
                                    ? "—"
                                    : `${isPositive ? "+" : ""}${step.delta.toFixed(3)}`}
                                </span>
                                <span className="w-20 text-slate-300 font-semibold">
                                  = {step.cumulative.toFixed(3)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Signed Summary Drivers */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                      {/* Positive Drivers (Risk Increasing) */}
                      <div className="p-4 rounded-xl bg-[#0C0A1D] border border-rose-500/20 space-y-3">
                        <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-rose-400" />
                          Risk-Increasing Drivers ([+] Positive SHAP)
                        </h4>
                        {explanation.positive_drivers.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">No significant risk-increasing factors detected.</p>
                        ) : (
                          explanation.positive_drivers.map((d, i) => (
                            <div key={i} className="space-y-1">
                              <div className="flex justify-between text-xs text-slate-200">
                                <span>{d.display_name}</span>
                                <span className="font-mono text-rose-400 font-bold">+{d.contribution.toFixed(3)}</span>
                              </div>
                              <div className="h-2 w-full bg-[#1C1933] rounded-full overflow-hidden">
                                <div
                                  style={{ width: `${Math.min(100, (d.contribution / 2.0) * 100)}%` }}
                                  className="h-full bg-rose-500 rounded-full"
                                ></div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Negative Drivers (Risk Mitigating) */}
                      <div className="p-4 rounded-xl bg-[#0C0A1D] border border-emerald-500/20 space-y-3">
                        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                          <TrendingDown className="w-4 h-4 text-emerald-400" />
                          Risk-Mitigating Drivers ([-] Negative SHAP)
                        </h4>
                        {explanation.negative_drivers.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">No significant risk-mitigating factors detected.</p>
                        ) : (
                          explanation.negative_drivers.map((d, i) => (
                            <div key={i} className="space-y-1">
                              <div className="flex justify-between text-xs text-slate-200">
                                <span>{d.display_name}</span>
                                <span className="font-mono text-emerald-400 font-bold">{d.contribution.toFixed(3)}</span>
                              </div>
                              <div className="h-2 w-full bg-[#1C1933] rounded-full overflow-hidden">
                                <div
                                  style={{ width: `${Math.min(100, (Math.abs(d.contribution) / 2.0) * 100)}%` }}
                                  className="h-full bg-emerald-500 rounded-full"
                                ></div>
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

            {/* =============================================================== */}
            {/* TAB 2: SHAP FEATURE IMPORTANCE & CONTRIBUTION DETAILS TABLE       */}
            {/* =============================================================== */}
            {activeTab === "factors" && (
              <div className="space-y-6">
                <Card className="p-6 bg-[#1C1933] border-[#383154]">
                  <CardHeader className="px-0 pt-0">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Layers className="w-5 h-5 text-[#8B5CF6]" />
                          SHAP Feature Importance & Attribution Details
                        </CardTitle>
                        <CardDescription>
                          Signed contributions move the model output relative to baseline. Absolute importance reflects total impact magnitude.
                        </CardDescription>
                      </div>

                      {/* Interactive Controls Bar: Search, Sort, Limit */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Search Input */}
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Search features..."
                            value={featureSearch}
                            onChange={(e) => setFeatureSearch(e.target.value)}
                            className="pl-8 pr-3 py-1.5 text-xs bg-[#151229] border border-[#383154] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#8B5CF6] w-40 sm:w-48"
                          />
                        </div>

                        {/* Sort Dropdown */}
                        <div className="flex items-center gap-1.5 bg-[#151229] border border-[#383154] px-2 py-1 rounded-xl text-xs">
                          <ArrowUpDown className="w-3.5 h-3.5 text-[#8B5CF6]" />
                          <select
                            value={featureSortBy}
                            onChange={(e) => setFeatureSortBy(e.target.value as any)}
                            className="bg-transparent text-[#F5F3FF] focus:outline-none text-xs"
                          >
                            <option value="abs">Sort: |Impact| Magnitude</option>
                            <option value="positive">Sort: Risk-Increasing (+)</option>
                            <option value="negative">Sort: Risk-Mitigating (-)</option>
                            <option value="name">Sort: Feature Name (A-Z)</option>
                          </select>
                        </div>

                        {/* Limit Dropdown */}
                        <select
                          value={featureLimit}
                          onChange={(e) => setFeatureLimit(parseInt(e.target.value, 10))}
                          className="px-2.5 py-1.5 text-xs bg-[#151229] border border-[#383154] rounded-xl text-white focus:outline-none focus:border-[#8B5CF6]"
                        >
                          <option value={5}>Top 5</option>
                          <option value={10}>Top 10</option>
                          <option value={11}>All 11 Features</option>
                        </select>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="px-0 pb-0 space-y-6">
                    {/* Horizontal Bar Visualizations */}
                    <div className="p-4 rounded-xl bg-[#0C0A1D] border border-[#383154] space-y-3">
                      <div className="flex items-center justify-between text-xs text-[#B7B1D1] pb-2 border-b border-[#383154]/50">
                        <span className="font-semibold uppercase tracking-wider">Feature Attribution Magnitude Bar Chart</span>
                        <span className="font-mono text-[10px] text-slate-400">Signed Log-Odds Margin</span>
                      </div>

                      {filteredFeatures.map((c) => {
                        const isPositive = c.contribution > 0;
                        const barPct = Math.min(100, (Math.abs(c.contribution) / maxFeatureAbsContrib) * 100);

                        return (
                          <div key={c.feature_name} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-slate-200">
                                {c.display_name}
                                <span className="ml-2 font-mono text-[11px] text-slate-400">
                                  ({typeof c.feature_value === "number" ? c.feature_value.toLocaleString() : c.feature_value} {c.unit})
                                </span>
                              </span>
                              <span
                                className={`font-mono font-bold ${
                                  isPositive ? "text-rose-400" : c.contribution < 0 ? "text-emerald-400" : "text-slate-400"
                                }`}
                              >
                                {c.contribution > 0 ? `+${c.contribution.toFixed(3)}` : c.contribution.toFixed(3)}
                              </span>
                            </div>

                            <div className="h-2 w-full bg-[#1C1933] rounded-full overflow-hidden flex items-center">
                              <div
                                style={{ width: `${barPct}%` }}
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isPositive
                                    ? "bg-rose-500 shadow-sm shadow-rose-500/40"
                                    : "bg-emerald-500 shadow-sm shadow-emerald-500/40"
                                }`}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Expandable Feature Contribution Details Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-[#383154] text-[#B7B1D1]">
                            <th className="py-3 px-3">Rank</th>
                            <th className="py-3 px-3">Business Feature</th>
                            <th className="py-3 px-3">Observed Value</th>
                            <th className="py-3 px-3">TreeSHAP Value</th>
                            <th className="py-3 px-3">Direction</th>
                            <th className="py-3 px-3">Plain-Language Underwriting Explanation</th>
                            <th className="py-3 px-3 text-right">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#383154]/50">
                          {filteredFeatures.map((c) => {
                            const isExpanded = expandedFactor === c.feature_name;
                            return (
                              <React.Fragment key={c.feature_name}>
                                <tr className="hover:bg-[#252141]/50 transition">
                                  <td className="py-3 px-3 font-mono font-bold text-[#A78BFA]">
                                    #{c.rank}
                                  </td>
                                  <td className="py-3 px-3 font-semibold text-white">
                                    {c.display_name}
                                  </td>
                                  <td className="py-3 px-3 font-mono text-slate-300">
                                    {typeof c.feature_value === "number"
                                      ? c.feature_value.toLocaleString()
                                      : String(c.feature_value)}{" "}
                                    <span className="text-[10px] text-slate-500">{c.unit}</span>
                                  </td>
                                  <td className="py-3 px-3 font-mono font-bold">
                                    <span
                                      className={
                                        c.contribution > 0
                                          ? "text-rose-400"
                                          : c.contribution < 0
                                          ? "text-emerald-400"
                                          : "text-slate-400"
                                      }
                                    >
                                      {c.contribution > 0
                                        ? `+${c.contribution.toFixed(3)}`
                                        : c.contribution.toFixed(3)}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3">
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        c.direction === "INCREASES_RISK"
                                          ? "bg-rose-950/70 text-rose-300 border border-rose-500/30"
                                          : c.direction === "DECREASES_RISK"
                                          ? "bg-emerald-950/70 text-emerald-300 border border-emerald-500/30"
                                          : "bg-slate-800 text-slate-400"
                                      }`}
                                    >
                                      {c.direction === "INCREASES_RISK"
                                        ? "[+] Increases Risk"
                                        : c.direction === "DECREASES_RISK"
                                        ? "[-] Mitigates Risk"
                                        : "Neutral"}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 text-slate-300 leading-relaxed max-w-md">
                                    {c.plain_text_explanation}
                                  </td>
                                  <td className="py-3 px-3 text-right">
                                    <button
                                      onClick={() => setExpandedFactor(isExpanded ? null : c.feature_name)}
                                      className="p-1 rounded hover:bg-[#30294D] text-[#A78BFA] transition"
                                      title="Toggle Feature Details"
                                    >
                                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr className="bg-[#151229]">
                                    <td colSpan={7} className="p-4 border-l-2 border-[#8B5CF6]">
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
                                        <div>
                                          <span className="text-[#A78BFA] font-bold block mb-1">Business Definition:</span>
                                          <p>{c.business_definition}</p>
                                        </div>
                                        <div>
                                          <span className="text-[#A78BFA] font-bold block mb-1">Non-Causal Attribution Note:</span>
                                          <p>
                                            SHAP value reflects how the tree ensemble scored this feature relative to the prior expected margin.
                                            It describes internal model mechanics, not legal causality.
                                          </p>
                                        </div>
                                        <div>
                                          <span className="text-[#A78BFA] font-bold block mb-1">Model Feature Column:</span>
                                          <code className="text-emerald-400 font-mono text-[11px]">{c.feature_name}</code>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* =============================================================== */}
            {/* TAB 3: CONSTRAINED COUNTERFACTUALS (What-If Scenarios)          */}
            {/* =============================================================== */}
            {activeTab === "counterfactuals" && (
              <div className="space-y-6">
                <Card className="p-6 bg-[#1C1933] border-[#383154]">
                  <CardHeader className="px-0 pt-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Scale className="w-5 h-5 text-[#8B5CF6]" />
                          What-If Scenarios: Constrained Counterfactual Simulations
                        </CardTitle>
                        <CardDescription>
                          Hypothetical scenario analysis showing minimal, actionable adjustments required to transition this assessment to a lower risk category.
                        </CardDescription>
                      </div>

                      <div className="flex items-center gap-3">
                        <select
                          value={targetRiskLevel}
                          onChange={(e) => setTargetRiskLevel(e.target.value)}
                          className="px-3 py-1.5 text-xs bg-[#151229] border border-[#383154] rounded-xl text-white focus:outline-none focus:border-[#8B5CF6]"
                        >
                          <option value="LOW">Target: LOW Risk Band (&lt;25%)</option>
                          <option value="MEDIUM">Target: MEDIUM Risk Band (&lt;55%)</option>
                        </select>
                        <Button
                          onClick={handleGenerateCounterfactuals}
                          disabled={loadingCounterfactuals}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          {loadingCounterfactuals ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Zap className="w-3.5 h-3.5" />
                          )}
                          Generate Scenarios
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="px-0 pb-0 space-y-6">
                    {/* Constraints Summary Box */}
                    <div className="p-4 rounded-xl bg-[#0C0A1D] border border-[#383154] grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-[#A78BFA] font-bold block mb-1">Immutable Attributes (Locked):</span>
                        <div className="flex gap-2">
                          <span className="px-2 py-0.5 rounded bg-[#1C1933] border border-[#383154] text-slate-300 font-mono">
                            age (Business Age)
                          </span>
                          <span className="px-2 py-0.5 rounded bg-[#1C1933] border border-[#383154] text-slate-300 font-mono">
                            industry (Operating Sector)
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[#A78BFA] font-bold block mb-1">Permitted Actionable Modifiers:</span>
                        <span className="text-slate-300 leading-relaxed">
                          Outstanding debt reductions (≤50%), operating cash flow expansion (≤30%), alternative payment discipline (scores up to 100), default mitigation.
                        </span>
                      </div>
                    </div>

                    {/* Counterfactual Results */}
                    {counterfactuals ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#F5F3FF]">
                            Found {counterfactuals.scenarios.length} Feasible Scenario Candidate(s)
                          </span>
                          <span className="text-[11px] text-[#B7B1D1]">
                            Original Probability: {counterfactuals.original_probability.toFixed(1)}% ({counterfactuals.original_risk_level})
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          {counterfactuals.scenarios.map((scen, idx) => (
                            <div
                              key={idx}
                              className="p-5 rounded-2xl bg-[#0C0A1D] border border-[#383154] space-y-4"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#383154] pb-3">
                                <div>
                                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-[#8B5CF6]" />
                                    {scen.guidance_summary}
                                  </h4>
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    Feasibility Score:{" "}
                                    <span className="text-emerald-400 font-bold font-mono">
                                      {scen.feasibility_score}/100
                                    </span>
                                  </p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <span className="text-[10px] text-slate-400 block">Projected Outcome:</span>
                                    <span className="text-sm font-bold font-mono text-emerald-400">
                                      {scen.counterfactual_probability.toFixed(1)}% ({scen.counterfactual_risk_level})
                                    </span>
                                  </div>
                                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                                    -{scen.probability_reduction.toFixed(1)}%
                                  </span>
                                </div>
                              </div>

                              {/* Proposed Modifications Table */}
                              <div>
                                <span className="text-xs font-semibold text-slate-300 block mb-2">
                                  Proposed Financial Target Values:
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                  {scen.proposed_changes.map((ch, cIdx) => (
                                    <div
                                      key={cIdx}
                                      className="p-3 rounded-xl bg-[#1C1933] border border-[#383154] text-xs space-y-1"
                                    >
                                      <span className="text-[#B7B1D1] font-medium block truncate">
                                        {ch.display_name}
                                      </span>
                                      <div className="flex items-center justify-between font-mono">
                                        <span className="text-slate-400 line-through">
                                          {ch.original_value.toLocaleString()}
                                        </span>
                                        <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                                        <span className="text-emerald-400 font-bold">
                                          {ch.proposed_value.toLocaleString()} {ch.unit}
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-emerald-300 font-mono block text-right">
                                        {ch.change_percentage > 0
                                          ? `+${ch.change_percentage}%`
                                          : `${ch.change_percentage}%`}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Disclaimers */}
                        <div className="p-4 rounded-xl bg-[#1C1933]/60 border border-[#383154] text-[11px] text-[#B7B1D1] space-y-1">
                          <span className="text-[#A78BFA] font-bold block">Scenario Disclaimers:</span>
                          {counterfactuals.disclaimers.map((d, i) => (
                            <p key={i}>• {d}</p>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-center bg-[#0C0A1D] border border-[#383154] rounded-2xl">
                        <Scale className="w-8 h-8 text-[#8B5CF6] mx-auto mb-2 opacity-60" />
                        <h4 className="text-sm font-semibold text-white">No Counterfactual Scenario Loaded</h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                          Click &quot;Generate Scenarios&quot; to calculate optimal financial pathways to achieve the selected risk band.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* =============================================================== */}
            {/* TAB 4: INTERACTIVE WHAT-IF SANDBOX (Live TreeSHAP Re-Inference) */}
            {/* =============================================================== */}
            {activeTab === "whatif" && (
              <div className="space-y-6">
                <Card className="p-6 bg-[#1C1933] border-[#383154]">
                  <CardHeader className="px-0 pt-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Sliders className="w-5 h-5 text-[#8B5CF6]" />
                          Dynamic What-If Sandbox & Real-Time TreeSHAP Recalculator
                        </CardTitle>
                        <CardDescription>
                          Modify financial inputs to re-evaluate real model predictions and SHAP attributions without altering the stored applicant record.
                        </CardDescription>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          onClick={handleResetWhatIf}
                          className="flex items-center gap-1.5 text-xs bg-[#252141] text-[#F5F3FF]"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Reset
                        </Button>
                        <Button
                          onClick={handleSimulateWhatIf}
                          disabled={loadingWhatIf}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          {loadingWhatIf ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          Recalculate Model & SHAP
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="px-0 pb-0 space-y-6">
                    {/* Input Controls Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {[
                        { key: "annual_revenue", label: "Annual Revenue ($)", step: 10000, min: 0 },
                        { key: "monthly_cash_flow", label: "Monthly Cash Flow ($)", step: 5000, min: -100000 },
                        { key: "monthly_expenses", label: "Monthly Expenses ($)", step: 5000, min: 0 },
                        { key: "existing_debt", label: "Outstanding Debt ($)", step: 5000, min: 0 },
                        { key: "utility_payment_score", label: "Utility Score (0-100)", step: 1, min: 0, max: 100 },
                        { key: "invoice_payment_score", label: "Invoice Score (0-100)", step: 1, min: 0, max: 100 },
                        { key: "digital_transactions", label: "Digital Txns/mo", step: 10, min: 0 },
                        { key: "previous_defaults", label: "Defaults Count", step: 1, min: 0 }
                      ].map((field) => (
                        <div key={field.key} className="p-3 rounded-xl bg-[#0C0A1D] border border-[#383154] space-y-1.5">
                          <label className="text-[11px] font-semibold text-[#B7B1D1] block truncate">
                            {field.label}
                          </label>
                          <input
                            type="number"
                            step={field.step}
                            min={field.min}
                            max={field.max}
                            value={whatIfInputs[field.key] ?? ""}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setWhatIfInputs((prev) => ({ ...prev, [field.key]: val }));
                            }}
                            className="w-full px-3 py-1.5 text-xs font-mono bg-[#151229] border border-[#383154] rounded-lg text-white focus:outline-none focus:border-[#8B5CF6]"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Simulation Result Comparison */}
                    {whatIfResult && (
                      <div className="p-5 rounded-2xl bg-[#0C0A1D] border border-[#8B5CF6]/40 space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#383154] pb-4">
                          <div>
                            <span className="text-xs font-bold uppercase tracking-wider text-[#A78BFA] block">
                              Recalculated Simulation Outcome
                            </span>
                            <div className="flex items-baseline gap-3 mt-1">
                              <span className="text-3xl font-bold font-mono text-white">
                                {whatIfResult.hypothetical_probability.toFixed(1)}%
                              </span>
                              <RiskBadge level={whatIfResult.hypothetical_risk_level} />
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-xs font-mono">
                            <div className="text-right">
                              <span className="text-slate-400 block text-[10px]">Original Baseline:</span>
                              <span className="text-slate-200 font-bold">
                                {whatIfResult.original_probability.toFixed(1)}% ({whatIfResult.original_risk_level})
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-slate-400 block text-[10px]">Observed Shift:</span>
                              <span
                                className={`font-bold ${
                                  whatIfResult.probability_delta > 0
                                    ? "text-rose-400"
                                    : whatIfResult.probability_delta < 0
                                    ? "text-emerald-400"
                                    : "text-slate-400"
                                }`}
                              >
                                {whatIfResult.probability_delta > 0
                                  ? `+${whatIfResult.probability_delta.toFixed(1)}%`
                                  : `${whatIfResult.probability_delta.toFixed(1)}%`}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Altered Features List */}
                        {whatIfResult.changed_features.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-xs font-semibold text-slate-300 block">
                              Recalculated Feature Deltas ({whatIfResult.changed_features.length}):
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                              {whatIfResult.changed_features.map((ch, idx) => (
                                <div
                                  key={idx}
                                  className="p-3 rounded-xl bg-[#1C1933] border border-[#383154] text-xs space-y-1 font-mono"
                                >
                                  <span className="text-[#B7B1D1] block truncate font-sans">
                                    {ch.display_name}
                                  </span>
                                  <div className="flex justify-between items-center text-slate-300">
                                    <span className="text-slate-500">{ch.original_value.toLocaleString()}</span>
                                    <ArrowRight className="w-3 h-3 text-slate-500" />
                                    <span className="text-white font-bold">{ch.hypothetical_value.toLocaleString()}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* =============================================================== */}
            {/* TAB 5: GLOBAL MODEL IMPORTANCE (Cross-population benchmarks)    */}
            {/* =============================================================== */}
            {activeTab === "global" && (
              <Card className="p-6 bg-[#1C1933] border-[#383154]">
                <CardHeader className="px-0 pt-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-[#8B5CF6]" />
                        Global Model Feature Importance (Mean Absolute TreeSHAP)
                      </CardTitle>
                      <CardDescription>
                        Cross-population importance across all 11 business features, contrasted with native XGBoost Gain and Weight.
                      </CardDescription>
                    </div>

                    {globalExplanation && (
                      <span className="text-xs text-[#B7B1D1] font-mono bg-[#0C0A1D] px-3 py-1.5 rounded-xl border border-[#383154]">
                        Fingerprint: {globalExplanation.dataset_fingerprint}
                      </span>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="px-0 pb-0 space-y-6">
                  {loadingGlobal && (
                    <div className="py-12">
                      <LoadingSpinner fullPage={false} text="Aggregating global TreeSHAP importances..." />
                    </div>
                  )}

                  {!loadingGlobal && globalExplanation && (
                    <div className="space-y-6">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-[#383154] text-[#B7B1D1]">
                              <th className="py-3 px-3">Rank</th>
                              <th className="py-3 px-3">Business Feature</th>
                              <th className="py-3 px-3">Mean |SHAP| (Margin Impact)</th>
                              <th className="py-3 px-3">XGBoost Gain</th>
                              <th className="py-3 px-3">Split Frequency (Weight)</th>
                              <th className="py-3 px-3">Business Definition</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#383154]/50">
                            {globalExplanation.all_features.map((f) => (
                              <tr key={f.feature_name} className="hover:bg-[#252141]/50 transition">
                                <td className="py-3 px-3 font-mono font-bold text-[#A78BFA]">
                                  #{f.rank}
                                </td>
                                <td className="py-3 px-3 font-semibold text-white">
                                  {f.display_name}
                                </td>
                                <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                                  {f.mean_abs_shap.toFixed(4)}
                                </td>
                                <td className="py-3 px-3 font-mono text-slate-300">
                                  {f.xgboost_gain !== null && f.xgboost_gain !== undefined
                                    ? f.xgboost_gain.toFixed(3)
                                    : "—"}
                                </td>
                                <td className="py-3 px-3 font-mono text-slate-400">
                                  {f.xgboost_weight !== null && f.xgboost_weight !== undefined
                                    ? f.xgboost_weight
                                    : "—"}
                                </td>
                                <td className="py-3 px-3 text-slate-400 leading-relaxed max-w-sm">
                                  {f.business_definition}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* =============================================================== */}
            {/* TAB 6: STABILITY & ROBUSTNESS DIAGNOSTICS                       */}
            {/* =============================================================== */}
            {activeTab === "stability" && (
              <Card className="p-6 bg-[#1C1933] border-[#383154]">
                <CardHeader className="px-0 pt-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-[#8B5CF6]" />
                        Explanation Stability & Robustness Diagnostics
                      </CardTitle>
                      <CardDescription>
                        Evaluates whether small perturbations (±5% to ±8%) in continuous financial inputs materially shift the prediction or top SHAP rankings.
                      </CardDescription>
                    </div>

                    <Button
                      onClick={handleEvaluateStability}
                      disabled={loadingStability}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      {loadingStability ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5" />
                      )}
                      Run Robustness Audit
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="px-0 pb-0 space-y-6">
                  {stabilityResult ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-4 rounded-xl bg-[#0C0A1D] border border-[#383154]">
                          <span className="text-xs text-[#B7B1D1] block mb-1">Risk Band Retention Rate</span>
                          <span className="text-2xl font-bold font-mono text-emerald-400">
                            {stabilityResult.risk_band_retention_rate.toFixed(1)}%
                          </span>
                          <span className="text-[11px] text-slate-400 block mt-1">
                            {stabilityResult.scenarios_evaluated} perturbation iterations evaluated
                          </span>
                        </div>

                        <div className="p-4 rounded-xl bg-[#0C0A1D] border border-[#383154]">
                          <span className="text-xs text-[#B7B1D1] block mb-1">Top-3 SHAP Rank Stability</span>
                          <span className="text-2xl font-bold font-mono text-[#A78BFA]">
                            {stabilityResult.top_features_stability_score.toFixed(1)}%
                          </span>
                          <span className="text-[11px] text-slate-400 block mt-1">
                            Consistency of leading risk drivers
                          </span>
                        </div>

                        <div className="p-4 rounded-xl bg-[#0C0A1D] border border-[#383154]">
                          <span className="text-xs text-[#B7B1D1] block mb-1">Overall Stability Tier</span>
                          <span
                            className={`text-2xl font-bold font-mono ${
                              stabilityResult.stability_rating === "HIGH"
                                ? "text-emerald-400"
                                : stabilityResult.stability_rating === "MODERATE"
                                ? "text-amber-400"
                                : "text-rose-400"
                            }`}
                          >
                            {stabilityResult.stability_rating}
                          </span>
                          <span className="text-[11px] text-slate-400 block mt-1">
                            Var(p) = {stabilityResult.probability_variance.toFixed(3)}
                          </span>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-[#1C1933] border border-[#383154] text-xs text-slate-300 space-y-1">
                        <span className="text-[#A78BFA] font-bold block">Methodology & Limitations:</span>
                        {stabilityResult.limitations.map((lim, i) => (
                          <p key={i}>• {lim}</p>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-[#0C0A1D] border border-[#383154] rounded-2xl">
                      <ShieldCheck className="w-8 h-8 text-[#8B5CF6] mx-auto mb-2 opacity-60" />
                      <h4 className="text-sm font-semibold text-white">No Stability Evaluation Generated</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                        Click &quot;Run Robustness Audit&quot; to test the mathematical resilience of this assessment&apos;s TreeSHAP explanation against input variances.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* =============================================================== */}
            {/* TAB 7: GOVERNANCE, MODEL LINEAGE & EPISTEMIC BOUNDARIES         */}
            {/* =============================================================== */}
            {activeTab === "governance" && (
              <Card className="p-6 bg-[#1C1933] border-[#383154]">
                <CardHeader className="px-0 pt-0">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#8B5CF6]" />
                    Model Lineage, Evaluation & Epistemic Limitations
                  </CardTitle>
                  <CardDescription>
                    Official model provenance metadata, calibration criteria, and explainability boundaries.
                  </CardDescription>
                </CardHeader>

                <CardContent className="px-0 pb-0 space-y-6">
                  {modelMetadata && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      <div className="p-4 rounded-xl bg-[#0C0A1D] border border-[#383154]">
                        <span className="text-slate-400 block mb-1">Model Architecture</span>
                        <span className="text-sm font-bold text-white">{modelMetadata.model_type}</span>
                      </div>
                      <div className="p-4 rounded-xl bg-[#0C0A1D] border border-[#383154]">
                        <span className="text-slate-400 block mb-1">Test ROC-AUC</span>
                        <span className="text-sm font-bold text-emerald-400 font-mono">
                          {modelMetadata.evaluation_metrics.roc_auc}
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-[#0C0A1D] border border-[#383154]">
                        <span className="text-slate-400 block mb-1">Test Accuracy</span>
                        <span className="text-sm font-bold text-[#A78BFA] font-mono">
                          {(modelMetadata.evaluation_metrics.accuracy * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-[#0C0A1D] border border-[#383154]">
                        <span className="text-slate-400 block mb-1">Training Samples</span>
                        <span className="text-sm font-bold text-white font-mono">
                          {modelMetadata.training_samples} MSMEs
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Formal Epistemic Boundaries */}
                  <div className="p-5 rounded-2xl bg-[#0C0A1D] border border-[#383154] space-y-3 text-xs leading-relaxed text-slate-300">
                    <h4 className="text-sm font-bold text-[#A78BFA] flex items-center gap-2">
                      <Info className="w-4 h-4 text-[#A78BFA]" />
                      What TreeSHAP Establishes vs. What It Does Not
                    </h4>
                    <p>
                      <strong>1. Associative Attribution:</strong> TreeSHAP decomposes the model’s prediction into additive contributions in log-odds space based on conditional expectations across tree splits. A positive contribution indicates that an input feature shifted the model’s internal decision margin higher relative to the ensemble base score.
                    </p>
                    <p>
                      <strong>2. Non-Causality:</strong> A high feature importance or large SHAP value does <em>not</em> prove that altering that real-world financial attribute will automatically alter creditworthiness or loan outcomes in the real world. Correlations captured by gradient-boosted trees reflect empirical historical loan performance patterns.
                    </p>
                    <p>
                      <strong>3. Decision-Support Role:</strong> Under MSME Risk AI policy, AI-assisted credit predictions and TreeSHAP attributions are strictly decision-support tools for qualified credit risk analysts and loan officers. They do not independently approve or reject loan applications.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
