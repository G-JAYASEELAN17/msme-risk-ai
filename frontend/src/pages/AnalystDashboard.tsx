import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardCheck,
  Search,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
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
} from "lucide-react";
import { api, AnalystDashboardStats, AssessmentSummary } from "../services/api";
import Sidebar from "../components/Sidebar";
import StatCard from "../components/StatCard";
import Button from "../components/ui/Button";
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { RiskBadge, StatusBadge } from "../components/ui/Badge";
import EmptyState from "../components/ui/EmptyState";
import ErrorMessage from "../components/ErrorMessage";
import { Skeleton } from "../components/ui/Skeleton";

export default function AnalystDashboard() {
  const navigate = useNavigate();

  // Metrics
  const [stats, setStats] = useState<AnalystDashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Table & Filters
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [reviewStatusFilter, setReviewStatusFilter] = useState("ALL");
  const [businessNameFilter, setBusinessNameFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Fetch summary stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const data = await api.getAnalystDashboardStats();
      setStats(data);
    } catch (err: any) {
      console.error("Failed to load analyst stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch paginated assessments with filters
  const fetchAssessments = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const res = await api.getAssessmentsPaginated({
        q: searchQuery.trim() || undefined,
        risk_level: riskFilter !== "ALL" ? riskFilter : undefined,
        review_status: reviewStatusFilter !== "ALL" ? reviewStatusFilter : undefined,
        business_name: businessNameFilter.trim() || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page,
        limit: 15,
        all_users: true, // Analyst views all businesses
      });

      setAssessments(res.items || []);
      setTotalPages(res.total_pages || 1);
      setTotalCount(res.total || 0);
    } catch (err: any) {
      console.error("Failed to load analyst review queue:", err);
      setError(err.message || "Failed to load assessments. Please verify analyst authorization.");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, riskFilter, reviewStatusFilter, businessNameFilter, dateFrom, dateTo, page]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setRiskFilter("ALL");
    setReviewStatusFilter("ALL");
    setBusinessNameFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  return (
    <div className="flex min-h-screen bg-[#030712] text-slate-100">
      <Sidebar active="Reports" />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto overflow-y-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center gap-1.5">
                <ClipboardCheck className="w-3.5 h-3.5" />
                Underwriting Decision Pipeline
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Analyst Review Dashboard
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Review AI risk assessments, examine credit signals, and record authorized credit decisions.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchStats();
                fetchAssessments();
              }}
              disabled={loading || statsLoading}
              leftIcon={<RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />}
            >
              Refresh Queue
            </Button>
          </div>
        </div>

        {/* 7 Summary Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          <StatCard
            label="Total Assessments"
            value={statsLoading ? "..." : (stats?.total_assessments ?? 0)}
            icon={<ClipboardCheck className="w-4 h-4 text-cyan-400" />}
          />
          <StatCard
            label="Pending Review"
            value={statsLoading ? "..." : (stats?.pending_reviews ?? 0)}
            icon={<Clock className="w-4 h-4 text-amber-400" />}
          />
          <StatCard
            label="In Review"
            value={statsLoading ? "..." : (stats?.in_review_assessments ?? 0)}
            icon={<Eye className="w-4 h-4 text-blue-400" />}
          />
          <StatCard
            label="Completed"
            value={statsLoading ? "..." : (stats?.completed_reviews ?? 0)}
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          />
          <StatCard
            label="Low Risk"
            value={statsLoading ? "..." : (stats?.low_risk_assessments ?? 0)}
            icon={<TrendingDown className="w-4 h-4 text-emerald-400" />}
          />
          <StatCard
            label="Medium Risk"
            value={statsLoading ? "..." : (stats?.medium_risk_assessments ?? 0)}
            icon={<TrendingUp className="w-4 h-4 text-amber-400" />}
          />
          <StatCard
            label="High Risk"
            value={statsLoading ? "..." : (stats?.high_risk_assessments ?? 0)}
            icon={<ShieldAlert className="w-4 h-4 text-rose-400" />}
          />
        </div>

        {/* Filter Toolbar */}
        <Card className="mb-6 bg-[#0b1528] border-[#1e293b]">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3">
              {/* Row 1: Search & Quick Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by business, ID, industry..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    className="w-full pl-9 pr-3 py-2 bg-[#081120] border border-[#1e293b] rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="Filter by business name..."
                    value={businessNameFilter}
                    onChange={(e) => {
                      setBusinessNameFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 bg-[#081120] border border-[#1e293b] rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <select
                    value={riskFilter}
                    onChange={(e) => {
                      setRiskFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 bg-[#081120] border border-[#1e293b] rounded-lg text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ALL">All Risk Categories</option>
                    <option value="LOW">Low Risk</option>
                    <option value="MEDIUM">Medium Risk</option>
                    <option value="HIGH">High Risk</option>
                  </select>
                </div>

                <div>
                  <select
                    value={reviewStatusFilter}
                    onChange={(e) => {
                      setReviewStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 bg-[#081120] border border-[#1e293b] rounded-lg text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ALL">All Review Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="in_review">In Review</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="needs_info">Needs Info</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Date Range & Reset */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#1a2d4b]/60">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>From:</span>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => {
                        setDateFrom(e.target.value);
                        setPage(1);
                      }}
                      className="px-2 py-1 bg-[#081120] border border-[#1e293b] rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>To:</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => {
                        setDateTo(e.target.value);
                        setPage(1);
                      }}
                      className="px-2 py-1 bg-[#081120] border border-[#1e293b] rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleResetFilters}
                    className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded bg-[#081120] border border-[#1e293b] hover:border-slate-600 transition-colors"
                  >
                    Reset Filters
                  </button>
                  <span className="text-xs text-slate-500">
                    Showing <strong className="text-slate-300">{assessments.length}</strong> of{" "}
                    <strong className="text-slate-300">{totalCount}</strong> assessments
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error message */}
        {error && <ErrorMessage message={error} className="mb-6" />}

        {/* Assessment Queue Table */}
        <Card className="bg-[#0b1528] border-[#1e293b] overflow-hidden">
          <CardHeader className="p-4 sm:p-5 border-b border-[#1e293b]">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base sm:text-lg text-white">Underwriting Queue</CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Assessments across all portfolio businesses ready for analyst evaluation
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full bg-slate-800/40" />
                ))}
              </div>
            ) : assessments.length === 0 ? (
              <EmptyState
                icon={<ClipboardCheck className="w-7 h-7 text-cyan-400" />}
                title="No assessments found"
                description="No assessments matched your current filter criteria."
                actionText="Clear Filters"
                onAction={handleResetFilters}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-[#081120] text-xs text-slate-400 uppercase tracking-wider border-b border-[#1e293b]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">ID</th>
                      <th className="px-4 py-3 font-semibold">Business Name</th>
                      <th className="px-4 py-3 font-semibold">Industry</th>
                      <th className="px-4 py-3 font-semibold">Risk Score</th>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold">Default Prob</th>
                      <th className="px-4 py-3 font-semibold">Review Status</th>
                      <th className="px-4 py-3 font-semibold">Created Date</th>
                      <th className="px-4 py-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e293b]">
                    {assessments.map((a) => {
                      const riskScore = Math.max(0, Math.round(100 - a.default_probability));
                      return (
                        <tr
                          key={a.id}
                          className="hover:bg-[#0f1d36]/60 transition-colors cursor-pointer"
                          onClick={() => navigate(`/analyst/review/${a.id}`)}
                        >
                          <td className="px-4 py-3 font-mono text-xs text-indigo-400">
                            #{a.id}
                          </td>
                          <td className="px-4 py-3 font-medium text-white">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[180px]">{a.business_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-400 capitalize">
                            {a.industry}
                          </td>
                          <td className="px-4 py-3 font-semibold text-white">
                            {riskScore}/100
                          </td>
                          <td className="px-4 py-3">
                            <RiskBadge level={a.risk_level} />
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-300">
                            {a.default_probability.toFixed(1)}%
                          </td>
                          <td className="px-4 py-3">
                            <ReviewBadge status={a.review_status || "pending"} />
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">
                            {new Date(a.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </td>
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/analyst/review/${a.id}`)}
                              className="text-xs h-8 px-2.5 hover:border-indigo-500 hover:text-indigo-400"
                              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                            >
                              Review
                            </Button>
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
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#1e293b] bg-[#081120]">
                <span className="text-xs text-slate-400">
                  Page <strong className="text-slate-200">{page}</strong> of{" "}
                  <strong className="text-slate-200">{totalPages}</strong>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded bg-[#0b1528] border border-[#1e293b] text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded bg-[#0b1528] border border-[#1e293b] text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function ReviewBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "approved") {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        Approved
      </span>
    );
  }
  if (s === "rejected") {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/15 text-rose-400 border border-rose-500/30">
        Rejected
      </span>
    );
  }
  if (s === "in_review") {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center gap-1 w-fit">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
        In Review
      </span>
    );
  }
  if (s === "needs_info") {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
        Needs Info
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700/40 text-slate-300 border border-slate-600/40">
      Pending
    </span>
  );
}
