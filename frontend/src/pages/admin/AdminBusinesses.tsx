import { useEffect, useState, useCallback, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import AdminHeader from "./AdminHeader";
import {
  Building2,
  Search,
  Filter,
  MapPin,
  Calendar,
  FileText,
  FileCheck,
  TrendingUp,
  DollarSign,
  X,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Eye,
  Activity,
  Layers,
} from "lucide-react";
import { api, Business, BusinessDetails } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/ui/EmptyState";
import { useToast } from "../../components/ui/Toast";

export default function AdminBusinesses() {
  const toast = useToast();

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [industryFilter, setIndustryFilter] = useState("all");

  // Selected Business for Detail Inspection
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [businessDetail, setBusinessDetail] = useState<BusinessDetails | null>(null);

  const loadBusinesses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Admin gets all businesses across platform
      const res = await api.getBusinesses(true);
      setBusinesses(res || []);
    } catch (err: any) {
      console.error("Failed to load platform businesses:", err);
      setError(err?.message || "Failed to retrieve businesses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBusinesses();
  }, [loadBusinesses]);

  // Load detailed inspection when selectedId changes
  const handleInspectBusiness = async (id: number) => {
    try {
      setSelectedId(id);
      setDetailLoading(true);
      const details = await api.getBusinessDetails(id);
      setBusinessDetail(details);
    } catch (err: any) {
      toast.error("Failed to load business details", err?.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const industries = useMemo(() => {
    const set = new Set<string>();
    businesses.forEach((b) => {
      if (b.industry) set.add(b.industry);
    });
    return Array.from(set);
  }, [businesses]);

  const filteredBusinesses = useMemo(() => {
    return businesses.filter((b) => {
      if (industryFilter !== "all" && b.industry !== industryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (b.name || "").toLowerCase().includes(q);
        const indMatch = (b.industry || "").toLowerCase().includes(q);
        const locMatch = (b.location || "").toLowerCase().includes(q);
        if (!nameMatch && !indMatch && !locMatch) return false;
      }
      return true;
    });
  }, [businesses, industryFilter, searchQuery]);

  return (
    <div className="flex min-h-screen bg-[#030712] text-slate-100">
      <Sidebar active="MSME Businesses" />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title="MSME Businesses"
          subtitle="Platform-wide registered enterprise and business accounts."
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "MSME Businesses" },
          ]}
        />

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Controls Bar: Search & Industry Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b]">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by business name, industry, location..."
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

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 hidden sm:inline">Industry:</span>
                <select
                  value={industryFilter}
                  onChange={(e) => setIndustryFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#0d1c33] border border-[#1d3559] text-xs font-semibold text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">All Industries ({businesses.length})</option>
                  {industries.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={loadBusinesses}
                className="p-2 rounded-xl bg-[#0d1c33] border border-[#1d3559] text-slate-300 hover:text-white hover:bg-slate-800 transition shrink-0"
                title="Refresh business list"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Business Table or Loading/Empty States */}
          {loading ? (
            <div className="py-20 flex justify-center">
              <LoadingSpinner text="Retrieving platform businesses..." />
            </div>
          ) : error ? (
            <EmptyState
              title="Unable to load businesses"
              description={error}
              actionLabel="Retry"
              onAction={loadBusinesses}
            />
          ) : filteredBusinesses.length === 0 ? (
            <EmptyState
              title="No businesses found"
              description="No registered MSME businesses match your search parameters."
              actionLabel="Clear Filters"
              onAction={() => {
                setSearchQuery("");
                setIndustryFilter("all");
              }}
            />
          ) : (
            <div className="rounded-2xl bg-[#081120] border border-[#1a2d4b] overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-[#0c182b] text-[11px] uppercase tracking-wider text-slate-400 border-b border-[#1a2d4b]">
                    <tr>
                      <th className="py-3 px-4">Business Name</th>
                      <th className="py-3 px-4">Industry</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4">Operating Age</th>
                      <th className="py-3 px-4">Employees</th>
                      <th className="py-3 px-4">Created Date</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#162742]">
                    {filteredBusinesses.map((b) => (
                      <tr
                        key={b.id}
                        className="hover:bg-slate-800/25 transition cursor-pointer"
                        onClick={() => handleInspectBusiness(b.id)}
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0">
                              {(b.name || "B").slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-white truncate hover:text-cyan-300 transition">
                                {b.name}
                              </div>
                              <div className="text-[11px] text-slate-400">ID #{b.id}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 font-medium text-slate-200">
                            {b.industry || "General"}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{b.location || "Not specified"}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-300">
                          {b.age !== undefined && b.age !== null ? `${b.age} years` : "—"}
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-300">
                          {b.employees ? `${b.employees} team` : "—"}
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-400">
                          {b.created_at ? new Date(b.created_at).toLocaleDateString() : "—"}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInspectBusiness(b.id);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#0d1c33] text-cyan-300 hover:text-white hover:bg-cyan-600/30 border border-[#1d3559] transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="p-3.5 bg-[#0c182b] border-t border-[#1a2d4b] text-xs text-slate-400 flex items-center justify-between">
                <span>Showing {filteredBusinesses.length} of {businesses.length} MSMEs</span>
                <span className="text-slate-400">Click any business to inspect portfolio telemetry</span>
              </div>
            </div>
          )}

          {/* Business Inspection Drawer / Modal */}
          {selectedId !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
              <div className="relative w-full max-w-3xl bg-[#081120] border border-[#1e3458] rounded-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
                <div className="flex items-center justify-between pb-4 border-b border-[#1a2d4b] sticky top-0 bg-[#081120] z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold text-sm">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">
                        {businessDetail?.name || `Business #${selectedId}`}
                      </h3>
                      <p className="text-xs text-slate-400">
                        MSME Profile & Risk Telemetry Inspection (Read-Only)
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedId(null);
                      setBusinessDetail(null);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {detailLoading ? (
                  <div className="py-20 flex justify-center">
                    <LoadingSpinner text="Retrieving business assessment details..." />
                  </div>
                ) : businessDetail ? (
                  <div className="mt-5 space-y-6">
                    {/* General Information Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-[#0c182b] border border-[#1a2d4b] text-xs">
                      <div>
                        <span className="text-slate-400 block mb-0.5">Industry Sector</span>
                        <strong className="text-white text-sm">{businessDetail.industry || "—"}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Location</span>
                        <strong className="text-white text-sm">{businessDetail.location || "—"}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Operating Age</span>
                        <strong className="text-white text-sm">
                          {businessDetail.age ? `${businessDetail.age} Years` : "—"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Team Size</span>
                        <strong className="text-white text-sm">
                          {businessDetail.employees ? `${businessDetail.employees} employees` : "—"}
                        </strong>
                      </div>
                    </div>

                    {/* Associated Assessments */}
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <FileCheck className="w-4 h-4 text-purple-400" />
                          Risk Assessments ({businessDetail.assessments?.length || 0})
                        </h4>
                      </div>

                      {(!businessDetail.assessments || businessDetail.assessments.length === 0) ? (
                        <div className="p-4 rounded-xl bg-[#0d1c33] border border-[#1a2d4b] text-xs text-slate-400 text-center">
                          No assessment runs have been recorded for this MSME yet.
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-800 border border-[#1a2d4b] rounded-xl overflow-hidden bg-[#0a1526]">
                          {businessDetail.assessments.map((a: any) => (
                            <div key={a.id} className="p-3 text-xs flex items-center justify-between">
                              <div>
                                <span className="font-semibold text-white">Assessment #{a.id}</span>
                                <span className="text-slate-400 block text-[11px]">
                                  Revenue: ₹{a.annual_revenue?.toLocaleString() || "—"} • Cash Flow: ₹{a.monthly_cash_flow?.toLocaleString() || "—"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                    a.review_status === "approved"
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                      : a.review_status === "rejected"
                                      ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                      : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                  }`}
                                >
                                  {a.review_status || "Pending"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Associated Financial Documents */}
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-cyan-400" />
                          Financial Documents ({businessDetail.documents?.length || 0})
                        </h4>
                      </div>

                      {(!businessDetail.documents || businessDetail.documents.length === 0) ? (
                        <div className="p-4 rounded-xl bg-[#0d1c33] border border-[#1a2d4b] text-xs text-slate-400 text-center">
                          No documents uploaded for this business.
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-800 border border-[#1a2d4b] rounded-xl overflow-hidden bg-[#0a1526]">
                          {businessDetail.documents.map((d: any) => (
                            <div key={d.id} className="p-3 text-xs flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-cyan-400" />
                                <div>
                                  <span className="font-semibold text-white truncate max-w-xs block">
                                    {d.original_filename || d.filename}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    Type: {d.document_type || "OTHER"} • Status: {d.status}
                                  </span>
                                </div>
                              </div>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                Protected
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="mt-6 pt-4 border-t border-[#1a2d4b] flex justify-end">
                  <button
                    onClick={() => {
                      setSelectedId(null);
                      setBusinessDetail(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 transition"
                  >
                    Close Inspection
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
