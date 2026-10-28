import { useEffect, useState, useCallback, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import AdminHeader from "./AdminHeader";
import {
  Briefcase,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  RefreshCw,
  Search,
  UserCheck,
  UserX,
  ShieldCheck,
  XCircle,
  AlertTriangle,
  Eye,
  Filter,
  Check,
  X,
  FileText,
  Mail,
  Building,
  GraduationCap,
  Calendar,
} from "lucide-react";
import {
  api,
  AdminUserItem,
  AssessmentSummary,
  AnalystAccessRequestItem,
} from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/ui/EmptyState";
import Button from "../../components/ui/Button";
import { useToast } from "../../components/ui/Toast";

interface AnalystWorkload {
  uid: string;
  name: string;
  email: string;
  status: string;
  pendingReviews: number;
  completedReviews: number;
  totalAssigned: number;
}

type TabType = "requests" | "workload";
type StatusFilterType = "all" | "pending" | "approved" | "rejected" | "suspended";

export default function AdminAnalysts() {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<TabType>("requests");
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [requests, setRequests] = useState<AnalystAccessRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search for Analyst Access Requests
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>("pending");
  const [searchTerm, setSearchTerm] = useState("");

  // Modals & Drawers state
  const [selectedRequest, setSelectedRequest] = useState<AnalystAccessRequestItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Confirmation modals
  const [approveConfirmTarget, setApproveConfirmTarget] = useState<AnalystAccessRequestItem | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AnalystAccessRequestItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [suspendTarget, setSuspendTarget] = useState<AnalystAccessRequestItem | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<AnalystAccessRequestItem | null>(null);

  // Load requests
  const loadRequests = useCallback(async () => {
    try {
      setRequestsLoading(true);
      const data = await api.getAnalystAccessRequests(
        statusFilter === "all" ? undefined : statusFilter,
        searchTerm
      );
      setRequests(data || []);
    } catch (err: any) {
      console.error("Failed to load analyst requests:", err);
      toast.error("Error", err?.message || "Failed to load analyst access requests.");
    } finally {
      setRequestsLoading(false);
    }
  }, [statusFilter, searchTerm, toast]);

  // Load telemetry data
  const loadWorkloadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersRes, assessRes] = await Promise.all([
        api.getAdminUsers(),
        api.getAssessments({ all_users: true }),
      ]);
      setUsers(usersRes || []);
      setAssessments(assessRes || []);
    } catch (err: any) {
      console.error("Failed to load analyst workload data:", err);
      setError(err?.message || "Failed to load analyst telemetry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkloadData();
    loadRequests();
  }, [loadWorkloadData, loadRequests]);

  // Action handlers
  const handleApprove = async () => {
    if (!approveConfirmTarget) return;
    try {
      setActionLoading(true);
      await api.approveAnalyst(approveConfirmTarget.uid);
      toast.success(
        "Application Approved",
        `Analyst access granted to ${approveConfirmTarget.name || approveConfirmTarget.email}.`
      );
      setApproveConfirmTarget(null);
      if (selectedRequest?.uid === approveConfirmTarget.uid) {
        setSelectedRequest(null);
      }
      loadRequests();
      loadWorkloadData();
    } catch (err: any) {
      toast.error("Approval Failed", err?.message || "Failed to approve analyst.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    if (!rejectionReason.trim()) {
      toast.error("Reason Required", "A clear rejection reason is mandatory.");
      return;
    }
    try {
      setActionLoading(true);
      await api.rejectAnalyst(rejectTarget.uid, rejectionReason.trim());
      toast.success(
        "Application Rejected",
        `Application for ${rejectTarget.name || rejectTarget.email} has been rejected.`
      );
      setRejectTarget(null);
      setRejectionReason("");
      if (selectedRequest?.uid === rejectTarget.uid) {
        setSelectedRequest(null);
      }
      loadRequests();
    } catch (err: any) {
      toast.error("Rejection Failed", err?.message || "Failed to reject analyst.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspend = async () => {
    if (!suspendTarget) return;
    try {
      setActionLoading(true);
      await api.suspendAnalyst(suspendTarget.uid);
      toast.warning(
        "Analyst Suspended",
        `Underwriting privileges revoked for ${suspendTarget.name || suspendTarget.email}.`
      );
      setSuspendTarget(null);
      if (selectedRequest?.uid === suspendTarget.uid) {
        setSelectedRequest(null);
      }
      loadRequests();
      loadWorkloadData();
    } catch (err: any) {
      toast.error("Suspension Failed", err?.message || "Failed to suspend analyst.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!reactivateTarget) return;
    try {
      setActionLoading(true);
      await api.reactivateAnalyst(reactivateTarget.uid);
      toast.success(
        "Analyst Reactivated",
        `Underwriting access restored for ${reactivateTarget.name || reactivateTarget.email}.`
      );
      setReactivateTarget(null);
      if (selectedRequest?.uid === reactivateTarget.uid) {
        setSelectedRequest(null);
      }
      loadRequests();
      loadWorkloadData();
    } catch (err: any) {
      toast.error("Reactivation Failed", err?.message || "Failed to reactivate analyst.");
    } finally {
      setActionLoading(false);
    }
  };

  // Derive analysts & workload
  const analysts = useMemo(() => {
    const analystUsers = users.filter(
      (u) => (u.role || "").toLowerCase() === "analyst"
    );

    const targetPool =
      analystUsers.length > 0
        ? analystUsers
        : users.filter((u) => (u.role || "").toLowerCase() === "admin");

    return targetPool.map((u): AnalystWorkload => {
      const emailLower = (u.email || "").toLowerCase();
      const reviewed = assessments.filter(
        (a) =>
          a.reviewed_by &&
          (a.reviewed_by.toLowerCase() === emailLower ||
            a.reviewed_by.toLowerCase().includes(u.uid.toLowerCase()))
      );

      const completed = reviewed.filter(
        (a) => a.review_status === "approved" || a.review_status === "rejected"
      ).length;

      const pendingCount = assessments.filter(
        (a) => (a.review_status || "pending") === "pending" || a.review_status === "in_review"
      ).length;

      const assignedPending = Math.round(pendingCount / Math.max(1, targetPool.length));

      return {
        uid: u.uid,
        name: u.name || u.email.split("@")[0],
        email: u.email,
        status: "Active",
        pendingReviews: assignedPending,
        completedReviews: completed,
        totalAssigned: assignedPending + completed,
      };
    });
  }, [users, assessments]);

  // Overall KPIs
  const pendingRequestsCount = requests.filter(
    (r) => r.approval_status === "pending_admin_approval" || r.approval_status === "pending_email_verification"
  ).length;

  const totalPendingQueue = assessments.filter(
    (a) => (a.review_status || "pending") === "pending" || a.review_status === "in_review"
  ).length;

  const totalCompleted = assessments.filter(
    (a) => a.review_status === "approved" || a.review_status === "rejected"
  ).length;

  const getStatusBadge = (status: string, verified: boolean) => {
    switch (status) {
      case "pending_email_verification":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3" /> Awaiting Email Verification
          </span>
        );
      case "pending_admin_approval":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#8B5CF6]/10 text-[#A78BFA] border border-[#8B5CF6]/30">
            <Clock className="w-3 h-3" /> Pending Approval
          </span>
        );
      case "approved":
      case "active":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> Approved & Active
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      case "suspended":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-500/20 text-slate-400 border border-slate-500/40">
            <AlertTriangle className="w-3 h-3" /> Suspended
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-700 text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0C0A1D] text-slate-100 font-sans">
      <Sidebar active="Analysts" />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title="Analyst Management & Access Control"
          subtitle="Review access applications, grant underwriting credentials, and monitor risk reviewer workload."
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Analysts" },
          ]}
        />

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#1C1933] border border-[#383154] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 font-display">Analyst Applications</span>
                <Briefcase className="w-4 h-4 text-[#A78BFA]" />
              </div>
              <div className="text-2xl font-bold text-white font-mono-numeric tabular-nums">{requests.length}</div>
              <div className="text-[11px] text-amber-400 mt-1 font-mono-numeric tabular-nums">
                {pendingRequestsCount} Pending Review
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#1C1933] border border-[#383154] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 font-display">Active Underwriters</span>
                <Users className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400 font-mono-numeric tabular-nums">{analysts.length}</div>
              <div className="text-[11px] text-slate-400 mt-1">Authorized Reviewers</div>
            </div>

            <div className="p-4 rounded-xl bg-[#1C1933] border border-[#383154] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 font-display">Pending Review Queue</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-400 font-mono-numeric tabular-nums">{totalPendingQueue}</div>
              <div className="text-[11px] text-slate-400 mt-1">Assessments in Queue</div>
            </div>

            <div className="p-4 rounded-xl bg-[#1C1933] border border-[#383154] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 font-display">Completed Decisions</span>
                <CheckCircle2 className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-purple-300 font-mono-numeric tabular-nums">{totalCompleted}</div>
              <div className="text-[11px] text-slate-400 mt-1">Total Approvals / Declines</div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-[#383154] space-x-8">
            <button
              onClick={() => setActiveTab("requests")}
              className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
                activeTab === "requests"
                  ? "border-[#8B5CF6] text-[#C4B5FD] font-display"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Analyst Access Requests</span>
              {pendingRequestsCount > 0 && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#8B5CF6]/10 text-[#C4B5FD] border border-[#8B5CF6]/25 font-mono-numeric tabular-nums">
                  {pendingRequestsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("workload")}
              className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
                activeTab === "workload"
                  ? "border-[#8B5CF6] text-[#C4B5FD] font-display"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Workload & Telemetry</span>
            </button>
          </div>

          {/* TAB 1: ANALYST ACCESS REQUESTS */}
          {activeTab === "requests" && (
            <div className="space-y-4">
              {/* Controls bar: Filters + Search */}
              <div className="p-4 rounded-xl bg-[#1C1933] border border-[#383154] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium mr-1 flex items-center gap-1 font-display">
                    <Filter className="w-3.5 h-3.5" /> Filter:
                  </span>
                  {(["all", "pending", "approved", "rejected", "suspended"] as StatusFilterType[]).map(
                    (st) => (
                      <button
                        key={st}
                        onClick={() => setStatusFilter(st)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                          statusFilter === st
                            ? "bg-[#8B5CF6] text-[#0C0A1D] shadow-sm font-bold"
                            : "bg-[#1C1933] text-slate-300 hover:text-white border border-[#383154] hover:bg-[#252141]"
                        }`}
                      >
                        {st}
                      </button>
                    )
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search applicant or org..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-[#1C1933] border border-[#383154] text-white text-xs rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-[#8B5CF6] placeholder-slate-500"
                    />
                  </div>

                  <button
                    onClick={loadRequests}
                    disabled={requestsLoading}
                    className="p-2 rounded-lg bg-[#1C1933] border border-[#383154] text-slate-300 hover:text-white hover:border-[#8B5CF6]/40 hover:bg-[#252141] transition disabled:opacity-50"
                    title="Refresh requests"
                  >
                    <RefreshCw className={`w-4 h-4 ${requestsLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {/* Requests Table */}
              <div className="rounded-xl bg-[#1C1933] border border-[#383154] overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
                <div className="p-4 bg-[#1C1933] border-b border-[#383154] flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display">
                    Application Submissions ({requests.length})
                  </h3>
                  <span className="text-xs text-slate-400 font-medium">Authorized Admin Decision Engine</span>
                </div>

                {requestsLoading ? (
                  <div className="py-16 flex justify-center">
                    <LoadingSpinner text="Loading analyst applications..." />
                  </div>
                ) : requests.length === 0 ? (
                  <div className="py-16 text-center">
                    <EmptyState
                      title="No Applications Found"
                      description={`No analyst access applications match the current filter (${statusFilter}).`}
                    />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                      <thead className="bg-[#1C1933] text-[11px] uppercase tracking-wider text-slate-400 border-b border-[#383154] font-display">
                        <tr>
                          <th className="py-3 px-4">Applicant</th>
                          <th className="py-3 px-4">Email Verification</th>
                          <th className="py-3 px-4">Organization</th>
                          <th className="py-3 px-4">Qualifications</th>
                          <th className="py-3 px-4">Experience</th>
                          <th className="py-3 px-4">Applied Date</th>
                          <th className="py-3 px-4">Approval Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#383154]">
                        {requests.map((r) => {
                          const isPending =
                            r.approval_status === "pending_admin_approval" ||
                            r.approval_status === "pending_email_verification";
                          const isApproved = r.approval_status === "approved" || r.approval_status === "active";
                          const isSuspended = r.approval_status === "suspended";

                          return (
                            <tr key={r.uid} className="hover:bg-[#1C1933]/50 transition-colors">
                              <td className="py-3.5 px-4 font-semibold text-white">
                                <div>{r.name || "Risk Analyst"}</div>
                                <div className="text-xs text-slate-400 font-normal font-mono-numeric">{r.email}</div>
                              </td>

                              <td className="py-3.5 px-4">
                                {r.email_verified ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                                    <ShieldCheck className="w-3.5 h-3.5" /> Verified
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs text-amber-400 font-medium">
                                    <Clock className="w-3.5 h-3.5" /> Unverified
                                  </span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 text-xs text-slate-300">
                                {r.organization || "Independent Underwriter"}
                              </td>

                              <td className="py-3.5 px-4 text-xs font-mono-numeric text-[#C4B5FD] font-medium">
                                {r.qualifications || "Not specified"}
                              </td>

                              <td className="py-3.5 px-4 text-xs text-slate-300 font-mono-numeric tabular-nums">
                                {r.experience_years || "3-5 years"}
                              </td>

                              <td className="py-3.5 px-4 text-xs text-slate-400 font-mono-numeric tabular-nums">
                                {new Date(r.created_at).toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </td>

                              <td className="py-3.5 px-4">
                                {getStatusBadge(r.approval_status, r.email_verified)}
                              </td>

                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => setSelectedRequest(r)}
                                    className="p-1.5 rounded-lg bg-[#1C1933] hover:bg-[#252141] border border-[#383154] text-slate-300 hover:text-white transition"
                                    title="View Full Application"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>

                                  {isPending && (
                                    <>
                                      <button
                                        onClick={() => setApproveConfirmTarget(r)}
                                        className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 transition"
                                        title="Approve Application"
                                      >
                                        <Check className="w-4 h-4" />
                                      </button>

                                      <button
                                        onClick={() => {
                                          setRejectTarget(r);
                                          setRejectionReason("");
                                        }}
                                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 transition"
                                        title="Reject Application"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}

                                  {isApproved && (
                                    <button
                                      onClick={() => setSuspendTarget(r)}
                                      className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 transition text-xs flex items-center gap-1"
                                      title="Suspend Analyst"
                                    >
                                      <UserX className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  {isSuspended && (
                                    <button
                                      onClick={() => setReactivateTarget(r)}
                                      className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 transition text-xs flex items-center gap-1"
                                      title="Reactivate Analyst"
                                    >
                                      <UserCheck className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: WORKLOAD & TELEMETRY */}
          {activeTab === "workload" && (
            <div className="space-y-6">
              {/* Workload Distribution Visual Bars */}
              <div className="p-5 rounded-xl bg-[#1C1933] border border-[#383154] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#A78BFA]" />
                    <h3 className="text-sm font-bold text-white font-display">Underwriting Queue Distribution</h3>
                  </div>
                  <button
                    onClick={loadWorkloadData}
                    className="p-1.5 rounded-lg bg-[#1C1933] border border-[#383154] text-slate-300 hover:text-white hover:border-[#8B5CF6]/40 hover:bg-[#252141] transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {loading ? (
                  <div className="py-12 flex justify-center">
                    <LoadingSpinner text="Analyzing underwriter workloads..." />
                  </div>
                ) : error ? (
                  <EmptyState title="Workload Data Unavailable" description={error} />
                ) : analysts.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No active underwriter accounts found on the platform.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {analysts.map((a) => {
                      const maxPending = Math.max(1, ...analysts.map((x) => x.pendingReviews));
                      const pct = Math.min(100, Math.round((a.pendingReviews / maxPending) * 100));

                      return (
                        <div
                          key={a.uid}
                          className="p-3.5 rounded-lg bg-[#1C1933] border border-[#383154] space-y-2"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 flex items-center justify-center font-bold text-xs">
                                {a.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <strong className="text-white text-xs font-semibold">{a.name}</strong>
                                <span className="text-slate-400 text-[11px] block font-mono-numeric">{a.email}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 text-right font-mono-numeric tabular-nums">
                              <div>
                                <span className="text-amber-400 font-bold block">{a.pendingReviews} pending</span>
                                <span className="text-[10px] text-slate-400">{a.completedReviews} completed</span>
                              </div>
                            </div>
                          </div>

                          <div className="w-full h-1.5 rounded-full bg-[#1C1933] border border-[#383154] overflow-hidden">
                            <div
                              style={{ width: `${Math.max(8, pct)}%` }}
                              className="h-full bg-[#8B5CF6] rounded-full transition-all duration-500"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Detailed Registered Underwriters Table */}
              <div className="rounded-xl bg-[#1C1933] border border-[#383154] overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
                <div className="p-4 bg-[#1C1933] border-b border-[#383154] flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display">
                    Registered Risk Underwriters
                  </h3>
                  <span className="text-xs text-slate-400 font-mono-numeric tabular-nums">{analysts.length} active analysts</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-[#1C1933] text-[11px] uppercase tracking-wider text-slate-400 border-b border-[#383154] font-display">
                      <tr>
                        <th className="py-3 px-4">Analyst Name</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Assigned Reviews</th>
                        <th className="py-3 px-4">Completed Reviews</th>
                        <th className="py-3 px-4">Pending Queue</th>
                        <th className="py-3 px-4 text-right">Avg. Review Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#383154]">
                      {analysts.map((a) => (
                        <tr key={a.uid} className="hover:bg-[#1C1933]/50 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-white">{a.name}</td>
                          <td className="py-3.5 px-4 text-xs text-slate-400 font-mono-numeric">{a.email}</td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              {a.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-semibold text-slate-200 font-mono-numeric tabular-nums">
                            {a.totalAssigned}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-semibold text-emerald-400 font-mono-numeric tabular-nums">
                            {a.completedReviews}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-semibold text-amber-400 font-mono-numeric tabular-nums">
                            {a.pendingReviews}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-400 text-right font-mono-numeric tabular-nums">
                            ~2.4 hrs
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL 1: Application Detail Drawer / Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl bg-[#1C1933] border border-[#383154] rounded-2xl shadow-2xl p-6 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#383154] pb-4 mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#A78BFA]" />
                <h3 className="text-base font-bold text-white font-display">Analyst Application Dossier</h3>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              <div className="p-4 rounded-xl bg-[#1C1933] border border-[#383154] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Applicant Name:</span>
                  <span className="text-white font-semibold">{selectedRequest.name || "Risk Analyst"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Email Address:</span>
                  <span className="font-mono-numeric text-[#A78BFA] font-medium">{selectedRequest.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Email Ownership:</span>
                  <span className="font-semibold">{selectedRequest.email_verified ? "Verified ✓" : "Unverified ⚠"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Phone Number:</span>
                  <span className="text-slate-200 font-mono-numeric">{selectedRequest.phone || "Not provided"}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#1C1933] border border-[#383154] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Organization / Institution:</span>
                  <span className="text-slate-200 font-medium">
                    {selectedRequest.organization || "Independent Underwriter"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Professional Qualifications:</span>
                  <span className="font-mono-numeric text-[#C4B5FD] font-medium">
                    {selectedRequest.qualifications || "Not specified"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Credit Risk Experience:</span>
                  <span className="text-slate-200 font-mono-numeric tabular-nums">{selectedRequest.experience_years || "3-5 years"}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#1C1933] border border-[#383154] space-y-2">
                <span className="text-slate-400 block font-medium">Reason for Requesting Analyst Access:</span>
                <p className="text-slate-200 leading-relaxed bg-[#1C1933] p-3 rounded-lg border border-[#383154]">
                  {selectedRequest.application_reason || "Standard institutional credit risk analysis."}
                </p>
              </div>

              {selectedRequest.rejection_reason && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300">
                  <span className="font-semibold block mb-1">Prior Rejection Reason:</span>
                  <p>{selectedRequest.rejection_reason}</p>
                </div>
              )}
            </div>

            <div className="border-t border-[#383154] pt-4 mt-4 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedRequest(null)}
              >
                Close
              </Button>

              {(selectedRequest.approval_status === "pending_admin_approval" ||
                selectedRequest.approval_status === "pending_email_verification") && (
                <>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setRejectTarget(selectedRequest);
                      setRejectionReason("");
                    }}
                  >
                    Reject Application
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setApproveConfirmTarget(selectedRequest)}
                  >
                    Approve Analyst Access
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Approve Confirmation */}
      {approveConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#1C1933] border border-[#383154] rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-3 text-emerald-400 mb-3">
              <UserCheck className="w-6 h-6" />
              <h3 className="text-base font-bold text-white font-display">Confirm Analyst Approval</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Are you sure you want to approve analyst access for{" "}
              <strong className="text-white">{approveConfirmTarget.name || approveConfirmTarget.email}</strong>?
              This will grant underwriting permissions, allow assessment reviews, and record your administrator ID in the authoritative audit trail.
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={actionLoading}
                onClick={() => setApproveConfirmTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={actionLoading}
                loadingText="Approving..."
                onClick={handleApprove}
              >
                Confirm Approval
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Reject Confirmation with REQUIRED Reason */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#1C1933] border border-rose-500/30 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <XCircle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white font-display">Reject Analyst Application</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Please provide a specific justification for rejecting the application of{" "}
              <strong className="text-white">{rejectTarget.name || rejectTarget.email}</strong>.
              This reason will be visible to the applicant and recorded in the audit logs.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Rejection Reason (Required)
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Insufficient underwriting credentials, unverified financial institution..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full bg-[#1C1933] border border-rose-500/40 text-white text-xs rounded-xl p-3 focus:outline-none focus:border-rose-500 placeholder-slate-500"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={actionLoading}
                onClick={() => {
                  setRejectTarget(null);
                  setRejectionReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={actionLoading}
                loadingText="Rejecting..."
                onClick={handleReject}
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Suspend Analyst Confirmation */}
      {suspendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#1C1933] border border-amber-500/30 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-3 text-amber-400 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white font-display">Suspend Analyst Privileges</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Temporarily revoke underwriting access for{" "}
              <strong className="text-white">{suspendTarget.name || suspendTarget.email}</strong>?
              The analyst will not be able to access the review workspace until reactivated.
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={actionLoading}
                onClick={() => setSuspendTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={actionLoading}
                loadingText="Suspending..."
                onClick={handleSuspend}
              >
                Confirm Suspension
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Reactivate Analyst Confirmation */}
      {reactivateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#1C1933] border border-emerald-500/30 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-3 text-emerald-400 mb-3">
              <UserCheck className="w-6 h-6" />
              <h3 className="text-base font-bold text-white font-display">Reactivate Analyst</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Restore underwriting access for{" "}
              <strong className="text-white">{reactivateTarget.name || reactivateTarget.email}</strong>?
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={actionLoading}
                onClick={() => setReactivateTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={actionLoading}
                loadingText="Reactivating..."
                onClick={handleReactivate}
              >
                Confirm Reactivation
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
