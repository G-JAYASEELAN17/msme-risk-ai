import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  LayoutDashboard,
  PlusCircle,
  Building2,
  FileSpreadsheet,
  FileUp,
  Settings,
  Scale,
  LogOut,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../services/firebase";
import { api } from "../services/api";

export default function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setSearchResults(null);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const data = await api.search(query.trim());
        setSearchResults(data);
      } catch {
        //
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const quickNav = [
    { label: "Executive Dashboard", icon: LayoutDashboard, path: "/dashboard", desc: "Portfolio analytics & trends" },
    { label: "New Risk Assessment", icon: PlusCircle, path: "/assessment", desc: "Evaluate MSME credit risk" },
    { label: "Business Profiles", icon: Building2, path: "/businesses", desc: "Manage borrower entities" },
    { label: "Financial Documents", icon: FileUp, path: "/documents", desc: "Upload statements & OCR" },
    { label: "Reports & Audit Logs", icon: FileSpreadsheet, path: "/reports", desc: "Export PDF & CSV memos" },
    { label: "Account & Settings", icon: Settings, path: "/settings", desc: "Configure rules & preferences" },
  ];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 sm:p-6 animate-in fade-in duration-150">
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-xl rounded-2xl bg-[#0b1629] border border-[#203a60] shadow-2xl shadow-black/90 overflow-hidden z-10 animate-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#182d4d] bg-[#081222]">
          <Search className="w-5 h-5 text-cyan-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command, business name, or search keyword..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <span className="text-[10px] font-mono text-slate-500 bg-[#0f1d33] px-2 py-0.5 rounded border border-slate-700">
            ESC
          </span>
        </div>

        {/* Results / Navigation Body */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-4">
          {/* Search Results if any */}
          {searchResults && (
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 px-2 block">
                Search Results ({searchResults.businesses.length + searchResults.assessments.length})
              </span>

              {searchResults.businesses.map((b: any) => (
                <button
                  key={b.id}
                  onClick={() => {
                    setOpen(false);
                    navigate(`/businesses?id=${b.id}`);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#122544] text-left transition-colors text-xs text-slate-200 group"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div>
                      <p className="font-semibold text-white">{b.name}</p>
                      <p className="text-[11px] text-slate-400">{b.industry} • {b.location}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-cyan-400 transition-opacity" />
                </button>
              ))}

              {searchResults.assessments.map((a: any) => (
                <button
                  key={a.id}
                  onClick={() => {
                    setOpen(false);
                    navigate(`/reports?id=${a.id}`);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#122544] text-left transition-colors text-xs text-slate-200 group"
                >
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <p className="font-semibold text-white">{a.business_name} (MSME-{a.id}24)</p>
                      <p className="text-[11px] text-slate-400">Risk: {a.risk_level} ({a.default_probability.toFixed(1)}%)</p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-cyan-400 transition-opacity" />
                </button>
              ))}

              {searchResults.businesses.length === 0 && searchResults.assessments.length === 0 && (
                <p className="text-xs text-slate-400 px-2 py-3 text-center">
                  No records matching "{query}".
                </p>
              )}
            </div>
          )}

          {/* Quick Navigation Commands */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block mb-1">
              Quick Navigation
            </span>
            {quickNav.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => {
                    setOpen(false);
                    navigate(item.path);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#122544] text-left transition-colors text-xs text-slate-200 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-[#0e1e36] text-cyan-400 flex items-center justify-center border border-[#1b3356]">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{item.label}</p>
                      <p className="text-[10px] text-slate-400">{item.desc}</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono group-hover:text-cyan-400">
                    Jump ↵
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#182d4d] bg-[#070f1d] text-[11px] text-slate-400">
          <span>Use <b>↑ ↓</b> to navigate</span>
          <span>Press <b>ESC</b> to close</span>
        </div>
      </div>
    </div>
  );
}
