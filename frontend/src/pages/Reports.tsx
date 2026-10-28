import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  FileSpreadsheet,
  Search,
  Filter,
  ArrowLeft,
  Printer,
  Download,
  Calendar,
  Building2,
  ShieldCheck,
  BrainCircuit,
  DollarSign,
  Zap,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sparkles,
  RefreshCw,
  Scale,
  Clock,
  XCircle,
  HelpCircle,
  Send,
  UserCheck,
} from "lucide-react";
import { auth } from "../services/firebase";
import { api, AssessmentSummary, FullReportData, UserProfile } from "../services/api";
import Sidebar from "../components/Sidebar";
import PageHeader from "../components/PageHeader";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { RiskBadge } from "../components/ui/Badge";
import EmptyState from "../components/ui/EmptyState";
import ErrorMessage from "../components/ErrorMessage";
import Pagination from "../components/ui/Pagination";
import { useAuthRole } from "../context/AuthRoleContext";
import { useToast } from "../components/ui/Toast";
import { Skeleton, TableSkeleton } from "../components/ui/Skeleton";

export default function Reports() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const reportIdParam = searchParams.get("id");

  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [reportData, setReportData] = useState<FullReportData | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search, Filter & Pagination states
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [reviewStatusFilter, setReviewStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "score_desc" | "score_asc">("date_desc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Analyst Review form state (in single report view)
  const [reviewStatusInput, setReviewStatusInput] = useState("approved");
  const [reviewNotesInput, setReviewNotesInput] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const { userProfile } = useAuthRole();

  useEffect(() => {
    if (userProfile) {
      setCurrentUserProfile(userProfile);
    }
  }, [userProfile]);

  useEffect(() => {
    if (reportIdParam) {
      fetchReportDetails(parseInt(reportIdParam, 10));
    } else {
      fetchAssessments();
    }
  }, [reportIdParam]);

  const fetchAssessments = async () => {
    try {
      setLoading(true);
      setError("");
      setReportData(null);
      const data = await api.getAssessments();
      setAssessments(data);
    } catch (err: any) {
      console.error("Fetch assessments error:", err);
      setError(err?.message || "Failed to retrieve assessment history.");
    } finally {
      setLoading(false);
    }
  };

  const fetchReportDetails = async (id: number) => {
    try {
      setLoading(true);
      setError("");
      const data = await api.getReport(id);
      setReportData(data);
    } catch (err: any) {
      console.error("Fetch report details error:", err);
      setError(err?.message || "Failed to load report details.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJSON = () => {
    if (!reportData) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(reportData, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `MSME_Risk_Report_${reportData.metadata.report_id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("Export Complete", "Report downloaded in JSON format.");
  };

  const handleExportCSV = () => {
    if (assessments.length === 0) return;
    const headers = ["ID", "Business Name", "Industry", "Default Probability (%)", "Risk Level", "Review Status", "Date"];
    const rows = assessments.map((a) => [
      `MSME-${a.id}24`,
      `"${a.business_name.replace(/"/g, '""')}"`,
      `"${a.industry}"`,
      a.default_probability.toFixed(1),
      a.risk_level,
      a.review_status || "pending",
      `"${new Date(a.created_at).toISOString()}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "MSME_Assessments_Portfolio.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success("Export Complete", "Portfolio records exported to CSV.");
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportIdParam) return;
    try {
      setSubmittingReview(true);
      const id = parseInt(reportIdParam, 10);
      await api.reviewAssessment(id, reviewStatusInput, reviewNotesInput);
      toast.success("Review Submitted", `Assessment marked as ${reviewStatusInput.toUpperCase()}`);
      await fetchReportDetails(id);
      setReviewNotesInput("");
    } catch (err: any) {
      toast.error("Review Failed", err.message || "Failed to update review status.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const renderReviewBadge = (status?: string) => {
    const s = (status || "pending").toLowerCase();
    if (s === "approved") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 size={12} /> Approved
        </span>
      );
    }
    if (s === "rejected") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
          <XCircle size={12} /> Rejected
        </span>
      );
    }
    if (s === "needs_info") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <HelpCircle size={12} /> Needs Info
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700/40 text-slate-300 border border-slate-700">
        <Clock size={12} /> Pending Review
      </span>
    );
  };

  // Filter and sort assessments
  const filteredAssessments = assessments
    .filter((a) => {
      const matchesSearch =
        a.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `MSME-${a.id}24`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.industry.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRisk =
        riskFilter === "ALL" || a.risk_level.toUpperCase() === riskFilter.toUpperCase();

      const matchesReview =
        reviewStatusFilter === "ALL" || (a.review_status || "pending").toLowerCase() === reviewStatusFilter.toLowerCase();

      return matchesSearch && matchesRisk && matchesReview;
    })
    .sort((a, b) => {
      if (sortBy === "date_desc") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === "date_asc") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === "score_desc") {
        return b.default_probability - a.default_probability;
      }
      if (sortBy === "score_asc") {
        return a.default_probability - b.default_probability;
      }
      return 0;
    });

  const totalPages = Math.ceil(filteredAssessments.length / pageSize) || 1;
  const paginatedAssessments = filteredAssessments.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const isAnalystOrAdmin = ["analyst", "admin"].includes((currentUserProfile?.role || "").toLowerCase());

  // 1. REPORT DETAIL SKELETON (When loading a specific report)
  if (reportIdParam && loading) {
    return (
      <div className="app-layout">
        <Sidebar active="Reports" />
        <main className="main-content">
          <div className="flex items-center justify-between pb-6 mb-6 border-b border-[#383154]">
            <Skeleton className="h-9 w-48 rounded-xl" />
            <div className="flex gap-3">
              <Skeleton className="h-9 w-28 rounded-xl" />
              <Skeleton className="h-9 w-28 rounded-xl" />
            </div>
          </div>
          <div className="rounded-2xl bg-[#1C1933] border border-[#383154] p-8 space-y-6">
            <div className="flex justify-between items-center pb-6 border-b border-[#383154]">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <div className="space-y-1.5">
                  <Skeleton className="h-5 w-36 rounded" />
                  <Skeleton className="h-3.5 w-48 rounded" />
                </div>
              </div>
              <Skeleton className="h-6 w-32 rounded-full" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-[#0C0A1D] border border-[#383154]">
              <Skeleton className="h-10 w-full rounded" />
              <Skeleton className="h-10 w-full rounded" />
              <Skeleton className="h-10 w-full rounded" />
              <Skeleton className="h-10 w-full rounded" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Skeleton className="h-44 rounded-xl" />
              <Skeleton className="h-44 rounded-xl" />
              <Skeleton className="h-44 rounded-xl" />
            </div>
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </main>
      </div>
    );
  }

  // 2. SINGLE DETAILED REPORT VIEW
  if (reportData) {
    const { metadata, business, financial_summary, risk_assessment } = reportData;

    return (
      <div className="app-layout">
        <Sidebar active="Reports" />

        <main className="main-content">
          {/* Header Controls (Hidden during print) */}
          <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-[#383154]">
            <Button
              variant="outline"
              size="sm"
              icon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => navigate("/reports")}
            >
              Back to Assessment History
            </Button>

            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                icon={<Download className="w-4 h-4" />}
                onClick={handleDownloadJSON}
              >
                Export JSON
              </Button>

              <Button
                variant="primary"
                size="sm"
                icon={<Printer className="w-4 h-4" />}
                onClick={handlePrint}
              >
                Print to PDF
              </Button>
            </div>
          </div>

          {/* Printable Report Document Card */}
          <div className="printable-area rounded-2xl bg-[#1C1933] border border-[#383154] p-6 sm:p-10 shadow-2xl space-y-8">
            {/* Header / Brand */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#383154]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 flex items-center justify-center text-[#A78BFA]">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-white font-['Space_Grotesk']">
                    MSME RISK AI
                  </h2>
                  <p className="text-xs text-slate-400">Credit Risk & Underwriting Decision Support</p>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <span className="inline-block px-3 py-1 rounded-full bg-[#8B5CF6]/10 border border-[#8B5CF6]/25 text-[#A78BFA] text-xs font-semibold mb-1 font-mono-numeric tabular-nums">
                  ID: {metadata.report_id}
                </span>
                <p className="text-xs text-slate-400 font-mono-numeric tabular-nums">
                  Generated {new Date(metadata.generated_at).toLocaleDateString("en-IN", { dateStyle: "long" })}
                </p>
              </div>
            </div>

            {/* Quick Metadata Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-[#0C0A1D] border border-[#383154] text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Model Engine</span>
                <span className="font-semibold text-white font-mono-numeric">XGBoost-Ensemble v{metadata.model_version}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Underwriter Jurisdiction</span>
                <span className="font-semibold text-white">{business.location || "India (RBI / MSME)"}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Model Confidence</span>
                <span className="font-semibold text-[#A78BFA] font-mono-numeric tabular-nums">{risk_assessment.confidence}% Confident</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Review Decision</span>
                <div>{renderReviewBadge(reportData.review_status || "pending")}</div>
              </div>
            </div>

            {/* Summary Highlights Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Business Overview */}
              <div className="p-5 rounded-xl bg-[#1C1933] border border-[#383154] space-y-3">
                <div className="flex items-center gap-2 text-[#A78BFA] text-xs font-bold uppercase tracking-wider">
                  <Building2 className="w-4 h-4" />
                  <span>Borrower Profile</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{business.name}</h3>
                  <p className="text-xs text-slate-400 capitalize">{business.industry} Sector</p>
                </div>
                <div className="pt-2 border-t border-[#383154] grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">Business Age:</span>
                    <p className="font-semibold text-white font-mono-numeric tabular-nums">{business.age} Years</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Workforce:</span>
                    <p className="font-semibold text-white font-mono-numeric tabular-nums">{business.employees} Staff</p>
                  </div>
                </div>
              </div>

              {/* Financial Profile */}
              <div className="p-5 rounded-xl bg-[#1C1933] border border-[#383154] space-y-3">
                <div className="flex items-center gap-2 text-[#A78BFA] text-xs font-bold uppercase tracking-wider">
                  <DollarSign className="w-4 h-4" />
                  <span>Financial Statement</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">Annual Revenue:</span>
                    <p className="font-semibold text-white font-mono-numeric tabular-nums">₹{financial_summary.annual_revenue.toLocaleString("en-IN")}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Monthly Cash Flow:</span>
                    <p className="font-semibold text-white font-mono-numeric tabular-nums">₹{financial_summary.monthly_cash_flow.toLocaleString("en-IN")}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Existing Debt:</span>
                    <p className="font-semibold text-white font-mono-numeric tabular-nums">₹{financial_summary.existing_debt.toLocaleString("en-IN")}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Monthly Expenses:</span>
                    <p className="font-semibold text-white font-mono-numeric tabular-nums">₹{financial_summary.monthly_expenses.toLocaleString("en-IN")}</p>
                  </div>
                </div>
              </div>

              {/* Risk Score Dial Card */}
              <div className="p-5 rounded-xl bg-[#1C1933] border border-[#383154] flex flex-col justify-between text-center">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                  <span>Credit Risk Tier</span>
                  <RiskBadge riskLevel={risk_assessment.risk_level} size="sm" />
                </div>

                <div className="my-3">
                  <div className="text-4xl font-extrabold text-white font-mono-numeric tabular-nums">
                    {risk_assessment.default_probability.toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">Default Probability Estimate</div>
                </div>

                <div className="p-2 rounded-lg bg-[#0C0A1D] text-xs text-slate-300 font-mono-numeric tabular-nums border border-[#383154]">
                  Health Score: <b className="text-white">{Math.round(100 - risk_assessment.default_probability)} / 100</b>
                </div>
              </div>
            </div>

            {/* Analyst Review & Underwriter Decision Section */}
            <div className="no-print p-6 rounded-2xl bg-[#1C1933] border border-[#8B5CF6]/25 space-y-5">
              <div className="flex items-center justify-between border-b border-[#383154] pb-4">
                <div className="flex items-center gap-2 text-[#A78BFA] font-semibold text-sm">
                  <UserCheck className="w-5 h-5" />
                  <span>Institutional Underwriting Review</span>
                </div>
                <div>{renderReviewBadge(reportData.review_status || "pending")}</div>
              </div>

              {/* Status details grid visible to all users */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-[#0C0A1D] border border-[#383154] text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5 uppercase tracking-wider font-semibold text-[10px]">
                    Current Decision Status
                  </span>
                  <span className="font-bold text-white capitalize">{reportData.review_status || "Pending"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5 uppercase tracking-wider font-semibold text-[10px]">
                    Reviewing Officer (Analyst UID)
                  </span>
                  <span className="font-mono-numeric text-[#C4B5FD] truncate block">
                    {reportData.reviewed_by || "Pending Review Assignment"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5 uppercase tracking-wider font-semibold text-[10px]">
                    Reviewed Timestamp
                  </span>
                  <span className="text-slate-300 font-mono-numeric tabular-nums">
                    {reportData.reviewed_at ? new Date(reportData.reviewed_at).toLocaleString("en-IN") : "Awaiting Underwriter Evaluation"}
                  </span>
                </div>
              </div>

              {reportData.review_notes && (
                <div className="p-4 rounded-xl bg-[#0C0A1D]/80 border border-[#383154] text-xs text-slate-300">
                  <span className="text-slate-400 block mb-1 font-semibold text-[10px] uppercase tracking-wider">
                    Underwriter Review Notes
                  </span>
                  <p className="whitespace-pre-wrap">{reportData.review_notes}</p>
                </div>
              )}

              {/* Analyst & Admin review controls (hidden from normal borrowers) */}
              {isAnalystOrAdmin ? (
                <form onSubmit={handleSubmitReview} className="space-y-4 pt-2 border-t border-[#383154]">
                  <div className="text-xs font-semibold text-[#C4B5FD] uppercase tracking-wider">
                    Update Underwriting Decision
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Decision Status</label>
                      <select
                        value={reviewStatusInput}
                        onChange={(e) => setReviewStatusInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-[#0C0A1D] border border-[#383154] rounded-xl text-white text-sm focus:outline-none focus:border-[#8B5CF6]"
                      >
                        <option value="approved">Approved</option>
                        <option value="needs_info">Conditional / Needs Info</option>
                        <option value="rejected">Rejected</option>
                        <option value="pending">Pending Review</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Underwriter Review Notes</label>
                      <input
                        type="text"
                        placeholder="e.g. Approved with lien condition. Cash flow coverage verified against bank records."
                        value={reviewNotesInput}
                        onChange={(e) => setReviewNotesInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-[#0C0A1D] border border-[#383154] rounded-xl text-white text-sm focus:outline-none focus:border-[#8B5CF6]"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      icon={<Send className="w-4 h-4" />}
                      loading={submittingReview}
                    >
                      Submit Underwriting Decision
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="text-[11px] text-slate-500 italic">
                  Review status is determined by authorized credit underwriting analysts. Borrowers cannot modify decisions.
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 2. ASSESSMENT LIST / HISTORY VIEW
  return (
    <div className="app-layout">
      <Sidebar active="Reports" />

      <main className="main-content space-y-8">
        <PageHeader
          badge="Assessment History"
          title="MSME Loan Evaluations & History"
          description="Track, filter, and review all automated risk models and underwriting reports."
          actions={
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="outline"
                size="md"
                icon={<RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />}
                onClick={fetchAssessments}
              >
                Refresh
              </Button>

              {assessments.length > 0 && (
                <Button
                  variant="outline"
                  size="md"
                  icon={<Download className="w-4 h-4" />}
                  onClick={handleExportCSV}
                >
                  Export CSV
                </Button>
              )}

              <Button
                variant="primary"
                size="md"
                icon={<Sparkles className="w-4 h-4" />}
                onClick={() => navigate("/assessment")}
              >
                New Assessment
              </Button>
            </div>
          }
        />

        {error && <ErrorMessage message={error} onRetry={fetchAssessments} />}

        {/* Search & Filtering Toolbar */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative">
                <Input
                  placeholder="Search business or MSME ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  leftIcon={<Search className="w-4 h-4" />}
                />
              </div>

              <div>
                <Select
                  value={riskFilter}
                  onChange={(e) => {
                    setRiskFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  options={[
                    { value: "ALL", label: "All Risk Tiers" },
                    { value: "LOW", label: "Low Risk Tier" },
                    { value: "MEDIUM", label: "Medium Risk Tier" },
                    { value: "HIGH", label: "High Risk Tier" },
                  ]}
                />
              </div>

              <div>
                <Select
                  value={reviewStatusFilter}
                  onChange={(e) => {
                    setReviewStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  options={[
                    { value: "ALL", label: "All Review Decisions" },
                    { value: "pending", label: "Pending Review" },
                    { value: "approved", label: "Approved" },
                    { value: "needs_info", label: "Needs Info" },
                    { value: "rejected", label: "Rejected" },
                  ]}
                />
              </div>

              <div>
                <Select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  options={[
                    { value: "date_desc", label: "Sort: Newest First" },
                    { value: "date_asc", label: "Sort: Oldest First" },
                    { value: "score_desc", label: "Sort: Highest Risk" },
                    { value: "score_asc", label: "Sort: Lowest Risk" },
                  ]}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assessments History Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Evaluation History Records ({filteredAssessments.length})</CardTitle>
              <CardDescription>Click any row to open the complete underwriting audit report</CardDescription>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="p-6">
                <TableSkeleton rows={6} columns={7} />
              </div>
            ) : filteredAssessments.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<FileSpreadsheet className="w-7 h-7 text-[#A78BFA]" />}
                  title={assessments.length === 0 ? "No reports available yet" : "No evaluation records found"}
                  description={
                    assessments.length === 0
                      ? "No MSME risk evaluations have been performed yet. Run an assessment to generate your first audit-ready risk report."
                      : "No assessments matched your active search and filter criteria."
                  }
                  actionText="New Assessment"
                  actionIcon={<Sparkles className="w-4 h-4" />}
                  onAction={() => navigate("/assessment")}
                />
              </div>
            ) : (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-[#1C1933] border-b border-[#383154] text-slate-400 uppercase text-[11px] tracking-wider">
                      <tr>
                        <th className="px-6 py-3.5 font-semibold">Report Reference</th>
                        <th className="px-6 py-3.5 font-semibold">Industry</th>
                        <th className="px-6 py-3.5 font-semibold">Default Probability</th>
                        <th className="px-6 py-3.5 font-semibold">Risk Classification</th>
                        <th className="px-6 py-3.5 font-semibold">Review Decision</th>
                        <th className="px-6 py-3.5 font-semibold">Date Evaluated</th>
                        <th className="px-6 py-3.5 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#383154]">
                      {paginatedAssessments.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-[#252141]/60 transition-colors cursor-pointer"
                          onClick={() => navigate(`/reports?id=${item.id}`)}
                        >
                          <td className="px-6 py-4">
                            <div className="font-semibold text-white">{item.business_name}</div>
                            <div className="text-[11px] text-slate-400 font-mono-numeric tabular-nums">MSME-{item.id}24</div>
                          </td>
                          <td className="px-6 py-4 text-slate-300 capitalize">{item.industry}</td>
                          <td className="px-6 py-4">
                            <span className="font-mono-numeric tabular-nums font-bold text-slate-100">
                              {item.default_probability.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <RiskBadge riskLevel={item.risk_level} size="sm" />
                          </td>
                          <td className="px-6 py-4">
                            {renderReviewBadge(item.review_status)}
                          </td>
                          <td className="px-6 py-4 text-slate-400 text-xs font-mono-numeric tabular-nums">
                            {new Date(item.created_at).toLocaleDateString("en-IN", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </td>
                          <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<FileText className="w-3.5 h-3.5" />}
                              onClick={() => navigate(`/reports?id=${item.id}`)}
                              className="text-[#A78BFA] hover:text-[#C4B5FD]"
                            >
                              View Report
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-[#383154] p-3">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={(p) => setCurrentPage(p)}
                    totalItems={filteredAssessments.length}
                    pageSize={pageSize}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
