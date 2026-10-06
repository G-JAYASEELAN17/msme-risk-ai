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
} from "lucide-react";
import { auth } from "../services/firebase";
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

  const state = location.state as {
    prediction?: {
      assessment_id: number;
      default_probability: number;
      risk_level: string;
      confidence: number;
      top_factors: string[];
      positive_factors: string[];
      risk_factors: string[];
    };
    inputs?: {
      name: string;
      industry: string;
      age: number;
      employees: number;
      annual_revenue: number;
      monthly_cash_flow: number;
      monthly_expenses: number;
      existing_debt: number;
      digital_transactions?: number;
      utility_payment_score?: number;
      invoice_payment_score?: number;
      previous_defaults?: number;
    };
  } | null;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/login");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

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

  return (
    <div className="app-layout">
      <Sidebar active="Risk results" />

      <main className="main-content space-y-8">
        <PageHeader
          badge={`Assessment MSME-${prediction.assessment_id}24`}
          title={`Risk Evaluation: ${inputs.name}`}
          description={`ML credit risk evaluation completed on ${new Date().toLocaleDateString("en-US", {
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
              initialBaseline={{
                annual_revenue: inputs.annual_revenue,
                monthly_cash_flow: inputs.monthly_cash_flow,
                existing_debt: inputs.existing_debt,
                monthly_expenses: inputs.monthly_expenses,
                age: inputs.age,
                employees: inputs.employees,
                industry: inputs.industry,
                utility_payment_score: inputs.utility_payment_score || 80,
                invoice_payment_score: inputs.invoice_payment_score || 80,
                digital_transactions: inputs.digital_transactions || 500,
                previous_defaults: inputs.previous_defaults || 0,
              }}
            />
          </div>
        )}

        {/* Primary Risk Score Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Risk Dial / Score Card (1 col) */}
          <Card className="flex flex-col justify-between overflow-hidden relative">
            <div
              className={`absolute top-0 inset-x-0 h-1.5 ${
                isLow ? "bg-emerald-500" : isMed ? "bg-amber-500" : "bg-rose-500"
              }`}
            />
            <CardHeader>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Risk Category
                </span>
                <RiskBadge riskLevel={prediction.risk_level} size="md" />
              </div>
            </CardHeader>

            <CardContent className="flex flex-col items-center justify-center text-center py-6">
              <div className="text-xs text-slate-400 font-medium mb-1">
                Estimated Default Probability
              </div>
              <div className="flex items-baseline gap-1 my-2">
                <span className="text-6xl font-extrabold text-white font-['Space_Grotesk'] tracking-tight">
                  {prediction.default_probability.toFixed(1)}
                </span>
                <span className="text-2xl font-bold text-slate-400">%</span>
              </div>

              <div className="mt-4 px-4 py-2 rounded-xl bg-[#091427] border border-[#172c49] text-xs text-slate-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Model Confidence: <b className="text-white">{prediction.confidence}%</b></span>
              </div>
            </CardContent>

            <div className="p-4 bg-[#091322] border-t border-[#16273f] text-center text-xs text-slate-400">
              Health Score: <b className="text-white font-mono">{Math.round(100 - prediction.default_probability)} / 100</b>
            </div>
          </Card>

          {/* Underwriter Guidance & Actions (2 cols) */}
          <Card className="lg:col-span-2 flex flex-col justify-between">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-cyan-400" />
                <div>
                  <CardTitle>Underwriting Recommendation</CardTitle>
                  <CardDescription>
                    Automated credit committee decision guidance
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className={`p-4 rounded-xl border ${guidance.border} ${guidance.bg} mb-6`}>
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

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-2">
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
                  <span className="text-slate-400 block mb-0.5">Monthly Exp.</span>
                  <span className="font-semibold text-white">${inputs.monthly_expenses.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Influencing Decision Factors Ranking */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <BrainCircuit className="w-5 h-5 text-cyan-400" />
                <div>
                  <CardTitle>Top Contributing Decision Factors</CardTitle>
                  <CardDescription>
                    Key features that drove the prediction model’s probability scoring
                  </CardDescription>
                </div>
              </div>
              <span className="text-xs text-slate-400 font-mono">SHAP Signal Ranking</span>
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-4">
              {prediction.top_factors.map((factor, index) => {
                const impactLabels = ["High Impact", "Medium Impact", "Moderate Impact"];
                const widths = ["88%", "62%", "40%"];

                const label = impactLabels[index % 3];
                const width = widths[index % 3];

                return (
                  <div
                    key={factor}
                    className="p-3.5 rounded-xl bg-[#091322] border border-[#16273f] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-md bg-[#13233c] text-cyan-400 text-xs font-bold flex items-center justify-center shrink-0">
                        0{index + 1}
                      </span>
                      <span className="text-xs sm:text-sm font-medium text-slate-100">{factor}</span>
                    </div>

                    <div className="flex items-center gap-3 sm:w-56 shrink-0">
                      <div className="h-2 flex-1 bg-[#15253d] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"
                          style={{ width }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-cyan-400 min-w-[70px] text-right">
                        {label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Positive Indicators vs Risk Signals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Positive Signals */}
          <Card>
            <CardHeader className="border-b border-[#16273f]">
              <div className="flex items-center gap-2 text-emerald-400">
                <TrendingUp className="w-5 h-5" />
                <CardTitle className="text-emerald-400">Positive Credit Signals</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {prediction.positive_factors.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">
                  No significant positive credit signals identified.
                </p>
              ) : (
                <ul className="space-y-3">
                  {prediction.positive_factors.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Risk Factors */}
          <Card>
            <CardHeader className="border-b border-[#16273f]">
              <div className="flex items-center gap-2 text-rose-400">
                <TrendingDown className="w-5 h-5" />
                <CardTitle className="text-rose-400">Risk Signals & Vulnerabilities</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {prediction.risk_factors.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">
                  No critical credit risk flags detected.
                </p>
              ) : (
                <ul className="space-y-3">
                  {prediction.risk_factors.map((r) => (
                    <li key={r} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Regulatory & System Disclaimer */}
        <div className="p-4 rounded-xl bg-[#081120] border border-[#16273f] text-xs text-slate-400 leading-relaxed mb-6">
          <span className="font-bold text-amber-400 uppercase tracking-wider block mb-1">
            System Disclaimer & Regulatory Notice
          </span>
          This assessment is generated by an artificial intelligence decision-support model to estimate MSME loan default probability. It is designed to assist credit officers and risk analysts by highlighting financial patterns and alternative indicators. It does not constitute an automated final lending decision or statutory credit bureau score.
        </div>
      </main>
    </div>
  );
}
