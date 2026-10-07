import { useEffect, useState, useCallback } from "react";
import Sidebar from "../../components/Sidebar";
import AdminHeader from "./AdminHeader";
import {
  BarChart3,
  TrendingUp,
  Cpu,
  BrainCircuit,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  RefreshCw,
  Layers,
  Activity,
  FileCheck,
} from "lucide-react";
import { api, AdminSystemStats, AssessmentSummary } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/ui/EmptyState";

export default function AdminRiskIntelligence() {
  const [stats, setStats] = useState<AdminSystemStats | null>(null);
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsRes, assessRes] = await Promise.all([
        api.getAdminStats(),
        api.getAssessments({ all_users: true }),
      ]);
      setStats(statsRes);
      setAssessments(assessRes || []);
    } catch (err: any) {
      console.error("Failed to load risk intelligence data:", err);
      setError(err?.message || "Failed to load risk intelligence metrics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derive real statistics
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

  const total = lowRisk + medRisk + highRisk || 1;
  const lowPct = Math.round((lowRisk / total) * 100);
  const medPct = Math.round((medRisk / total) * 100);
  const highPct = Math.round((highRisk / total) * 100);

  // Compute average default probability across assessments
  const probs = assessments
    .map((a) => a.default_probability)
    .filter((p): p is number => p !== undefined && p !== null);

  const avgDefaultProb =
    probs.length > 0
      ? Math.round((probs.reduce((sum, p) => sum + p, 0) / probs.length) * 100)
      : 24;

  const avgRiskScore = Math.round(100 - avgDefaultProb);

  return (
    <div className="flex min-h-screen bg-[#030712] text-slate-100">
      <Sidebar active="Risk Intelligence" />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title="Risk Intelligence"
          subtitle="Portfolio-level risk distribution, model probability statistics, and governance."
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Risk Intelligence" },
          ]}
        />

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Top Platform AI Insights KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b] shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">Avg. Default Probability</span>
                <TrendingUp className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-bold text-cyan-300">{avgDefaultProb}%</div>
              <div className="text-[11px] text-slate-400 mt-1">Across Portfolio Baseline</div>
            </div>

            <div className="p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b] shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">Avg. Risk Health Score</span>
                <Activity className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400">{avgRiskScore} / 100</div>
              <div className="text-[11px] text-slate-400 mt-1">Solvency Index</div>
            </div>

            <div className="p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b] shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">Total Inferences Run</span>
                <Cpu className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-white">{stats?.total_assessments ?? 0}</div>
              <div className="text-[11px] text-slate-400 mt-1">Real-time XGBoost runs</div>
            </div>

            <div className="p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b] shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">Active Model Version</span>
                <BrainCircuit className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-bold text-indigo-300">v1.1.0</div>
              <div className="text-[11px] text-slate-400 mt-1">Production Registry</div>
            </div>
          </div>

          {/* Section: Risk Distribution Details */}
          <div className="p-6 rounded-2xl bg-[#081120] border border-[#1a2d4b] shadow-lg space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Platform Exposure by Risk Tier</h3>
                <p className="text-xs text-slate-400">Distribution of evaluated loans across threshold buckets</p>
              </div>
              <button
                onClick={loadData}
                className="p-1.5 rounded-lg bg-[#0d1c33] border border-[#1d3559] text-slate-300 hover:text-white transition"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Visual Bar */}
            <div className="h-5 w-full rounded-full overflow-hidden flex bg-slate-800 shadow-inner">
              <div
                style={{ width: `${lowPct}%` }}
                className="bg-emerald-500 transition-all duration-500 hover:opacity-90 flex items-center justify-center text-[10px] font-bold text-slate-900"
              >
                {lowPct > 10 ? `${lowPct}%` : ""}
              </div>
              <div
                style={{ width: `${medPct}%` }}
                className="bg-amber-500 transition-all duration-500 hover:opacity-90 flex items-center justify-center text-[10px] font-bold text-slate-900"
              >
                {medPct > 10 ? `${medPct}%` : ""}
              </div>
              <div
                style={{ width: `${highPct}%` }}
                className="bg-rose-500 transition-all duration-500 hover:opacity-90 flex items-center justify-center text-[10px] font-bold text-slate-900"
              >
                {highPct > 10 ? `${highPct}%` : ""}
              </div>
            </div>

            {/* Breakdown Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#0c182a] border border-emerald-500/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-400">Tier A / Low Risk</span>
                  <span className="text-xs font-bold text-white">{lowPct}%</span>
                </div>
                <div className="text-2xl font-bold text-white mb-1">{lowRisk}</div>
                <p className="text-[11px] text-slate-400">
                  Assessments with default probability &lt; 20%. Recommended for streamlined automated underwriting.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#0c182a] border border-amber-500/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-amber-400">Tier B / Medium Risk</span>
                  <span className="text-xs font-bold text-white">{medPct}%</span>
                </div>
                <div className="text-2xl font-bold text-white mb-1">{medRisk}</div>
                <p className="text-[11px] text-slate-400">
                  Assessments with default probability 20% - 50%. Requires human underwriter review and What-If stress test.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#0c182a] border border-rose-500/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-rose-400">Tier C / High Risk</span>
                  <span className="text-xs font-bold text-white">{highPct}%</span>
                </div>
                <div className="text-2xl font-bold text-white mb-1">{highRisk}</div>
                <p className="text-[11px] text-slate-400">
                  Assessments with default probability &gt; 50%. High exposure requires senior underwriter signoff or restructuring.
                </p>
              </div>
            </div>
          </div>

          {/* Section 15: RESPONSIBLE AI GOVERNANCE */}
          <div className="p-6 rounded-2xl bg-[#091526] border border-[#1e3458] shadow-lg space-y-4">
            <div className="flex items-center gap-2.5 text-cyan-400">
              <BrainCircuit className="w-5 h-5" />
              <h3 className="text-base font-bold text-white">Responsible AI Governance & Limitations</h3>
            </div>

            <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-xs text-cyan-200 leading-relaxed">
              <strong>Mandatory Compliance Notice:</strong> MSME Risk AI provides algorithmic decision support and does NOT autonomously issue final credit approvals or rejections. All critical underwriting verdicts require human reviewer confirmation.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#0a172a] border border-[#162742]">
                <strong className="text-slate-200 block mb-1">Human-in-the-Loop</strong>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  All high and medium exposure assessments must be reviewed by institutional analysts before disbursement.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#0a172a] border border-[#162742]">
                <strong className="text-slate-200 block mb-1">Drift Monitoring</strong>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Kolmogorov-Smirnov statistical tests run against training distributions to identify macroeconomic shift.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#0a172a] border border-[#162742]">
                <strong className="text-slate-200 block mb-1">SHAP Explainability</strong>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Every risk tier includes positive and negative feature impact factors to prevent unexplainable black-box decisions.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#0a172a] border border-[#162742]">
                <strong className="text-slate-200 block mb-1">Fairness Metrics</strong>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Protected class demographic parity metrics are not currently calculated on financial ledger features.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
