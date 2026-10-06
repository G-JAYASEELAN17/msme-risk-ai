import React, { useState, useEffect } from "react";
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  BrainCircuit,
  Sliders,
  DollarSign,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { api, PredictionRequest, SimulationResponse } from "../services/api";
import { RiskBadge } from "./ui/Badge";
import Button from "./ui/Button";
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from "./ui/Card";

interface WhatIfSimulatorProps {
  baselineData?: PredictionRequest;
  assessmentId?: number;
}

export default function WhatIfSimulator({ baselineData, assessmentId }: WhatIfSimulatorProps) {
  // Default values from baseline or fallback
  const initRevenue = baselineData?.annual_revenue ?? 2000000;
  const initCashFlow = baselineData?.monthly_cash_flow ?? 120000;
  const initExpenses = baselineData?.monthly_expenses ?? 80000;
  const initDebt = baselineData?.existing_debt ?? 300000;
  const initUtility = baselineData?.utility_payment_score ?? 85;
  const initInvoice = baselineData?.invoice_payment_score ?? 80;
  const initDefaults = baselineData?.previous_defaults ?? 0;

  const [rev, setRev] = useState<number>(initRevenue);
  const [cf, setCf] = useState<number>(initCashFlow);
  const [exp, setExp] = useState<number>(initExpenses);
  const [debt, setDebt] = useState<number>(initDebt);
  const [util, setUtil] = useState<number>(initUtility);
  const [inv, setInv] = useState<number>(initInvoice);
  const [defs, setDefs] = useState<number>(initDefaults);

  const [simulationResult, setSimulationResult] = useState<SimulationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    runSimulation();
  }, [rev, cf, exp, debt, util, inv, defs]);

  const runSimulation = async () => {
    try {
      setLoading(true);
      setError("");

      const payload = {
        assessment_id: assessmentId,
        baseline_data: baselineData || {
          name: "Simulated Business",
          industry: "Manufacturing",
          age: 5,
          employees: 15,
          annual_revenue: initRevenue,
          monthly_cash_flow: initCashFlow,
          monthly_expenses: initExpenses,
          existing_debt: initDebt,
          digital_transactions: 300,
          utility_payment_score: initUtility,
          invoice_payment_score: initInvoice,
          previous_defaults: initDefaults,
        },
        simulated_annual_revenue: rev,
        simulated_monthly_cash_flow: cf,
        simulated_monthly_expenses: exp,
        simulated_existing_debt: debt,
        simulated_utility_score: util,
        simulated_invoice_score: inv,
        simulated_defaults: defs,
      };

      const result = await api.simulateRisk(payload);
      setSimulationResult(result);
    } catch (err: any) {
      setError(err?.message || "Simulation calculation failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setRev(initRevenue);
    setCf(initCashFlow);
    setExp(initExpenses);
    setDebt(initDebt);
    setUtil(initUtility);
    setInv(initInvoice);
    setDefs(initDefaults);
  };

  return (
    <div className="space-y-6">
      {/* Simulation Banner Notice */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <span>
            <b>What-If Risk Sandbox:</b> Adjust hypothetical parameters below to observe credit score and default probability shifts in real-time. Original assessment records remain strictly unchanged.
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          icon={<RotateCcw className="w-3.5 h-3.5" />}
          className="border-amber-500/40 hover:bg-amber-500/20 text-amber-200 shrink-0"
        >
          Reset Sliders
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Parameter Controls (7 cols) */}
        <Card className="lg:col-span-7">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <CardTitle>Hypothetical Scenario Adjustments</CardTitle>
              </div>
              <span className="text-xs text-slate-400 font-mono">Live Recalculation</span>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Annual Revenue */}
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-200 mb-1.5">
                <span>Annual Revenue (USD)</span>
                <span className="font-mono text-cyan-400">${rev.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="100000"
                max="10000000"
                step="50000"
                value={rev}
                onChange={(e) => setRev(Number(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-[#13233b] rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                <span>$100K</span>
                <span>$5M</span>
                <span>$10M</span>
              </div>
            </div>

            {/* Existing Debt */}
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-200 mb-1.5">
                <span>Outstanding Liabilities / Debt</span>
                <span className="font-mono text-rose-400">${debt.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="0"
                max="3000000"
                step="25000"
                value={debt}
                onChange={(e) => setDebt(Number(e.target.value))}
                className="w-full accent-rose-400 h-1.5 bg-[#13233b] rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                <span>$0</span>
                <span>$1.5M</span>
                <span>$3M</span>
              </div>
            </div>

            {/* Monthly Net Cash Flow */}
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-200 mb-1.5">
                <span>Monthly Net Cash Flow</span>
                <span className="font-mono text-emerald-400">${cf.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="-50000"
                max="500000"
                step="10000"
                value={cf}
                onChange={(e) => setCf(Number(e.target.value))}
                className="w-full accent-emerald-400 h-1.5 bg-[#13233b] rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                <span>-$50K</span>
                <span>$250K</span>
                <span>$500K</span>
              </div>
            </div>

            {/* Utility & Invoice Score Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-slate-200 mb-1.5">
                  <span>Utility Score</span>
                  <span className="font-mono text-white">{util}/100</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={util}
                  onChange={(e) => setUtil(Number(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-[#13233b] rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-slate-200 mb-1.5">
                  <span>Invoice Score</span>
                  <span className="font-mono text-white">{inv}/100</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={inv}
                  onChange={(e) => setInv(Number(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-[#13233b] rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Defaults Count */}
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-200 mb-1.5">
                <span>Previous Loan Defaults</span>
                <span className="font-mono text-white">{defs} Event(s)</span>
              </div>
              <div className="flex gap-2">
                {[0, 1, 2, 3, 4, 5].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setDefs(count)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      defs === count
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50"
                        : "bg-[#091424] text-slate-400 border-[#1c2e47] hover:border-slate-600"
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Simulation Outcome (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="flex flex-col justify-between overflow-hidden relative">
            <div className="p-5 border-b border-[#16273f]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Simulated Outcome
                </span>
                {simulationResult && (
                  <RiskBadge riskLevel={simulationResult.simulated.risk_level} size="md" />
                )}
              </div>
            </div>

            <CardContent className="py-6 text-center">
              {simulationResult ? (
                <div>
                  <span className="text-xs text-slate-400 font-medium block mb-1">
                    Simulated Default Probability
                  </span>
                  <div className="flex items-baseline justify-center gap-1 my-2">
                    <span className="text-5xl font-extrabold text-white font-['Space_Grotesk']">
                      {simulationResult.simulated.default_probability.toFixed(1)}
                    </span>
                    <span className="text-2xl font-bold text-slate-400">%</span>
                  </div>

                  <div className="flex items-center justify-center gap-2 mt-4 text-xs">
                    <span className="text-slate-400">Baseline:</span>
                    <span className="font-mono text-slate-200">
                      {simulationResult.baseline.default_probability.toFixed(1)}%
                    </span>
                    <span className="text-slate-500">•</span>
                    <span
                      className={`font-semibold flex items-center gap-0.5 ${
                        simulationResult.probability_delta <= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {simulationResult.probability_delta <= 0 ? (
                        <TrendingDown className="w-3.5 h-3.5" />
                      ) : (
                        <TrendingUp className="w-3.5 h-3.5" />
                      )}
                      {simulationResult.probability_delta > 0 ? "+" : ""}
                      {simulationResult.probability_delta.toFixed(1)}% Shift
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-xs text-slate-400">Running simulation engine...</div>
              )}
            </CardContent>

            {simulationResult && (
              <div className="p-4 bg-[#081222] border-t border-[#16273f] text-xs">
                <span className="font-bold text-slate-300 uppercase text-[10px] tracking-wider block mb-2">
                  Hypothetical Factor Shift
                </span>
                <ul className="space-y-1.5 text-slate-300">
                  {simulationResult.summary_of_changes.slice(0, 3).map((change, i) => (
                    <li key={i} className="flex items-center gap-2 text-[11px]">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
