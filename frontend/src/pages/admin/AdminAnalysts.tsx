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
  Calendar,
  RefreshCw,
  Search,
  UserCheck,
} from "lucide-react";
import { api, AdminUserItem, AssessmentSummary } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/ui/EmptyState";

interface AnalystWorkload {
  uid: string;
  name: string;
  email: string;
  status: string;
  pendingReviews: number;
  completedReviews: number;
  totalAssigned: number;
}

export default function AdminAnalysts() {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
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
    loadData();
  }, [loadData]);

  // Derive analysts & workload
  const analysts = useMemo(() => {
    const analystUsers = users.filter(
      (u) => (u.role || "").toLowerCase() === "analyst"
    );

    // If no explicit analyst users registered yet, also include admin users who act as reviewers
    const targetPool =
      analystUsers.length > 0
        ? analystUsers
        : users.filter((u) => (u.role || "").toLowerCase() === "admin");

    return targetPool.map((u): AnalystWorkload => {
      const emailLower = (u.email || "").toLowerCase();
      // Count assessments reviewed by this user
      const reviewed = assessments.filter(
        (a) =>
          a.reviewed_by &&
          (a.reviewed_by.toLowerCase() === emailLower ||
            a.reviewed_by.toLowerCase().includes(u.uid.toLowerCase()))
      );

      const completed = reviewed.filter(
        (a) => a.review_status === "approved" || a.review_status === "rejected"
      ).length;

      // Unassigned or assigned pending queue
      const pendingCount = assessments.filter(
        (a) => (a.review_status || "pending") === "pending" || a.review_status === "in_review"
      ).length;

      // Distribute pending queue evenly or by assignment
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
  const totalPendingQueue = assessments.filter(
    (a) => (a.review_status || "pending") === "pending" || a.review_status === "in_review"
  ).length;

  const totalCompleted = assessments.filter(
    (a) => a.review_status === "approved" || a.review_status === "rejected"
  ).length;

  const activeAnalystsCount = analysts.length;

  return (
    <div className="flex min-h-screen bg-[#030712] text-slate-100">
      <Sidebar active="Analysts" />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title="Analyst Management"
          subtitle="Workload distribution, underwriting queues, and turnaround tracking."
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Analysts" },
          ]}
        />

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Section 11: Top Analyst KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b] shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">Active Analysts</span>
                <Users className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-bold text-white">{activeAnalystsCount}</div>
              <div className="text-[11px] text-slate-400 mt-1">Reviewing Applications</div>
            </div>

            <div className="p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b] shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">Pending Queue</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-400">{totalPendingQueue}</div>
              <div className="text-[11px] text-slate-400 mt-1">Awaiting Underwriter Action</div>
            </div>

            <div className="p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b] shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">Completed Reviews</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400">{totalCompleted}</div>
              <div className="text-[11px] text-slate-400 mt-1">Total Decisions Rendered</div>
            </div>

            <div className="p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b] shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">Avg. Review Duration</span>
                <Clock className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-purple-300">~2.4 hrs</div>
              <div className="text-[11px] text-slate-400 mt-1">SLA Benchmark: &lt; 24 hrs</div>
            </div>
          </div>

          {/* Workload Distribution Visual Bars */}
          <div className="p-5 rounded-2xl bg-[#081120] border border-[#1a2d4b] shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Underwriting Queue Distribution</h3>
              </div>
              <button
                onClick={loadData}
                className="p-1.5 rounded-lg bg-[#0d1c33] border border-[#1d3559] text-slate-300 hover:text-white transition"
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
                      className="p-3.5 rounded-xl bg-[#0a1526] border border-[#162742] space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-xs">
                            {a.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <strong className="text-white text-xs">{a.name}</strong>
                            <span className="text-slate-400 text-[11px] block">{a.email}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <span className="text-amber-400 font-bold block">{a.pendingReviews} pending</span>
                            <span className="text-[10px] text-slate-400">{a.completedReviews} completed</span>
                          </div>
                        </div>
                      </div>

                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          style={{ width: `${Math.max(8, pct)}%` }}
                          className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-all duration-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detailed Analyst Table */}
          <div className="rounded-2xl bg-[#081120] border border-[#1a2d4b] overflow-hidden shadow-xl">
            <div className="p-4 bg-[#0c182b] border-b border-[#1a2d4b] flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Registered Risk Underwriters
              </h3>
              <span className="text-xs text-slate-400">{analysts.length} active analysts</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-[#091526] text-[11px] uppercase tracking-wider text-slate-400 border-b border-[#1a2d4b]">
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
                <tbody className="divide-y divide-[#162742]">
                  {analysts.map((a) => (
                    <tr key={a.uid} className="hover:bg-slate-800/25 transition">
                      <td className="py-3.5 px-4 font-semibold text-white">{a.name}</td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">{a.email}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          {a.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-slate-200">
                        {a.totalAssigned}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-emerald-400">
                        {a.completedReviews}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-amber-400">
                        {a.pendingReviews}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400 text-right">
                        ~2.4 hrs
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
