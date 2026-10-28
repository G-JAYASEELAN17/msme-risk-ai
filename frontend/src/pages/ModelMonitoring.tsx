import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  ModelMonitoringData,
  GovernanceSummaryData,
  DriftSnapshotData,
  GovernanceAlertItem,
  CreditPolicyItem
} from "../services/api";
import Sidebar from "../components/Sidebar";
import PageHeader from "../components/PageHeader";
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import Button from "../components/ui/Button";
import LoadingSpinner from "../components/LoadingSpinner";
import { useToast } from "../components/ui/Toast";
import { useAuthRole } from "../context/AuthRoleContext";
import {
  Activity,
  Layers,
  ShieldCheck,
  AlertTriangle,
  BrainCircuit,
  Calendar,
  FileText,
  BarChart3,
  RefreshCw,
  Lock,
  ArrowRight,
  Sparkles,
  Info,
  CheckCircle2,
  Sliders,
  Scale,
  AlertOctagon,
  Check,
  X,
  Eye,
  FileCode,
  ShieldAlert,
  HelpCircle,
  Database,
  Fingerprint
} from "lucide-react";

export default function ModelMonitoring() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user, isAdmin, isAnalyst } = useAuthRole();

  // Navigation sub-tabs
  const [activeGovernanceTab, setActiveGovernanceTab] = useState<
    "registry" | "distributions" | "drift" | "alerts" | "performance_fairness" | "policies"
  >("registry");

  const [daysFilter, setDaysFilter] = useState<number | null>(30); // 7, 30, 90, null (all)
  const [selectedAlertForAction, setSelectedAlertForAction] = useState<GovernanceAlertItem | null>(null);
  const [alertActionType, setAlertActionType] = useState<"ACKNOWLEDGE" | "RESOLVE">("ACKNOWLEDGE");
  const [alertActionNotes, setAlertActionNotes] = useState("");

  const canAccess = isAdmin || isAnalyst;

  // 1. Legacy/Existing Monitoring Data Query
  const {
    data: monitoringData,
    isLoading: loadingMonitoring,
    refetch: refetchMonitoring
  } = useQuery<ModelMonitoringData>({
    queryKey: ["model-monitoring-data", daysFilter],
    queryFn: () => api.getAdminModelMonitoring(daysFilter),
    staleTime: 60 * 1000,
    enabled: !!user && canAccess
  });

  // 2. Comprehensive Governance Summary Query (Active Model, Registry, Drift, Alerts, Fairness)
  const {
    data: govSummary,
    isLoading: loadingGov,
    refetch: refetchGov
  } = useQuery<GovernanceSummaryData>({
    queryKey: ["governance-summary"],
    queryFn: () => api.getGovernanceSummary(),
    staleTime: 30 * 1000,
    enabled: !!user && canAccess
  });

  // 3. Drift Snapshot Query (90-day window against msme_loans_clean.csv baseline)
  const {
    data: driftData,
    isLoading: loadingDrift,
    refetch: refetchDrift
  } = useQuery<DriftSnapshotData>({
    queryKey: ["drift-snapshot", daysFilter],
    queryFn: () => api.getDriftSnapshot(daysFilter || 90),
    staleTime: 60 * 1000,
    enabled: !!user && canAccess
  });

  // 4. Underwriting Credit Policies Query
  const {
    data: policies = [],
    isLoading: loadingPolicies,
    refetch: refetchPolicies
  } = useQuery<CreditPolicyItem[]>({
    queryKey: ["governance-credit-policies"],
    queryFn: () => api.getCreditPolicies(),
    staleTime: 60 * 1000,
    enabled: !!user && canAccess
  });

  // Alert Action Mutation (ACKNOWLEDGE / RESOLVE)
  const alertActionMutation = useMutation({
    mutationFn: () => {
      if (!selectedAlertForAction) throw new Error("No alert selected");
      return api.updateGovernanceAlert(
        selectedAlertForAction.id,
        alertActionType,
        alertActionNotes.trim() || undefined
      );
    },
    onSuccess: (updatedAlert) => {
      queryClient.invalidateQueries({ queryKey: ["governance-summary"] });
      setSelectedAlertForAction(null);
      setAlertActionNotes("");
      toast.success(
        "Alert Updated",
        `Alert #${updatedAlert.id} status changed to ${updatedAlert.status}.`
      );
    },
    onError: (err: any) => {
      toast.error("Action Failed", err?.message || "Could not update governance alert.");
    }
  });

  const handleRefreshAll = () => {
    void refetchMonitoring();
    void refetchGov();
    void refetchDrift();
    void refetchPolicies();
    toast.success("Telemetry Refreshed", "Model registry, PSI drift and alert logs updated.");
  };

  if (!canAccess) {
    return (
      <div className="app-layout">
        <Sidebar active="Model monitoring" />
        <main className="main-content space-y-6">
          <PageHeader
            badge="Administrative & Governance Zone"
            title="Model Governance Platform"
            description="Restricted platform governance and telemetry module."
          />
          <Card className="max-w-xl mx-auto mt-12 p-8 text-center space-y-4 bg-[#1C1933] border-[#383154]">
            <div className="w-14 h-14 rounded-2xl bg-rose-950/40 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <Lock className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-white font-['Space_Grotesk']">
              Analyst / Administrator Privileges Required
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Model monitoring, Population Stability Index (PSI) drift telemetry, and change governance are restricted to authorized credit analysts and administrators.
            </p>
            <div className="pt-2">
              <Button variant="primary" onClick={() => navigate("/dashboard")}>
                Return to Dashboard
              </Button>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  const isLoading = loadingMonitoring || loadingGov || loadingDrift;

  return (
    <div className="app-layout">
      <Sidebar active="Model monitoring" />

      <main className="main-content space-y-6">
        <PageHeader
          badge="MLOps & Governance"
          title="AI Model Governance & Monitoring Platform"
          description="Continuous operational tracking of XGBoost v1.1.0 inference distributions, TreeSHAP attributions, Population Stability Index (PSI) drift, and persistent alerts."
          actions={
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="outline"
                size="md"
                icon={<FileText className="w-4 h-4 text-[#A78BFA]" />}
                onClick={() => navigate("/admin/model-card")}
              >
                Official Model Card
              </Button>
              <Button
                variant="outline"
                size="md"
                icon={<RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />}
                onClick={handleRefreshAll}
              >
                Refresh Telemetry
              </Button>
            </div>
          }
        />

        {/* Governance Navigation Tabs Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-2xl bg-[#1C1933] border border-[#383154]">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: "registry", label: "Model Registry & Inventory", icon: Fingerprint },
              { key: "distributions", label: "Inference Distributions", icon: BarChart3 },
              { key: "drift", label: "Feature Drift (PSI)", icon: Activity },
              { key: "alerts", label: `Alerts (${govSummary?.open_alerts_count ?? 0})`, icon: AlertTriangle },
              { key: "performance_fairness", label: "Performance & Fairness Disclosures", icon: ShieldCheck },
              { key: "policies", label: "Underwriting Policies", icon: Scale }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveGovernanceTab(tab.key as any)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    activeGovernanceTab === tab.key
                      ? "bg-[#8B5CF6] text-white shadow-md shadow-[#8B5CF6]/25"
                      : "text-slate-300 hover:text-white hover:bg-[#252141]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Time Window Selector */}
          <div className="flex items-center gap-1.5 px-2">
            {[
              { label: "7D", val: 7 },
              { label: "30D", val: 30 },
              { label: "90D", val: 90 },
              { label: "All", val: null }
            ].map((btn) => (
              <button
                key={btn.label}
                onClick={() => setDaysFilter(btn.val)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  daysFilter === btn.val
                    ? "bg-[#8B5CF6] text-white shadow"
                    : "bg-[#0C0A1D] text-slate-400 hover:bg-[#252141] border border-[#383154]"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* TAB 1: MODEL REGISTRY & INVENTORY */}
        {activeGovernanceTab === "registry" && (
          <div className="space-y-6">
            {govSummary?.active_model && (
              <Card className="bg-[#1C1933] border-[#383154]">
                <CardHeader className="border-b border-[#383154]">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Active Production Model Registry Record</CardTitle>
                      <CardDescription>
                        Cryptographically fingerprinted production machine learning artifact
                      </CardDescription>
                    </div>
                    <span className="px-3 py-1 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold">
                      DEPLOYMENT STATUS: {govSummary.active_model.deployment_status}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-6">
                  {/* Metadata Specs Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-3.5 rounded-xl bg-[#0C0A1D] border border-[#383154]">
                      <div className="text-[11px] text-slate-400">Model Identifier</div>
                      <div className="text-sm font-bold text-white mt-1 font-mono">
                        {govSummary.active_model.model_id}
                      </div>
                      <div className="text-[10px] text-[#A78BFA] mt-0.5">
                        Version v{govSummary.active_model.model_version}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#0C0A1D] border border-[#383154]">
                      <div className="text-[11px] text-slate-400">Algorithm Engine</div>
                      <div className="text-sm font-bold text-white mt-1 font-mono">
                        {govSummary.active_model.algorithm}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Preprocessor: {govSummary.active_model.preprocessing_version}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#0C0A1D] border border-[#383154]">
                      <div className="text-[11px] text-slate-400">Training Provenance</div>
                      <div className="text-sm font-bold text-white mt-1 font-mono">
                        {govSummary.active_model.training_samples.toLocaleString()} train / {govSummary.active_model.test_samples.toLocaleString()} test
                      </div>
                      <div className="text-[10px] text-emerald-400 mt-0.5">
                        Holdout ROC-AUC: {govSummary.active_model.validation_metrics?.roc_auc ?? 0.9647}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#0C0A1D] border border-[#383154]">
                      <div className="text-[11px] text-slate-400">Feature Schema</div>
                      <div className="text-sm font-bold text-white mt-1 font-mono">
                        11 inputs / 14 cols
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Registered: {new Date(govSummary.active_model.registered_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Cryptographic Fingerprints */}
                  <div className="p-4 rounded-xl bg-[#0C0A1D] border border-[#383154] space-y-2 text-xs">
                    <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                      Cryptographic Artifact Fingerprints (SHA-256)
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono">
                      <span className="text-slate-400">Model File Fingerprint:</span>
                      <span className="text-[#A78BFA] bg-[#1C1933] px-2 py-0.5 rounded border border-[#383154]">
                        {govSummary.active_model.artifact_fingerprint}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono">
                      <span className="text-slate-400">Preprocessor Scaler Fingerprint:</span>
                      <span className="text-slate-300 bg-[#1C1933] px-2 py-0.5 rounded border border-[#383154]">
                        {govSummary.active_model.schema_fingerprint}
                      </span>
                    </div>
                  </div>

                  {/* Holdout Validation Metrics Table */}
                  <div>
                    <div className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                      Verified Holdout Evaluation Metrics
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
                      <div className="p-3 rounded-xl bg-[#0C0A1D] border border-[#383154] text-center">
                        <div className="text-slate-400 text-[10px]">ROC-AUC</div>
                        <div className="text-lg font-bold text-emerald-400 mt-1">
                          {govSummary.active_model.validation_metrics?.roc_auc ?? 0.9647}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-[#0C0A1D] border border-[#383154] text-center">
                        <div className="text-slate-400 text-[10px]">Accuracy</div>
                        <div className="text-lg font-bold text-white mt-1">
                          {govSummary.active_model.validation_metrics?.accuracy ?? 0.918}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-[#0C0A1D] border border-[#383154] text-center">
                        <div className="text-slate-400 text-[10px]">Precision</div>
                        <div className="text-lg font-bold text-[#A78BFA] mt-1">
                          {govSummary.active_model.validation_metrics?.precision ?? 0.781}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-[#0C0A1D] border border-[#383154] text-center">
                        <div className="text-slate-400 text-[10px]">Recall</div>
                        <div className="text-lg font-bold text-[#A78BFA] mt-1">
                          {govSummary.active_model.validation_metrics?.recall ?? 0.820}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-[#0C0A1D] border border-[#383154] text-center">
                        <div className="text-slate-400 text-[10px]">F1 Score</div>
                        <div className="text-lg font-bold text-white mt-1">
                          {govSummary.active_model.validation_metrics?.f1_score ?? 0.800}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Known Operational Limitations */}
                  <div className="p-4 rounded-xl bg-[#0C0A1D] border border-[#383154] space-y-2 text-xs">
                    <div className="text-amber-400 font-bold flex items-center gap-1.5">
                      <AlertOctagon className="w-4 h-4" />
                      <span>Documented Operational Model Limitations</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-slate-300">
                      {govSummary.active_model.known_limitations?.map((lim, idx) => (
                        <li key={idx} className="leading-relaxed">{lim}</li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* TAB 2: INFERENCE DISTRIBUTIONS */}
        {activeGovernanceTab === "distributions" && monitoringData && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4 bg-[#1C1933] border-[#383154]">
                <div className="text-xs text-slate-400">Total Evaluations</div>
                <div className="text-3xl font-extrabold text-white mt-1 font-mono">
                  {monitoringData.volume_and_counts.total_predictions}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Window: {monitoringData.time_window.filter}
                </div>
              </Card>

              <Card className="p-4 bg-[#1C1933] border-[#383154]">
                <div className="text-xs text-slate-400">Mean Default Probability</div>
                <div className="text-3xl font-extrabold text-amber-400 mt-1 font-mono">
                  {monitoringData.averages.average_default_probability.toFixed(1)}%
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Average risk score: {Math.round(monitoringData.averages.average_risk_score)}
                </div>
              </Card>

              <Card className="p-4 bg-[#1C1933] border-[#383154]">
                <div className="text-xs text-slate-400">Data Completeness</div>
                <div className="text-3xl font-extrabold text-emerald-400 mt-1 font-mono">
                  {Math.round(monitoringData.data_quality.average_score)} / 100
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Missing rate: {monitoringData.data_quality.missing_data_rate_percentage.toFixed(1)}%
                </div>
              </Card>

              <Card className="p-4 bg-[#1C1933] border-[#383154]">
                <div className="text-xs text-slate-400">Model Deployment</div>
                <div className="text-2xl font-bold text-white mt-1 font-mono">
                  Active v{monitoringData.model_metadata.model_version}
                </div>
                <div className="text-[11px] text-[#A78BFA] mt-1">
                  {monitoringData.model_metadata.algorithm}
                </div>
              </Card>
            </div>

            {/* Risk Tier Distribution */}
            <Card className="bg-[#1C1933] border-[#383154] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Inference Risk Tier Distribution</CardTitle>
                  <CardDescription>
                    Portfolio classification percentages across evaluated businesses
                  </CardDescription>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  N = {monitoringData.volume_and_counts.total_predictions}
                </span>
              </div>

              {/* Segmented Bar */}
              <div className="h-4 rounded-full bg-[#0C0A1D] overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${monitoringData.distribution_percentages.low_risk_percentage}%` }}
                />
                <div
                  className="h-full bg-amber-500 transition-all"
                  style={{ width: `${monitoringData.distribution_percentages.medium_risk_percentage}%` }}
                />
                <div
                  className="h-full bg-rose-500 transition-all"
                  style={{ width: `${monitoringData.distribution_percentages.high_risk_percentage}%` }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-3.5 rounded-xl bg-[#0C0A1D] border border-[#383154] flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-400">Low Risk</span>
                  <span className="text-lg font-bold text-white font-mono">
                    {monitoringData.distribution_percentages.low_risk_percentage.toFixed(1)}% ({monitoringData.volume_and_counts.low_risk_count})
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#0C0A1D] border border-[#383154] flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-400">Medium Risk</span>
                  <span className="text-lg font-bold text-white font-mono">
                    {monitoringData.distribution_percentages.medium_risk_percentage.toFixed(1)}% ({monitoringData.volume_and_counts.medium_risk_count})
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#0C0A1D] border border-[#383154] flex items-center justify-between">
                  <span className="text-xs font-semibold text-rose-400">High Risk</span>
                  <span className="text-lg font-bold text-white font-mono">
                    {monitoringData.distribution_percentages.high_risk_percentage.toFixed(1)}% ({monitoringData.volume_and_counts.high_risk_count})
                  </span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 3: FEATURE DRIFT TELEMETRY (PSI) */}
        {activeGovernanceTab === "drift" && (
          <div className="space-y-6">
            <Card className="bg-[#1C1933] border-[#383154]">
              <CardHeader className="border-b border-[#383154]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle>Population Stability Index (PSI) Drift Analysis</CardTitle>
                    <CardDescription>
                      Evaluated against genuine baseline training dataset: {driftData?.reference_dataset || "msme_loans_clean.csv (N=2,501)"}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-bold uppercase ${
                        driftData?.overall_drift_status === "STABLE"
                          ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30"
                          : driftData?.overall_drift_status === "SIGNIFICANT_DRIFT"
                          ? "bg-rose-950/60 text-rose-400 border border-rose-500/30"
                          : "bg-amber-950/60 text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      OVERALL: {driftData?.overall_drift_status || "STABLE"}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="p-3.5 bg-[#0C0A1D] border-b border-[#383154] text-xs text-slate-400 flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#A78BFA] shrink-0" />
                  <span>
                    Threshold standard: PSI &lt; 0.10 indicates distribution stability; PSI between 0.10–0.25 suggests moderate drift; PSI &ge; 0.25 flags significant distributional divergence.
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#383154] bg-[#0C0A1D] text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                        <th className="py-3 px-4">Monitored Feature</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4 font-mono text-right">Baseline Mean</th>
                        <th className="py-3 px-4 font-mono text-right">Current Mean</th>
                        <th className="py-3 px-4 font-mono text-right">PSI Score</th>
                        <th className="py-3 px-4 text-right">Drift Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#252141] text-slate-300">
                      {driftData &&
                        Object.entries(driftData.feature_drift_metrics).map(([feat, m]) => (
                          <tr key={feat} className="hover:bg-[#252141]/50">
                            <td className="py-3 px-4 font-bold text-white font-mono">{feat}</td>
                            <td className="py-3 px-4 text-slate-400 uppercase text-[10px]">{m.feature_type}</td>
                            <td className="py-3 px-4 text-right font-mono text-slate-400">
                              {m.baseline_mean !== null ? m.baseline_mean?.toLocaleString() : "—"}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-[#A78BFA]">
                              {m.current_mean !== null ? m.current_mean?.toLocaleString() : "—"}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-white">
                              {m.psi_score !== null && m.psi_score !== undefined ? m.psi_score.toFixed(4) : "—"}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                  m.status === "NO_DRIFT"
                                    ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/20"
                                    : m.status === "SIGNIFICANT_DRIFT"
                                    ? "bg-rose-950/60 text-rose-400 border border-rose-500/20"
                                    : "bg-amber-950/60 text-amber-400 border border-amber-500/20"
                                }`}
                              >
                                {m.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 4: GOVERNANCE ALERTS */}
        {activeGovernanceTab === "alerts" && (
          <div className="space-y-6">
            <Card className="bg-[#1C1933] border-[#383154]">
              <CardHeader className="border-b border-[#383154]">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Persistent Governance Alerts</CardTitle>
                    <CardDescription>
                      Deduplicated operational alert events requiring underwriter or compliance acknowledgment
                    </CardDescription>
                  </div>
                  <span className="text-xs font-mono text-[#A78BFA]">
                    {govSummary?.open_alerts_count ?? 0} Open / Acknowledged
                  </span>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-3">
                {govSummary?.alerts.length === 0 ? (
                  <div className="text-xs text-slate-400 text-center py-8">
                    No active governance alerts detected. Model inferences and inputs remain within approved bounds.
                  </div>
                ) : (
                  govSummary?.alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-4 rounded-xl bg-[#0C0A1D] border border-[#383154] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              alert.severity === "CRITICAL"
                                ? "bg-rose-950/60 text-rose-400 border border-rose-500/30"
                                : "bg-amber-950/60 text-amber-400 border border-amber-500/30"
                            }`}
                          >
                            {alert.severity}
                          </span>
                          <span className="font-bold text-white">{alert.title}</span>
                          <span className="text-slate-500 font-mono text-[10px]">
                            ({alert.alert_type})
                          </span>
                        </div>
                        <div className="text-slate-300">{alert.description}</div>
                        <div className="text-[11px] text-slate-500">
                          Detected: {new Date(alert.created_at).toLocaleString()} • Model v{alert.model_version}
                          {alert.resolution_notes && (
                            <span className="ml-2 text-emerald-400">
                              • Resolved: {alert.resolution_notes}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            alert.status === "RESOLVED"
                              ? "bg-emerald-950/60 text-emerald-400"
                              : alert.status === "ACKNOWLEDGED"
                              ? "bg-blue-950/60 text-blue-400"
                              : "bg-rose-950/60 text-rose-400"
                          }`}
                        >
                          {alert.status}
                        </span>

                        {alert.status === "OPEN" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedAlertForAction(alert);
                              setAlertActionType("ACKNOWLEDGE");
                            }}
                          >
                            Acknowledge
                          </Button>
                        )}

                        {alert.status !== "RESOLVED" && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setSelectedAlertForAction(alert);
                              setAlertActionType("RESOLVE");
                            }}
                          >
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 5: PERFORMANCE & FAIRNESS DISCLOSURES */}
        {activeGovernanceTab === "performance_fairness" && govSummary && (
          <div className="space-y-6">
            {/* Performance Monitoring Transparency Card */}
            <Card className="bg-[#1C1933] border-[#383154]">
              <CardHeader className="border-b border-[#383154]">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Post-Origination Default Performance Monitoring</CardTitle>
                    <CardDescription>
                      Empirical tracking of loan repayment telemetry and default ground-truth
                    </CardDescription>
                  </div>
                  <span className="px-3 py-1 rounded-lg bg-amber-950/60 text-amber-400 border border-amber-500/30 text-xs font-mono font-bold">
                    {govSummary.performance_monitoring_status}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-[#0C0A1D] border border-amber-500/20 text-slate-300 leading-relaxed space-y-2">
                  <div className="text-amber-300 font-bold flex items-center gap-1.5">
                    <Info className="w-4 h-4" />
                    <span>Statutory Transparency Notice: Unfabricated Ground-Truth</span>
                  </div>
                  <p>{govSummary.performance_metrics?.reason}</p>
                </div>

                <div className="space-y-2">
                  <div className="font-bold text-white uppercase text-[11px] tracking-wider">
                    Holdout Benchmark Reference (At Deployment Validation)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-center">
                    <div className="p-3 rounded-xl bg-[#0C0A1D] border border-[#383154]">
                      <div className="text-[10px] text-slate-400">Verified ROC-AUC</div>
                      <div className="text-lg font-bold text-emerald-400 mt-0.5">0.9647</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#0C0A1D] border border-[#383154]">
                      <div className="text-[10px] text-slate-400">Verified Accuracy</div>
                      <div className="text-lg font-bold text-white mt-0.5">91.8%</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#0C0A1D] border border-[#383154]">
                      <div className="text-[10px] text-slate-400">Precision (Default)</div>
                      <div className="text-lg font-bold text-[#A78BFA] mt-0.5">78.1%</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#0C0A1D] border border-[#383154]">
                      <div className="text-[10px] text-slate-400">Recall (Default)</div>
                      <div className="text-lg font-bold text-[#A78BFA] mt-0.5">82.0%</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Fairness and Responsible AI Governance Card */}
            <Card className="bg-[#1C1933] border-[#383154]">
              <CardHeader className="border-b border-[#383154]">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Fairness & Responsible-Use Governance</CardTitle>
                    <CardDescription>
                      Compliance with Reserve Bank of India (RBI) Fair Lending Practice Code
                    </CardDescription>
                  </div>
                  <span className="px-3 py-1 rounded-lg bg-blue-950/60 text-blue-400 border border-blue-500/30 text-xs font-mono font-bold">
                    FAIRNESS STATUS: {govSummary.fairness_status}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-[#0C0A1D] border border-blue-500/20 text-slate-300 leading-relaxed space-y-2">
                  <div className="text-blue-300 font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Regulatory Framework: {govSummary.fairness_disclosures?.regulatory_framework}</span>
                  </div>
                  <p>{govSummary.fairness_disclosures?.disclosure}</p>
                </div>

                <div className="space-y-2">
                  <div className="font-bold text-white uppercase text-[11px] tracking-wider">
                    Institutional Governance Safeguards
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                    {govSummary.fairness_disclosures?.safeguards?.map((s: string, idx: number) => (
                      <li key={idx} className="leading-relaxed">{s}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 6: UNDERWRITING POLICIES */}
        {activeGovernanceTab === "policies" && (
          <div className="space-y-6">
            <Card className="bg-[#1C1933] border-[#383154]">
              <CardHeader className="border-b border-[#383154]">
                <CardTitle>Configured Institutional Credit Policies</CardTitle>
                <CardDescription>
                  Auditable underwriting policy rules evaluated independently from statistical ML inferences
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                {policies.map((p) => (
                  <div key={p.id} className="p-4 rounded-xl bg-[#0C0A1D] border border-[#383154] space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-white">{p.name}</div>
                        <div className="text-xs text-[#A78BFA] font-mono">
                          ID: {p.policy_id} • Version: {p.version}
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          p.is_active
                            ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {p.is_active ? "ACTIVE POLICY" : "HISTORICAL ARCHIVE"}
                      </span>
                    </div>

                    {p.description && <div className="text-xs text-slate-300">{p.description}</div>}

                    {/* Rules list */}
                    <div className="space-y-2 pt-2">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Configured Underwriting Rules ({p.rules?.length || 0})
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        {p.rules?.map((r: any) => (
                          <div
                            key={r.rule_id}
                            className="p-2.5 rounded-lg bg-[#1C1933] border border-[#383154] flex items-center justify-between gap-2"
                          >
                            <div>
                              <div className="font-semibold text-white">{r.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{r.rule_id}</div>
                            </div>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                r.severity === "CRITICAL" ? "text-rose-400" : "text-amber-400"
                              }`}
                            >
                              {r.severity}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* MODAL: ALERT ACTION */}
        {selectedAlertForAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl bg-[#1C1933] border border-[#383154] p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-white">
                {alertActionType === "ACKNOWLEDGE" ? "Acknowledge" : "Resolve"} Governance Alert #{selectedAlertForAction.id}
              </h3>
              <p className="text-xs text-slate-300">
                {selectedAlertForAction.title}: {selectedAlertForAction.description}
              </p>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Reviewer Notes & Justification</label>
                <textarea
                  rows={3}
                  value={alertActionNotes}
                  onChange={(e) => setAlertActionNotes(e.target.value)}
                  placeholder="Document resolution findings or acknowledgment rationale..."
                  className="w-full p-2.5 rounded-xl bg-[#0C0A1D] border border-[#383154] text-white text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedAlertForAction(null)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => alertActionMutation.mutate()}
                  disabled={alertActionMutation.isPending}
                >
                  {alertActionMutation.isPending ? "Submitting..." : `Confirm ${alertActionType}`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
