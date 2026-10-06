import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
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
} from "lucide-react";
import { auth } from "../services/firebase";
import { api, ModelMonitoringData, UserProfile } from "../services/api";
import Sidebar from "../components/Sidebar";
import PageHeader from "../components/PageHeader";
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import Button from "../components/ui/Button";
import LoadingSpinner from "../components/LoadingSpinner";

export default function ModelMonitoring() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [daysFilter, setDaysFilter] = useState<number | null>(30); // 7, 30, 90, null (all)
  const [data, setData] = useState<ModelMonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/login");
        return;
      }
      try {
        const prof = await api.getUserProfile();
        setProfile(prof);
        if (prof.role.toLowerCase() !== "admin") {
          setLoading(false);
          return;
        }
        await loadMonitoringData(30);
      } catch (err: any) {
        console.error("Auth / profile loading error:", err);
        setError("Failed to verify administrative privileges.");
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const loadMonitoringData = async (days: number | null) => {
    try {
      setLoading(true);
      setError("");
      const res = await api.getAdminModelMonitoring(days);
      setData(res);
    } catch (err: any) {
      console.error("Failed to load model monitoring metrics:", err);
      setError(err?.message || "Failed to load model monitoring metrics.");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (days: number | null) => {
    setDaysFilter(days);
    loadMonitoringData(days);
  };

  const isAdmin = profile?.role?.toLowerCase() === "admin";

  if (!loading && !isAdmin) {
    return (
      <div className="app-layout">
        <Sidebar active="Settings" />
        <main className="main-content space-y-6">
          <PageHeader
            badge="Administrative Zone"
            title="Model Monitoring Platform"
            description="Restricted platform governance and telemetry module."
          />
          <Card className="max-w-xl mx-auto mt-12 p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-950/40 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <Lock className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-white font-['Space_Grotesk']">
              Administrator Privileges Required
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Model monitoring, data drift telemetry, and model governance are restricted to compliance administrators.
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

  return (
    <div className="app-layout">
      <Sidebar active="Settings" />

      <main className="main-content space-y-6">
        <PageHeader
          badge="MLOps & Governance"
          title="AI Model Monitoring Platform"
          description="Continuous operational tracking of XGBoost v1.1.0 inference distributions, risk shifts, data quality, and drift telemetry."
          actions={
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="outline"
                size="md"
                icon={<FileText className="w-4 h-4 text-cyan-400" />}
                onClick={() => navigate("/admin/model-card")}
              >
                View Model Card
              </Button>
              <Button
                variant="outline"
                size="md"
                icon={<RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />}
                onClick={() => loadMonitoringData(daysFilter)}
              >
                Refresh Telemetry
              </Button>
            </div>
          }
        />

        {/* Date Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-[#091427] border border-[#16273f]">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <span>Telemetry Time Window:</span>
          </div>

          <div className="flex items-center gap-2">
            {[
              { label: "7 Days", val: 7 },
              { label: "30 Days", val: 30 },
              { label: "90 Days", val: 90 },
              { label: "All Time", val: null },
            ].map((btn) => (
              <button
                key={btn.label}
                onClick={() => handleFilterChange(btn.val)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  daysFilter === btn.val
                    ? "bg-cyan-500 text-black font-semibold shadow-md shadow-cyan-500/20"
                    : "bg-[#0c1b33] text-slate-300 hover:bg-[#132749] border border-[#182e4e]"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-24 flex justify-center">
            <LoadingSpinner text="Computing operational inference distributions & drift telemetry..." />
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Top KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Current Model</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/20 font-mono text-[10px]">
                    ACTIVE
                  </span>
                </div>
                <div className="my-3">
                  <div className="text-xl font-bold text-white font-['Space_Grotesk']">
                    {data.model_metadata.model_name}
                  </div>
                  <div className="text-xs text-cyan-400 font-mono mt-0.5">
                    {data.model_metadata.algorithm} v{data.model_metadata.model_version}
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 border-t border-[#16273f] pt-2">
                  Feature Dimensions: <b>{data.model_metadata.feature_count} inputs</b>
                </div>
              </Card>

              <Card className="p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Inference Count</span>
                  <Activity className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="my-3">
                  <div className="text-3xl font-extrabold text-white font-['Space_Grotesk']">
                    {data.volume_and_counts.total_predictions}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">Evaluations in window</div>
                </div>
                <div className="text-[11px] text-slate-400 border-t border-[#16273f] pt-2">
                  Window: <b>{data.time_window.filter}</b>
                </div>
              </Card>

              <Card className="p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Avg Default Prob. / Score</span>
                  <BarChart3 className="w-4 h-4 text-amber-400" />
                </div>
                <div className="my-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-white font-['Space_Grotesk']">
                      {data.averages.average_default_probability.toFixed(1)}%
                    </span>
                    <span className="text-sm font-semibold text-cyan-400">
                      Score {Math.round(data.averages.average_risk_score)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Mean model confidence indicator: {data.averages.average_confidence.toFixed(1)}%
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 border-t border-[#16273f] pt-2">
                  Normalized scale 0–100
                </div>
              </Card>

              <Card className="p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Data Quality Average</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="my-3">
                  <div className="text-3xl font-extrabold text-emerald-400 font-['Space_Grotesk']">
                    {Math.round(data.data_quality.average_score)} / 100
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Missing Input Rate: {data.data_quality.missing_data_rate_percentage.toFixed(1)}%
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 border-t border-[#16273f] pt-2">
                  Heuristic completeness index
                </div>
              </Card>
            </div>

            {/* Risk Tier Distribution Visualization */}
            <Card className="p-6">
              <CardHeader className="p-0 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Inference Risk Distribution</CardTitle>
                    <CardDescription>
                      Distribution of portfolio default classifications across evaluated assessments
                    </CardDescription>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Total: {data.volume_and_counts.total_predictions}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="p-0 space-y-4">
                {/* Horizontal Segmented Bar */}
                <div className="h-4 rounded-full bg-[#11233d] overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${data.distribution_percentages.low_risk_percentage}%` }}
                    title={`Low Risk: ${data.distribution_percentages.low_risk_percentage}%`}
                  />
                  <div
                    className="h-full bg-amber-500 transition-all"
                    style={{ width: `${data.distribution_percentages.medium_risk_percentage}%` }}
                    title={`Medium Risk: ${data.distribution_percentages.medium_risk_percentage}%`}
                  />
                  <div
                    className="h-full bg-rose-500 transition-all"
                    style={{ width: `${data.distribution_percentages.high_risk_percentage}%` }}
                    title={`High Risk: ${data.distribution_percentages.high_risk_percentage}%`}
                  />
                </div>

                {/* Legend & Percentages */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="p-3 rounded-xl bg-[#0a162b] border border-[#162947] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-white">Low Risk</div>
                        <div className="text-[11px] text-slate-400">{data.volume_and_counts.low_risk_count} assessments</div>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-emerald-400 font-mono">
                      {data.distribution_percentages.low_risk_percentage.toFixed(1)}%
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0a162b] border border-[#162947] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-white">Medium Risk</div>
                        <div className="text-[11px] text-slate-400">{data.volume_and_counts.medium_risk_count} assessments</div>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-amber-400 font-mono">
                      {data.distribution_percentages.medium_risk_percentage.toFixed(1)}%
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0a162b] border border-[#162947] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-white">High Risk</div>
                        <div className="text-[11px] text-slate-400">{data.volume_and_counts.high_risk_count} assessments</div>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-rose-400 font-mono">
                      {data.distribution_percentages.high_risk_percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Input Distribution & Data Drift Telemetry */}
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-[#16273f]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle>Feature Distribution & Data Drift Monitoring</CardTitle>
                    <CardDescription>
                      Continuous statistical tracking of key financial and operational inference features
                    </CardDescription>
                  </div>
                  <div className="px-3 py-1 rounded-lg bg-[#09152a] border border-[#172d4d] text-[11px] text-slate-300 font-mono">
                    Baseline: {data.feature_drift.baseline_status}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="p-3.5 bg-[#081222] border-b border-[#16273f] text-[11px] text-slate-400 flex items-center gap-2">
                  <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>{data.feature_drift.disclaimer}</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#16273f] bg-[#091322] text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                        <th className="py-3 px-4">Feature Name</th>
                        <th className="py-3 px-4">Window Samples</th>
                        <th className="py-3 px-4">Mean</th>
                        <th className="py-3 px-4">Median</th>
                        <th className="py-3 px-4">Range (Min – Max)</th>
                        <th className="py-3 px-4">Missing Rate</th>
                        <th className="py-3 px-4 text-right">Drift Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#132238] text-slate-300">
                      {Object.entries(data.feature_drift.features).map(([featName, featData]) => {
                        const s = featData.recent_stats;
                        return (
                          <tr key={featName} className="hover:bg-[#0c1930] transition-colors">
                            <td className="py-3.5 px-4 font-mono font-medium text-white">
                              {featName}
                            </td>
                            <td className="py-3.5 px-4 text-slate-300">{s.count}</td>
                            <td className="py-3.5 px-4 font-mono text-cyan-400">
                              {s.mean !== null ? s.mean.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—"}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-200">
                              {s.median !== null ? s.median.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—"}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-400">
                              {s.min !== null && s.max !== null
                                ? `${s.min.toLocaleString(undefined, { maximumFractionDigits: 0 })} – ${s.max.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                                : "—"}
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  s.missing_rate === 0
                                    ? "bg-emerald-950/60 text-emerald-400"
                                    : "bg-amber-950/60 text-amber-400"
                                }`}
                              >
                                {s.missing_rate.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300 border border-slate-700">
                                {featData.drift_status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions Footer */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-[#091427] border border-[#16273f]">
              <div className="text-xs text-slate-400">
                Institutional AI Governance: Human review required for high-impact credit underwriting decisions.
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<FileText className="w-4 h-4" />}
                  onClick={() => navigate("/admin/model-card")}
                >
                  Official Model Card
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<ArrowRight className="w-4 h-4" />}
                  onClick={() => navigate("/prediction-history")}
                >
                  Prediction History Ledger
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
