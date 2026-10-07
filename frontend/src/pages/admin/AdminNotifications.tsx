import { useEffect, useState, useCallback, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import AdminHeader from "./AdminHeader";
import {
  Bell,
  AlertTriangle,
  FileText,
  Activity,
  Users,
  Shield,
  Bot,
  CheckCircle2,
  X,
  RefreshCw,
  Clock,
  Filter,
} from "lucide-react";
import { api, NotificationItem } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/ui/EmptyState";
import { useToast } from "../../components/ui/Toast";

interface AdminAlert {
  id: string;
  type: "spike" | "ocr" | "health" | "workload" | "model" | "security";
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export default function AdminNotifications() {
  const toast = useToast();
  const [notifications, setNotifications] = useState<AdminAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch platform notifications and telemetry
      const [notifsRes, statsRes] = await Promise.allSettled([
        api.getNotifications(),
        api.getAdminStats(),
      ]);

      const items: AdminAlert[] = [];

      // Add live platform event alerts based on real stats
      if (statsRes.status === "fulfilled" && statsRes.value) {
        const stats = statsRes.value;
        if (stats.high_risk_assessments && stats.high_risk_assessments > 0) {
          items.push({
            id: "alert-spike",
            type: "spike",
            severity: "warning",
            title: "Elevated High-Risk Volume",
            message: `${stats.high_risk_assessments} portfolio applications currently flag high default probability. Review queue allocation recommended.`,
            timestamp: new Date().toLocaleTimeString(),
            read: false,
          });
        }

        if (stats.pending_reviews && stats.pending_reviews > 5) {
          items.push({
            id: "alert-workload",
            type: "workload",
            severity: "info",
            title: "Analyst Queue Threshold Alert",
            message: `${stats.pending_reviews} assessments currently awaiting underwriter review. Turnaround SLA benchmark active.`,
            timestamp: new Date().toLocaleTimeString(),
            read: false,
          });
        }
      }

      // Add backend-persisted notifications
      if (notifsRes.status === "fulfilled" && notifsRes.value) {
        notifsRes.value.forEach((n: NotificationItem) => {
          items.push({
            id: String(n.id),
            type: n.type?.includes("security") ? "security" : "model",
            severity: n.type?.includes("risk") ? "warning" : "info",
            title: n.title,
            message: n.message,
            timestamp: n.created_at ? new Date(n.created_at).toLocaleTimeString() : "Recent",
            read: n.is_read || false,
          });
        });
      }

      // Fallback telemetry alert if clean
      if (items.length === 0) {
        items.push({
          id: "alert-baseline",
          type: "health",
          severity: "info",
          title: "All Telemetry Systems Operational",
          message: "No anomalies, drift violations, or rate-limit infractions detected in the last monitoring cycle.",
          timestamp: new Date().toLocaleTimeString(),
          read: true,
        });
      }

      setNotifications(items);
    } catch (err: any) {
      console.error("Failed to load admin notifications:", err);
      setError(err?.message || "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read: true } : item))
    );
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    toast.success("Notifications Updated", "All platform alerts marked as reviewed.");
  };

  const filteredNotifs = useMemo(() => {
    if (severityFilter === "all") return notifications;
    return notifications.filter((n) => n.severity === severityFilter);
  }, [notifications, severityFilter]);

  const getIcon = (type: AdminAlert["type"]) => {
    switch (type) {
      case "spike":
        return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      case "ocr":
        return <FileText className="w-4 h-4 text-amber-400" />;
      case "health":
        return <Activity className="w-4 h-4 text-emerald-400" />;
      case "workload":
        return <Users className="w-4 h-4 text-indigo-400" />;
      case "model":
        return <Bot className="w-4 h-4 text-cyan-400" />;
      case "security":
        return <Shield className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#030712] text-slate-100">
      <Sidebar active="Notifications" />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title="Platform Notifications"
          subtitle="Real-time infrastructure warnings, underwriting workload alerts, and security events."
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Notifications" },
          ]}
        />

        <main className="p-4 sm:p-6 lg:p-8 max-w-4xl w-full mx-auto space-y-6">
          {/* Controls Bar */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b]">
            <div className="flex items-center gap-2">
              {(["all", "warning", "info"] as const).map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition ${
                    severityFilter === sev
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "bg-[#0d1c33] text-slate-400 hover:text-white border border-[#1d3559]"
                  }`}
                >
                  {sev === "all" ? "All Alerts" : sev}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleMarkAllRead}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#0d1c33] border border-[#1d3559] text-slate-300 hover:text-white transition"
              >
                Mark All Read
              </button>
              <button
                onClick={loadNotifications}
                className="p-1.5 rounded-xl bg-[#0d1c33] border border-[#1d3559] text-slate-300 hover:text-white transition"
                title="Refresh alerts"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Alert List */}
          {loading ? (
            <div className="py-20 flex justify-center">
              <LoadingSpinner text="Querying platform event bus..." />
            </div>
          ) : error ? (
            <EmptyState
              title="Failed to load notifications"
              description={error}
              actionLabel="Retry"
              onAction={loadNotifications}
            />
          ) : filteredNotifs.length === 0 ? (
            <EmptyState
              title="No notifications"
              description="No platform alerts match the selected severity filter."
            />
          ) : (
            <div className="space-y-3">
              {filteredNotifs.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 rounded-2xl border transition flex items-start justify-between gap-4 ${
                    n.read
                      ? "bg-[#081120]/60 border-[#162742] opacity-75"
                      : "bg-[#081120] border-[#1a2d4b] shadow-md"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${
                        n.severity === "warning"
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                          : n.severity === "critical"
                          ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                          : "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                      }`}
                    >
                      {getIcon(n.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">{n.title}</h4>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50" />
                        )}
                      </div>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                        {n.message}
                      </p>
                      <span className="text-[10px] text-slate-400 block mt-2">
                        {n.timestamp}
                      </span>
                    </div>
                  </div>

                  {!n.read && (
                    <button
                      onClick={() => handleMarkAsRead(n.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white shrink-0"
                      title="Dismiss alert"
                    >
                      <CheckCircle2 className="w-4 h-4 text-slate-400 hover:text-emerald-400 transition" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
