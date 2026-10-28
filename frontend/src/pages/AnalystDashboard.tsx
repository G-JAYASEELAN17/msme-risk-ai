import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ClipboardCheck,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  ShieldAlert,
  ArrowRight,
  Calendar,
  Building2,
  ChevronLeft,
  ChevronRight,
  Eye,
  SlidersHorizontal,
  X,
  User,
  BrainCircuit,
  FileText,
} from "lucide-react";
import { api, AnalystDashboardStats, AssessmentSummary } from "../services/api";
import Sidebar from "../components/Sidebar";
import AnalystHeader from "./analyst/AnalystHeader";
import EmptyState from "../components/ui/EmptyState";
import { RiskBadge } from "../components/ui/Badge";
import { Skeleton, TableSkeleton, KpiCardSkeleton } from "../components/ui/Skeleton";
import { useQuery } from "@tanstack/react-query";

interface AnalystDashboardProps {
  initialTab?: "overview" | "queue";
}

export default function AnalystDashboard({ initialTab }: AnalystDashboardProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Active view tab (Overview or Review Queue)
  const isQueueOnly =
    initialTab === "queue" ||
    location.pathname === "/analyst/reviews" ||
    location.search.includes("tab=queue");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [reviewStatusFilter, setReviewStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [page, setPage] = useState(1);

  // TanStack Query: Analyst portfolio stats (30s fresh window)
  const {
    data: stats = null,
    isLoading: statsLoading,
    refetch: fetchStats,
  } = useQuery<AnalystDashboardStats>({
    queryKey: ["analyst-dashboard-stats"],
    queryFn: () => api.getAnalystDashboardStats(),
    staleTime: 30 * 1000,
  });

  // Compute date_from based on dateFilter
  const computeDateFrom = useCallback(() => {
    if (dateFilter === "today") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }
    if (dateFilter === "7d") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d.toISOString();
    }
    if (dateFilter === "30d") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString();
    }
    return undefined;
  }, [dateFilter]);

  // Map sort option to backend params
  const computeSortParams = useCallback(() => {
    switch (sortBy) {
      case "oldest":
        return { sort_by: "created_at", sort_order: "asc" };
      case "highest_risk":
      case "highest_default":
        return { sort_by: "default_probability", sort_order: "desc" };
      case "lowest_risk":
        return { sort_by: "default_probability", sort_order: "asc" };
      case "newest":
      default:
        return { sort_by: "created_at", sort_order: "desc" };
    }
  }, [sortBy]);

  const sortParams = computeSortParams();
  const dateFromIso = computeDateFrom();

  // TanStack Query: Paginated review queue
  const {
    data: queueData,
    isLoading: loading,
    error: queryError,
    refetch: fetchAssessments,
  } = useQuery({
    queryKey: [
      "analyst-assessments",
      searchQuery,
      riskFilter,
      reviewStatusFilter,
      dateFromIso,
      sortParams.sort_by,
      sortParams.sort_order,
      page,
    ],
    queryFn: () =>
      api.getAssessmentsPaginated({
        q: searchQuery.trim() || undefined,
        risk_level: riskFilter !== "ALL" ? riskFilter : undefined,
        review_status: reviewStatusFilter !== "ALL" ? reviewStatusFilter : undefined,
        date_from: dateFromIso,
        sort_by: sortParams.sort_by,
        sort_order: sortParams.sort_order,
        page,
        limit: 15,
        all_users: true,
      }),
    staleTime: 30 * 1000,
  });

  const assessments = queueData?.items || [];
  const totalPages = queueData?.total_pages || 1;
  const totalCount = queueData?.total || 0;
  const error = queryError ? (queryError as Error).message : "";

  const handleResetFilters = () => {
    setSearchQuery("");
    setRiskFilter("ALL");
    setReviewStatusFilter("ALL");
    setPriorityFilter("ALL");
    setDateFilter("all");
    setSortBy("newest");
    setPage(1);
  };

  // Helper to determine review priority
  const getPriority = (a: AssessmentSummary) => {
    const risk = (a.risk_level || "").toLowerCase();
    const status = (a.review_status || "pending").toLowerCase();
    if (risk === "high" || status === "needs_info") {
      return { level: "HIGH", label: "High Priority", color: "rose" };
    }
    if (risk === "medium" || status === "in_review") {
      return { level: "NORMAL", label: "Normal Priority", color: "amber" };
    }
    return { level: "LOW", label: "Standard Review", color: "emerald" };
  };

  // Filter by priority if set
  const filteredAssessments = useMemo(() => {
    if (priorityFilter === "ALL") return assessments;
    return assessments.filter((a) => {
      const p = getPriority(a);
      return p.level === priorityFilter;
    });
  }, [assessments, priorityFilter]);

  // Calculated portfolio risk percentages
  const lowRiskCount = stats?.low_risk_assessments ?? 0;
  const medRiskCount = stats?.medium_risk_assessments ?? 0;
  const highRiskCount = stats?.high_risk_assessments ?? 0;
  const totalRiskCount = lowRiskCount + medRiskCount + highRiskCount || 1;
  const lowPct = Math.round((lowRiskCount / totalRiskCount) * 100);
  const medPct = Math.round((medRiskCount / totalRiskCount) * 100);
  const highPct = Math.round((highRiskCount / totalRiskCount) * 100);

  return (
    <div className="flex min-h-screen bg-[#0C0A1D] text-slate-100">
      <Sidebar active={isQueueOnly ? "Review Queue" : "Analyst"} />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AnalystHeader
          title={isQueueOnly ? "Assessment Review Queue" : "Analyst Dashboard"}
          subtitle="Review MSME applications and make evidence-based credit risk decisions."
          breadcrumbs={
            isQueueOnly
              ? [{ label: "Analyst", href: "/analyst" }, { label: "Review Queue" }]
              : [{ label: "Analyst" }, { label: "Dashboard" }]
          }
        />

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Section 28: Responsible AI Notice */}
          <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-indigo-300">
              <BrainCircuit className="w-4 h-4 text-[#A78BFA] shrink-0" />
              <span>
                <strong>AI-Assisted Credit Risk Assessment:</strong> Provides decision support telemetry; does not autonomously approve or reject credit. Final credit underwriting decisions remain human-in-the-loop.
              </span>
            </div>
            <button
              onClick={() => {
                fetchStats();
                fetchAssessments();
              }}
              className="p-1.5 rounded-lg bg-[#1C1933] border border-[#383154] text-slate-300 hover:text-white transition self-end sm:self-auto shrink-0"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Section 3: TOP KPI CARDS (8 real backend metrics) */}
          <section aria-labelledby="analyst-kpis">
            <div className="flex items-center justify-between mb-3">
              <h2 id="analyst-kpis" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Underwriting Pipeline Metrics
              </h2>
              <span className="text-xs text-slate-400">Authoritative database counts</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {/* Total Assessments */}
              <div className="p-3.5 rounded-2xl bg-[#0C0A1D] border border-[#383154] flex flex-col justify-between">
                <span className="text-[11px] font-semibold text-slate-400">Total Assessments</span>
                <div className="mt-2 text-xl font-bold text-white">
                  {statsLoading ? "..." : (stats?.total_assessments ?? 0)}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5">Platform volume</span>
              </div>

              {/* Pending Reviews */}
              <div
                onClick={() => {
                  setReviewStatusFilter("pending");
                  setPage(1);
                }}
                className="p-3.5 rounded-2xl bg-[#0C0A1D] border border-amber-500/30 hover:border-amber-400 cursor-pointer transition flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-amber-300">Pending Reviews</span>
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="mt-2 text-xl font-bold text-amber-400">
                  {statsLoading ? "..." : (stats?.pending_reviews ?? 0)}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5">Awaiting action</span>
              </div>

              {/* In Review */}
              <div
                onClick={() => {
                  setReviewStatusFilter("in_review");
                  setPage(1);
                }}
                className="p-3.5 rounded-2xl bg-[#0C0A1D] border border-blue-500/30 hover:border-blue-400 cursor-pointer transition flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-blue-300">In Review</span>
                  <Eye className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div className="mt-2 text-xl font-bold text-blue-400">
                  {statsLoading ? "..." : (stats?.in_review_assessments ?? 0)}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5">Under evaluation</span>
              </div>

              {/* Completed Reviews */}
              <div
                onClick={() => {
                  setReviewStatusFilter("approved");
                  setPage(1);
                }}
                className="p-3.5 rounded-2xl bg-[#0C0A1D] border border-emerald-500/30 hover:border-emerald-400 cursor-pointer transition flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-emerald-300">Completed</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="mt-2 text-xl font-bold text-emerald-400">
                  {statsLoading ? "..." : (stats?.completed_reviews ?? 0)}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5">Decisions rendered</span>
              </div>

              {/* Low Risk */}
              <div
                onClick={() => {
                  setRiskFilter("LOW");
                  setPage(1);
                }}
                className="p-3.5 rounded-2xl bg-[#0C0A1D] border border-[#383154] hover:border-emerald-500/40 cursor-pointer transition flex flex-col justify-between"
              >
                <span className="text-[11px] font-semibold text-slate-400">Low Risk</span>
                <div className="mt-2 text-xl font-bold text-emerald-400">
                  {statsLoading ? "..." : (stats?.low_risk_assessments ?? 0)}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5">{lowPct}% of portfolio</span>
              </div>

              {/* Medium Risk */}
              <div
                onClick={() => {
                  setRiskFilter("MEDIUM");
                  setPage(1);
                }}
                className="p-3.5 rounded-2xl bg-[#0C0A1D] border border-[#383154] hover:border-amber-500/40 cursor-pointer transition flex flex-col justify-between"
              >
                <span className="text-[11px] font-semibold text-slate-400">Medium Risk</span>
                <div className="mt-2 text-xl font-bold text-amber-400">
                  {statsLoading ? "..." : (stats?.medium_risk_assessments ?? 0)}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5">{medPct}% of portfolio</span>
              </div>

              {/* High Risk */}
              <div
                onClick={() => {
                  setRiskFilter("HIGH");
                  setPage(1);
                }}
                className="p-3.5 rounded-2xl bg-[#0C0A1D] border border-[#383154] hover:border-rose-500/40 cursor-pointer transition flex flex-col justify-between"
              >
                <span className="text-[11px] font-semibold text-slate-400">High Risk</span>
                <div className="mt-2 text-xl font-bold text-rose-400">
                  {statsLoading ? "..." : (stats?.high_risk_assessments ?? 0)}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5">{highPct}% of portfolio</span>
              </div>

              {/* Needs Information */}
              <div
                onClick={() => {
                  setReviewStatusFilter("needs_info");
                  setPage(1);
                }}
                className="p-3.5 rounded-2xl bg-[#0C0A1D] border border-[#8B5CF6]/30 hover:border-[#8B5CF6] cursor-pointer transition flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#C4B5FD]">Needs Info</span>
                  <FileText className="w-3.5 h-3.5 text-[#A78BFA]" />
                </div>
                <div className="mt-2 text-xl font-bold text-[#A78BFA]">
                  {statsLoading ? "..." : (stats?.needs_info_assessments ?? 0)}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5">Docs requested</span>
              </div>
            </div>
          </section>

          {/* Section 4 & 5: ASSESSMENT REVIEW QUEUE TOOLBAR & FILTERS */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0C0A1D] border border-[#383154] space-y-4 shadow-md">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-indigo-400" />
                  Assessment Review Queue
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Applications requiring underwriter evaluation, verification, and credit decisioning
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetFilters}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#1C1933] border border-[#383154] text-slate-300 hover:text-white transition"
                >
                  Reset Filters
                </button>
              </div>
            </div>

            {/* Filter Controls Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-2 border-t border-[#383154]/60">
              {/* Search */}
              <div className="relative lg:col-span-2">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by business, ID, applicant..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 bg-[#1C1933] border border-[#383154] rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#8B5CF6]"
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

              {/* Risk Filter */}
              <div>
                <select
                  value={riskFilter}
                  onChange={(e) => {
                    setRiskFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 bg-[#1C1933] border border-[#383154] rounded-xl text-xs font-semibold text-slate-200 focus:outline-none focus:border-[#8B5CF6]"
                >
                  <option value="ALL">All Risk Tiers</option>
                  <option value="LOW">Low Risk</option>
                  <option value="MEDIUM">Medium Risk</option>
                  <option value="HIGH">High Risk</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={reviewStatusFilter}
                  onChange={(e) => {
                    setReviewStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 bg-[#1C1933] border border-[#383154] rounded-xl text-xs font-semibold text-slate-200 focus:outline-none focus:border-[#8B5CF6]"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="in_review">In Review</option>
                  <option value="needs_info">Needs Information</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {/* Priority Filter (Section 6) */}
              <div>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#1C1933] border border-[#383154] rounded-lg text-xs font-medium text-slate-200 focus:outline-none focus:border-[#8B5CF6] font-mono-numeric"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="HIGH">High Priority</option>
                  <option value="NORMAL">Normal Priority</option>
                  <option value="LOW">Low Priority</option>
                </select>
              </div>

              {/* Date & Sort Filter */}
              <div>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-1.5 bg-[#1C1933] border border-[#383154] rounded-lg text-xs font-medium text-slate-200 focus:outline-none focus:border-[#8B5CF6] font-mono-numeric"
                >
                  <option value="newest">Sort: Newest First</option>
                  <option value="oldest">Sort: Oldest First</option>
                  <option value="highest_risk">Sort: Highest Risk</option>
                  <option value="lowest_risk">Sort: Lowest Risk</option>
                  <option value="highest_default">Sort: Highest Default %</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: REVIEW QUEUE TABLE */}
          <div className="rounded-xl bg-[#1C1933] border border-[#383154] overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
            {loading ? (
              <TableSkeleton rows={8} columns={8} />
            ) : error ? (
              <EmptyState
                title="Unable to load review queue"
                description={error}
                actionLabel="Retry Queue"
                onAction={() => { void fetchAssessments(); }}
              />
            ) : filteredAssessments.length === 0 ? (
              <EmptyState
                title="Queue is currently clear"
                description="No MSME applications currently match your queue filters."
                actionLabel="Clear Filters"
                onAction={handleResetFilters}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-[#1C1933] text-[10px] uppercase tracking-wider text-slate-400 border-b border-[#383154] font-mono-numeric">
                    <tr>
                      <th className="py-2.5 px-3.5">Commercial Entity</th>
                      <th className="py-2.5 px-3.5">Priority</th>
                      <th className="py-2.5 px-3.5">Risk Level</th>
                      <th className="py-2.5 px-3.5">Score</th>
                      <th className="py-2.5 px-3.5">Default Prob</th>
                      <th className="py-2.5 px-3.5">Data Quality</th>
                      <th className="py-2.5 px-3.5">Workflow Status</th>
                      <th className="py-2.5 px-3.5">Submitted</th>
                      <th className="py-2.5 px-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#383154]/80">
                    {filteredAssessments.map((a) => {
                      const priority = getPriority(a);
                      const riskScore = Math.max(0, Math.round(100 - a.default_probability));
                      const riskLower = (a.risk_level || "Medium").toLowerCase();

                      return (
                        <tr
                          key={a.id}
                          className="hover:bg-[#252141] transition-colors cursor-pointer"
                          onClick={() => navigate(`/analyst/review/${a.id}`)}
                        >
                          {/* Business */}
                          <td className="py-3 px-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-md bg-[#252141] border border-[#383154] text-[#A78BFA] flex items-center justify-center font-medium text-xs font-mono-numeric shrink-0">
                                {(a.business_name || "B").slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-white truncate max-w-[200px] hover:text-[#C4B5FD] transition">
                                  {a.business_name || `MSME Application #${a.id}`}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate font-mono-numeric">
                                  Ref #{a.id} • {a.industry || "General Industry"}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Priority */}
                          <td className="py-3 px-3.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono-numeric font-medium border uppercase ${
                                priority.color === "rose"
                                  ? "bg-rose-500/10 text-rose-400 border-rose-500/25"
                                  : priority.color === "amber"
                                  ? "bg-amber-500/10 text-amber-400 border-amber-500/25"
                                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  priority.color === "rose"
                                    ? "bg-rose-400"
                                    : priority.color === "amber"
                                    ? "bg-amber-400"
                                    : "bg-emerald-400"
                                }`}
                              />
                              {priority.label}
                            </span>
                          </td>

                          {/* Risk Level */}
                          <td className="py-3 px-3.5">
                            <RiskBadge level={a.risk_level} size="sm" />
                          </td>

                          {/* Score */}
                          <td className="py-3 px-3.5 font-mono-numeric font-semibold text-white tabular-nums">
                            {riskScore}
                            <span className="text-[10px] text-slate-400 font-normal">/100</span>
                          </td>

                          {/* Default Prob */}
                          <td className="py-3 px-3.5 font-mono-numeric text-slate-300 tabular-nums">
                            {a.default_probability.toFixed(1)}%
                          </td>

                          {/* Data Quality */}
                          <td className="py-3 px-3.5">
                            <span className="text-[11px] font-mono-numeric text-slate-300">
                              {a.data_quality_tier || "Standard"}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono-numeric font-medium uppercase ${
                                a.review_status === "approved"
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                                  : a.review_status === "in_review"
                                  ? "bg-blue-500/10 text-blue-300 border border-blue-500/25"
                                  : a.review_status === "needs_info"
                                  ? "bg-amber-500/10 text-amber-300 border border-amber-500/25"
                                  : a.review_status === "rejected"
                                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/25"
                                  : "bg-slate-800/40 text-slate-400 border border-slate-700/50"
                              }`}
                            >
                              {a.review_status === "approved"
                                ? "Approved"
                                : a.review_status === "in_review"
                                ? "In Review"
                                : a.review_status === "needs_info"
                                ? "Needs Info"
                                : a.review_status === "rejected"
                                ? "Rejected"
                                : "Pending"}
                            </span>
                          </td>

                          {/* Submitted */}
                          <td className="py-3 px-3.5 text-slate-400 font-mono-numeric text-[11px]">
                            {new Date(a.created_at).toLocaleDateString()}
                          </td>

                          {/* Action */}
                          <td className="py-3 px-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => navigate(`/analyst/review/${a.id}`)}
                              className="px-2.5 py-1 rounded bg-[#1C1933] hover:bg-[#252141] text-[#C4B5FD] border border-[#383154] hover:border-[#383154] text-[11px] font-mono-numeric inline-flex items-center gap-1 transition-colors"
                            >
                              <span>Dossier</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#383154] bg-[#1C1933] text-xs text-slate-400 font-mono-numeric tabular-nums">
                <span>
                  Showing {filteredAssessments.length} of {totalCount} queue applications (Page {page} of {totalPages})
                </span>

                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg bg-[#252141] border border-[#383154] text-slate-300 hover:text-white disabled:opacity-40 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg bg-[#252141] border border-[#383154] text-slate-300 hover:text-white disabled:opacity-40 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section 29: Bottom Quick Intelligence & Portfolio Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-[#0C0A1D] border border-[#383154] space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Portfolio Risk Exposure
              </h4>
              <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-800">
                <div style={{ width: `${lowPct}%` }} className="bg-emerald-500" title={`Low: ${lowPct}%`} />
                <div style={{ width: `${medPct}%` }} className="bg-amber-500" title={`Medium: ${medPct}%`} />
                <div style={{ width: `${highPct}%` }} className="bg-rose-500" title={`High: ${highPct}%`} />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Low ({lowPct}%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Medium ({medPct}%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  High ({highPct}%)
                </span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#0C0A1D] border border-[#383154] flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Underwriter Actions Shortcut
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Have an urgent borrower scenario? Use the interactive What-If scenario sandbox to stress-test financial ratios.
                </p>
              </div>
              <div className="pt-3 flex gap-2">
                <button
                  onClick={() => navigate("/prediction?simulator=open")}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#1C1933] text-[#C4B5FD] border border-[#383154] hover:bg-[#8B5CF6]/10 transition"
                >
                  Open Scenario Simulator →
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
