import React, { useState, useEffect } from "react";
import Header from "../components/Header";
import SEO from "../components/SEO";
import {
  Sparkles,
  Building2,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  Sliders,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  Info,
  Scale
} from "lucide-react";
import Button from "../components/ui/Button";
import { api, DemoSampleData, DemoAssessmentResult, DemoSimulationResult } from "../services/api";
import { useNavigate } from "react-router-dom";

export default function DemoPage() {
  const navigate = useNavigate();
  const [loadingSample, setLoadingSample] = useState(true);
  const [assessing, setAssessing] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Business Form State
  const [businessData, setBusinessData] = useState<DemoSampleData | null>(null);
  const [assessmentResult, setAssessmentResult] = useState<DemoAssessmentResult | null>(null);

  // Simulation Sliders
  const [revenueChange, setRevenueChange] = useState<number>(0);
  const [cashFlowChange, setCashFlowChange] = useState<number>(0);
  const [debtChange, setDebtChange] = useState<number>(0);
  const [simulationResult, setSimulationResult] = useState<DemoSimulationResult | null>(null);

  // Load sample on mount
  useEffect(() => {
    loadSample();
  }, []);

  const loadSample = async () => {
    setLoadingSample(true);
    setError(null);
    try {
      const sample = await api.getDemoSample();
      setBusinessData(sample);
      // Run initial assessment automatically for high-friction-free demo
      const result = await api.assessDemoRisk(sample);
      setAssessmentResult(result);
    } catch (err: any) {
      setError(err?.message || "Failed to load demonstration data.");
    } finally {
      setLoadingSample(false);
    }
  };

  const handleRunAssessment = async () => {
    if (!businessData) return;
    setAssessing(true);
    setError(null);
    try {
      const result = await api.assessDemoRisk(businessData);
      setAssessmentResult(result);
      // Reset simulation when base recomputes
      setSimulationResult(null);
      setRevenueChange(0);
      setCashFlowChange(0);
      setDebtChange(0);
    } catch (err: any) {
      setError(err?.message || "Assessment simulation failed.");
    } finally {
      setAssessing(false);
    }
  };

  const handleRunSimulation = async () => {
    if (!businessData) return;
    setSimulating(true);
    try {
      const sim = await api.simulateDemoScenario({
        business_data: businessData,
        revenue_change_pct: revenueChange,
        cash_flow_change_pct: cashFlowChange,
        debt_change_pct: debtChange
      });
      setSimulationResult(sim);
    } catch (err: any) {
      setError(err?.message || "What-If stress test failed.");
    } finally {
      setSimulating(false);
    }
  };

  const getTierColor = (tier?: string) => {
    switch (tier?.toLowerCase()) {
      case "low":
        return "text-emerald-400 bg-emerald-950/40 border-emerald-800";
      case "medium":
        return "text-amber-400 bg-amber-950/40 border-amber-800";
      case "high":
        return "text-rose-400 bg-rose-950/40 border-rose-800";
      default:
        return "text-cyan-400 bg-cyan-950/40 border-cyan-800";
    }
  };

  return (
    <div className="min-h-screen bg-[#060b14] text-slate-100 flex flex-col selection:bg-cyan-500/20">
      <SEO
        title="Interactive Public Demo | MSME Risk AI"
        description="Experience MSME Risk AI with safe synthetic data. Explore real-time XGBoost default probability, SHAP factor attribution, and What-If scenario simulations."
        canonical="https://msme-risk-ai.vercel.app/demo"
      />
      <Header />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Banner */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800 text-cyan-300 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Interactive Public Sandbox
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            MSME Credit Risk Engine in Action
          </h1>
          <p className="text-slate-300 mt-3 text-sm sm:text-base">
            Test the live XGBoost prediction pipeline, inspect explainable factor attribution, and run stress simulations.
          </p>
        </div>

        {/* DEMO NOTICE CALLOUT */}
        <div className="mb-8 p-4 rounded-xl bg-amber-950/30 border border-amber-600/40 text-amber-200 text-xs sm:text-sm flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-amber-300 uppercase tracking-wide mr-2">
              DEMO DATA ONLY:
            </span>
            All business names and financial figures shown below are synthetic records ("Sri Lakshmi Engineering Works"). No private customer data is used or stored.
          </div>
        </div>

        {error && (
          <div className="mb-8 p-4 rounded-xl bg-rose-950/50 border border-rose-700 text-rose-200 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-400" />
              <span>{error}</span>
            </div>
            <button
              onClick={loadSample}
              className="text-xs font-semibold underline hover:text-white"
            >
              Retry
            </button>
          </div>
        )}

        {loadingSample ? (
          <div className="text-center py-20">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-400">Loading synthetic demonstration profile...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* LEFT COLUMN: Business & Financial Inputs (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="p-6 rounded-2xl bg-[#091426] border border-[#182c47]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-cyan-400" />
                    <h2 className="text-base font-bold text-white">MSME Business Profile</h2>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-950 text-cyan-300 border border-cyan-800">
                    Synthetic
                  </span>
                </div>

                {businessData && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Company Name</label>
                      <input
                        type="text"
                        value={businessData.business_name}
                        disabled
                        className="w-full px-3 py-2 rounded-lg bg-[#060d19] border border-[#1b3252] text-slate-200 text-xs font-semibold cursor-not-allowed"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Sector</label>
                        <input
                          type="text"
                          value={businessData.industry_sector}
                          disabled
                          className="w-full px-3 py-2 rounded-lg bg-[#060d19] border border-[#1b3252] text-slate-200 text-xs cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Years Active</label>
                        <input
                          type="number"
                          value={businessData.years_in_business}
                          onChange={(e) =>
                            setBusinessData({
                              ...businessData,
                              years_in_business: Number(e.target.value)
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-[#060d19] border border-[#1b3252] text-white text-xs focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    <div className="border-t border-[#13233b] pt-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                        Financial Parameters (INR)
                      </h3>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Annual Turnover (₹)</label>
                          <input
                            type="number"
                            value={businessData.annual_revenue}
                            onChange={(e) =>
                              setBusinessData({
                                ...businessData,
                                annual_revenue: Number(e.target.value)
                              })
                            }
                            className="w-full px-3 py-2 rounded-lg bg-[#060d19] border border-[#1b3252] text-white text-xs focus:outline-none focus:border-cyan-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Monthly Cash Flow</label>
                            <input
                              type="number"
                              value={businessData.monthly_cash_flow}
                              onChange={(e) =>
                                setBusinessData({
                                  ...businessData,
                                  monthly_cash_flow: Number(e.target.value)
                                })
                              }
                              className="w-full px-3 py-2 rounded-lg bg-[#060d19] border border-[#1b3252] text-white text-xs focus:outline-none focus:border-cyan-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Existing Debt</label>
                            <input
                              type="number"
                              value={businessData.existing_debt}
                              onChange={(e) =>
                                setBusinessData({
                                  ...businessData,
                                  existing_debt: Number(e.target.value)
                                })
                              }
                              className="w-full px-3 py-2 rounded-lg bg-[#060d19] border border-[#1b3252] text-white text-xs focus:outline-none focus:border-cyan-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Utility Score (0-100)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={businessData.utility_payment_score}
                              onChange={(e) =>
                                setBusinessData({
                                  ...businessData,
                                  utility_payment_score: Number(e.target.value)
                                })
                              }
                              className="w-full px-3 py-2 rounded-lg bg-[#060d19] border border-[#1b3252] text-white text-xs focus:outline-none focus:border-cyan-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Past Defaults</label>
                            <select
                              value={businessData.past_defaults_count}
                              onChange={(e) =>
                                setBusinessData({
                                  ...businessData,
                                  past_defaults_count: Number(e.target.value)
                                })
                              }
                              className="w-full px-3 py-2 rounded-lg bg-[#060d19] border border-[#1b3252] text-white text-xs focus:outline-none focus:border-cyan-500"
                            >
                              <option value={0}>0 Defaults</option>
                              <option value={1}>1 Default</option>
                              <option value={2}>2 Defaults</option>
                              <option value={3}>3+ Defaults</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleRunAssessment}
                      disabled={assessing}
                      className="w-full mt-2"
                    >
                      {assessing ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5 inline" /> Recomputing...
                        </>
                      ) : (
                        "Recompute AI Assessment"
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Security & Isolation Reminder */}
              <div className="p-4 rounded-xl bg-[#091426]/60 border border-[#14233a] text-xs text-slate-400 flex items-start gap-2.5">
                <Scale className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <p>
                  In this public demo, calculations run in ephemeral memory without writing to database storage.
                </p>
              </div>
            </div>

            {/* RIGHT COLUMN: AI Results, SHAP Attribution & What-If Simulation (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {assessmentResult && (
                <>
                  {/* Score & Risk Tier Card */}
                  <div className="p-6 rounded-2xl bg-[#091426] border border-[#182c47]">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                      <div>
                        <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                          AI Credit Risk Assessment
                        </span>
                        <h3 className="text-xl font-extrabold text-white mt-1">
                          {assessmentResult.company_name}
                        </h3>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${getTierColor(
                          assessmentResult.risk_tier
                        )}`}
                      >
                        {assessmentResult.risk_tier} Risk Tier
                      </span>
                    </div>

                    {/* Gauges Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                      <div className="p-4 rounded-xl bg-[#060d19] border border-[#14243b] text-center">
                        <div className="text-xs text-slate-400 mb-1">Risk Score</div>
                        <div className="text-3xl font-black text-cyan-400">
                          {assessmentResult.risk_score}
                          <span className="text-xs text-slate-500 font-normal"> / 100</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">Higher = Greater Risk</div>
                      </div>

                      <div className="p-4 rounded-xl bg-[#060d19] border border-[#14243b] text-center">
                        <div className="text-xs text-slate-400 mb-1">12-Mo Default Prob</div>
                        <div className="text-3xl font-black text-white">
                          {(assessmentResult.default_probability * 100).toFixed(1)}%
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">XGBoost Calibrated</div>
                      </div>

                      <div className="p-4 rounded-xl bg-[#060d19] border border-[#14243b] text-center">
                        <div className="text-xs text-slate-400 mb-1">Model Confidence</div>
                        <div className="text-3xl font-black text-emerald-400">
                          {(assessmentResult.confidence_score * 100).toFixed(0)}%
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">Certainty Metric</div>
                      </div>
                    </div>

                    {/* SHAP Explainability Breakdown */}
                    <div className="border-t border-[#13233b] pt-5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        Explainable Factor Attribution (SHAP)
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Positive factors */}
                        <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-900/40">
                          <div className="text-xs font-bold text-emerald-400 flex items-center gap-1 mb-2">
                            <TrendingDown className="w-3.5 h-3.5" /> Protective Factors (Lower Risk)
                          </div>
                          <ul className="space-y-1.5 text-xs text-slate-300">
                            {assessmentResult.explanation.positive_factors.map((f, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="text-emerald-400 font-bold">•</span>
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Negative factors */}
                        <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-900/40">
                          <div className="text-xs font-bold text-rose-400 flex items-center gap-1 mb-2">
                            <TrendingUp className="w-3.5 h-3.5" /> Risk Drivers (Elevate Risk)
                          </div>
                          <ul className="space-y-1.5 text-xs text-slate-300">
                            {assessmentResult.explanation.negative_factors.map((f, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="text-rose-400 font-bold">•</span>
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Interactive What-If Simulation Sandbox */}
                  <div className="p-6 rounded-2xl bg-[#091426] border border-[#182c47]">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Sliders className="w-5 h-5 text-purple-400" />
                        <h3 className="text-base font-bold text-white">What-If Stress Simulation</h3>
                      </div>
                      <span className="text-[11px] text-slate-400 italic">Hypothetical Test</span>
                    </div>

                    <p className="text-xs text-slate-300 mb-5 leading-relaxed">
                      Simulate market shocks by altering revenue, cash flow, and debt levels to evaluate balance sheet resilience.
                    </p>

                    <div className="space-y-4 mb-5">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-300">Annual Revenue Shock:</span>
                          <span className="font-mono text-cyan-300 font-bold">{revenueChange > 0 ? `+${revenueChange}` : revenueChange}%</span>
                        </div>
                        <input
                          type="range"
                          min="-50"
                          max="50"
                          step="5"
                          value={revenueChange}
                          onChange={(e) => setRevenueChange(Number(e.target.value))}
                          className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-300">Monthly Cash Flow Shock:</span>
                          <span className="font-mono text-cyan-300 font-bold">{cashFlowChange > 0 ? `+${cashFlowChange}` : cashFlowChange}%</span>
                        </div>
                        <input
                          type="range"
                          min="-50"
                          max="50"
                          step="5"
                          value={cashFlowChange}
                          onChange={(e) => setCashFlowChange(Number(e.target.value))}
                          className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-300">Total Debt Obligation Adjustment:</span>
                          <span className="font-mono text-cyan-300 font-bold">{debtChange > 0 ? `+${debtChange}` : debtChange}%</span>
                        </div>
                        <input
                          type="range"
                          min="-50"
                          max="50"
                          step="5"
                          value={debtChange}
                          onChange={(e) => setDebtChange(Number(e.target.value))}
                          className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRunSimulation}
                      disabled={simulating}
                      className="w-full"
                    >
                      {simulating ? "Simulating Scenario..." : "Run Scenario Simulation"}
                    </Button>

                    {simulationResult && (
                      <div className="mt-5 p-4 rounded-xl bg-purple-950/20 border border-purple-800/40">
                        <h5 className="text-xs font-bold text-purple-300 uppercase tracking-wider mb-2">
                          Simulation Impact Result
                        </h5>
                        <div className="grid grid-cols-2 gap-3 text-center">
                          <div className="p-2.5 rounded-lg bg-[#060d19]">
                            <div className="text-[11px] text-slate-400">New Default Prob</div>
                            <div className="text-lg font-bold text-white">
                              {(simulationResult.simulated_default_prob * 100).toFixed(1)}%
                            </div>
                            <div className={`text-[11px] font-mono mt-0.5 ${simulationResult.probability_delta > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                              {simulationResult.probability_delta > 0 ? "+" : ""}
                              {(simulationResult.probability_delta * 100).toFixed(1)}% delta
                            </div>
                          </div>

                          <div className="p-2.5 rounded-lg bg-[#060d19]">
                            <div className="text-[11px] text-slate-400">New Risk Score</div>
                            <div className="text-lg font-bold text-white">
                              {simulationResult.simulated_risk_score}
                            </div>
                            <div className={`text-[11px] font-mono mt-0.5 ${simulationResult.risk_score_delta > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                              {simulationResult.risk_score_delta > 0 ? "+" : ""}
                              {simulationResult.risk_score_delta} pts
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* BOTTOM CALL TO ACTION */}
        <div className="mt-16 p-8 rounded-2xl bg-gradient-to-r from-[#0c1a2e] to-[#0a1526] border border-[#182c47] text-center">
          <h2 className="text-xl font-bold text-white mb-2">Ready to Underwrite Live Applications?</h2>
          <p className="text-sm text-slate-300 max-w-xl mx-auto mb-6">
            Create an institution or borrower account to upload financial statements, verify OCR document extraction, and submit credit assessments for analyst review.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button variant="primary" size="md" onClick={() => navigate("/register")}>
              Create Assessment Account <ArrowRight className="w-4 h-4 ml-1 inline" />
            </Button>
            <Button variant="outline" size="md" onClick={() => navigate("/responsible-ai")}>
              Read Responsible AI Charter
            </Button>
          </div>
        </div>
      </main>

      <footer className="bg-[#040810] border-t border-[#101c2e] py-8 text-center text-xs text-slate-400">
        <p>&copy; {new Date().getFullYear()} MSME Risk AI. Decision-Support Public Sandbox.</p>
      </footer>
    </div>
  );
}
