import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import AdminHeader from "./AdminHeader";
import {
  Users,
  Building2,
  FileCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Activity,
  Database,
  KeyRound,
  HardDrive,
  Cpu,
  BrainCircuit,
  RefreshCw,
  TrendingUp,
  Shield,
  Layers,
  Info,
} from "lucide-react";
import { api, AdminSystemStats, AssessmentSummary } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/ui/EmptyState";
import Card, { CardHeader, CardTitle, CardContent } from "../../components/ui/Card";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState<AdminSystemStats | null>(null);
  const [health, setHealth] = useState<{
    status: string;
    application: string;
    database: string;
    database_type: string;
    environment: string;
    version: string;
  } | null>(null);
  const [readiness, setReadiness] = useState<{
    ready: boolean;
    database: string;
    ml_model: string;
    model_version?: string;
  } | null>(null);
  const [recentAssessments, setRecentAssessments] = useState<AssessmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string>("");
  const [activityFilter, setActivityFilter] = useState<"7d" | "30d" | "90d" | "all">("30d");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [adminStatsRes, healthRes, readyRes, assessRes] = await Promise.allSettled([
        api.getAdminStats(),
        api.getHealth(),
        api.getReadiness(),
        api.getAssessments({ all_users: true, limit: 10 }),
      ]);

      if (adminStatsRes.status === "fulfilled") {
        setStats(adminStatsRes.value);
      } else {
        throw new Error("Failed to load platform statistics.");
      }

      if (healthRes.status === "fulfilled") {
        setHealth(healthRes.value);
      }
      if (readyRes.status === "fulfilled") {
        setReadiness(readyRes.value);
      }
      if (assessRes.status === "fulfilled") {
        setRecentAssessments(assessRes.value || []);
      }

      setLastChecked(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.error("Admin dashboard load error:", err);
      setError(err?.message || "Failed to load admin telemetry data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived metrics from real backend data
  const totalUsers = stats?.total_users ?? 0;
  const totalBusinesses = stats?.total_businesses ?? 0;
  const totalAssessments = stats?.total_assessments ?? 0;
  const pendingReviews = stats?.pending_reviews ?? 0;
  const completedReviews = (stats?.approved_assessments ?? 0) + (stats?.rejected_assessments ?? 0);
  const totalDocs = stats?.total_documents ?? 0;

  const lowRisk =
    stats?.risk_distribution?.["Low"] ??
    stats?.risk_distribution?.["low"] ??
    0;
  const medRisk =
    stats?.risk_distribution?.["Medium"] ??
    stats?.risk_distribution?.["medium"] ??
    0;
  const highRisk =
    stats?.risk_distribution?.["High"] ??
    stats?.risk_distribution?.["high"] ??
    stats?.high_risk_assessments ??
    0;

  const totalRiskCount = lowRisk + medRisk + highRisk || 1;
  const lowPct = Math.round((lowRisk / totalRiskCount) * 100);
  const medPct = Math.round((medRisk / totalRiskCount) * 100);
  const highPct = Math.round((highRisk / totalRiskCount) * 100);

  // Health card helper
  const isDbHealthy = health?.database === "healthy" || readiness?.database === "ready";
  const isModelReady = readiness?.ml_model === "loaded" || readiness?.ready === true;

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#030712] text-slate-100">
        <Sidebar active="Overview" />
        <div className="flex-1 flex flex-col">
          <AdminHeader />
          <div className="flex-1 flex items-center justify-center p-8">
            <LoadingSpinner text="Retrieving platform intelligence & system health..." />
          </div>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex min-h-screen bg-[#030712] text-slate-100">
        <Sidebar active="Overview" />
        <div className="flex-1 flex flex-col">
          <AdminHeader />
          <main className="p-6 max-w-7xl mx-auto w-full">
            <EmptyState
              title="Unable to load platform health"
              description={error}
              actionLabel="Retry Telemetry Check"
              onAction={loadData}
            />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#030712] text-slate-100">
      <Sidebar active="Overview" />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title="Admin Control Center"
          subtitle="Platform overview, risk intelligence, users and system health."
        />

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Top Info Bar / Responsible AI Notice */}
          <div className="p-3.5 rounded-2xl bg-blue-950/30 border border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-blue-300">
              <BrainCircuit className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                <strong>AI-Assisted Credit Risk Assessment:</strong> Provides decision support telemetry; does not autonomously approve or reject credit.
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
              <span className="text-slate-400 text-[11px]">
                Last checked: <span className="text-slate-200">{lastChecked || "Just now"}</span>
              </span>
              <button
                onClick={loadData}
                className="p-1.5 rounded-lg bg-[#0d1c33] border border-[#1e3458] text-slate-300 hover:text-white hover:bg-slate-800 transition"
                title="Refresh Metrics"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Section 4: KPI CARDS (9 cards as required) */}
          <section aria-labelledby="kpi-heading">
            <div className="flex items-center justify-between mb-3">
              <h2 id="kpi-heading" className="text-sm font-bold uppercase tracking-wider text-slate-400">
                Platform Key Metrics
              </h2>
              <span className="text-xs text-slate-400">Live authoritative counts</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {/* Total Users */}
              <div
                onClick={() => navigate("/admin/users")}
                className="p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b] hover:border-cyan-500/40 cursor-pointer transition group shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Total Users</span>
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 text-2xl font-bold text-white group-hover:text-cyan-300 transition">
                  {totalUsers}
                </div>
                <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1">
                  <span>Manage Platform Accounts</span>
                </div>
              </div>

              {/* Total MSME Businesses */}
              <div
                onClick={() => navigate("/admin/businesses")}
                className="p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b] hover:border-cyan-500/40 cursor-pointer transition group shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Total Businesses</span>
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 text-2xl font-bold text-white group-hover:text-cyan-300 transition">
                  {totalBusinesses}
                </div>
                <div className="mt-1 text-[11px] text-slate-400">Registered MSMEs</div>
              </div>

              {/* Total Assessments */}
              <div
                onClick={() => navigate("/admin/assessments")}
                className="p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b] hover:border-cyan-500/40 cursor-pointer transition group shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Total Assessments</span>
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
                    <FileCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 text-2xl font-bold text-white group-hover:text-purple-300 transition">
                  {totalAssessments}
                </div>
                <div className="mt-1 text-[11px] text-slate-400">Lifetime Risk Runs</div>
              </div>

              {/* Pending Analyst Reviews */}
              <div
                onClick={() => navigate("/admin/assessments?status=pending")}
                className="p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b] hover:border-amber-500/40 cursor-pointer transition group shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Pending Reviews</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 text-2xl font-bold text-amber-400">
                  {pendingReviews}
                </div>
                <div className="mt-1 text-[11px] text-slate-400">Awaiting Analyst Queue</div>
              </div>

              {/* Completed Reviews */}
              <div
                onClick={() => navigate("/admin/assessments?status=completed")}
                className="p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b] hover:border-emerald-500/40 cursor-pointer transition group shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Completed Reviews</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 text-2xl font-bold text-emerald-400">
                  {completedReviews}
                </div>
                <div className="mt-1 text-[11px] text-slate-400">Approved & Rejected</div>
              </div>

              {/* Low Risk */}
              <div
                onClick={() => navigate("/admin/assessments?risk=low")}
                className="p-4 rounded-2xl bg-[#081120] border border-emerald-500/20 hover:border-emerald-500/40 cursor-pointer transition group shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Low Risk</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {lowPct}%
                  </span>
                </div>
                <div className="mt-3 text-2xl font-bold text-emerald-400">{lowRisk}</div>
                <div className="mt-1 text-[11px] text-slate-400">Grade Tier A/B</div>
              </div>

              {/* Medium Risk */}
              <div
                onClick={() => navigate("/admin/assessments?risk=medium")}
                className="p-4 rounded-2xl bg-[#081120] border border-amber-500/20 hover:border-amber-500/40 cursor-pointer transition group shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Medium Risk</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    {medPct}%
                  </span>
                </div>
                <div className="mt-3 text-2xl font-bold text-amber-400">{medRisk}</div>
                <div className="mt-1 text-[11px] text-slate-400">Moderate Exposure</div>
              </div>

              {/* High Risk */}
              <div
                onClick={() => navigate("/admin/assessments?risk=high")}
                className="p-4 rounded-2xl bg-[#081120] border border-rose-500/20 hover:border-rose-500/40 cursor-pointer transition group shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">High Risk</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    {highPct}%
                  </span>
                </div>
                <div className="mt-3 text-2xl font-bold text-rose-400">{highRisk}</div>
                <div className="mt-1 text-[11px] text-slate-400">Critical Scrutiny</div>
              </div>

              {/* Documents Processed */}
              <div
                onClick={() => navigate("/admin/documents")}
                className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b] hover:border-cyan-500/40 cursor-pointer transition group shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Documents Processed</span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 text-2xl font-bold text-white group-hover:text-indigo-300 transition">
                  {totalDocs}
                </div>
                <div className="mt-1 text-[11px] text-slate-400">OCR Statements Extracted</div>
              </div>
            </div>
          </section>

          {/* Section 5: PLATFORM HEALTH */}
          <section aria-labelledby="health-heading">
            <div className="flex items-center justify-between mb-3">
              <h2 id="health-heading" className="text-sm font-bold uppercase tracking-wider text-slate-400">
                Platform Health & Telemetry
              </h2>
              <span className="text-xs text-slate-400">Authoritative service probes</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Backend API */}
              <div className="p-3.5 rounded-2xl bg-[#081120] border border-[#1a2d4b] flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300">Backend API</span>
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                  Healthy
                </div>
                <span className="text-[10px] text-slate-400 mt-1">FastAPI v{health?.version || "1.1.0"}</span>
              </div>

              {/* Database */}
              <div className="p-3.5 rounded-2xl bg-[#081120] border border-[#1a2d4b] flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300">Database</span>
                  <Database className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                  <span className={`w-2 h-2 rounded-full ${isDbHealthy ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-rose-400"}`} />
                  {isDbHealthy ? "Healthy" : "Degraded"}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 capitalize">
                  {health?.database_type || "PostgreSQL"} Engine
                </span>
              </div>

              {/* Authentication */}
              <div className="p-3.5 rounded-2xl bg-[#081120] border border-[#1a2d4b] flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300">Authentication</span>
                  <KeyRound className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                  Healthy
                </div>
                <span className="text-[10px] text-slate-400 mt-1">Firebase JWT + RBAC</span>
              </div>

              {/* Document Storage */}
              <div className="p-3.5 rounded-2xl bg-[#081120] border border-[#1a2d4b] flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300">Document Storage</span>
                  <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                  Healthy
                </div>
                <span className="text-[10px] text-slate-400 mt-1">Isolated Object Store</span>
              </div>

              {/* AI Prediction Service */}
              <div className="p-3.5 rounded-2xl bg-[#081120] border border-[#1a2d4b] flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300">AI Prediction</span>
                  <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                  <span className={`w-2 h-2 rounded-full ${isModelReady ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-amber-400"}`} />
                  {isModelReady ? "Healthy" : "Fallback Mode"}
                </div>
                <span className="text-[10px] text-slate-400 mt-1">XGBoost & SHAP</span>
              </div>

              {/* OCR Service */}
              <div className="p-3.5 rounded-2xl bg-[#081120] border border-[#1a2d4b] flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300">OCR Service</span>
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                  Configured
                </div>
                <span className="text-[10px] text-slate-400 mt-1">DocumentAI & Regex</span>
              </div>
            </div>
          </section>

          {/* Section 6 & 7: PORTFOLIO RISK & ACTIVITY TREND */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Risk Distribution Card (Section 6) */}
            <div className="lg:col-span-5 bg-[#081120] border border-[#1a2d4b] rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-bold text-white">Portfolio Risk Distribution</h3>
                  </div>
                  <button
                    onClick={() => navigate("/admin/risk-intelligence")}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
                  >
                    View Intel →
                  </button>
                </div>

                {/* Visual Distribution Bar */}
                <div className="h-4 w-full rounded-full overflow-hidden flex bg-slate-800 shadow-inner mb-6">
                  <div
                    style={{ width: `${lowPct}%` }}
                    className="bg-emerald-500 transition-all duration-500 hover:opacity-90"
                    title={`Low: ${lowPct}%`}
                  />
                  <div
                    style={{ width: `${medPct}%` }}
                    className="bg-amber-500 transition-all duration-500 hover:opacity-90"
                    title={`Medium: ${medPct}%`}
                  />
                  <div
                    style={{ width: `${highPct}%` }}
                    className="bg-rose-500 transition-all duration-500 hover:opacity-90"
                    title={`High: ${highPct}%`}
                  />
                </div>

                {/* Risk Breakdown Rows */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#0c182a] border border-[#162742]">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-emerald-400" />
                      <div>
                        <div className="text-xs font-semibold text-slate-200">LOW RISK</div>
                        <div className="text-[10px] text-slate-400">Default Prob &lt; 20%</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-emerald-400">{lowPct}%</div>
                      <div className="text-[10px] text-slate-400">{lowRisk} assessments</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#0c182a] border border-[#162742]">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-amber-400" />
                      <div>
                        <div className="text-xs font-semibold text-slate-200">MEDIUM RISK</div>
                        <div className="text-[10px] text-slate-400">Default Prob 20% - 50%</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-amber-400">{medPct}%</div>
                      <div className="text-[10px] text-slate-400">{medRisk} assessments</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#0c182a] border border-[#162742]">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-rose-400" />
                      <div>
                        <div className="text-xs font-semibold text-slate-200">HIGH RISK</div>
                        <div className="text-[10px] text-slate-400">Default Prob &gt; 50%</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-rose-400">{highPct}%</div>
                      <div className="text-[10px] text-slate-400">{highRisk} assessments</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#1a2d4b] text-[11px] text-slate-400 flex items-center justify-between">
                <span>Total Evaluated: {totalRiskCount} portfolios</span>
                <span className="text-slate-300 font-medium">Model: XGBoost v{health?.version || "1.1.0"}</span>
              </div>
            </div>

            {/* Assessment Activity Trend (Section 7) */}
            <div className="lg:col-span-7 bg-[#081120] border border-[#1a2d4b] rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <div>
                      <h3 className="text-sm font-bold text-white">Assessment Activity & Pipeline</h3>
                      <p className="text-[11px] text-slate-400">Underwriting throughput and review metrics</p>
                    </div>
                  </div>

                  {/* Filter tabs */}
                  <div className="flex items-center p-0.5 rounded-xl bg-[#0c182b] border border-[#1d3559]">
                    {(["7d", "30d", "90d", "all"] as const).map((filterKey) => (
                      <button
                        key={filterKey}
                        onClick={() => setActivityFilter(filterKey)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                          activityFilter === filterKey
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {filterKey === "7d"
                          ? "7 Days"
                          : filterKey === "30d"
                          ? "30 Days"
                          : filterKey === "90d"
                          ? "90 Days"
                          : "All Time"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pipeline Funnel Stats */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="p-3 rounded-xl bg-[#0d1c33] border border-[#1a2d4b] text-center">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1">Created</span>
                    <span className="text-xl font-bold text-white">{totalAssessments}</span>
                    <span className="text-[10px] text-cyan-400 block mt-0.5">Initiated</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0d1c33] border border-[#1a2d4b] text-center">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1">Under Review</span>
                    <span className="text-xl font-bold text-amber-400">{pendingReviews}</span>
                    <span className="text-[10px] text-amber-400/80 block mt-0.5">Analyst Queue</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0d1c33] border border-[#1a2d4b] text-center">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1">Decided</span>
                    <span className="text-xl font-bold text-emerald-400">{completedReviews}</span>
                    <span className="text-[10px] text-emerald-400/80 block mt-0.5">Approved/Rejected</span>
                  </div>
                </div>

                {/* Activity Representation */}
                <div className="p-4 rounded-xl bg-[#0a1526] border border-[#182945] space-y-3">
                  <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Recent Pipeline Submissions</span>
                    <button
                      onClick={() => navigate("/admin/assessments")}
                      className="text-[11px] text-cyan-400 hover:underline"
                    >
                      View All Assessments →
                    </button>
                  </div>

                  {recentAssessments.length === 0 ? (
                    <div className="text-xs text-slate-400 py-4 text-center">
                      No recent assessment activity found for this period.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800/80">
                      {recentAssessments.slice(0, 4).map((item) => (
                        <div
                          key={item.id}
                          onClick={() => navigate(`/admin/assessments`)}
                          className="py-2.5 flex items-center justify-between hover:bg-slate-800/30 px-2 rounded-lg cursor-pointer transition"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-slate-100 truncate">
                              {item.business_name || `Business #${item.id}`}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {item.created_at ? new Date(item.created_at).toLocaleDateString() : "Recent"} • {item.industry || "General"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                                item.risk_level?.toLowerCase() === "low"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                  : item.risk_level?.toLowerCase() === "high"
                                  ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              }`}
                            >
                              {item.risk_level || "Medium"}
                            </span>
                            <span className="text-[11px] text-slate-400 capitalize">
                              {item.review_status?.replace("_", " ") || "Pending"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#1a2d4b] text-[11px] text-slate-400 flex items-center justify-between">
                <span>Filter applied: {activityFilter.toUpperCase()}</span>
                <span className="text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  Audit logs active
                </span>
              </div>
            </div>
          </div>

          {/* Section: Bottom Quick Links & Platform Administration */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              onClick={() => navigate("/admin/analysts")}
              className="p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b] hover:border-purple-500/40 cursor-pointer transition group shadow-md"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition">
                    Analyst Workload
                  </h3>
                  <p className="text-[11px] text-slate-400">Monitor underwriters & turnaround times</p>
                </div>
              </div>
              <div className="text-xs text-slate-300 mt-2 flex items-center justify-between">
                <span>Pending Reviews: <strong className="text-amber-400">{pendingReviews}</strong></span>
                <span className="text-purple-400 group-hover:translate-x-1 transition-transform">Inspect →</span>
              </div>
            </div>

            <div
              onClick={() => navigate("/admin/model-monitoring")}
              className="p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b] hover:border-cyan-500/40 cursor-pointer transition group shadow-md"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition">
                    Model Monitoring & Drift
                  </h3>
                  <p className="text-[11px] text-slate-400">Feature statistics & drift detection</p>
                </div>
              </div>
              <div className="text-xs text-slate-300 mt-2 flex items-center justify-between">
                <span>Model Version: <strong className="text-cyan-400">v{health?.version || "1.1.0"}</strong></span>
                <span className="text-cyan-400 group-hover:translate-x-1 transition-transform">Inspect →</span>
              </div>
            </div>

            <div
              onClick={() => navigate("/admin/audit-logs")}
              className="p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b] hover:border-emerald-500/40 cursor-pointer transition group shadow-md"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition">
                    Audit Trail & Security
                  </h3>
                  <p className="text-[11px] text-slate-400">Immutable record of platform mutations</p>
                </div>
              </div>
              <div className="text-xs text-slate-300 mt-2 flex items-center justify-between">
                <span>Recent Events: <strong className="text-emerald-400">{stats?.recent_audit_events_count ?? 0}</strong></span>
                <span className="text-emerald-400 group-hover:translate-x-1 transition-transform">View Logs →</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
