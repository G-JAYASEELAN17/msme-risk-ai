import { useEffect, useState, useCallback } from "react";
import Sidebar from "../../components/Sidebar";
import AdminHeader from "./AdminHeader";
import {
  Shield,
  Search,
  Filter,
  Calendar,
  Clock,
  User,
  Activity,
  X,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Code,
  CheckCircle2,
} from "lucide-react";
import { api, AuditLogItem } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/ui/EmptyState";

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [actionFilter, setActionFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const loadAuditLogs = useCallback(
    async (currentPage: number) => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.getAdminAuditLogs({
          page: currentPage,
          limit: 25,
          action: actionFilter.trim() || undefined,
          actor: actorFilter.trim() || undefined,
        });
        setLogs(res.items || []);
        setPage(res.page);
        setTotalPages(res.total_pages || 1);
        setTotalCount(res.total || 0);
      } catch (err: any) {
        console.error("Failed to load audit logs:", err);
        setError(err?.message || "Failed to load audit logs.");
      } finally {
        setLoading(false);
      }
    },
    [actionFilter, actorFilter]
  );

  useEffect(() => {
    loadAuditLogs(page);
  }, [page, loadAuditLogs]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadAuditLogs(1);
  };

  const handleClearFilters = () => {
    setActionFilter("");
    setActorFilter("");
    setPage(1);
  };

  const getActionBadgeClass = (action: string) => {
    const act = (action || "").toUpperCase();
    if (act.includes("ROLE") || act.includes("SECURITY") || act.includes("AUTH")) {
      return "bg-purple-500/10 text-purple-400 border-purple-500/30";
    }
    if (act.includes("APPROVED")) {
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    }
    if (act.includes("REJECTED") || act.includes("DELETE") || act.includes("FAILED")) {
      return "bg-rose-500/10 text-rose-400 border-rose-500/30";
    }
    if (act.includes("PREDICT") || act.includes("ASSESSMENT")) {
      return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
    }
    return "bg-slate-800 text-slate-300 border-slate-700";
  };

  return (
    <div className="flex min-h-screen bg-[#030712] text-slate-100">
      <Sidebar active="Audit Logs" />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title="Audit Logs"
          subtitle="Immutable audit trail of system authentication, reviews, mutations, and privileged events."
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Audit Logs" },
          ]}
        />

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Filter Bar */}
          <form
            onSubmit={handleFilterSubmit}
            className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b]"
          >
            <div className="flex flex-col sm:flex-row items-center gap-3 flex-1">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by action (e.g. ROLE)..."
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0d1c33] border border-[#1d3559] text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="relative w-full sm:w-64">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by actor UID..."
                  value={actorFilter}
                  onChange={(e) => setActorFilter(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0d1c33] border border-[#1d3559] text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                type="submit"
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white transition"
              >
                Apply Filter
              </button>

              {(actionFilter || actorFilter) && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => loadAuditLogs(page)}
              className="p-2 rounded-xl bg-[#0d1c33] border border-[#1d3559] text-slate-300 hover:text-white transition self-end sm:self-auto"
              title="Refresh audit logs"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </form>

          {/* Audit Trail Table */}
          {loading ? (
            <div className="py-20 flex justify-center">
              <LoadingSpinner text="Retrieving immutable audit records..." />
            </div>
          ) : error ? (
            <EmptyState
              title="Failed to load audit logs"
              description={error}
              actionLabel="Retry"
              onAction={() => loadAuditLogs(page)}
            />
          ) : logs.length === 0 ? (
            <EmptyState
              title="No audit events found"
              description="No audit trail events match your current filter criteria."
              actionLabel="Clear Filters"
              onAction={handleClearFilters}
            />
          ) : (
            <div className="rounded-2xl bg-[#081120] border border-[#1a2d4b] overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-[#0c182b] text-[11px] uppercase tracking-wider text-slate-400 border-b border-[#1a2d4b]">
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Actor UID</th>
                      <th className="py-3 px-4">Resource Type</th>
                      <th className="py-3 px-4">Resource ID</th>
                      <th className="py-3 px-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#162742]">
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-slate-800/25 transition cursor-pointer"
                        onClick={() => setSelectedLog(log)}
                      >
                        <td className="py-3.5 px-4 text-xs text-slate-400 whitespace-nowrap">
                          {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border uppercase font-mono ${getActionBadgeClass(
                              log.action
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-xs text-slate-300 truncate max-w-[140px]">
                          {log.user_id || "System"}
                        </td>

                        <td className="py-3.5 px-4 text-xs capitalize text-slate-300">
                          {log.resource_type || "—"}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-xs text-slate-400 truncate max-w-[120px]">
                          {log.resource_id ? `#${log.resource_id}` : "—"}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                            }}
                            className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
                          >
                            Inspect JSON
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination Footer */}
              <div className="p-3.5 bg-[#0c182b] border-t border-[#1a2d4b] text-xs text-slate-400 flex items-center justify-between">
                <div>
                  Showing {logs.length} of {totalCount} total audit events (Page {page} of {totalPages})
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-1.5 rounded-lg bg-[#0d1c33] border border-[#1d3559] text-slate-300 hover:text-white disabled:opacity-40 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded-lg bg-[#0d1c33] border border-[#1d3559] text-slate-300 hover:text-white disabled:opacity-40 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Audit Event Details Modal */}
          {selectedLog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
              <div className="relative w-full max-w-lg bg-[#081120] border border-[#1e3458] rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-[#1a2d4b]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">
                        Audit Event #{selectedLog.id}
                      </h3>
                      <p className="text-xs text-slate-400 font-mono">{selectedLog.action}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mt-4 space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-[#0c182b] border border-[#1a2d4b]">
                    <div>
                      <span className="text-slate-400 block">Actor UID:</span>
                      <span className="text-white font-mono">{selectedLog.user_id || "System"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Timestamp:</span>
                      <span className="text-white">
                        {selectedLog.created_at ? new Date(selectedLog.created_at).toISOString() : "—"}
                      </span>
                    </div>
                    <div className="mt-1">
                      <span className="text-slate-400 block">Resource Type:</span>
                      <span className="text-cyan-400 font-semibold">{selectedLog.resource_type}</span>
                    </div>
                    <div className="mt-1">
                      <span className="text-slate-400 block">Resource ID:</span>
                      <span className="text-white font-mono">{selectedLog.resource_id || "None"}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-1 font-semibold flex items-center gap-1.5">
                      <Code className="w-3.5 h-3.5 text-cyan-400" />
                      Payload Metadata Details:
                    </span>
                    <pre className="p-3 rounded-xl bg-[#050b14] border border-[#162742] text-[11px] text-cyan-300 font-mono overflow-x-auto max-h-60">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#1a2d4b] flex justify-end">
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 transition"
                  >
                    Close Log
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
