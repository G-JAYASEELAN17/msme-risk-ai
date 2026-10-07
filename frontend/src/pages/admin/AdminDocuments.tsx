import { useEffect, useState, useCallback, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import AdminHeader from "./AdminHeader";
import {
  FileText,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck,
  HardDrive,
  RefreshCw,
  X,
  Building2,
  Calendar,
  Lock,
} from "lucide-react";
import { api, DocumentItem } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/ui/EmptyState";

export default function AdminDocuments() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // For Admin/Analyst, api.getDocuments() returns platform documents
      const res = await api.getDocuments();
      setDocuments(res || []);
    } catch (err: any) {
      console.error("Failed to load documents:", err);
      setError(err?.message || "Failed to load document records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Derived KPIs
  const total = documents.length;
  const verified = documents.filter(
    (d) => d.status === "verified" || (d.verified_count && d.verified_count > 0)
  ).length;
  const processing = documents.filter(
    (d) => (d.processing_status || "").toUpperCase() === "PROCESSING"
  ).length;
  const failed = documents.filter(
    (d) =>
      (d.processing_status || "").toUpperCase() === "FAILED" ||
      (d.status || "").toLowerCase() === "failed"
  ).length;
  const needsReview = Math.max(0, total - (verified + processing + failed));

  const filteredDocs = useMemo(() => {
    return documents.filter((d) => {
      if (statusFilter !== "all") {
        const s = (d.processing_status || d.status || "").toLowerCase();
        if (statusFilter === "verified" && d.status !== "verified") return false;
        if (statusFilter === "processing" && s !== "processing") return false;
        if (statusFilter === "failed" && s !== "failed") return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (d.original_filename || d.filename || "").toLowerCase().includes(q);
        const bizMatch = (d.business_name || "").toLowerCase().includes(q);
        const typeMatch = (d.document_type || "").toLowerCase().includes(q);
        if (!nameMatch && !bizMatch && !typeMatch) return false;
      }
      return true;
    });
  }, [documents, statusFilter, searchQuery]);

  return (
    <div className="flex min-h-screen bg-[#030712] text-slate-100">
      <Sidebar active="Documents" />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title="Document Management"
          subtitle="Platform-level OCR ingestion, extraction health, and statement storage."
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Documents" },
          ]}
        />

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Section 16: Document Health KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b] shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">Total Documents</span>
                <FileText className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-bold text-white">{total}</div>
              <div className="text-[11px] text-slate-400 mt-1">Uploaded Statements</div>
            </div>

            <div className="p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b] shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">Verified</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400">{verified}</div>
              <div className="text-[11px] text-slate-400 mt-1">Fields Reconciled</div>
            </div>

            <div className="p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b] shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">Processing</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-400">{processing}</div>
              <div className="text-[11px] text-slate-400 mt-1">Active Pipeline</div>
            </div>

            <div className="p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b] shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">Needs Review</span>
                <FileCheck className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-purple-300">{needsReview}</div>
              <div className="text-[11px] text-slate-400 mt-1">Pending Sign-off</div>
            </div>

            <div className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b] shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">Failed / Corrupt</span>
                <AlertCircle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-bold text-rose-400">{failed}</div>
              <div className="text-[11px] text-slate-400 mt-1">OCR Parser Errors</div>
            </div>
          </div>

          {/* Controls Bar: Search & Status Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b]">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by filename, business, or document type..."
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
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[#0d1c33] border border-[#1d3559] text-xs font-semibold text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">All Statuses</option>
                <option value="verified">Verified</option>
                <option value="processing">Processing</option>
                <option value="failed">Failed</option>
              </select>

              <button
                onClick={loadDocuments}
                className="p-2 rounded-xl bg-[#0d1c33] border border-[#1d3559] text-slate-300 hover:text-white hover:bg-slate-800 transition shrink-0"
                title="Refresh document records"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Documents Table */}
          {loading ? (
            <div className="py-20 flex justify-center">
              <LoadingSpinner text="Retrieving platform document inventory..." />
            </div>
          ) : error ? (
            <EmptyState
              title="Failed to load documents"
              description={error}
              actionLabel="Retry"
              onAction={loadDocuments}
            />
          ) : filteredDocs.length === 0 ? (
            <EmptyState
              title="No documents found"
              description="No document records match your current filter parameters."
              actionLabel="Clear Filters"
              onAction={() => {
                setSearchQuery("");
                setStatusFilter("all");
              }}
            />
          ) : (
            <div className="rounded-2xl bg-[#081120] border border-[#1a2d4b] overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-[#0c182b] text-[11px] uppercase tracking-wider text-slate-400 border-b border-[#1a2d4b]">
                    <tr>
                      <th className="py-3 px-4">Document</th>
                      <th className="py-3 px-4">Business</th>
                      <th className="py-3 px-4">Document Type</th>
                      <th className="py-3 px-4">OCR Provider</th>
                      <th className="py-3 px-4">Processing Status</th>
                      <th className="py-3 px-4">Size</th>
                      <th className="py-3 px-4 text-right">Upload Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#162742]">
                    {filteredDocs.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-800/25 transition">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                            <div className="min-w-0">
                              <span className="font-semibold text-white truncate max-w-xs block">
                                {d.original_filename || d.filename}
                              </span>
                              <span className="text-[10px] text-slate-400">ID #{d.id}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-xs font-medium text-slate-300">
                          {d.business_name || `Business #${d.business_id || "—"}`}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-medium">
                            {d.document_type || "OTHER"}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-400">
                          Google DocumentAI / Fallback
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase border ${
                              (d.processing_status || d.status || "").toLowerCase() === "completed" ||
                              (d.processing_status || d.status || "").toLowerCase() === "verified"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : (d.processing_status || d.status || "").toLowerCase() === "failed"
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                (d.processing_status || d.status || "").toLowerCase() === "completed" ||
                                (d.processing_status || d.status || "").toLowerCase() === "verified"
                                  ? "bg-emerald-400"
                                  : (d.processing_status || d.status || "").toLowerCase() === "failed"
                                  ? "bg-rose-400"
                                  : "bg-amber-400"
                              }`}
                            />
                            {d.processing_status || d.status || "Uploaded"}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-400">
                          {d.file_size ? `${Math.round(d.file_size / 1024)} KB` : "—"}
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-400 text-right">
                          {d.created_at ? new Date(d.created_at).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="p-3.5 bg-[#0c182b] border-t border-[#1a2d4b] text-xs text-slate-400 flex items-center justify-between">
                <span>Showing {filteredDocs.length} of {documents.length} documents</span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Lock className="w-3.5 h-3.5 text-cyan-400" />
                  Preserving signed URL isolation & tenant security
                </span>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
