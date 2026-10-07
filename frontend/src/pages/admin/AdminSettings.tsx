import { useEffect, useState, useCallback } from "react";
import Sidebar from "../../components/Sidebar";
import AdminHeader from "./AdminHeader";
import {
  Settings,
  Server,
  KeyRound,
  Cpu,
  FileText,
  Bell,
  ShieldCheck,
  CheckCircle2,
  Lock,
  RefreshCw,
  HardDrive,
  Activity,
  Layers,
} from "lucide-react";
import { api } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/ui/EmptyState";

interface SystemConfigItem {
  name: string;
  category: "Application" | "Authentication" | "AI/ML" | "OCR" | "Notifications" | "Security";
  status: "Configured" | "Active" | "Disabled" | "Protected";
  description: string;
  badgeType: "emerald" | "cyan" | "purple" | "blue";
}

export default function AdminSettings() {
  const [health, setHealth] = useState<any>(null);
  const [readiness, setReadiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [h, r] = await Promise.all([api.getHealth(), api.getReadiness()]);
      setHealth(h);
      setReadiness(r);
    } catch (err: any) {
      console.error("Failed to load system settings:", err);
      setError(err?.message || "Failed to load system settings configuration.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const configItems: SystemConfigItem[] = [
    // 1. Application
    {
      name: "API Host Runtime",
      category: "Application",
      status: "Active",
      description: `FastAPI production engine (${health?.environment || "production"}). Model v${health?.version || "1.1.0"}.`,
      badgeType: "emerald",
    },
    {
      name: "Primary Database",
      category: "Application",
      status: "Active",
      description: `PostgreSQL transactional engine via SQLAlchemy. Connection pool active.`,
      badgeType: "emerald",
    },
    // 2. Authentication
    {
      name: "Firebase Authentication",
      category: "Authentication",
      status: "Configured",
      description: "Cryptographic JWT ID token verification with client-side session refresh.",
      badgeType: "purple",
    },
    {
      name: "Role-Based Access Control (RBAC)",
      category: "Authentication",
      status: "Active",
      description: "Strict authoritative backend enforcement (user, analyst, admin).",
      badgeType: "purple",
    },
    // 3. AI/ML
    {
      name: "Risk Scoring Model",
      category: "AI/ML",
      status: "Configured",
      description: `Gradient-boosted decision trees (XGBoost 1.1.0). Readiness status: ${readiness?.ml_model || "loaded"}.`,
      badgeType: "cyan",
    },
    {
      name: "SHAP Explainability Engine",
      category: "AI/ML",
      status: "Active",
      description: "TreeSHAP feature importance computation for positive and negative credit factors.",
      badgeType: "cyan",
    },
    {
      name: "What-If Simulator",
      category: "AI/ML",
      status: "Active",
      description: "Real-time non-persistent scenario simulation for cash flow and revenue stress testing.",
      badgeType: "cyan",
    },
    // 4. OCR
    {
      name: "Document AI Ingestion Pipeline",
      category: "OCR",
      status: "Configured",
      description: "Automated balance sheet and P&L financial table field extraction.",
      badgeType: "blue",
    },
    {
      name: "Isolated Object Storage",
      category: "OCR",
      status: "Protected",
      description: "Private bucket storage with time-limited signed download URLs.",
      badgeType: "blue",
    },
    // 5. Notifications
    {
      name: "In-App Notification Dispatcher",
      category: "Notifications",
      status: "Active",
      description: "Real-time user alerts for risk threshold breaches and review approvals.",
      badgeType: "emerald",
    },
    // 6. Security
    {
      name: "Tenant Isolation & IDOR Guards",
      category: "Security",
      status: "Protected",
      description: "Database queries filtered strictly by authenticated UID for non-privileged roles.",
      badgeType: "purple",
    },
    {
      name: "Sliding-Window Rate Limiting",
      category: "Security",
      status: "Active",
      description: "DDoS and credential stuffing protection applied to mutating POST/PUT routes.",
      badgeType: "emerald",
    },
    {
      name: "Security HTTP Headers",
      category: "Security",
      status: "Active",
      description: "Strict-Transport-Security, X-Frame-Options, X-Content-Type-Options enforced.",
      badgeType: "emerald",
    },
  ];

  const categories = [
    "Application",
    "Authentication",
    "AI/ML",
    "OCR",
    "Notifications",
    "Security",
  ] as const;

  return (
    <div className="flex min-h-screen bg-[#030712] text-slate-100">
      <Sidebar active="System Settings" />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title="System Settings"
          subtitle="Platform infrastructure parameters, integrations, and security enforcement."
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Settings" },
          ]}
        />

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Security Notice Banner */}
          <div className="p-4 rounded-2xl bg-[#0a172a] border border-[#1e3458] flex items-start gap-3">
            <Lock className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="text-white block font-semibold mb-0.5">
                Zero-Credential Exposure Policy
              </strong>
              <p className="text-slate-400 leading-relaxed">
                To prevent secret leaks and maintain strict enterprise compliance, private API keys, database credentials, and service-role tokens are never rendered in the interface. Only operational health and configuration statuses are displayed below.
              </p>
            </div>
          </div>

          {/* Configuration Categories */}
          {loading ? (
            <div className="py-20 flex justify-center">
              <LoadingSpinner text="Reading environment settings..." />
            </div>
          ) : error ? (
            <EmptyState
              title="Failed to load settings"
              description={error}
              actionLabel="Retry"
              onAction={loadSettings}
            />
          ) : (
            <div className="space-y-6">
              {categories.map((cat) => {
                const items = configItems.filter((i) => i.category === cat);
                if (items.length === 0) return null;

                return (
                  <div
                    key={cat}
                    className="p-5 rounded-2xl bg-[#081120] border border-[#1a2d4b] shadow-md space-y-3"
                  >
                    <div className="flex items-center gap-2 pb-2 border-b border-[#1a2d4b]">
                      {cat === "Application" ? (
                        <Server className="w-4 h-4 text-cyan-400" />
                      ) : cat === "Authentication" ? (
                        <KeyRound className="w-4 h-4 text-purple-400" />
                      ) : cat === "AI/ML" ? (
                        <Cpu className="w-4 h-4 text-indigo-400" />
                      ) : cat === "OCR" ? (
                        <FileText className="w-4 h-4 text-blue-400" />
                      ) : cat === "Notifications" ? (
                        <Bell className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <ShieldCheck className="w-4 h-4 text-purple-400" />
                      )}
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        {cat} Configuration
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {items.map((item) => (
                        <div
                          key={item.name}
                          className="p-3.5 rounded-xl bg-[#0c182b] border border-[#162742] flex flex-col justify-between space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-white">
                              {item.name}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                item.badgeType === "emerald"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                  : item.badgeType === "cyan"
                                  ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                                  : item.badgeType === "purple"
                                  ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                                  : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  item.badgeType === "emerald"
                                    ? "bg-emerald-400"
                                    : item.badgeType === "cyan"
                                    ? "bg-cyan-400"
                                    : item.badgeType === "purple"
                                    ? "bg-purple-400"
                                    : "bg-blue-400"
                                }`}
                              />
                              {item.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
