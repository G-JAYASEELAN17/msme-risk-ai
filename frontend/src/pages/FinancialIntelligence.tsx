import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import {
  financialIntelligenceApi,
  FinancialIntelligenceSummaryResponse,
  AccountLevelMetrics,
  FinancialDiscrepancyItem,
  PaginatedTransactionsResponse,
  TransactionClassificationItem,
  api,
  Business
} from "../services/api";
import { useAuthRole } from "../context/AuthRoleContext";
import Sidebar from "../components/Sidebar";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  FileText,
  ShieldCheck,
  Info,
  ChevronRight,
  Filter,
  Search,
  Download,
  Eye,
  Sliders,
  Scale,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  XCircle,
  Check,
  Clock,
  Briefcase,
  HelpCircle,
  Lock
} from "lucide-react";

export default function FinancialIntelligence() {
  const { user, role, isAnalyst, isAdmin } = useAuthRole();
  const location = useLocation();
  const navigate = useNavigate();
  const { userId: routeUserId } = useParams<{ userId?: string }>();

  // Determine effective target user ID (for analysts inspecting a specific applicant)
  const queryParams = new URLSearchParams(location.search);
  const targetUserId = routeUserId || queryParams.get("user_id") || undefined;
  const businessIdParam = queryParams.get("business_id");

  // State
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | undefined>(
    businessIdParam ? parseInt(businessIdParam, 10) : undefined
  );
  const [summary, setSummary] = useState<FinancialIntelligenceSummaryResponse | null>(null);
  const [accounts, setAccounts] = useState<AccountLevelMetrics[]>([]);
  const [discrepancies, setDiscrepancies] = useState<FinancialDiscrepancyItem[]>([]);
  const [transactionsData, setTransactionsData] = useState<PaginatedTransactionsResponse | null>(null);

  // Filters & Pagination for Transactions
  const [txCategoryFilter, setTxCategoryFilter] = useState<string>("");
  const [txSearch, setTxSearch] = useState<string>("");
  const [txPage, setTxPage] = useState<number>(1);

  // View mode: 'analyst' (deep-dive) vs 'applicant' (plain-language)
  const [viewMode, setViewMode] = useState<"analyst" | "applicant">(
    isAnalyst || isAdmin ? "analyst" : "applicant"
  );

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    "overview" | "accounts" | "reconciliation" | "transactions" | "report"
  >("overview");

  // Loading & Action states
  const [loading, setLoading] = useState<boolean>(true);
  const [recalculating, setRecalculating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<FinancialDiscrepancyItem | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<"RESOLVED" | "EXEMPTED" | "DISMISSED">("RESOLVED");
  const [resolutionNotes, setResolutionNotes] = useState<string>("");
  const [resolving, setResolving] = useState<boolean>(false);

  const [selectedTxForOverride, setSelectedTxForOverride] = useState<TransactionClassificationItem | null>(null);
  const [newCategory, setNewCategory] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [overriding, setOverriding] = useState<boolean>(false);

  const [showDqModal, setShowDqModal] = useState<boolean>(false);

  const [businessesLoaded, setBusinessesLoaded] = useState<boolean>(false);

  // Fetch initial businesses
  useEffect(() => {
    let isMounted = true;
    api.getBusinesses()
      .then((res) => {
        if (!isMounted) return;
        const bizList = res || [];
        setBusinesses(bizList);
        if (bizList.length > 0) {
          setSelectedBusinessId(bizList[0].id);
        }
        setBusinessesLoaded(true);
      })
      .catch(() => {
        if (isMounted) setBusinessesLoaded(true);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch Financial Intelligence Data
  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [sumRes, accRes, discRes] = await Promise.all([
        financialIntelligenceApi.getSummary(selectedBusinessId, targetUserId),
        financialIntelligenceApi.getAccounts(selectedBusinessId, targetUserId),
        financialIntelligenceApi.getDiscrepancies(targetUserId)
      ]);
      setSummary(sumRes);
      setAccounts(accRes || []);
      setDiscrepancies(discRes || []);
    } catch (err: any) {
      console.error("Failed to load financial intelligence:", err);
      setErrorMsg(err.message || "Failed to load financial intelligence. Please ensure bank statements or financial records have been uploaded.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch Transactions on filter/page change
  const loadTransactions = async () => {
    try {
      const res = await financialIntelligenceApi.getTransactions({
        page: txPage,
        limit: 15,
        category: txCategoryFilter || undefined,
        search: txSearch || undefined,
        userId: targetUserId
      });
      setTransactionsData(res);
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
    }
  };

  useEffect(() => {
    if (!businessesLoaded) return;
    loadData();
  }, [selectedBusinessId, targetUserId, businessesLoaded]);

  useEffect(() => {
    loadTransactions();
  }, [txPage, txCategoryFilter, txSearch, targetUserId]);

  // Recalculate Financials
  const handleRecalculate = async () => {
    setRecalculating(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await financialIntelligenceApi.recalculate(selectedBusinessId, targetUserId);
      setSuccessMsg(`Financial metrics re-synchronized successfully (Run #${res.run_id}).`);
      await loadData();
      await loadTransactions();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to recalculate financial metrics.");
    } finally {
      setRecalculating(false);
    }
  };

  // Resolve Discrepancy
  const handleResolveDiscrepancy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDiscrepancy) return;
    setResolving(true);
    try {
      await financialIntelligenceApi.resolveDiscrepancy(selectedDiscrepancy.id, {
        status: resolutionStatus,
        resolution_notes: resolutionNotes
      });
      setSelectedDiscrepancy(null);
      setResolutionNotes("");
      setSuccessMsg("Discrepancy resolution recorded in the audit trail.");
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to resolve discrepancy.");
    } finally {
      setResolving(false);
    }
  };

  // Override Category
  const handleOverrideCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTxForOverride || !newCategory) return;
    setOverriding(true);
    try {
      await financialIntelligenceApi.overrideCategory(selectedTxForOverride.id, {
        new_category: newCategory,
        reason: overrideReason
      });
      setSelectedTxForOverride(null);
      setNewCategory("");
      setOverrideReason("");
      setSuccessMsg("Transaction category overridden and logged.");
      await loadTransactions();
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to override category.");
    } finally {
      setOverriding(false);
    }
  };

  // Helpers
  const formatCurrency = (val?: number | null) => {
    if (val === null || val === undefined) return "Not available";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatPct = (val?: number | null) => {
    if (val === null || val === undefined) return "—";
    return `${val > 0 ? "+" : ""}${val.toFixed(1)}%`;
  };

  // Category list
  const categoryLabels: Record<string, string> = {
    sales_receipt: "Business Sales Receipt",
    supplier_payment: "Supplier Payment",
    payroll: "Payroll / Wages",
    rent_utilities: "Rent & Utilities",
    tax_payment: "Tax & GST Challan",
    loan_repayment_emi: "Loan Repayment (EMI)",
    interest_payment: "Interest Payment",
    own_account_transfer: "Internal Contra Transfer",
    refund: "Customer / Tax Refund",
    loan_proceeds: "Loan Disbursement",
    capital_injection: "Capital Injection",
    cash_withdrawal: "Cash Withdrawal",
    operating_expense: "General Operating Expense",
    unknown: "Unclassified"
  };

  return (
    <div className="flex h-screen bg-[#0C0A1D] text-[#F5F3FF] overflow-hidden">
      {/* Sidebar */}
      <Sidebar active="Financial Intelligence" />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
          {/* Top Banner & Control Bar */}
          <div className="bg-[#1C1933] border border-[#383154] rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#8B5CF6]/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#8B5CF6]/20 text-[#A78BFA] border border-[#8B5CF6]/30">
                    Traceable & Explainable Underwriting
                  </span>
                  {summary && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#252141] text-[#B7B1D1] border border-[#383154]">
                      Period: {summary.reporting_period}
                    </span>
                  )}
                  {targetUserId && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Underwriting Applicant: {targetUserId}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-[#F5F3FF]">
                  Financial Health & Intelligence Engine
                </h1>
                <p className="text-sm text-[#B7B1D1]">
                  Evidence-backed consolidated cash flow, multi-account reconciliation, and data reliability metrics.
                </p>
              </div>

              {/* Actions & View Toggle */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* View Mode Toggle for Analysts */}
                {(isAnalyst || isAdmin) && (
                  <div className="flex items-center bg-[#151229] p-1 rounded-xl border border-[#383154]">
                    <button
                      onClick={() => setViewMode("applicant")}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                        viewMode === "applicant"
                          ? "bg-[#8B5CF6] text-white shadow-md"
                          : "text-[#B7B1D1] hover:text-white"
                      }`}
                    >
                      Applicant View
                    </button>
                    <button
                      onClick={() => setViewMode("analyst")}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                        viewMode === "analyst"
                          ? "bg-[#8B5CF6] text-white shadow-md"
                          : "text-[#B7B1D1] hover:text-white"
                      }`}
                    >
                      Analyst Deep-Dive
                    </button>
                  </div>
                )}

                {/* Recalculate Button */}
                <button
                  onClick={handleRecalculate}
                  disabled={recalculating}
                  className="flex items-center gap-2 px-4 py-2 bg-[#252141] hover:bg-[#30294D] text-[#F5F3FF] border border-[#383154] rounded-xl text-sm font-medium transition-all shadow-sm hover:border-[#8B5CF6] disabled:opacity-50"
                  title="Recalculate all affected financial metrics from supporting documents"
                >
                  <RefreshCw className={`w-4 h-4 text-[#8B5CF6] ${recalculating ? "animate-spin" : ""}`} />
                  {recalculating ? "Recalculating..." : "Recalculate"}
                </button>

                {/* Print/Export Button */}
                <button
                  onClick={() => setActiveTab("report")}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#A78BFA] hover:to-[#8B5CF6] text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-[#8B5CF6]/20"
                >
                  <FileText className="w-4 h-4" />
                  Health Report
                </button>
              </div>
            </div>

            {/* Notification messages */}
            {errorMsg && (
              <div className="mt-4 p-3.5 bg-[#F87171]/15 border border-[#F87171]/40 rounded-xl text-xs text-[#F87171] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
                <button onClick={() => setErrorMsg(null)} className="hover:text-white">✕</button>
              </div>
            )}
            {successMsg && (
              <div className="mt-4 p-3.5 bg-[#22C55E]/15 border border-[#22C55E]/40 rounded-xl text-xs text-[#22C55E] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{successMsg}</span>
                </div>
                <button onClick={() => setSuccessMsg(null)} className="hover:text-white">✕</button>
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-[#383154] pb-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "overview"
                  ? "bg-[#252141] text-[#A78BFA] border-b-2 border-[#8B5CF6]"
                  : "text-[#B7B1D1] hover:text-[#F5F3FF]"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Cash Flow & Revenue
            </button>
            <button
              onClick={() => setActiveTab("accounts")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "accounts"
                  ? "bg-[#252141] text-[#A78BFA] border-b-2 border-[#8B5CF6]"
                  : "text-[#B7B1D1] hover:text-[#F5F3FF]"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Bank Accounts ({accounts.length})
            </button>
            <button
              onClick={() => setActiveTab("reconciliation")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "reconciliation"
                  ? "bg-[#252141] text-[#A78BFA] border-b-2 border-[#8B5CF6]"
                  : "text-[#B7B1D1] hover:text-[#F5F3FF]"
              }`}
            >
              <Scale className="w-4 h-4" />
              Reconciliation & Discrepancies
              {discrepancies.filter((d) => d.verification_status === "OPEN").length > 0 && (
                <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("transactions")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "transactions"
                  ? "bg-[#252141] text-[#A78BFA] border-b-2 border-[#8B5CF6]"
                  : "text-[#B7B1D1] hover:text-[#F5F3FF]"
              }`}
            >
              <Layers className="w-4 h-4" />
              Transactions & Categorization
            </button>
            <button
              onClick={() => setActiveTab("report")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "report"
                  ? "bg-[#252141] text-[#A78BFA] border-b-2 border-[#8B5CF6]"
                  : "text-[#B7B1D1] hover:text-[#F5F3FF]"
              }`}
            >
              <FileText className="w-4 h-4" />
              Financial Health Report
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center p-16 space-y-4">
              <RefreshCw className="w-10 h-10 text-[#8B5CF6] animate-spin" />
              <p className="text-sm text-[#B7B1D1]">Analyzing banking streams and calculating financial facts...</p>
            </div>
          ) : !summary ? (
            <div className="bg-[#1C1933] border border-[#383154] rounded-2xl p-12 text-center space-y-4">
              <AlertTriangle className="w-12 h-12 text-[#F59E0B] mx-auto" />
              <h3 className="text-lg font-bold">No Financial Records Available</h3>
              <p className="text-sm text-[#B7B1D1] max-w-md mx-auto">
                Upload business bank statements or GST returns on the Documents page to unlock consolidated financial intelligence.
              </p>
              <button
                onClick={() => navigate("/documents")}
                className="px-5 py-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-xl text-sm font-medium transition-all"
              >
                Go to Documents Upload
              </button>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW & CASH FLOW */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  {/* KPI Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Identified Business Receipts */}
                    <div className="bg-[#1C1933] border border-[#383154] rounded-2xl p-5 hover:border-[#8B5CF6]/50 transition-all space-y-3">
                      <div className="flex items-center justify-between text-xs text-[#B7B1D1]">
                        <span>Identified Business Receipts</span>
                        <span className="px-2 py-0.5 rounded bg-[#22C55E]/10 text-[#22C55E] text-[10px] font-semibold">
                          CALCULATED
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-[#F5F3FF]">
                        {formatCurrency(summary.revenue.identified_business_receipts)}
                      </div>
                      <div className="text-xs text-[#B7B1D1] flex items-center justify-between border-t border-[#383154]/60 pt-2">
                        <span>Gross credits: {formatCurrency(summary.cash_flow.total_credits)}</span>
                        <span className="text-[#A78BFA]" title="Internal transfers between accounts excluded">
                          Contra ded: {formatCurrency(summary.cash_flow.total_credits - summary.revenue.identified_business_receipts)}
                        </span>
                      </div>
                    </div>

                    {/* Total Debits / Outflows */}
                    <div className="bg-[#1C1933] border border-[#383154] rounded-2xl p-5 hover:border-[#8B5CF6]/50 transition-all space-y-3">
                      <div className="flex items-center justify-between text-xs text-[#B7B1D1]">
                        <span>Total Debits / Outflows</span>
                        <span className="px-2 py-0.5 rounded bg-[#F87171]/10 text-[#F87171] text-[10px] font-semibold">
                          CALCULATED
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-[#F5F3FF]">
                        {formatCurrency(summary.cash_flow.total_debits)}
                      </div>
                      <div className="text-xs text-[#B7B1D1] flex items-center justify-between border-t border-[#383154]/60 pt-2">
                        <span>Monthly avg: {formatCurrency(summary.cash_flow.total_debits / Math.max(1, summary.statement_coverage_months))}</span>
                        <span className="text-[#F87171]">Outflow</span>
                      </div>
                    </div>

                    {/* Net Cash Movement */}
                    <div className="bg-[#1C1933] border border-[#383154] rounded-2xl p-5 hover:border-[#8B5CF6]/50 transition-all space-y-3">
                      <div className="flex items-center justify-between text-xs text-[#B7B1D1]">
                        <span>Net Cash Movement</span>
                        <span className="px-2 py-0.5 rounded bg-[#8B5CF6]/10 text-[#A78BFA] text-[10px] font-semibold">
                          FACT
                        </span>
                      </div>
                      <div className={`text-2xl font-bold ${summary.cash_flow.net_cash_flow >= 0 ? "text-[#22C55E]" : "text-[#F87171]"}`}>
                        {formatCurrency(summary.cash_flow.net_cash_flow)}
                      </div>
                      <div className="text-xs text-[#B7B1D1] flex items-center justify-between border-t border-[#383154]/60 pt-2">
                        <span>{summary.cash_flow.positive_flow_months} positive mos</span>
                        <span>{summary.cash_flow.negative_flow_months} negative mos</span>
                      </div>
                    </div>

                    {/* Data Quality Score */}
                    <div
                      onClick={() => setShowDqModal(true)}
                      className="bg-[#1C1933] border border-[#383154] rounded-2xl p-5 hover:border-[#8B5CF6] transition-all space-y-3 cursor-pointer group"
                    >
                      <div className="flex items-center justify-between text-xs text-[#B7B1D1]">
                        <span>Data Quality Score</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          summary.data_quality.overall_score >= 80
                            ? "bg-[#22C55E]/15 text-[#22C55E]"
                            : summary.data_quality.overall_score >= 60
                            ? "bg-[#F59E0B]/15 text-[#F59E0B]"
                            : "bg-[#F87171]/15 text-[#F87171]"
                        }`}>
                          {summary.data_quality.tier}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <div className="text-2xl font-bold text-[#F5F3FF]">
                          {summary.data_quality.overall_score.toFixed(1)}
                          <span className="text-xs text-[#B7B1D1] font-normal"> / 100</span>
                        </div>
                        <span className="text-xs text-[#8B5CF6] group-hover:underline flex items-center gap-0.5">
                          Audit <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                      <div className="w-full bg-[#151229] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#22C55E]"
                          style={{ width: `${Math.min(100, summary.data_quality.overall_score)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Secondary KPI Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Supported Average Closing Balance */}
                    <div className="bg-[#1C1933]/70 border border-[#383154] rounded-xl p-4 space-y-1">
                      <span className="text-xs text-[#B7B1D1]">Supported Avg Balance</span>
                      <div className="text-lg font-bold text-[#F5F3FF]">
                        {formatCurrency(summary.cash_flow.average_closing_balance)}
                      </div>
                      <p className="text-[11px] text-[#B7B1D1]">
                        Latest: {formatCurrency(summary.cash_flow.latest_closing_balance)}
                      </p>
                    </div>

                    {/* Identified Existing Debt */}
                    <div className="bg-[#1C1933]/70 border border-[#383154] rounded-xl p-4 space-y-1">
                      <span className="text-xs text-[#B7B1D1]">Observed Loan EMIs</span>
                      <div className="text-lg font-bold text-[#F5F3FF]">
                        {formatCurrency(summary.debt_repayment.observed_loan_emis_total)}
                      </div>
                      <p className="text-[11px] text-[#B7B1D1]">
                        Run-rate: {formatCurrency(summary.debt_repayment.monthly_debt_service_burden)}/mo
                      </p>
                    </div>

                    {/* Current Ratio / Liquidity */}
                    <div className="bg-[#1C1933]/70 border border-[#383154] rounded-xl p-4 space-y-1">
                      <span className="text-xs text-[#B7B1D1]">Current Ratio</span>
                      <div className="text-lg font-bold text-[#F5F3FF]">
                        {summary.liquidity.current_ratio !== null ? `${summary.liquidity.current_ratio}x` : "Insufficient data"}
                      </div>
                      <p className="text-[11px] text-[#B7B1D1]">
                        Working capital: {formatCurrency(summary.liquidity.working_capital)}
                      </p>
                    </div>

                    {/* Open Discrepancies */}
                    <div className="bg-[#1C1933]/70 border border-[#383154] rounded-xl p-4 space-y-1">
                      <span className="text-xs text-[#B7B1D1]">Discrepancies Flagged</span>
                      <div className={`text-lg font-bold ${summary.open_discrepancies_count > 0 ? "text-[#F59E0B]" : "text-[#22C55E]"}`}>
                        {summary.open_discrepancies_count} Open
                      </div>
                      <p className="text-[11px] text-[#B7B1D1]">
                        {summary.has_coverage_gaps ? "Sequence gap identified" : "Sequence intact"}
                      </p>
                    </div>
                  </div>

                  {/* Monthly Trends Visualization */}
                  <div className="bg-[#1C1933] border border-[#383154] rounded-2xl p-6 shadow-xl space-y-6">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h3 className="text-base font-bold text-[#F5F3FF]">Monthly Banking Flows & Business Receipts</h3>
                        <p className="text-xs text-[#B7B1D1]">
                          Comparing gross credits, genuine business sales receipts, and debits over supported calendar periods.
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1.5 text-[#B7B1D1]">
                          <span className="w-3 h-3 rounded-sm bg-[#8B5CF6]" /> Genuine Receipts
                        </span>
                        <span className="flex items-center gap-1.5 text-[#B7B1D1]">
                          <span className="w-3 h-3 rounded-sm bg-[#F87171]" /> Outflows (Debits)
                        </span>
                        <span className="flex items-center gap-1.5 text-[#B7B1D1]">
                          <span className="w-3 h-3 rounded-sm bg-[#22C55E]" /> Net Cash Movement
                        </span>
                      </div>
                    </div>

                    {summary.monthly_trends && summary.monthly_trends.length > 0 ? (
                      <div className="space-y-4 pt-2">
                        {summary.monthly_trends.map((item) => {
                          const maxVal = Math.max(
                            ...summary.monthly_trends.map((m) => Math.max(m.business_receipts, m.debits, Math.abs(m.net_cash_flow))),
                            1
                          );
                          const receiptWidth = Math.min(100, Math.round((item.business_receipts / maxVal) * 100));
                          const debitWidth = Math.min(100, Math.round((item.debits / maxVal) * 100));

                          return (
                            <div key={item.month} className="space-y-1.5 bg-[#151229]/60 p-3 rounded-xl border border-[#383154]/50">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-[#F5F3FF] w-24">{item.month}</span>
                                <div className="flex items-center gap-4 text-right">
                                  <span className="text-[#A78BFA] font-medium">Receipts: {formatCurrency(item.business_receipts)}</span>
                                  <span className="text-[#F87171] font-medium">Debits: {formatCurrency(item.debits)}</span>
                                  <span className={`font-bold w-24 ${item.net_cash_flow >= 0 ? "text-[#22C55E]" : "text-[#F87171]"}`}>
                                    {item.net_cash_flow >= 0 ? "+" : ""}{formatCurrency(item.net_cash_flow)}
                                  </span>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 pt-1">
                                <div className="w-full bg-[#1C1933] h-2 rounded-full overflow-hidden">
                                  <div className="h-full bg-[#8B5CF6] rounded-full transition-all" style={{ width: `${receiptWidth}%` }} />
                                </div>
                                <div className="w-full bg-[#1C1933] h-2 rounded-full overflow-hidden">
                                  <div className="h-full bg-[#F87171] rounded-full transition-all" style={{ width: `${debitWidth}%` }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-sm text-[#B7B1D1]">
                        No monthly observation records available.
                      </div>
                    )}
                  </div>

                  {/* Revenue Reconciliation & Variance Card */}
                  <div className="bg-[#1C1933] border border-[#383154] rounded-2xl p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-[#F5F3FF]">Multi-Source Revenue Comparison</h3>
                        <p className="text-xs text-[#B7B1D1]">
                          Comparing declared figures with bank receipts, GST filings, and Profit & Loss statements.
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        summary.revenue.reconciliation_status === "MATCHED"
                          ? "bg-[#22C55E]/15 text-[#22C55E]"
                          : summary.revenue.reconciliation_status === "DIVERGENT"
                          ? "bg-[#F59E0B]/15 text-[#F59E0B]"
                          : "bg-[#252141] text-[#B7B1D1]"
                      }`}>
                        Status: {summary.revenue.reconciliation_status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                      <div className="p-4 bg-[#151229] border border-[#383154] rounded-xl space-y-1">
                        <span className="text-xs text-[#B7B1D1]">Applicant Declared Turnover</span>
                        <div className="text-lg font-bold text-[#F5F3FF]">
                          {formatCurrency(summary.revenue.declared_turnover)}
                        </div>
                        <span className="text-[10px] text-[#A78BFA]">Self-Declared</span>
                      </div>

                      <div className="p-4 bg-[#151229] border border-[#383154] rounded-xl space-y-1">
                        <span className="text-xs text-[#B7B1D1]">GST Reported Turnover</span>
                        <div className="text-lg font-bold text-[#F5F3FF]">
                          {formatCurrency(summary.revenue.supporting_records_turnover)}
                        </div>
                        <span className="text-[10px] text-[#22C55E]">Extracted from GSTR-3B</span>
                      </div>

                      <div className="p-4 bg-[#151229] border border-[#383154] rounded-xl space-y-1">
                        <span className="text-xs text-[#B7B1D1]">Annualized Bank Receipts</span>
                        <div className="text-lg font-bold text-[#F5F3FF]">
                          {formatCurrency(summary.revenue.annualized_business_receipts)}
                        </div>
                        <span className="text-[10px] text-[#60A5FA]">Extracted from Bank Records</span>
                      </div>
                    </div>

                    {summary.revenue.reconciliation_notes && summary.revenue.reconciliation_notes.length > 0 && (
                      <div className="bg-[#252141]/50 border border-[#383154] rounded-xl p-4 space-y-1.5">
                        <span className="text-xs font-semibold text-[#A78BFA]">Reconciliation Observations & Disclosures:</span>
                        <ul className="text-xs text-[#B7B1D1] space-y-1 list-disc list-inside">
                          {summary.revenue.reconciliation_notes.map((note, idx) => (
                            <li key={idx}>{note}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: BANK ACCOUNTS */}
              {activeTab === "accounts" && (
                <div className="space-y-6">
                  <div className="bg-[#1C1933] border border-[#383154] rounded-2xl p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h3 className="text-base font-bold text-[#F5F3FF]">
                          Registered Business Accounts ({accounts.length})
                        </h3>
                        <p className="text-xs text-[#B7B1D1]">
                          Analysis across authorized accounts with internal transfer detection and arithmetic consistency checks.
                        </p>
                      </div>
                      <div className="px-3 py-1 bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-xl text-xs text-[#22C55E] flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Contra-Transfer Deduplication Active</span>
                      </div>
                    </div>

                    {accounts.length === 0 ? (
                      <div className="text-center py-10 text-sm text-[#B7B1D1]">
                        No authorized bank accounts linked. Upload bank statements to establish account streams.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        {accounts.map((acc) => (
                          <div
                            key={acc.id}
                            className="bg-[#151229] border border-[#383154] rounded-2xl p-5 hover:border-[#8B5CF6]/50 transition-all space-y-4"
                          >
                            <div className="flex items-start justify-between">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-[#F5F3FF] text-base">{acc.bank_name}</span>
                                  {acc.is_primary && (
                                    <span className="px-2 py-0.5 bg-[#8B5CF6]/20 text-[#A78BFA] text-[10px] font-semibold rounded-md border border-[#8B5CF6]/40">
                                      PRIMARY
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs font-mono text-[#B7B1D1]">{acc.account_number_masked}</p>
                              </div>
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                acc.verification_status === "VERIFIED"
                                  ? "bg-[#22C55E]/15 text-[#22C55E]"
                                  : "bg-[#F59E0B]/15 text-[#F59E0B]"
                              }`}>
                                {acc.verification_status}
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 bg-[#1C1933] p-3 rounded-xl border border-[#383154]/50 text-xs">
                              <div>
                                <span className="text-[#B7B1D1] block text-[10px]">Credits</span>
                                <span className="font-bold text-[#22C55E]">{formatCurrency(acc.total_credits)}</span>
                              </div>
                              <div>
                                <span className="text-[#B7B1D1] block text-[10px]">Debits</span>
                                <span className="font-bold text-[#F87171]">{formatCurrency(acc.total_debits)}</span>
                              </div>
                              <div>
                                <span className="text-[#B7B1D1] block text-[10px]">Net Flow</span>
                                <span className={`font-bold ${acc.net_flow >= 0 ? "text-[#22C55E]" : "text-[#F87171]"}`}>
                                  {formatCurrency(acc.net_flow)}
                                </span>
                              </div>
                            </div>

                            <div className="space-y-1 text-xs text-[#B7B1D1] border-t border-[#383154]/60 pt-3">
                              <div className="flex justify-between">
                                <span>Statement Period:</span>
                                <span className="text-[#F5F3FF] font-medium">{acc.reporting_period}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Closing Balance:</span>
                                <span className="text-[#F5F3FF] font-medium">{formatCurrency(acc.closing_balance)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Arithmetic Consistency:</span>
                                <span className={acc.arithmetic_consistent ? "text-[#22C55E]" : "text-[#F87171]"}>
                                  {acc.arithmetic_consistent ? "Verified Match" : `Delta ₹${acc.arithmetic_delta}`}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Observed Loan EMIs:</span>
                                <span className="text-[#A78BFA]">{formatCurrency(acc.detected_emi_total)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: RECONCILIATION & DISCREPANCIES */}
              {activeTab === "reconciliation" && (
                <div className="space-y-6">
                  <div className="bg-[#1C1933] border border-[#383154] rounded-2xl p-6 shadow-xl space-y-6">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h3 className="text-base font-bold text-[#F5F3FF]">
                          Evidence Reconciliation & Discrepancies ({discrepancies.length})
                        </h3>
                        <p className="text-xs text-[#B7B1D1]">
                          Automated mismatch, arithmetic variance, and statement gap detections with underwriter resolution workflow.
                        </p>
                      </div>
                    </div>

                    {discrepancies.length === 0 ? (
                      <div className="p-8 text-center bg-[#151229] border border-[#383154] rounded-xl space-y-2">
                        <CheckCircle className="w-10 h-10 text-[#22C55E] mx-auto" />
                        <h4 className="font-bold text-[#F5F3FF]">No Discrepancies Detected</h4>
                        <p className="text-xs text-[#B7B1D1]">
                          All declared turnover and extracted banking streams are reconcilable within configured risk tolerances.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-[#383154] text-[#B7B1D1] bg-[#151229]/60">
                              <th className="p-3">Severity</th>
                              <th className="p-3">Code</th>
                              <th className="p-3">Issue Title & Explanation</th>
                              <th className="p-3">Expected vs Observed</th>
                              <th className="p-3">Status</th>
                              {(isAnalyst || isAdmin) && <th className="p-3 text-right">Action</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#383154]/50">
                            {discrepancies.map((d) => (
                              <tr key={d.id} className="hover:bg-[#252141]/40 transition-colors">
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    d.severity === "CRITICAL"
                                      ? "bg-[#F87171]/20 text-[#F87171] border border-[#F87171]/40"
                                      : d.severity === "HIGH"
                                      ? "bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40"
                                      : "bg-[#60A5FA]/20 text-[#60A5FA] border border-[#60A5FA]/40"
                                  }`}>
                                    {d.severity}
                                  </span>
                                </td>
                                <td className="p-3 font-mono text-[#A78BFA] font-medium">{d.discrepancy_code}</td>
                                <td className="p-3 max-w-md space-y-0.5">
                                  <div className="font-semibold text-[#F5F3FF]">{d.title}</div>
                                  <p className="text-[#B7B1D1] text-[11px] leading-relaxed">{d.explanation}</p>
                                  {d.analyst_resolution && (
                                    <div className="text-[10px] text-[#22C55E] bg-[#22C55E]/10 p-1.5 rounded mt-1">
                                      <strong>Resolution ({d.resolved_by}):</strong> {d.analyst_resolution}
                                    </div>
                                  )}
                                </td>
                                <td className="p-3 text-[11px] space-y-0.5">
                                  {d.expected_value && <div>Exp: <span className="text-[#F5F3FF]">{d.expected_value}</span></div>}
                                  {d.observed_value && <div>Obs: <span className="text-[#F87171]">{d.observed_value}</span></div>}
                                </td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                    d.verification_status === "RESOLVED"
                                      ? "bg-[#22C55E]/15 text-[#22C55E]"
                                      : d.verification_status === "EXEMPTED"
                                      ? "bg-[#60A5FA]/15 text-[#60A5FA]"
                                      : "bg-[#F59E0B]/15 text-[#F59E0B]"
                                  }`}>
                                    {d.verification_status}
                                  </span>
                                </td>
                                {(isAnalyst || isAdmin) && (
                                  <td className="p-3 text-right">
                                    {d.verification_status === "OPEN" ? (
                                      <button
                                        onClick={() => {
                                          setSelectedDiscrepancy(d);
                                          setResolutionStatus("RESOLVED");
                                        }}
                                        className="px-2.5 py-1 bg-[#8B5CF6]/20 hover:bg-[#8B5CF6] text-[#A78BFA] hover:text-white border border-[#8B5CF6]/40 rounded-lg text-xs transition-all"
                                      >
                                        Resolve
                                      </button>
                                    ) : (
                                      <span className="text-[#B7B1D1] text-[11px]">Closed</span>
                                    )}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: TRANSACTIONS & CATEGORIZATION */}
              {activeTab === "transactions" && (
                <div className="space-y-6">
                  <div className="bg-[#1C1933] border border-[#383154] rounded-2xl p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <h3 className="text-base font-bold text-[#F5F3FF]">
                          Transaction Streams & Classification Engine
                        </h3>
                        <p className="text-xs text-[#B7B1D1]">
                          Audit trail of categorized banking entries with contra-transfer detection and underwriter adjustments.
                        </p>
                      </div>

                      {/* Filters */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {/* Search input */}
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-[#B7B1D1] absolute left-3 top-2.5" />
                          <input
                            type="text"
                            placeholder="Search description / ref..."
                            value={txSearch}
                            onChange={(e) => {
                              setTxSearch(e.target.value);
                              setTxPage(1);
                            }}
                            className="pl-8 pr-3 py-1.5 bg-[#151229] border border-[#383154] rounded-xl text-xs text-[#F5F3FF] focus:border-[#8B5CF6] outline-none"
                          />
                        </div>

                        {/* Category filter */}
                        <select
                          value={txCategoryFilter}
                          onChange={(e) => {
                            setTxCategoryFilter(e.target.value);
                            setTxPage(1);
                          }}
                          className="px-3 py-1.5 bg-[#151229] border border-[#383154] rounded-xl text-xs text-[#F5F3FF] focus:border-[#8B5CF6] outline-none"
                        >
                          <option value="">All Categories</option>
                          {Object.entries(categoryLabels).map(([k, label]) => (
                            <option key={k} value={k}>{label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Table */}
                    {!transactionsData || transactionsData.transactions.length === 0 ? (
                      <div className="text-center py-12 text-sm text-[#B7B1D1]">
                        No transactions found matching criteria.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-[#383154] text-[#B7B1D1] bg-[#151229]/60">
                              <th className="p-3">Date</th>
                              <th className="p-3">Account</th>
                              <th className="p-3">Description</th>
                              <th className="p-3 text-right">Debit</th>
                              <th className="p-3 text-right">Credit</th>
                              <th className="p-3 text-right">Balance</th>
                              <th className="p-3">Category</th>
                              {(isAnalyst || isAdmin) && <th className="p-3 text-right">Action</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#383154]/40">
                            {transactionsData.transactions.map((tx) => (
                              <tr key={tx.id} className="hover:bg-[#252141]/30 transition-colors">
                                <td className="p-3 font-mono text-[#B7B1D1] whitespace-nowrap">{tx.transaction_date}</td>
                                <td className="p-3 text-[#B7B1D1] whitespace-nowrap">{tx.account_number_masked || `Acc #${tx.bank_account_id}`}</td>
                                <td className="p-3 max-w-xs font-mono text-[11px] text-[#F5F3FF] truncate" title={tx.description}>
                                  {tx.description}
                                </td>
                                <td className="p-3 text-right font-medium text-[#F87171]">
                                  {tx.debit > 0 ? formatCurrency(tx.debit) : "—"}
                                </td>
                                <td className="p-3 text-right font-medium text-[#22C55E]">
                                  {tx.credit > 0 ? formatCurrency(tx.credit) : "—"}
                                </td>
                                <td className="p-3 text-right font-mono text-[#B7B1D1]">
                                  {tx.balance !== null ? formatCurrency(tx.balance) : "—"}
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className="px-2 py-0.5 rounded bg-[#252141] text-[#A78BFA] border border-[#383154] text-[10px] font-medium">
                                      {categoryLabels[tx.category] || tx.category}
                                    </span>
                                    {tx.is_internal_transfer && (
                                      <span className="px-1.5 py-0.5 rounded bg-[#F59E0B]/20 text-[#F59E0B] text-[9px] font-bold">
                                        CONTRA
                                      </span>
                                    )}
                                    {tx.analyst_reviewed && (
                                      <span className="px-1.5 py-0.5 rounded bg-[#22C55E]/20 text-[#22C55E] text-[9px] font-bold" title="Analyst adjusted category">
                                        OVERRIDDEN
                                      </span>
                                    )}
                                  </div>
                                </td>
                                {(isAnalyst || isAdmin) && (
                                  <td className="p-3 text-right">
                                    <button
                                      onClick={() => {
                                        setSelectedTxForOverride(tx);
                                        setNewCategory(tx.category);
                                      }}
                                      className="px-2 py-1 text-[11px] text-[#8B5CF6] hover:text-[#A78BFA] hover:bg-[#8B5CF6]/10 rounded transition-all"
                                    >
                                      Adjust
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* Pagination */}
                        <div className="flex items-center justify-between border-t border-[#383154] pt-4 text-xs text-[#B7B1D1]">
                          <span>
                            Showing page {transactionsData.page} of {Math.ceil(transactionsData.total_count / transactionsData.limit) || 1} ({transactionsData.total_count} total entries)
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                              disabled={txPage <= 1}
                              className="px-3 py-1 bg-[#151229] border border-[#383154] rounded-lg disabled:opacity-40 hover:border-[#8B5CF6]"
                            >
                              Previous
                            </button>
                            <button
                              onClick={() => setTxPage((p) => p + 1)}
                              disabled={txPage >= Math.ceil(transactionsData.total_count / transactionsData.limit)}
                              className="px-3 py-1 bg-[#151229] border border-[#383154] rounded-lg disabled:opacity-40 hover:border-[#8B5CF6]"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: FINANCIAL HEALTH REPORT */}
              {activeTab === "report" && (
                <div className="space-y-6">
                  <div className="bg-[#1C1933] border border-[#383154] rounded-2xl p-8 shadow-2xl space-y-8 print:p-0 print:border-none">
                    {/* Header for print/report */}
                    <div className="flex items-start justify-between border-b border-[#383154] pb-6">
                      <div className="space-y-1">
                        <span className="text-xs uppercase tracking-widest text-[#8B5CF6] font-bold">
                          MSME Risk AI Financial Dossier
                        </span>
                        <h2 className="text-2xl font-bold text-[#F5F3FF]">
                          {summary.business_name || "Applicant MSME Business"}
                        </h2>
                        <p className="text-xs text-[#B7B1D1]">
                          Generated at {new Date(summary.last_recalculated_at).toLocaleString()} • Engine Version {summary.disclosures.engine_version}
                        </p>
                      </div>
                      <button
                        onClick={() => window.print()}
                        className="px-4 py-2 bg-[#252141] hover:bg-[#30294D] text-[#F5F3FF] border border-[#383154] rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all print:hidden"
                      >
                        <Download className="w-3.5 h-3.5" /> Print / Save PDF
                      </button>
                    </div>

                    {/* Executive Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-[#151229] rounded-xl border border-[#383154] space-y-1">
                        <span className="text-xs text-[#B7B1D1]">True Sales Receipts</span>
                        <div className="text-lg font-bold text-[#22C55E]">
                          {formatCurrency(summary.revenue.identified_business_receipts)}
                        </div>
                      </div>
                      <div className="p-4 bg-[#151229] rounded-xl border border-[#383154] space-y-1">
                        <span className="text-xs text-[#B7B1D1]">Annualized Run-Rate</span>
                        <div className="text-lg font-bold text-[#F5F3FF]">
                          {formatCurrency(summary.revenue.annualized_business_receipts)}
                        </div>
                      </div>
                      <div className="p-4 bg-[#151229] rounded-xl border border-[#383154] space-y-1">
                        <span className="text-xs text-[#B7B1D1]">Net Movement</span>
                        <div className={`text-lg font-bold ${summary.cash_flow.net_cash_flow >= 0 ? "text-[#22C55E]" : "text-[#F87171]"}`}>
                          {formatCurrency(summary.cash_flow.net_cash_flow)}
                        </div>
                      </div>
                      <div className="p-4 bg-[#151229] rounded-xl border border-[#383154] space-y-1">
                        <span className="text-xs text-[#B7B1D1]">Data Quality Index</span>
                        <div className="text-lg font-bold text-[#A78BFA]">
                          {summary.data_quality.overall_score.toFixed(1)} / 100 ({summary.data_quality.tier})
                        </div>
                      </div>
                    </div>

                    {/* Ratios & Debt Coverage */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-[#F5F3FF] uppercase tracking-wider">
                        Repayment & Liquidity Indicators
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        <div className="p-4 bg-[#151229] border border-[#383154] rounded-xl space-y-1">
                          <span className="text-[#B7B1D1]">Current Ratio:</span>
                          <span className="text-base font-bold text-[#F5F3FF] block">
                            {summary.liquidity.current_ratio !== null ? `${summary.liquidity.current_ratio}x` : "Not available"}
                          </span>
                          <span className="text-[10px] text-[#B7B1D1]">{summary.liquidity.limitations}</span>
                        </div>
                        <div className="p-4 bg-[#151229] border border-[#383154] rounded-xl space-y-1">
                          <span className="text-[#B7B1D1]">Observed Loan EMIs:</span>
                          <span className="text-base font-bold text-[#F5F3FF] block">
                            {formatCurrency(summary.debt_repayment.observed_loan_emis_total)}
                          </span>
                          <span className="text-[10px] text-[#B7B1D1]">Annualized burden: {formatCurrency(summary.debt_repayment.annual_debt_service_burden)}</span>
                        </div>
                        <div className="p-4 bg-[#151229] border border-[#383154] rounded-xl space-y-1">
                          <span className="text-[#B7B1D1]">Reconciliation Status:</span>
                          <span className="text-base font-bold text-[#A78BFA] block">
                            {summary.revenue.reconciliation_status}
                          </span>
                          <span className="text-[10px] text-[#B7B1D1]">Declared vs Bank vs GST</span>
                        </div>
                      </div>
                    </div>

                    {/* Disclosures & Regulatory Charter */}
                    <div className="p-4 bg-[#151229] border border-[#383154] rounded-xl space-y-2 text-xs text-[#B7B1D1]">
                      <span className="font-semibold text-[#A78BFA] block">Governance & Verification Disclosures:</span>
                      <p>{summary.disclosures.charter}</p>
                      <p>{summary.disclosures.reconciliation_rule}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* RESOLVE DISCREPANCY MODAL */}
      {selectedDiscrepancy && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#1C1933] border border-[#383154] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-[#F5F3FF]">Resolve Financial Discrepancy</h3>
                <p className="text-xs text-[#B7B1D1]">{selectedDiscrepancy.title}</p>
              </div>
              <button onClick={() => setSelectedDiscrepancy(null)} className="text-[#B7B1D1] hover:text-white">✕</button>
            </div>

            <form onSubmit={handleResolveDiscrepancy} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[#B7B1D1]">Resolution Status</label>
                <select
                  value={resolutionStatus}
                  onChange={(e: any) => setResolutionStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-[#151229] border border-[#383154] rounded-xl text-[#F5F3FF] outline-none"
                >
                  <option value="RESOLVED">RESOLVED (Verified supporting records provided)</option>
                  <option value="EXEMPTED">EXEMPTED (Legitimate business rationale accepted)</option>
                  <option value="DISMISSED">DISMISSED (False positive or acceptable variance)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[#B7B1D1]">Underwriter Resolution Evidence / Notes</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Detail the supporting documents, invoices, or interview justification examined..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-[#151229] border border-[#383154] rounded-xl text-[#F5F3FF] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedDiscrepancy(null)}
                  className="px-4 py-2 bg-[#252141] hover:bg-[#30294D] text-[#B7B1D1] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolving || !resolutionNotes.trim()}
                  className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-xl font-medium disabled:opacity-50"
                >
                  {resolving ? "Recording..." : "Save Resolution"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OVERRIDE TRANSACTION CATEGORY MODAL */}
      {selectedTxForOverride && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#1C1933] border border-[#383154] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-[#F5F3FF]">Adjust Transaction Category</h3>
                <p className="text-xs text-[#B7B1D1] truncate max-w-xs">{selectedTxForOverride.description}</p>
              </div>
              <button onClick={() => setSelectedTxForOverride(null)} className="text-[#B7B1D1] hover:text-white">✕</button>
            </div>

            <form onSubmit={handleOverrideCategory} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[#B7B1D1]">New Classification Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-[#151229] border border-[#383154] rounded-xl text-[#F5F3FF] outline-none"
                >
                  {Object.entries(categoryLabels).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[#B7B1D1]">Underwriting Justification</label>
                <textarea
                  required
                  rows={3}
                  placeholder="State reason for overriding the default classification (e.g., invoice matched)..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full px-3 py-2 bg-[#151229] border border-[#383154] rounded-xl text-[#F5F3FF] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedTxForOverride(null)}
                  className="px-4 py-2 bg-[#252141] hover:bg-[#30294D] text-[#B7B1D1] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={overriding || !overrideReason.trim()}
                  className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-xl font-medium disabled:opacity-50"
                >
                  {overriding ? "Saving..." : "Apply Override"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DATA QUALITY SCORE BREAKDOWN MODAL */}
      {showDqModal && summary && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#1C1933] border border-[#383154] rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-[#F5F3FF]">Data Quality Audit Breakdown</h3>
                <p className="text-xs text-[#B7B1D1]">4-Dimensional Reliability & Consistency Scoring</p>
              </div>
              <button onClick={() => setShowDqModal(false)} className="text-[#B7B1D1] hover:text-white">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              {summary.data_quality.quality_factors.map((factor) => (
                <div key={factor.dimension} className="space-y-1 bg-[#151229] p-3 rounded-xl border border-[#383154]">
                  <div className="flex items-center justify-between font-semibold text-[#F5F3FF]">
                    <span>{factor.dimension}</span>
                    <span>{factor.score.toFixed(1)} / {factor.max.toFixed(1)}</span>
                  </div>
                  <div className="w-full bg-[#1C1933] h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#8B5CF6] rounded-full"
                      style={{ width: `${Math.min(100, (factor.score / factor.max) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}

              <div className="p-3 bg-[#252141]/50 border border-[#383154] rounded-xl space-y-1 text-[#B7B1D1]">
                <span className="font-semibold text-[#A78BFA] block">Limitation Disclosures:</span>
                <ul className="list-disc list-inside space-y-0.5">
                  {summary.data_quality.limitations_and_disclosures.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowDqModal(false)}
                className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-xl text-xs font-medium"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
