import React, { useState, useEffect } from "react";
import {
  Scale,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  X,
  Calendar,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { api, AssessmentCompareResult, AssessmentSummary } from "../services/api";
import { RiskBadge } from "./ui/Badge";
import Button from "./ui/Button";

interface AssessmentCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessments: AssessmentSummary[];
  defaultId1?: number;
  defaultId2?: number;
}

export default function AssessmentCompareModal({
  isOpen,
  onClose,
  assessments,
  defaultId1,
  defaultId2,
}: AssessmentCompareModalProps) {
  const [selectedId1, setSelectedId1] = useState<number | "">(defaultId1 || (assessments[0]?.id || ""));
  const [selectedId2, setSelectedId2] = useState<number | "">(
    defaultId2 || (assessments.length > 1 ? assessments[1]?.id : assessments[0]?.id || "")
  );
  const [compareData, setCompareData] = useState<AssessmentCompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (selectedId1 && selectedId2 && selectedId1 !== selectedId2) {
      runComparison(Number(selectedId1), Number(selectedId2));
    }
  }, [selectedId1, selectedId2]);

  const runComparison = async (id1: number, id2: number) => {
    try {
      setLoading(true);
      setError("");
      const result = await api.compareAssessments(id1, id2);
      setCompareData(result);
    } catch (err: any) {
      setError(err?.message || "Failed to compare assessments.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#0b1629] border border-[#203a60] p-6 sm:p-8 shadow-2xl shadow-black/90 z-10 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-[#182d4d] mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-['Space_Grotesk']">
                Compare Assessment Records
              </h3>
              <p className="text-xs text-slate-400">
                Inspect changes in financial indicators, risk categories, and default probability deltas
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selection Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="p-3.5 rounded-xl bg-[#091322] border border-[#16273f]">
            <label className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 block mb-1.5">
              Baseline Assessment (A)
            </label>
            <select
              value={selectedId1}
              onChange={(e) => setSelectedId1(Number(e.target.value))}
              className="w-full bg-[#0d1c33] border border-[#1d3559] text-slate-100 text-xs rounded-lg p-2.5 focus:outline-none"
            >
              {assessments.map((a) => (
                <option key={a.id} value={a.id}>
                  MSME-{a.id}24 • {a.business_name} ({new Date(a.created_at).toLocaleDateString()}) - {a.risk_level} RISK
                </option>
              ))}
            </select>
          </div>

          <div className="p-3.5 rounded-xl bg-[#091322] border border-[#16273f]">
            <label className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 block mb-1.5">
              Target Assessment (B)
            </label>
            <select
              value={selectedId2}
              onChange={(e) => setSelectedId2(Number(e.target.value))}
              className="w-full bg-[#0d1c33] border border-[#1d3559] text-slate-100 text-xs rounded-lg p-2.5 focus:outline-none"
            >
              {assessments.map((a) => (
                <option key={a.id} value={a.id}>
                  MSME-{a.id}24 • {a.business_name} ({new Date(a.created_at).toLocaleDateString()}) - {a.risk_level} RISK
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedId1 === selectedId2 && (
          <div className="p-3 mb-6 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Please select two distinct assessments to compare financial and risk variances.</span>
          </div>
        )}

        {error && (
          <div className="p-3 mb-6 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {compareData && (
          <div className="space-y-6">
            {/* Deltas & Summary Callout */}
            <div className="p-4 rounded-xl bg-[#081122] border border-[#16273f]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#14233a] mb-3">
                <div>
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Risk Probability Shift
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-2xl font-bold text-white font-['Space_Grotesk']">
                      {compareData.deltas.default_probability_delta > 0 ? "+" : ""}
                      {compareData.deltas.default_probability_delta.toFixed(1)}%
                    </span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        compareData.deltas.default_probability_delta <= 0
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {compareData.deltas.default_probability_delta <= 0 ? "Credit Health Improved" : "Risk Increased"}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-400 space-y-1 text-left sm:text-right">
                  <div>Revenue Delta: <b>{compareData.deltas.annual_revenue_delta >= 0 ? `+$${compareData.deltas.annual_revenue_delta.toLocaleString()}` : `-$${Math.abs(compareData.deltas.annual_revenue_delta).toLocaleString()}`}</b></div>
                  <div>Debt Delta: <b>{compareData.deltas.existing_debt_delta >= 0 ? `+$${compareData.deltas.existing_debt_delta.toLocaleString()}` : `-$${Math.abs(compareData.deltas.existing_debt_delta).toLocaleString()}`}</b></div>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                {compareData.comparison_summary.map((s, i) => (
                  <p key={i} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-cyan-400 font-bold">•</span>
                    <span>{s}</span>
                  </p>
                ))}
              </div>
            </div>

            {/* Side by side comparison table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#081222] text-slate-400 uppercase text-[10px] tracking-wider border-b border-[#14233a]">
                  <tr>
                    <th className="p-3">Indicator</th>
                    <th className="p-3">Baseline (MSME-{compareData.assessment_1.id}24)</th>
                    <th className="p-3">Target (MSME-{compareData.assessment_2.id}24)</th>
                    <th className="p-3 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#13233a]">
                  <tr>
                    <td className="p-3 text-slate-300 font-medium">Default Probability</td>
                    <td className="p-3 font-mono text-white font-bold">{compareData.assessment_1.default_probability.toFixed(1)}%</td>
                    <td className="p-3 font-mono text-white font-bold">{compareData.assessment_2.default_probability.toFixed(1)}%</td>
                    <td className="p-3 text-right font-mono font-bold">
                      <span className={compareData.deltas.default_probability_delta <= 0 ? "text-emerald-400" : "text-rose-400"}>
                        {compareData.deltas.default_probability_delta >= 0 ? `+${compareData.deltas.default_probability_delta.toFixed(1)}%` : `${compareData.deltas.default_probability_delta.toFixed(1)}%`}
                      </span>
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3 text-slate-300 font-medium">Risk Category</td>
                    <td className="p-3"><RiskBadge riskLevel={compareData.assessment_1.risk_level} size="sm" /></td>
                    <td className="p-3"><RiskBadge riskLevel={compareData.assessment_2.risk_level} size="sm" /></td>
                    <td className="p-3 text-right text-slate-400">
                      {compareData.deltas.risk_level_changed ? "Changed" : "Unchanged"}
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3 text-slate-300 font-medium">Annual Revenue</td>
                    <td className="p-3 text-white">${compareData.assessment_1.annual_revenue.toLocaleString()}</td>
                    <td className="p-3 text-white">${compareData.assessment_2.annual_revenue.toLocaleString()}</td>
                    <td className="p-3 text-right font-mono text-slate-300">
                      {compareData.deltas.annual_revenue_delta >= 0 ? `+$${compareData.deltas.annual_revenue_delta.toLocaleString()}` : `-$${Math.abs(compareData.deltas.annual_revenue_delta).toLocaleString()}`}
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3 text-slate-300 font-medium">Monthly Cash Flow</td>
                    <td className="p-3 text-white">${compareData.assessment_1.monthly_cash_flow.toLocaleString()}</td>
                    <td className="p-3 text-white">${compareData.assessment_2.monthly_cash_flow.toLocaleString()}</td>
                    <td className="p-3 text-right font-mono text-slate-300">
                      {compareData.deltas.monthly_cash_flow_delta >= 0 ? `+$${compareData.deltas.monthly_cash_flow_delta.toLocaleString()}` : `-$${Math.abs(compareData.deltas.monthly_cash_flow_delta).toLocaleString()}`}
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3 text-slate-300 font-medium">Existing Liabilities</td>
                    <td className="p-3 text-white">${compareData.assessment_1.existing_debt.toLocaleString()}</td>
                    <td className="p-3 text-white">${compareData.assessment_2.existing_debt.toLocaleString()}</td>
                    <td className="p-3 text-right font-mono text-slate-300">
                      {compareData.deltas.existing_debt_delta >= 0 ? `+$${compareData.deltas.existing_debt_delta.toLocaleString()}` : `-$${Math.abs(compareData.deltas.existing_debt_delta).toLocaleString()}`}
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3 text-slate-300 font-medium">Utility Score / 100</td>
                    <td className="p-3 text-white">{compareData.assessment_1.utility_payment_score}</td>
                    <td className="p-3 text-white">{compareData.assessment_2.utility_payment_score}</td>
                    <td className="p-3 text-right font-mono text-slate-300">
                      {(compareData.assessment_2.utility_payment_score - compareData.assessment_1.utility_payment_score) >= 0 ? `+${compareData.assessment_2.utility_payment_score - compareData.assessment_1.utility_payment_score}` : `${compareData.assessment_2.utility_payment_score - compareData.assessment_1.utility_payment_score}`}
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3 text-slate-300 font-medium">Invoice Score / 100</td>
                    <td className="p-3 text-white">{compareData.assessment_1.invoice_payment_score}</td>
                    <td className="p-3 text-white">{compareData.assessment_2.invoice_payment_score}</td>
                    <td className="p-3 text-right font-mono text-slate-300">
                      {(compareData.assessment_2.invoice_payment_score - compareData.assessment_1.invoice_payment_score) >= 0 ? `+${compareData.assessment_2.invoice_payment_score - compareData.assessment_1.invoice_payment_score}` : `${compareData.assessment_2.invoice_payment_score - compareData.assessment_1.invoice_payment_score}`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="pt-6 border-t border-[#182d4d] mt-6 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Comparison
          </Button>
        </div>
      </div>
    </div>
  );
}
