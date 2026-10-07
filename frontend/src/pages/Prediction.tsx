import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  BrainCircuit,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Scale,
  ShieldCheck,
  Info,
  Sliders,
  Activity,
  Layers,
  History,
  FileText,
} from "lucide-react";
import { auth } from "../services/firebase";
import { api, PredictionResponse, PredictionRequest, RiskTrendResult } from "../services/api";
import Sidebar from "../components/Sidebar";
import PageHeader from "../components/PageHeader";
import Button from "../components/ui/Button";
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { RiskBadge } from "../components/ui/Badge";
import EmptyState from "../components/ui/EmptyState";
import WhatIfSimulator from "../components/WhatIfSimulator";

export default function Prediction() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showSimulator, setShowSimulator] = useState(false);
  const [riskTrend, setRiskTrend] = useState<RiskTrendResult | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  const state = location.state as {
    prediction?: PredictionResponse;
    inputs?: PredictionRequest;
  } | null;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/login");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (state?.prediction?.assessment_id) {
      api
        .getPredictionRiskTrend(state.prediction.assessment_id)
        .then((trend) => setRiskTrend(trend))
        .catch((err) => console.log("Trend lookup:", err));
    }
  }, [state?.prediction?.assessment_id]);

  if (!state || !state.prediction || !state.inputs) {
    return (
      <div className="app-layout">
        <Sidebar active="Risk results" />
        <main className="main-content">
          <PageHeader
            badge="Prediction Results"
            title="Risk Evaluation Summary"
            description="No active assessment calculation loaded in session memory."
          />
          <Card className="max-w-xl mx-auto mt-8 p-8">
            <EmptyState
              icon={<BrainCircuit className="w-8 h-8" />}
              title="No Active Prediction Found"
              description="Please submit a loan applicant's details through the guided assessment wizard to generate risk metrics."
              actionText="Go to Assessment Wizard"
              actionIcon={<Sparkles className="w-4 h-4" />}
              onAction={() => navigate("/assessment")}
            />
          </Card>
        </main>
      </div>
    );
  }

  const { prediction, inputs } = state;
  const level = (prediction.risk_level || "MEDIUM").toUpperCase();
  const isLow = level === "LOW";
  const isMed = level === "MEDIUM";

  const riskScore =
    prediction.risk_score !== undefined
      ? Math.round(prediction.risk_score)
      : Math.round(prediction.default_probability * 100);

  const dataQualityScore =
    prediction.data_quality_score !== undefined
      ? Math.round(prediction.data_quality_score)
      : 100;

  const dataQualityTier = prediction.data_quality_tier || (
    dataQualityScore >= 85 ? "High Quality" : dataQualityScore >= 65 ? "Medium Quality" : "Low Quality"
  );

  const modelVersion = prediction.model_version || "1.1.0";

  // Decision guidance text based on risk category
  const guidance = isLow
    ? {
        title: "Recommended for Standard Processing",
        description:
          "This MSME exhibits strong financial health, positive alternative cash-flow signals, and a low likelihood of loan default. Standard due diligence and credit facility approval recommended.",
        color: "text-emerald-400",
        border: "border-emerald-500/30",
        bg: "bg-emerald-950/20",
      }
    : isMed
    ? {
        title: "Conditional Approval / Enhanced Verification",
        description:
          "This business shows moderate credit viability with some risk flags (e.g. debt coverage or invoice punctuality). Consider collateral requirements, tiered disbursements, or secondary financial covenants.",
        color: "text-amber-400",
        border: "border-amber-500/30",
        bg: "bg-amber-950/20",
      }
    : {
        title: "Elevated Risk Flagged / Strict Scrutiny",
        description:
          "High default probability detected due to multiple risk indicators (such as existing liabilities, default history, or compressed cash flow). Requires senior underwriting committee review or credit mitigation.",
        color: "text-rose-400",
        border: "border-rose-500/30",
        bg: "bg-rose-950/20",
      };

  const categories = prediction.factor_breakdown?.categories || {};
  const categoryNames = Object.keys(categories);
  const allFactors = prediction.factor_breakdown?.all_factors || [];

  const displayedFactors =
    selectedCategory === "ALL"
      ? allFactors
      : categories[selectedCategory] || [];

  return (
    <div className="app-layout">
      <Sidebar active="Risk results" />

      <main className="main-content space-y-8">
        <PageHeader
          badge={`Assessment MSME-${prediction.assessment_id}24`}
          title={`Risk Intelligence: ${inputs.name}`}
          description={`ML credit risk evaluation completed with XGBoost v${modelVersion} on ${new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}`}
          actions={
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="outline"
                size="md"
                icon={<Sliders className="w-4 h-4 text-cyan-400" />}
                onClick={() => setShowSimulator(!showSimulator)}
              >
                {showSimulator ? "Hide Simulator" : "What-If Simulator"}
              </Button>
              <Button
                variant="outline"
                size="md"
                icon={<History className="w-4 h-4" />}
                onClick={() => navigate("/prediction-history")}
              >
                Prediction History
              </Button>
              <Button
                variant="outline"
                size="md"
                icon={<FileSpreadsheet className="w-4 h-4" />}
                onClick={() => navigate(`/reports?id=${prediction.assessment_id}`)}
              >
                Full Audit Report
              </Button>
              <Button
                variant="primary"
                size="md"
                icon={<RotateCcw className="w-4 h-4" />}
                onClick={() => navigate("/assessment")}
              >
                New Assessment
              </Button>
            </div>
          }
        />

        {/* Responsible AI Transparency Disclosure */}
        <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/20 text-xs text-slate-300 flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <b className="text-white">AI-Assisted Credit Risk Assessment:</b> This system provides AI-assisted credit
            risk decision support and does not autonomously approve or reject loans. Your AI-generated risk assessment
            is available for analyst review alongside verified business documentation.
          </p>
        </div>

        {/* Counterfactual What-If Simulator Panel */}
        {showSimulator && (
          <div className="animate-fade-in p-6 bg-slate-900/90 border border-cyan-500/30 rounded-3xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-bold text-white font-['Space_Grotesk']">
                  Interactive Counterfactual Simulation ({inputs.name})
                </h3>
              </div>
              <button
                onClick={() => setShowSimulator(false)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
              >
                Close Simulator
              </button>
            </div>
            <WhatIfSimulator
              assessmentId={prediction.assessment_id}
              baselineData={inputs}
            />
          </div>
        )}

        {/* Primary Intelligence Metric Cards (4 Cards Grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Risk Score (0-100) */}
          <Card className="p-5 flex flex-col justify-between relative overflow-hidden">
            <div
              className={`absolute top-0 inset-x-0 h-1.5 ${
                isLow ? "bg-emerald-500" : isMed ? "bg-amber-500" : "bg-rose-500"
              }`}
            />
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider">Normalized Risk Score</span>
              <RiskBadge riskLevel={prediction.risk_level} size="sm" />
            </div>
            <div className="my-3">
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-extrabold text-white font-['Space_Grotesk'] tracking-tight">
                  {riskScore}
                </span>
                <span className="text-xl font-bold text-slate-400">/ 100</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Tier Band: {isLow ? "0–24 (Low)" : isMed ? "25–55 (Medium)" : "56–100 (High)"}
              </div>
            </div>
            <div className="text-[11px] text-slate-400 border-t border-[#16273f] pt-2">
              Standardized credit score index
            </div>
          </Card>

          {/* Card 2: Estimated Default Probability */}
          <Card className="p-5 flex flex-col justify-between">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider">Default Probability</span>
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="my-3">
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-extrabold text-cyan-400 font-['Space_Grotesk'] tracking-tight">
                  {prediction.default_probability.toFixed(1)}
                </span>
                <span className="text-2xl font-bold text-cyan-500">%</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Raw model default likelihood
              </div>
            </div>
            <div className="text-[11px] text-slate-400 border-t border-[#16273f] pt-2">
              Model: <b className="text-white">XGBoost v{modelVersion}</b>
            </div>
          </Card>

          {/* Card 3: Model Confidence Indicator */}
          <Card className="p-5 flex flex-col justify-between">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider">Model Confidence</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="my-3">
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-extrabold text-white font-['Space_Grotesk'] tracking-tight">
                  {prediction.confidence.toFixed(1)}
                </span>
                <span className="text-2xl font-bold text-slate-400">%</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Model confidence indicator
              </div>
            </div>
            <div className="text-[11px] text-slate-400 border-t border-[#16273f] pt-2" title="Indicates boundary margin distance; not calibrated posterior probability">
              Proximity certainty indicator
            </div>
          </Card>

          {/* Card 4: Data Quality Score */}
          <Card className="p-5 flex flex-col justify-between">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider">Data Quality Score</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  dataQualityScore >= 85
                    ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/20"
                    : dataQualityScore >= 65
                    ? "bg-amber-950/60 text-amber-400 border border-amber-500/20"
                    : "bg-rose-950/60 text-rose-400 border border-rose-500/20"
                }`}
              >
                {dataQualityTier}
              </span>
            </div>
            <div className="my-3">
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-extrabold text-emerald-400 font-['Space_Grotesk'] tracking-tight">
                  {dataQualityScore}
                </span>
                <span className="text-xl font-bold text-slate-400">/ 100</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Input source integrity & verification
              </div>
            </div>
            <div className="text-[11px] text-slate-400 border-t border-[#16273f] pt-2">
              Document & financial completeness
            </div>
          </Card>
        </div>

        {/* Multi-Assessment Risk Trend & Underwriting Recommendation */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Underwriting Recommendation (2 cols) */}
          <Card className="lg:col-span-2 flex flex-col justify-between">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-cyan-400" />
                <div>
                  <CardTitle>Underwriting Recommendation</CardTitle>
                  <CardDescription>
                    AI-Assisted Credit Risk Assessment for Analyst Review
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className={`p-4 rounded-xl border ${guidance.border} ${guidance.bg}`}>
                <h4 className={`text-sm font-bold ${guidance.color} mb-1.5 flex items-center gap-2`}>
                  {isLow ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : isMed ? (
                    <Info className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                  )}
                  {guidance.title}
                </h4>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  {guidance.description}
                </p>
              </div>

              {/* Deterministic AI Underwriting Summary */}
              {prediction.analyst_summary && (
                <div className="p-4 rounded-xl bg-[#09152b] border border-[#182f50] space-y-1.5">
                  <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                    <Sparkles className="w-4 h-4" />
                    <span>Deterministic AI Underwriting Summary</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                    {prediction.analyst_summary}
                  </p>
                </div>
              )}

              {/* Core Financial Snapshot */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                <div className="p-3 rounded-lg bg-[#0a1424] border border-[#16273f]">
                  <span className="text-slate-400 block mb-0.5">Industry</span>
                  <span className="font-semibold text-white capitalize truncate block">{inputs.industry}</span>
                </div>
                <div className="p-3 rounded-lg bg-[#0a1424] border border-[#16273f]">
                  <span className="text-slate-400 block mb-0.5">Annual Revenue</span>
                  <span className="font-semibold text-white">${inputs.annual_revenue.toLocaleString()}</span>
                </div>
                <div className="p-3 rounded-lg bg-[#0a1424] border border-[#16273f]">
                  <span className="text-slate-400 block mb-0.5">Existing Debt</span>
                  <span className="font-semibold text-white">${inputs.existing_debt.toLocaleString()}</span>
                </div>
                <div className="p-3 rounded-lg bg-[#0a1424] border border-[#16273f]">
                  <span className="text-slate-400 block mb-0.5">Monthly Cash Flow</span>
                  <span className="font-semibold text-white">${inputs.monthly_cash_flow.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Risk Trend & Model Lineage Card (1 col) */}
          <Card className="flex flex-col justify-between">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                <div>
                  <CardTitle>Historical Risk Trajectory</CardTitle>
                  <CardDescription>Multi-assessment longitudinal analysis</CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {riskTrend ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-[#09152b] border border-[#1a3359] text-center">
                    <span className="text-xs text-slate-400 block mb-1">Observed Trend</span>
                    <div
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                        riskTrend.trend === "IMPROVING"
                          ? "bg-emerald-950/80 text-emerald-400 border border-emerald-500/30"
                          : riskTrend.trend === "INCREASING_RISK"
                          ? "bg-rose-950/80 text-rose-400 border border-rose-500/30"
                          : "bg-slate-800 text-slate-300 border border-slate-700"
                      }`}
                    >
                      {riskTrend.trend === "IMPROVING" ? (
                        <TrendingDown className="w-4 h-4" />
                      ) : riskTrend.trend === "INCREASING_RISK" ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : null}
                      <span>{riskTrend.trend_label}</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-2">{riskTrend.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-[#0a1424] border border-[#16273f] rounded-lg text-center">
                      <span className="text-slate-400 block mb-0.5">Previous Prob.</span>
                      <span className="font-mono font-bold text-white">
                        {riskTrend.previous_probability !== null && riskTrend.previous_probability !== undefined
                          ? `${riskTrend.previous_probability.toFixed(1)}%`
                          : "First Run"}
                      </span>
                    </div>
                    <div className="p-3 bg-[#0a1424] border border-[#16273f] rounded-lg text-center">
                      <span className="text-slate-400 block mb-0.5">Current Prob.</span>
                      <span className="font-mono font-bold text-cyan-400">
                        {riskTrend.current_probability.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-400 bg-[#091322] border border-[#16273f] rounded-xl">
                  First recorded credit assessment for this business. Trend requires multiple historical assessments.
                </div>
              )}

              <div className="p-3 rounded-lg bg-[#081220] border border-[#16273f] text-xs text-slate-400">
                <div className="flex justify-between py-1">
                  <span>Model Engine:</span>
                  <span className="font-mono text-slate-200">XGBoost Classifier</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Model Version:</span>
                  <span className="font-mono text-cyan-400">v{modelVersion}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Explainable AI: 7-Category Factor Breakdown */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <BrainCircuit className="w-5 h-5 text-cyan-400" />
                <div>
                  <CardTitle>Explainable AI — Categorized Factor Breakdown</CardTitle>
                  <CardDescription>
                    SHAP TreeExplainer feature attributions grouped into 7 analytical dimensions
                  </CardDescription>
                </div>
              </div>

              {/* Category Filter Pills */}
              {categoryNames.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setSelectedCategory("ALL")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      selectedCategory === "ALL"
                        ? "bg-cyan-500 text-black font-semibold"
                        : "bg-[#091427] text-slate-300 hover:bg-[#11233e] border border-[#16273f]"
                    }`}
                  >
                    All Dimensions
                  </button>
                  {categoryNames.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        selectedCategory === cat
                          ? "bg-cyan-500 text-black font-semibold"
                          : "bg-[#091427] text-slate-300 hover:bg-[#11233e] border border-[#16273f]"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent>
            {displayedFactors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {displayedFactors.map((f, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl bg-[#091322] border border-[#16273f] flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs sm:text-sm font-semibold text-white">
                          {f.display_name}
                        </div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                          {f.category}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 ${
                          f.impact_direction === "positive"
                            ? "bg-emerald-950/70 text-emerald-400 border border-emerald-500/20"
                            : "bg-rose-950/70 text-rose-400 border border-rose-500/20"
                        }`}
                      >
                        {f.impact_direction === "positive" ? "✓ Reduces Risk" : "⚠ Increases Risk"}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {f.explanation}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-[#132338] pt-1.5 mt-1 font-mono">
                      <span>Value: <b className="text-slate-200">{String(f.value)}</b></span>
                      <span>Impact: <b className="text-cyan-400 capitalize">{f.impact_magnitude}</b></span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {prediction.top_factors.map((factor, index) => (
                  <div
                    key={factor}
                    className="p-3.5 rounded-xl bg-[#091322] border border-[#16273f] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-md bg-[#13233c] text-cyan-400 text-xs font-bold flex items-center justify-center">
                        0{index + 1}
                      </span>
                      <span className="text-xs sm:text-sm font-medium text-slate-100">{factor}</span>
                    </div>
                    <span className="text-xs text-cyan-400 font-semibold">High Impact</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Positive Indicators vs Risk Vulnerabilities */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Positive Signals */}
          <Card>
            <CardHeader className="border-b border-[#16273f]">
              <div className="flex items-center gap-2 text-emerald-400">
                <TrendingUp className="w-5 h-5" />
                <CardTitle className="text-emerald-400">Top Positive Credit Factors</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {prediction.positive_factors.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">
                  No dominant positive credit signals identified.
                </p>
              ) : (
                <ul className="space-y-3">
                  {prediction.positive_factors.map((p, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Top Risk Factors */}
          <Card>
            <CardHeader className="border-b border-[#16273f]">
              <div className="flex items-center gap-2 text-rose-400">
                <TrendingDown className="w-5 h-5" />
                <CardTitle className="text-rose-400">Top Negative Risk Factors</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {prediction.risk_factors.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">
                  No critical credit vulnerabilities flagged.
                </p>
              ) : (
                <ul className="space-y-3">
                  {prediction.risk_factors.map((r, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Regulatory & System Disclaimers */}
        <div className="p-4 rounded-xl bg-[#081120] border border-[#16273f] text-xs text-slate-400 leading-relaxed space-y-2">
          <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-[11px]">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>AI-Assisted Credit Risk Assessment — Decision Support Notice</span>
          </div>
          <p>
            This system provides AI-assisted credit risk decision support and does not autonomously approve or reject loans. All outputs are intended for licensed credit risk analysts and loan underwriting committees. Historical predictions and scenario results are hypothetical estimates that do not guarantee future repayment performance.
          </p>
        </div>
      </main>
    </div>
  );
}
