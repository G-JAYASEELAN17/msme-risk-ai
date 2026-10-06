import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  History,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  Filter,
  Search,
  BrainCircuit,
  ShieldCheck,
  Activity,
  Sparkles,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  X,
  FileText,
} from "lucide-react";
import { auth } from "../services/firebase";
import { api, PredictionHistoryItem, PredictionExplanation, RiskTrendResult } from "../services/api";
import Sidebar from "../components/Sidebar";
import PageHeader from "../components/PageHeader";
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { RiskBadge } from "../components/ui/Badge";
import Button from "../components/ui/Button";
import LoadingSpinner from "../components/LoadingSpinner";
import EmptyState from "../components/ui/EmptyState";

export default function PredictionHistory() {
  const navigate = useNavigate();
  const [predictions, setPredictions] = useState<PredictionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [selectedPrediction, setSelectedPrediction] = useState<PredictionHistoryItem | null>(null);
  const [explanation, setExplanation] = useState<PredictionExplanation | null>(null);
  const [riskTrend, setRiskTrend] = useState<RiskTrendResult | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/login");
      } else {
        loadHistory();
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await api.getPredictionHistory({ limit: 100 });
      setPredictions(data);
    } catch (err) {
      console.error("Failed to load prediction history:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetails = async (item: PredictionHistoryItem) => {
    setSelectedPrediction(item);
    setLoadingDetails(true);
    setExplanation(null);
    setRiskTrend(null);

    try {
      const [exp, trend] = await Promise.allSettled([
        api.getPredictionExplanation(item.prediction_id),
        api.getPredictionRiskTrend(item.prediction_id),
      ]);

      if (exp.status === "fulfilled") {
        setExplanation(exp.value);
      }
      if (trend.status === "fulfilled") {
        setRiskTrend(trend.value);
      }
    } catch (err) {
      console.error("Failed to load details for prediction:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const filteredPredictions = predictions.filter((p) => {
    const matchesSearch =
      p.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.industry.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(p.prediction_id).includes(searchQuery);
    const matchesRisk =
      riskFilter === "ALL" || p.risk_level.toUpperCase() === riskFilter.toUpperCase();
    return matchesSearch && matchesRisk;
  });

  return (
    <div className="app-layout">
      <Sidebar active="Prediction history" />

      <main className="main-content space-y-6">
        <PageHeader
          badge="Audit Trail & Lineage"
          title="Historical Predictions"
          description="Complete immutable archive of model executions, version lineage, risk scores, and data quality metrics."
          actions={
            <Button
              variant="outline"
              size="md"
              icon={<RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />}
              onClick={loadHistory}
            >
              Refresh History
            </Button>
          }
        />

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by business name, industry, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#091427] border border-[#16273f] rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="bg-[#091427] border border-[#16273f] text-slate-200 text-xs sm:text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Risk Tiers</option>
              <option value="LOW">Low Risk</option>
              <option value="MEDIUM">Medium Risk</option>
              <option value="HIGH">High Risk</option>
            </select>
          </div>
        </div>

        {/* Prediction Table */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="py-20 flex justify-center">
              <LoadingSpinner text="Loading prediction history archive..." />
            </div>
          ) : filteredPredictions.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<History className="w-8 h-8 text-cyan-400" />}
                title="No Historical Predictions Found"
                description={
                  searchQuery || riskFilter !== "ALL"
                    ? "No predictions matched your current search or filter criteria."
                    : "Complete a credit risk assessment in the wizard to record model predictions in this ledger."
                }
                actionText="Create Assessment"
                actionIcon={<Sparkles className="w-4 h-4" />}
                onAction={() => navigate("/assessment")}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[#16273f] bg-[#091322] text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                    <th className="py-3.5 px-4">Prediction ID</th>
                    <th className="py-3.5 px-4">Business & Industry</th>
                    <th className="py-3.5 px-4">Evaluation Date</th>
                    <th className="py-3.5 px-4">Risk Level</th>
                    <th className="py-3.5 px-4">Default Prob.</th>
                    <th className="py-3.5 px-4">Risk Score</th>
                    <th className="py-3.5 px-4">Data Quality</th>
                    <th className="py-3.5 px-4">Model Version</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#132238] text-slate-300">
                  {filteredPredictions.map((item) => (
                    <tr
                      key={item.prediction_id}
                      className="hover:bg-[#0c1930] transition-colors cursor-pointer"
                      onClick={() => handleOpenDetails(item)}
                    >
                      <td className="py-4 px-4 font-mono font-medium text-cyan-400">
                        #{item.prediction_id}
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-semibold text-white">{item.business_name}</div>
                        <div className="text-[11px] text-slate-400 capitalize">{item.industry}</div>
                      </td>
                      <td className="py-4 px-4 text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            {new Date(item.created_at).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <RiskBadge riskLevel={item.risk_level} size="sm" />
                      </td>
                      <td className="py-4 px-4 font-mono font-semibold text-white">
                        {item.default_probability.toFixed(1)}%
                      </td>
                      <td className="py-4 px-4 font-mono">
                        <span className="font-bold text-white">{Math.round(item.risk_score)}</span>
                        <span className="text-slate-400 text-xs"> / 100</span>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                            item.data_quality_score >= 85
                              ? "bg-emerald-950/40 text-emerald-400 border border-emerald-500/20"
                              : item.data_quality_score >= 65
                              ? "bg-amber-950/40 text-amber-400 border border-amber-500/20"
                              : "bg-rose-950/40 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {Math.round(item.data_quality_score)} / 100
                        </span>
                      </td>
                      <td className="py-4 px-4 font-mono text-xs text-slate-300">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          v{item.model_version}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<ArrowRight className="w-3.5 h-3.5 text-cyan-400" />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetails(item);
                          }}
                        >
                          Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Prediction Detail Modal */}
        {selectedPrediction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#0b172a] border border-[#1e3557] rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#16273f]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-950/50 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <BrainCircuit className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white font-['Space_Grotesk']">
                      Prediction #{selectedPrediction.prediction_id} — {selectedPrediction.business_name}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Assessment #{selectedPrediction.assessment_id} • Evaluated on{" "}
                      {new Date(selectedPrediction.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPrediction(null)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {loadingDetails ? (
                <div className="py-16 flex justify-center">
                  <LoadingSpinner text="Retrieving explainability & risk trajectory..." />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Top Stats Banner */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="p-3.5 bg-[#091322] border border-[#16273f] rounded-xl">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider block mb-1">
                        Risk Tier
                      </span>
                      <RiskBadge riskLevel={selectedPrediction.risk_level} size="md" />
                    </div>
                    <div className="p-3.5 bg-[#091322] border border-[#16273f] rounded-xl">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider block mb-1">
                        Default Prob.
                      </span>
                      <span className="text-xl font-bold font-['Space_Grotesk'] text-white">
                        {selectedPrediction.default_probability.toFixed(1)}%
                      </span>
                    </div>
                    <div className="p-3.5 bg-[#091322] border border-[#16273f] rounded-xl">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider block mb-1">
                        Risk Score
                      </span>
                      <span className="text-xl font-bold font-['Space_Grotesk'] text-cyan-400">
                        {Math.round(selectedPrediction.risk_score)} / 100
                      </span>
                    </div>
                    <div className="p-3.5 bg-[#091322] border border-[#16273f] rounded-xl">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider block mb-1">
                        Data Quality
                      </span>
                      <span className="text-xl font-bold font-['Space_Grotesk'] text-emerald-400">
                        {Math.round(selectedPrediction.data_quality_score)} / 100
                      </span>
                    </div>
                  </div>

                  {/* Risk Trajectory Banner if available */}
                  {riskTrend && (
                    <div className="p-4 rounded-xl bg-[#09152b] border border-[#1a3359] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5 text-cyan-400 shrink-0" />
                        <div>
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                            Multi-Assessment Risk Trajectory
                          </h4>
                          <p className="text-xs text-slate-300 mt-0.5">{riskTrend.description}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                            riskTrend.trend === "IMPROVING"
                              ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30"
                              : riskTrend.trend === "INCREASING_RISK"
                              ? "bg-rose-950/60 text-rose-400 border border-rose-500/30"
                              : "bg-slate-800 text-slate-300 border border-slate-700"
                          }`}
                        >
                          {riskTrend.trend === "IMPROVING" ? (
                            <TrendingDown className="w-3.5 h-3.5" />
                          ) : riskTrend.trend === "INCREASING_RISK" ? (
                            <TrendingUp className="w-3.5 h-3.5" />
                          ) : null}
                          {riskTrend.trend_label}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Deterministic AI Underwriting Summary */}
                  {explanation?.analyst_summary && (
                    <div className="p-4 rounded-xl bg-[#081222] border border-[#16273f] space-y-1.5">
                      <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                        <Sparkles className="w-4 h-4" />
                        <span>Analyst AI Underwriting Summary</span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                        {explanation.analyst_summary}
                      </p>
                    </div>
                  )}

                  {/* Categorized Factors Breakdown */}
                  {explanation?.factor_breakdown && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Categorized Explainability Drivers
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                        {explanation.factor_breakdown.all_factors?.map((f, i) => (
                          <div
                            key={i}
                            className="p-3 bg-[#091322] border border-[#16273f] rounded-xl text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-white">{f.display_name}</span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                  f.impact_direction === "positive"
                                    ? "bg-emerald-950 text-emerald-400"
                                    : "bg-rose-950 text-rose-400"
                                }`}
                              >
                                {f.impact_direction === "positive" ? "Reduces Risk" : "Increases Risk"}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">{f.category}</div>
                            <p className="text-[11px] text-slate-300 leading-tight pt-1">
                              {f.explanation}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Responsible AI Disclaimer */}
                  <div className="p-3.5 rounded-xl bg-[#08101e] border border-[#14233a] text-[11px] text-slate-400 flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span>
                      <b>Decision Support Notice:</b> {explanation?.disclaimer || "This system provides AI-assisted credit risk decision support and does not autonomously approve or reject loans."}
                    </span>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<FileText className="w-4 h-4" />}
                      onClick={() => navigate(`/reports?id=${selectedPrediction.assessment_id}`)}
                    >
                      Open Full Audit Report
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setSelectedPrediction(null)}
                    >
                      Close Window
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
