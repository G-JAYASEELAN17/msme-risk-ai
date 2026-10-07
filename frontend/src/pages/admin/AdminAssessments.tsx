import { useEffect, useState, useCallback, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import AdminHeader from "./AdminHeader";
import {
  FileCheck,
  Search,
  Filter,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
  Eye,
  RefreshCw,
  Building2,
  Calendar,
  Layers,
  Sliders,
  DollarSign,
} from "lucide-react";
import { api, AssessmentSummary } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/ui/EmptyState";
import { useToast } from "../../components/ui/Toast";

export default function AdminAssessments() {
  const toast = useToast();

  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Selected Assessment Inspection
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentSummary | null>(null);

  const loadAssessments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Admin requests all users across the portfolio
      const res = await api.getAssessments({ all_users: true });
      setAssessments(res || []);
    } catch (err: any) {
      console.error("Failed to load assessments:", err);
      setError(err?.message || "Failed to load platform assessments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssessments();
  }, [loadAssessments]);

  const filteredAssessments = useMemo(() => {
    return assessments.filter((a) => {
      // Risk filter
      if (riskFilter !== "all") {
        if ((a.risk_level || "").toLowerCase() !== riskFilter.toLowerCase()) {
          return false;
        }
      }
      // Status filter
      if (statusFilter !== "all") {
        const s = (a.review_status || "pending").toLowerCase();
        if (statusFilter === "completed") {
          if (s !== "approved" && s !== "rejected") return false;
        } else if (s !== statusFilter) {
          return false;
        }
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const bizMatch = (a.business_name || "").toLowerCase().includes(q);
        const idMatch = String(a.id).includes(q);
        const indMatch = (a.industry || "").toLowerCase().includes(q);
        if (!bizMatch && !idMatch && !indMatch) return false;
      }
      return true;
    });
  }, [assessments, riskFilter, statusFilter, searchQuery]);

  return (
    <div className="flex min-h-screen bg-[#030712] text-slate-100">
      <Sidebar active="Assessments" />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title="Assessment Management"
          subtitle="Platform-wide risk scorecards, default probabilities, and underwriting status."
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Assessments" },
          ]}
        />

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Controls Bar: Search & Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b]">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by business name or assessment ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#0d1c33] border border-[#1d3559] text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {/* Risk Filter */}
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[#0d1c33] border border-[#1d3559] text-xs font-semibold text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">All Risk Levels</option>
                <option value="low">Low Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="high">High Risk</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[#0d1c33] border border-[#1d3559] text-xs font-semibold text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">All Review Statuses</option>
                <option value="pending">Pending</option>
                <option value="in_review">In Review</option>
                <option value="needs_info">Needs Information</option>
                <option value="completed">Completed (Approved/Rejected)</option>
              </select>

              <button
                onClick={loadAssessments}
                className="p-2 rounded-xl bg-[#0d1c33] border border-[#1d3559] text-slate-300 hover:text-white hover:bg-slate-800 transition shrink-0"
                title="Refresh assessments"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Table or States */}
          {loading ? (
            <div className="py-20 flex justify-center">
              <LoadingSpinner text="Retrieving platform assessment records..." />
            </div>
          ) : error ? (
            <EmptyState
              title="Failed to load assessments"
              description={error}
              actionLabel="Retry"
              onAction={loadAssessments}
            />
          ) : filteredAssessments.length === 0 ? (
            <EmptyState
              title="No assessments match the selected filters"
              description="Try adjusting your search query, risk tier, or status parameters."
              actionLabel="Clear Filters"
              onAction={() => {
                setSearchQuery("");
                setRiskFilter("all");
                setStatusFilter("all");
              }}
            />
          ) : (
            <div className="rounded-2xl bg-[#081120] border border-[#1a2d4b] overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-[#0c182b] text-[11px] uppercase tracking-wider text-slate-400 border-b border-[#1a2d4b]">
                    <tr>
                      <th className="py-3 px-4">ID</th>
                      <th className="py-3 px-4">Business</th>
                      <th className="py-3 px-4">Risk Tier</th>
                      <th className="py-3 px-4">Default Probability</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Reviewer</th>
                      <th className="py-3 px-4">Created Date</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#162742]">
                    {filteredAssessments.map((a) => {
                      const prob =
                        a.default_probability !== undefined && a.default_probability !== null
                          ? Math.round(a.default_probability * 100)
                          : null;
                      const riskTier = (a.risk_level || "Medium").toLowerCase();

                      return (
                        <tr
                          key={a.id}
                          className="hover:bg-slate-800/25 transition cursor-pointer"
                          onClick={() => setSelectedAssessment(a)}
                        >
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-400">
                            #{a.id}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-white truncate max-w-xs hover:text-cyan-300 transition">
                              {a.business_name || `MSME Account #${a.id}`}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {a.industry || "General Industry"}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${
                                riskTier === "low"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                  : riskTier === "high"
                                  ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  riskTier === "low"
                                    ? "bg-emerald-400"
                                    : riskTier === "high"
                                    ? "bg-rose-400"
                                    : "bg-amber-400"
                                }`}
                              />
                              {a.risk_level || "Medium"}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            {prob !== null ? (
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-2 rounded-full bg-slate-800 overflow-hidden">
                                  <div
                                    style={{ width: `${Math.min(prob, 100)}%` }}
                                    className={`h-full ${
                                      prob > 50
                                        ? "bg-rose-500"
                                        : prob > 20
                                        ? "bg-amber-500"
                                        : "bg-emerald-500"
                                    }`}
                                  />
                                </div>
                                <span className="font-semibold text-white text-xs">{prob}%</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`text-xs capitalize font-medium ${
                                a.review_status === "approved"
                                  ? "text-emerald-400"
                                  : a.review_status === "rejected"
                                  ? "text-rose-400"
                                  : a.review_status === "needs_info"
                                  ? "text-blue-400"
                                  : "text-amber-400"
                              }`}
                            >
                              {a.review_status?.replace("_", " ") || "Pending"}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-xs text-slate-400 truncate max-w-[120px]">
                            {a.reviewed_by ? a.reviewed_by.split("@")[0] : "—"}
                          </td>

                          <td className="py-3.5 px-4 text-xs text-slate-400">
                            {a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAssessment(a);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#0d1c33] text-cyan-300 hover:text-white hover:bg-cyan-600/30 border border-[#1d3559] transition"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Inspect</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="p-3.5 bg-[#0c182b] border-t border-[#1a2d4b] text-xs text-slate-400 flex items-center justify-between">
                <span>Showing {filteredAssessments.length} of {assessments.length} assessments</span>
                <span className="text-slate-400">Click any scorecard to inspect underlying underwriting figures</span>
              </div>
            </div>
          )}

          {/* Assessment Inspection Modal */}
          {selectedAssessment && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
              <div className="relative w-full max-w-2xl bg-[#081120] border border-[#1e3458] rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between pb-4 border-b border-[#1a2d4b]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold text-sm">
                      <FileCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">
                        Assessment #{selectedAssessment.id}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {selectedAssessment.business_name} • Underwriting Inspection
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedAssessment(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mt-5 space-y-5">
                  {/* Risk Overview Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-[#0c182b] border border-[#1a2d4b] text-xs">
                    <div>
                      <span className="text-slate-400 block mb-0.5">Risk Tier</span>
                      <strong className="text-white text-sm capitalize">
                        {selectedAssessment.risk_level || "Medium"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Default Probability</span>
                      <strong className="text-cyan-400 text-sm">
                        {selectedAssessment.default_probability !== undefined && selectedAssessment.default_probability !== null
                          ? `${Math.round(selectedAssessment.default_probability * 100)}%`
                          : "—"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Review Status</span>
                      <strong className="text-amber-400 text-sm capitalize">
                        {selectedAssessment.review_status?.replace("_", " ") || "Pending"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Model Confidence</span>
                      <strong className="text-emerald-400 text-sm">
                        {selectedAssessment.confidence !== undefined && selectedAssessment.confidence !== null
                          ? `${Math.round(selectedAssessment.confidence * 100)}%`
                          : "High"}
                      </strong>
                    </div>
                  </div>

                  {/* Financial Metrics */}
                  <div className="p-4 rounded-xl bg-[#0d1c33] border border-[#1a2d4b] space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Application Financials
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block">Annual Revenue:</span>
                        <strong className="text-white text-sm">
                          ₹{selectedAssessment.annual_revenue?.toLocaleString() || "—"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Industry Sector:</span>
                        <strong className="text-white text-sm">
                          {selectedAssessment.industry || "General"}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Review Notes */}
                  {selectedAssessment.review_notes && (
                    <div className="p-4 rounded-xl bg-[#0c182b] border border-[#1a2d4b] text-xs space-y-1">
                      <span className="text-slate-400 block font-semibold">Analyst Review Notes:</span>
                      <p className="text-slate-200 leading-relaxed">
                        {selectedAssessment.review_notes}
                      </p>
                      {selectedAssessment.reviewed_by && (
                        <div className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800">
                          Reviewed by: <span className="text-cyan-400">{selectedAssessment.reviewed_by}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-[#1a2d4b] flex justify-end">
                  <button
                    onClick={() => setSelectedAssessment(null)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 transition"
                  >
                    Close Scorecard
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
